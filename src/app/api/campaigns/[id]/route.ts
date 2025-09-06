import { NextRequest, NextResponse } from 'next/server'
import { withApiProtection, AuthenticatedRequest } from '@/lib/auth/api-protection'
import { PERMISSIONS } from '@/types/auth'
import { UserService } from '@/lib/auth/user-service'
import prisma from '@/lib/db/prisma'
import { getCampaignMetrics } from '@/lib/analytics/campaign-analytics'
import { notificationService } from '@/lib/notifications/notification-service'
import { getUserOrgSlug, querySchema } from '@/lib/db/schema-db'
import { accessLogger } from '@/lib/security/access-logger'
import { CampaignWorkflowService } from '@/lib/workflow/campaign-workflow-service'
import { competitiveCategoryService } from '@/lib/services/competitive-category-service'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'

// import { CampaignStatus } from '@prisma/client' // Use string literals instead

async function getHandler(
  request: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await async params in Next.js 14.1.0
    const { id } = await params
    
    // Validate session
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // CRITICAL SECURITY FIX: Use schema-aware queries for multi-tenant data
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }
    
    // Check if master is accessing cross-org data
    if (user.role === 'master' && user.organizationId !== orgSlug) {
      await accessLogger.logMasterCrossOrgAccess(
        user.id,
        user.organizationId!,
        orgSlug,
        'GET',
        `/api/campaigns/${id}`,
        request as NextRequest
      )
    }

    // Fetch campaign with advertiser and agency using schema-aware query
    const campaignQuery = `
      SELECT 
        c.*,
        a.id as advertiser_id, a.name as advertiser_name,
        ag.id as agency_id, ag.name as agency_name
      FROM "Campaign" c
      LEFT JOIN "Advertiser" a ON a.id = c."advertiserId"
      LEFT JOIN "Agency" ag ON ag.id = c."agencyId"
      WHERE c.id = $1
    `
    const campaignsRaw = await querySchema<any>(orgSlug, campaignQuery, [id])
    
    if (!campaignsRaw || campaignsRaw.length === 0) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }
    
    const campaignRaw = campaignsRaw[0]
    
    // Fetch ad approvals with shows
    const adApprovalsQuery = `
      SELECT 
        aa.*,
        s.id as show_id, s.name as show_name
      FROM "AdApproval" aa
      LEFT JOIN "Show" s ON s.id = aa."showId"
      WHERE aa."campaignId" = $1
    `
    const adApprovalsRaw = await querySchema<any>(orgSlug, adApprovalsQuery, [id])
    
    // Fetch spot submissions for each ad approval
    const adApprovals = await Promise.all(adApprovalsRaw.map(async (aa) => {
      const submissionsQuery = `
        SELECT * FROM "SpotSubmission"
        WHERE "adApprovalId" = $1
      `
      const submissions = await querySchema<any>(orgSlug, submissionsQuery, [aa.id])
      
      return {
        ...aa,
        show: {
          id: aa.show_id,
          name: aa.show_name
        },
        spotSubmissions: submissions
      }
    }))
    
    const campaign = {
      ...campaignRaw,
      advertiser: campaignRaw.advertiser_id ? {
        id: campaignRaw.advertiser_id,
        name: campaignRaw.advertiser_name
      } : null,
      agency: campaignRaw.agency_name || null,
      agencyId: campaignRaw.agency_id || null,
      adApprovals,
      _count: {
        adApprovals: adApprovals.length
      }
    }

    // Get real analytics metrics
    const metrics = await getCampaignMetrics(campaign.id, orgSlug)
    
    // Transform for compatibility with real analytics data
    const transformedCampaign = {
      id: campaign.id,
      campaignId: campaign.id,
      name: campaign.name,
      client: campaign.advertiser?.name || '',
      advertiser: campaign.advertiser?.name || '',
      advertiserId: campaign.advertiserId,
      advertiserName: campaign.advertiser?.name || '',
      agency: campaign.agency || '',
      agencyId: campaign.agencyId || null,
      description: campaign.description || '',
      startDate: campaign.startDate.toISOString(),
      endDate: campaign.endDate.toISOString(),
      budget: campaign.budget || 0,
      targetImpressions: campaign.targetImpressions || 0,
      industry: campaign.industry || '',
      targetAudience: campaign.targetAudience || '',
      spent: metrics.spent,
      status: campaign.status,
      probability: campaign.probability !== undefined ? campaign.probability : 10,
      impressions: metrics.impressions,
      clicks: metrics.clicks,
      conversions: metrics.conversions,
      ctr: metrics.ctr,
      conversionRate: metrics.conversionRate,
      cpc: metrics.cpc,
      cpa: metrics.cpa,
      adCount: campaign._count.adApprovals,
      ads: campaign.adApprovals.map(ad => ({
        id: ad.id,
        title: ad.title,
        showName: ad.show.name,
        status: ad.status,
        submissionCount: ad.spotSubmissions.length,
      })),
      createdAt: campaign.createdAt.toISOString(),
      updatedAt: campaign.updatedAt.toISOString(),
    }

    return NextResponse.json({
      success: true,
      campaign: transformedCampaign
    })
  } catch (error) {
    console.error('❌ Campaign API Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch campaign' },
      { status: 500 }
    )
  }
}

