import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { getUserOrgSlug, querySchema } from '@/lib/db/schema-db'
import { allocateBulkSpots, BulkAllocationInput } from '@/lib/inventory/bulk-allocator'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const bulkPreviewSchema = z.object({
  campaignId: z.string().optional(),
  advertiserId: z.string().min(1, "Advertiser ID is required"),
  agencyId: z.string().optional(),
  showIds: z.array(z.string()).min(1),
  dateRange: z.object({
    start: z.string().transform(s => new Date(s)),
    end: z.string().transform(s => new Date(s))
  }),
  weekdays: z.array(z.number().min(0).max(6)),
  placementTypes: z.array(z.string()),
  spotsRequested: z.number().min(1),
  spotsPerWeek: z.number().optional(),
  allowMultiplePerShowPerDay: z.boolean().default(false),
  fallbackStrategy: z.enum(['strict', 'relaxed', 'fill_anywhere']).default('strict'),
  maxSpotsPerShowPerDay: z.number().optional()
})

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions - need at least view permission for preview
    if (!['master', 'admin', 'sales', 'producer'].includes(session.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const orgSlug = await getUserOrgSlug(session.userId)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Parse and validate input
    const body = await request.json()
    const validationResult = bulkPreviewSchema.safeParse(body)
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const input = validationResult.data

    // Validate campaign belongs to org if provided
    if (input.campaignId) {
      const campaignCheck = await querySchema(
        orgSlug,
        'SELECT id FROM "Campaign" WHERE id = $1',
        [input.campaignId]
      )
      
      if (!campaignCheck || campaignCheck.length === 0) {
        return NextResponse.json(
          { error: 'Campaign not found or does not belong to organization' },
          { status: 404 }
        )
      }
    }

    // Validate advertiser belongs to org
    const advertiserCheck = await querySchema(
      orgSlug,
      'SELECT id, name FROM "Advertiser" WHERE id = $1',
      [input.advertiserId]
    )
    
    if (!advertiserCheck || advertiserCheck.length === 0) {
      return NextResponse.json(
        { error: 'Advertiser not found or does not belong to organization' },
        { status: 404 }
      )
    }

    // Get show metadata
    const showsQuery = `
      SELECT id, name 
      FROM "Show" 
      WHERE id = ANY($1::text[])
    `
    const showsResult = await querySchema(orgSlug, showsQuery, [input.showIds])
    
    if (!showsResult || showsResult.length !== input.showIds.length) {
      return NextResponse.json(
        { error: 'One or more shows not found' },
        { status: 404 }
      )
    }

    // For now, use hardcoded defaults until Organization settings are properly configured
    // TODO: Add settings to Organization table or create settings table
    const defaultSettings = {
      defaultBulkFallbackStrategy: 'strict',
      defaultAllowMultiplePerShowPerDay: false,
      maxSpotsPerShowPerDay: 1
    }
    
    // Apply defaults if not specified
    if (!body.fallbackStrategy) {
      input.fallbackStrategy = defaultSettings.defaultBulkFallbackStrategy as any
    }
    if (body.allowMultiplePerShowPerDay === undefined) {
      input.allowMultiplePerShowPerDay = defaultSettings.defaultAllowMultiplePerShowPerDay
    }
    if (!input.maxSpotsPerShowPerDay) {
      input.maxSpotsPerShowPerDay = defaultSettings.maxSpotsPerShowPerDay
    }

    // Default max spots per show per day if still not set
    if (!input.maxSpotsPerShowPerDay) {
      input.maxSpotsPerShowPerDay = input.allowMultiplePerShowPerDay ? 3 : 1
    }

    // Perform allocation preview
    const allocationInput: BulkAllocationInput = {
      campaignId: input.campaignId,
      advertiserId: input.advertiserId,
      agencyId: input.agencyId,
      showIds: input.showIds,
      dateRange: {
        start: input.dateRange.start,
        end: input.dateRange.end
      },
      weekdays: input.weekdays,
      placementTypes: input.placementTypes,
      spotsRequested: input.spotsRequested,
      spotsPerWeek: input.spotsPerWeek,
      allowMultiplePerShowPerDay: input.allowMultiplePerShowPerDay,
      fallbackStrategy: input.fallbackStrategy,
      maxSpotsPerShowPerDay: input.maxSpotsPerShowPerDay
    }

    const result = await allocateBulkSpots(orgSlug, allocationInput, showsResult)

    // Log the preview request
    console.log('Bulk schedule preview:', {
      userId: session.userId,
      orgSlug,
      advertiserId: input.advertiserId,
      requested: input.spotsRequested,
      placeable: result.summary.placeable,
      strategy: input.fallbackStrategy
    })

    return NextResponse.json({
      success: true,
      preview: result,
      settings: {
        allowMultiplePerShowPerDay: input.allowMultiplePerShowPerDay,
        maxSpotsPerShowPerDay: input.maxSpotsPerShowPerDay,
        fallbackStrategy: input.fallbackStrategy
      }
    })

  } catch (error: any) {
    console.error('Bulk schedule preview error:', error)
    return NextResponse.json(
      { error: 'Failed to generate preview', details: error.message },
      { status: 500 }
    )
  }
}