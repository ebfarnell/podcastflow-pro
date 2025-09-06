import { NextRequest, NextResponse } from 'next/server'
import { creativeService } from '@/services/creative-service'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { withApiProtection } from '@/lib/api-protection'
import { getUserOrgSlug, querySchema, safeQuerySchema } from '@/lib/db/schema-db'
import { UserService } from '@/lib/auth/user-service'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


// List creatives with filtering
async function handleGET(request: NextRequest) {
  const authToken = request.cookies.get('auth-token')
  if (!authToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await UserService.validateSession(authToken.value)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit
    const campaignId = searchParams.get('campaignId')
    const status = searchParams.get('status') || 'active'
    const includePerformance = searchParams.get('includePerformance') === 'true'
    const includeApprovals = searchParams.get('includeApprovals') === 'true'
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    
    // Build query for AdCreative table in organization schema
    let whereClause = 'WHERE 1=1'
    const params: any[] = []
    
    if (campaignId) {
      params.push(campaignId)
      whereClause += ` AND "campaignId" = $${params.length}`
    }
    
    if (status) {
      params.push(status)
      whereClause += ` AND ac.status = $${params.length}`
    }
    
    // Query for creatives
    const query = `
      SELECT 
        ac.*,
        c.name as campaign_name,
        a.name as advertiser_name
      FROM "AdCreative" ac
      LEFT JOIN "Campaign" c ON c.id = ac."campaignId"
      LEFT JOIN "Advertiser" a ON a.id = c."advertiserId"
      ${whereClause}
      ORDER BY ac."createdAt" DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `
    params.push(limit, offset)
    
    const creatives = await querySchema<any>(orgSlug, query, params)
    
    // Get total count
    const countQuery = `
      SELECT COUNT(*) as count 
      FROM "AdCreative" ac
      LEFT JOIN "Campaign" c ON c.id = ac."campaignId"
      ${whereClause}
    `
    const countResult = await querySchema<any>(orgSlug, countQuery, params.slice(0, -2))
    const total = parseInt(countResult[0]?.count || '0')
    
    // Get performance metrics if requested
    let performanceMap: Record<string, any> = {}
    if (includePerformance && creatives.length > 0) {
      const creativeIds = creatives.map(c => c.id)
      const perfQuery = `
        SELECT 
          "creativeId",
          COUNT(*) as "totalDeliveries",
          COUNT(DISTINCT "episodeId") as "uniqueEpisodes",
          COUNT(DISTINCT "showId") as "uniqueShows",
          AVG("performanceScore") as "avgPerformance",
          SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as "successfulDeliveries"
        FROM "CreativeDelivery"
        WHERE "creativeId" = ANY($1::uuid[])
        ${dateFrom ? `AND "deliveredAt" >= $2` : ''}
        ${dateTo ? `AND "deliveredAt" <= $${dateFrom ? 3 : 2}` : ''}
        GROUP BY "creativeId"
      `
      const perfParams: any[] = [creativeIds]
      if (dateFrom) perfParams.push(new Date(dateFrom))
      if (dateTo) perfParams.push(new Date(dateTo))
      
      const { data: perfData } = await safeQuerySchema(orgSlug, perfQuery, perfParams)
      if (perfData) {
        perfData.forEach(p => {
          performanceMap[p.creativeId] = {
            totalDeliveries: parseInt(p.totalDeliveries),
            uniqueEpisodes: parseInt(p.uniqueEpisodes),
            uniqueShows: parseInt(p.uniqueShows),
            avgPerformance: parseFloat(p.avgPerformance || 0),
            successfulDeliveries: parseInt(p.successfulDeliveries),
            deliveryRate: p.totalDeliveries > 0 ? (parseInt(p.successfulDeliveries) / parseInt(p.totalDeliveries)) : 0
          }
        })
      }
    }

    // Get approval data if requested
    let approvalsMap: Record<string, any> = {}
    if (includeApprovals && creatives.length > 0) {
      const creativeIds = creatives.map(c => c.id)
      const approvalQuery = `
        SELECT 
          "creativeId",
          COUNT(*) as "totalApprovals",
          COUNT(CASE WHEN status = 'approved' THEN 1 END) as "approved",
          COUNT(CASE WHEN status = 'rejected' THEN 1 END) as "rejected",
          COUNT(CASE WHEN status IN ('pending', 'submitted') THEN 1 END) as "pending",
          MAX("updatedAt") as "lastActivityDate"
        FROM "AdApproval"
        WHERE "creativeId" = ANY($1::uuid[])
        GROUP BY "creativeId"
      `
      
      const { data: approvalData } = await safeQuerySchema(orgSlug, approvalQuery, [creativeIds])
      if (approvalData) {
        approvalData.forEach(a => {
          approvalsMap[a.creativeId] = {
            totalApprovals: parseInt(a.totalApprovals),
            approved: parseInt(a.approved),
            rejected: parseInt(a.rejected),
            pending: parseInt(a.pending),
            lastActivityDate: a.lastActivityDate,
            approvalRate: a.totalApprovals > 0 ? (parseInt(a.approved) / parseInt(a.totalApprovals)) : 0
          }
        })
      }
    }

    // Transform results to match expected format
    const transformedCreatives = creatives.map(creative => {
      const result: any = {
        id: creative.id,
        name: creative.name || 'Untitled Creative',
        type: creative.type || 'host-read',
        format: creative.format || 'audio',
        duration: creative.duration || 30,
        status: creative.status,
        script: creative.script,
        talkingPoints: creative.talkingPoints,
        campaignId: creative.campaignId,
        campaignName: creative.campaign_name,
        advertiserName: creative.advertiser_name,
        createdAt: creative.createdAt,
        updatedAt: creative.updatedAt
      }

      // Add optional data
      if (includePerformance) {
        result.performance = performanceMap[creative.id] || {
          totalDeliveries: 0,
          uniqueEpisodes: 0,
          uniqueShows: 0,
          avgPerformance: 0,
          successfulDeliveries: 0,
          deliveryRate: 0
        }
      }

      if (includeApprovals) {
        result.approvals = approvalsMap[creative.id] || {
          totalApprovals: 0,
          approved: 0,
          rejected: 0,
          pending: 0,
          lastActivityDate: null,
          approvalRate: 0
        }
      }

      return result
    })

    return NextResponse.json({
      creatives: transformedCreatives,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    })
  } catch (error) {
    console.error('Error fetching creatives:', error)
    return NextResponse.json(
      { error: 'Failed to fetch creatives' },
      { status: 500 }
    )
  }
}

