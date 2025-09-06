import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug, querySchema } from '@/lib/db/schema-db'
import { accessLogger } from '@/lib/security/access-logger'
import { z } from 'zod'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


const KPIUpdateSchema = z.object({
  kpiType: z.enum(['unique_web_visits', 'conversions', 'both']).optional(),
  goalCPA: z.number().positive().optional(),
  conversionValue: z.number().positive().optional(),
  targetVisits: z.number().int().positive().optional(),
  targetConversions: z.number().int().positive().optional(),
  actualVisits: z.number().int().min(0).optional(),
  actualConversions: z.number().int().min(0).optional(),
  clientCanUpdate: z.boolean().optional(),
  reminderFrequency: z.enum(['monthly', 'quarterly', 'biannually', 'annually', 'never']).optional(),
})

// PUT /api/campaigns/[id]/kpi/[kpiId] - Update campaign KPI
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; kpiId: string } }
) {
  try {
    // Validate session
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to manage campaigns
    if (!['admin', 'sales', 'master'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const campaignId = params.id
    const kpiId = params.kpiId
    const body = await request.json()

    // Validate input
    const validatedData = KPIUpdateSchema.parse(body)

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
        'PUT',
        `/api/campaigns/${campaignId}/kpi/${kpiId}`,
        request
      )
    }

    // Check if user has access to this campaign and KPI
    const existingQuery = `
      SELECT * FROM "CampaignKPI" 
      WHERE id = $1 AND "campaignId" = $2
    `
    const existingKPIs = await querySchema<any>(orgSlug, existingQuery, [kpiId, campaignId])
    
    if (!existingKPIs || existingKPIs.length === 0) {
      return NextResponse.json({ error: 'KPI not found' }, { status: 404 })
    }
    const existingKPI = existingKPIs[0]

    // Track changed fields
    const changedFields: string[] = []
    const oldValues: any = {}
    const newValues: any = {}

    Object.keys(validatedData).forEach(key => {
      const newValue = (validatedData as any)[key]
      const oldValue = (existingKPI as any)[key]
      
      if (newValue !== undefined && newValue !== oldValue) {
        changedFields.push(key)
        oldValues[key] = oldValue
        newValues[key] = newValue
      }
    })

    // Calculate next reminder date if frequency changed
    let nextReminderDate = existingKPI.nextReminderDate
    if (validatedData.reminderFrequency && validatedData.reminderFrequency !== existingKPI.reminderFrequency) {
      if (validatedData.reminderFrequency === 'never') {
        nextReminderDate = null
      } else if (validatedData.clientCanUpdate !== false) {
        const now = new Date()
        nextReminderDate = new Date(now)
        switch (validatedData.reminderFrequency) {
          case 'monthly':
            nextReminderDate.setMonth(now.getMonth() + 1)
            break
          case 'quarterly':
            nextReminderDate.setMonth(now.getMonth() + 3)
            break
          case 'biannually':
            nextReminderDate.setMonth(now.getMonth() + 6)
            break
          case 'annually':
            nextReminderDate.setFullYear(now.getFullYear() + 1)
            break
        }
      }
    }

    // Build update query dynamically
    const updateFields: string[] = []
    const updateParams: any[] = []
    let paramIndex = 1
    
    if (validatedData.kpiType !== undefined) {
      updateFields.push(`"kpiType" = $${paramIndex++}`)
      updateParams.push(validatedData.kpiType)
    }
    if (validatedData.goalCPA !== undefined) {
      updateFields.push(`"goalCPA" = $${paramIndex++}`)
      updateParams.push(validatedData.goalCPA)
    }
    if (validatedData.conversionValue !== undefined) {
      updateFields.push(`"conversionValue" = $${paramIndex++}`)
      updateParams.push(validatedData.conversionValue)
    }
    if (validatedData.targetVisits !== undefined) {
      updateFields.push(`"targetVisits" = $${paramIndex++}`)
      updateParams.push(validatedData.targetVisits)
    }
    if (validatedData.targetConversions !== undefined) {
      updateFields.push(`"targetConversions" = $${paramIndex++}`)
      updateParams.push(validatedData.targetConversions)
    }
    if (validatedData.actualVisits !== undefined) {
      updateFields.push(`"actualVisits" = $${paramIndex++}`)
      updateParams.push(validatedData.actualVisits)
    }
    if (validatedData.actualConversions !== undefined) {
      updateFields.push(`"actualConversions" = $${paramIndex++}`)
      updateParams.push(validatedData.actualConversions)
    }
    if (validatedData.clientCanUpdate !== undefined) {
      updateFields.push(`"clientCanUpdate" = $${paramIndex++}`)
      updateParams.push(validatedData.clientCanUpdate)
    }
    if (validatedData.reminderFrequency !== undefined) {
      updateFields.push(`"reminderFrequency" = $${paramIndex++}`)
      updateParams.push(validatedData.reminderFrequency)
    }
    
    updateFields.push(`"updatedBy" = $${paramIndex++}`)
    updateParams.push(user.id)
    updateFields.push(`"lastUpdated" = NOW()`)
    updateFields.push(`"updatedAt" = NOW()`)
    
    if (validatedData.clientCanUpdate !== false) {
      updateFields.push(`"nextReminderDate" = $${paramIndex++}`)
      updateParams.push(nextReminderDate)
    }
    
    updateParams.push(kpiId)
    
    const updateQuery = `
      UPDATE "CampaignKPI"
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `
    
    const updatedKPIs = await querySchema<any>(orgSlug, updateQuery, updateParams)
    const updatedKPI = updatedKPIs[0]

    // Create history entry if there were changes
    if (changedFields.length > 0) {
      const historyId = `kph_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const historyQuery = `
        INSERT INTO "KPIHistory" (
          id, "campaignKPIId", "changeType", "changedFields", 
          "oldValues", "newValues", "updatedBy", "updateSource", 
          "ipAddress", "userAgent", "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW()
        )
      `
      
      await querySchema(orgSlug, historyQuery, [
        historyId,
        kpiId,
        'goal_updated',
        JSON.stringify(changedFields),
        JSON.stringify(oldValues),
        JSON.stringify(newValues),
        user.id,
        user.role,
        request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
        request.headers.get('user-agent')
      ])
    }

    // Get updater info
    const updaterQuery = `
      SELECT id, name, email FROM public."User" WHERE id = $1
    `
    const updaters = await querySchema<any>('public', updaterQuery, [user.id])
    const updater = updaters[0]
    
    return NextResponse.json({
      ...updatedKPI,
      updater: updater || null
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input data', details: error.errors }, { status: 400 })
    }
    console.error('Error updating campaign KPI:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/campaigns/[id]/kpi/[kpiId] - Delete campaign KPI
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; kpiId: string } }
) {
  try {
    // Validate session
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to manage campaigns
    if (!['admin', 'master'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const campaignId = params.id
    const kpiId = params.kpiId

    // CRITICAL SECURITY FIX: Use schema-aware queries for multi-tenant data
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Check if user has access to this campaign and KPI
    const existingQuery = `
      SELECT * FROM "CampaignKPI" 
      WHERE id = $1 AND "campaignId" = $2
    `
    const existingKPIs = await querySchema<any>(orgSlug, existingQuery, [kpiId, campaignId])
    
    if (!existingKPIs || existingKPIs.length === 0) {
      return NextResponse.json({ error: 'KPI not found' }, { status: 404 })
    }

    // Delete KPI (this will cascade delete history and tokens)
    await querySchema(orgSlug, `DELETE FROM "CampaignKPI" WHERE id = $1`, [kpiId])

    return NextResponse.json({ message: 'KPI deleted successfully' })
  } catch (error) {
    console.error('Error deleting campaign KPI:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