async function putHandler(
  request: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await async params in Next.js 14.1.0
    const { id } = await params
    
    // Validate session
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only sales, admin, and master can update campaigns
    if (!['sales', 'admin', 'master'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { 
      name, 
      client,
      agency,
      description,
      startDate, 
      endDate, 
      budget, 
      targetImpressions,
      status, 
      probability,
      industry,
      targetAudience
    } = body

    // Validate probability if provided (0 is allowed for lost campaigns)
    if (probability !== undefined && ![0, 10, 35, 65, 90, 100].includes(probability)) {
      return NextResponse.json(
        { error: 'Probability must be one of: 0, 10, 35, 65, 90, 100' },
        { status: 400 }
      )
    }

    // CRITICAL SECURITY FIX: Use schema-aware queries for multi-tenant data
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Check if campaign exists in organization schema
    const existingQuery = `SELECT * FROM "Campaign" WHERE id = $1`
    const existingCampaigns = await querySchema(orgSlug, existingQuery, [id])
    
    if (!existingCampaigns || existingCampaigns.length === 0) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }
    
    const existing = existingCampaigns[0]

    // Check if status is changing for notifications
    const statusChanged = status && status !== existing.status
    const previousStatus = existing.status

    // Update campaign using schema-aware query
    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (startDate !== undefined) updateData.startDate = new Date(startDate)
    if (endDate !== undefined) updateData.endDate = new Date(endDate)
    if (budget !== undefined) updateData.budget = budget
    if (targetImpressions !== undefined) updateData.targetImpressions = targetImpressions
    if (industry !== undefined) updateData.industry = industry
    if (targetAudience !== undefined) updateData.targetAudience = targetAudience
    
    // Handle client/advertiser - need to look up the advertiser ID
    if (client !== undefined) {
      // First check if an advertiser with this name exists
      const advertiserQuery = `SELECT id FROM "Advertiser" WHERE name = $1`
      const advertisers = await querySchema(orgSlug, advertiserQuery, [client])
      if (advertisers && advertisers.length > 0) {
        updateData.advertiserId = advertisers[0].id
      }
    }
    
    // Handle agency - need to look up the agency ID
    if (agency !== undefined && agency !== '') {
      const agencyQuery = `SELECT id FROM "Agency" WHERE name = $1`
      const agencies = await querySchema(orgSlug, agencyQuery, [agency])
      if (agencies && agencies.length > 0) {
        updateData.agencyId = agencies[0].id
      } else {
        updateData.agencyId = null
      }
    }
    
    if (status !== undefined) {
      updateData.status = status
      // When marking as Lost, set probability to 0%
      if (status === 'lost') {
        updateData.probability = 0
      }
    }
    if (probability !== undefined) updateData.probability = probability
    updateData.updatedBy = user.id
    updateData.updatedAt = new Date()
    
    console.log('📝 Update data:', updateData)
    console.log('📝 Campaign ID:', id)
    console.log('📝 Org slug:', orgSlug)
    
    // Check for competitive conflicts if dates or advertiser changed
    const datesChanged = (startDate !== undefined && startDate !== existing.startDate) ||
                        (endDate !== undefined && endDate !== existing.endDate)
    const advertiserChanged = updateData.advertiserId && updateData.advertiserId !== existing.advertiserId
    
    if (datesChanged || advertiserChanged) {
      const checkAdvertiserId = updateData.advertiserId || existing.advertiserId
      const checkStartDate = updateData.startDate || existing.startDate
      const checkEndDate = updateData.endDate || existing.endDate
      
      const conflicts = await competitiveCategoryService.checkCompetitiveConflicts(
        orgSlug,
        id,
        checkAdvertiserId,
        checkStartDate,
        checkEndDate,
        id // Exclude current campaign
      )
      
      if (conflicts.length > 0) {
        const { canProceed, blockedBy, warnings } = competitiveCategoryService.canProceedWithConflicts(conflicts)
        
        // Store conflicts on campaign
        await competitiveCategoryService.storeConflicts(orgSlug, id, conflicts)
        
        if (!canProceed && !existing.conflictOverride) {
          // Check if user is admin/master who can override
          if (['admin', 'master'].includes(user.role)) {
            console.warn('⚠️ Competitive conflicts detected but admin/master can override')
          } else {
            return NextResponse.json({
              error: 'Campaign blocked by competitive conflicts',
              conflicts: blockedBy.map(c => ({
                group: c.competitiveGroupName,
                conflictingCampaigns: c.conflictingCampaigns.map(camp => camp.name)
              }))
            }, { status: 409 })
          }
        }
        
        if (warnings.length > 0) {
          console.log(`⚠️ Competitive warnings for campaign ${id}:`, warnings.length)
        }
      }
    }
    
    // Check if probability is changing
    const probabilityChanging = probability !== undefined && probability !== existing.probability
    
    if (probabilityChanging) {
      console.log(`🔄 Probability changing from ${existing.probability}% to ${probability}%`)
      
      // Trigger workflow for probability transitions (65% and 90%)
      if ((probability === 65 || probability === 90) && existing.probability < probability) {
        try {
          console.log(`🚀 Triggering ${probability}% automation workflow...`)
          const workflowService = new CampaignWorkflowService()
          await workflowService.handleCampaignStatusUpdate(
            {
              campaignId: id,
              organizationId: user.organizationId!,
              organizationSlug: orgSlug,
              userId: user.id,
              userName: user.name || user.email,
              userRole: user.role
            },
            probability,
            status
          )
          console.log(`✅ ${probability}% automation workflow completed`)
        } catch (workflowError) {
          console.error('❌ Workflow error:', workflowError)
          // Don't fail the update if workflow fails - log and continue
          // This ensures the probability update still happens
        }
      }
    }
    
    // Always do regular update
    // Build update query
    const updateFields = Object.keys(updateData).map((key, index) => 
      `"${key}" = $${index + 2}`
    ).join(', ')
    
    const updateQuery = `
      UPDATE "Campaign"
      SET ${updateFields}
      WHERE id = $1
      RETURNING *
    `
    const updateParams = [id, ...Object.values(updateData)]
    const updateResult = await querySchema<any>(orgSlug, updateQuery, updateParams)
    
    if (!updateResult || updateResult.length === 0) {
      throw new Error('Failed to update campaign')
    }
    
    // Use the returned campaign from UPDATE
    const campaignUpdated = updateResult[0]
    
    // Fetch related data for response
    const advertiserQuery = `SELECT * FROM "Advertiser" WHERE id = $1`
    const advertisers = await querySchema<any>(orgSlug, advertiserQuery, [campaignUpdated.advertiserId])
    
    const campaign = {
      ...campaignUpdated,
      advertiser: advertisers[0] || null,
      creator: { id: campaignUpdated.createdBy },
      updater: { id: campaignUpdated.updatedBy }
    }

    // Send notifications if status changed
    if (statusChanged) {
      try {
        // Get relevant users to notify (campaign team, stakeholders)
        const teamUsers = await prisma.user.findMany({
          where: {
            organizationId: user.organizationId,
            role: { in: ['admin', 'sales', 'producer'] }
          },
          select: { id: true }
        })

        await notificationService.notifyCampaignStatusChange(
          teamUsers.map(u => u.id),
          campaign,
          previousStatus,
          campaign.status,
          user.name || user.email,
          `Campaign status updated from ${previousStatus} to ${campaign.status}`,
          true // Send email for important status changes
        )
        console.log('📧 Campaign status change notifications sent')
      } catch (notificationError) {
        console.error('❌ Failed to send campaign notifications:', notificationError)
        // Don't fail update if notification fails
      }
    }

    console.log(`✅ Campaign updated: ${campaign.name}`)

    return NextResponse.json({
      success: true,
      campaign: {
        ...campaign,
        campaignId: campaign.id,
        advertiserName: campaign.advertiser.name,
      }
    })
  } catch (error) {
    console.error('❌ Campaign update error:', error)
    return NextResponse.json(
      { error: 'Failed to update campaign' },
      { status: 500 }
    )
  }
}