// Create a new creative
async function handlePOST(request: NextRequest) {
  const authToken = request.cookies.get('auth-token')
  if (!authToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await UserService.validateSession(authToken.value)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const body = await request.json()
    
    // Validate required fields
    if (!body.name || !body.type || !body.format || body.duration === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: name, type, format, duration' },
        { status: 400 }
      )
    }

    // Generate ID
    const creativeId = `cre_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // Insert creative into AdCreative table
    const insertQuery = `
      INSERT INTO "AdCreative" (
        id, "campaignId", "organizationId", name, type, format, 
        duration, script, "talkingPoints", status, "createdBy", 
        "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW()
      )
      RETURNING *
    `
    
    const params = [
      creativeId,
      body.campaignId || null,
      user.organizationId,
      body.name,
      body.type,
      body.format,
      body.duration,
      body.script || null,
      body.talkingPoints ? JSON.stringify(body.talkingPoints) : null,
      body.status || 'draft',
      user.id
    ]
    
    const result = await querySchema<any>(orgSlug, insertQuery, params)
    const creative = result[0]

    return NextResponse.json({
      id: creative.id,
      name: creative.name,
      type: creative.type,
      format: creative.format,
      duration: creative.duration,
      status: creative.status,
      script: creative.script,
      talkingPoints: creative.talkingPoints,
      campaignId: creative.campaignId,
      createdAt: creative.createdAt,
      updatedAt: creative.updatedAt
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating creative:', error)
    return NextResponse.json(
      { error: 'Failed to create creative' },
      { status: 500 }
    )
  }
}

// Export using direct function approach for production build compatibility
export async function GET(request: NextRequest) {
  return handleGET(request)
}

export async function POST(request: NextRequest) {
  return handlePOST(request)
}