async function deleteHandler(
  request: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await async params in Next.js 14.1.0
    const { id } = await params
    
    // Validate session
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin and master can delete campaigns
    if (!['admin', 'master'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // CRITICAL SECURITY FIX: Use schema-aware queries for multi-tenant data
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Check if campaign exists in organization schema
    const existingQuery = `SELECT * FROM "Campaign" WHERE id = $1`
    const existingCampaigns = await querySchema(orgSlug, existingQuery, [id])
    
    if (!existingCampaigns || existingCampaigns.length === 0) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }

    // Set status to archived instead of hard delete using schema-aware query
    const archiveQuery = `
      UPDATE "Campaign"
      SET status = 'archived', "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = $1
    `
    await querySchema(orgSlug, archiveQuery, [id])

    console.log(`✅ Campaign archived: ${id}`)

    return NextResponse.json({
      success: true,
      message: 'Campaign archived successfully'
    })
  } catch (error) {
    console.error('❌ Campaign deletion error:', error)
    return NextResponse.json(
      { error: 'Failed to delete campaign' },
      { status: 500 }
    )
  }
}

// Use direct function export to fix production build issue
export const GET = async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const authToken = request.cookies.get('auth-token')
  if (!authToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  return getHandler(request as AuthenticatedRequest, context)
}

export const PUT = async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const authToken = request.cookies.get('auth-token')
  if (!authToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  return putHandler(request as AuthenticatedRequest, context)
}

export const DELETE = async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const authToken = request.cookies.get('auth-token')
  if (!authToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  return deleteHandler(request as AuthenticatedRequest, context)
}
