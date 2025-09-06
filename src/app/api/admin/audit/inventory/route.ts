import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { safeQuerySchema, getSchemaClient } from '@/lib/db/schema-db'
import { getOrgPrismaClient } from '@/lib/db/multi-tenant-prisma'

// Force dynamic
export const dynamic = 'force-dynamic'

interface AuditReport {
  summary: {
    invisibleCampaigns: number
    orphanedOrders: number
    danglingReservations: number
    inventoryMismatches: number
    blockedDeletions: number
    statusInconsistencies: number
  }
  details: {
    invisibleCampaigns: any[]
    orphanedOrders: any[]
    danglingReservations: any[]
    inventoryMismatches: any[]
    blockedDeletions: any[]
    statusInconsistencies: any[]
  }
  metadata: {
    organizationId: string
    organizationSlug: string
    auditTimestamp: string
    executionTimeMs: number
  }
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    // Check authentication and authorization
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin or master can access audit
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const orgSlug = session.organizationSlug
    const orgId = session.organizationId

    if (!orgSlug || !orgId) {
      return NextResponse.json({ error: 'Organization context not found' }, { status: 400 })
    }

    console.log(`[Audit API] Starting inventory audit for org: ${orgSlug}`)

    const report: AuditReport = {
      summary: {
        invisibleCampaigns: 0,
        orphanedOrders: 0,
        danglingReservations: 0,
        inventoryMismatches: 0,
        blockedDeletions: 0,
        statusInconsistencies: 0
      },
      details: {
        invisibleCampaigns: [],
        orphanedOrders: [],
        danglingReservations: [],
        inventoryMismatches: [],
        blockedDeletions: [],
        statusInconsistencies: []
      },
      metadata: {
        organizationId: orgId,
        organizationSlug: orgSlug,
        auditTimestamp: new Date().toISOString(),
        executionTimeMs: 0
      }
    }

    // 1. Find Invisible Campaigns
    console.log('[Audit API] Checking for invisible campaigns...')
    const invisibleCampaignsQuery = `
      SELECT 
        c.id,
        c.name,
        c.status,
        c.probability,
        c."advertiserId",
        c."agencyId",
        c."sellerId",
        c."createdAt",
        c."updatedAt",
        c."deletedAt",
        c.budget,
        c."startDate",
        c."endDate",
        CASE 
          WHEN c.status IS NULL THEN 'null_status'
          WHEN c.status NOT IN ('draft', 'pending', 'approved', 'active', 'completed', 'cancelled', 'rejected') THEN 'invalid_status'
          WHEN c."deletedAt" IS NOT NULL THEN 'soft_deleted'
          WHEN c."advertiserId" IS NULL THEN 'missing_advertiser'
          WHEN c.probability = 0 THEN 'zero_probability'
          WHEN c.probability > 100 THEN 'invalid_probability'
          ELSE 'unknown'
        END as visibility_reason,
        EXISTS(SELECT 1 FROM "CampaignSchedule" cs WHERE cs."campaignId" = c.id) as has_schedule,
        EXISTS(SELECT 1 FROM "Order" o WHERE o."campaignId" = c.id) as has_order,
        EXISTS(SELECT 1 FROM "Reservation" r WHERE r."campaignId" = c.id) as has_reservation
      FROM "Campaign" c
      WHERE (
        c.status IS NULL 
        OR c.status NOT IN ('draft', 'pending', 'approved', 'active', 'completed', 'cancelled', 'rejected')
        OR c."deletedAt" IS NOT NULL
        OR c."advertiserId" IS NULL
        OR c.probability = 0
        OR c.probability > 100
      )
      ORDER BY c."createdAt" DESC
    `
    
    const { data: invisibleCampaigns, error: icError } = await safeQuerySchema(
      orgSlug,
      invisibleCampaignsQuery
    )
    
    if (!icError && invisibleCampaigns) {
      report.details.invisibleCampaigns = invisibleCampaigns
      report.summary.invisibleCampaigns = invisibleCampaigns.length
      console.log(`[Audit API] Found ${invisibleCampaigns.length} invisible campaigns`)
    }

    // 2. Find Orphaned Orders
    console.log('[Audit API] Checking for orphaned orders...')
    const orphanedOrdersQuery = `
      SELECT 
        o.id,
        o."campaignId",
        o.status as order_status,
        o."totalAmount",
        o."createdAt",
        o."updatedAt",
        o.approved,
        CASE
          WHEN o."campaignId" IS NULL THEN 'null_campaign'
          WHEN NOT EXISTS(SELECT 1 FROM "Campaign" c WHERE c.id = o."campaignId") THEN 'campaign_not_found'
          WHEN EXISTS(SELECT 1 FROM "Campaign" c WHERE c.id = o."campaignId" AND c."deletedAt" IS NOT NULL) THEN 'campaign_deleted'
          WHEN o.approved IS NULL THEN 'null_approved_flag'
          WHEN o.approved = false THEN 'not_approved'
          WHEN o.status NOT IN ('pending', 'approved', 'completed', 'cancelled') THEN 'invalid_status'
          ELSE 'unknown'
        END as reason_hidden
      FROM "Order" o
      WHERE (
        o."campaignId" IS NULL
        OR NOT EXISTS(SELECT 1 FROM "Campaign" c WHERE c.id = o."campaignId")
        OR EXISTS(SELECT 1 FROM "Campaign" c WHERE c.id = o."campaignId" AND c."deletedAt" IS NOT NULL)
        OR o.approved IS NULL
        OR o.approved = false
        OR o.status NOT IN ('pending', 'approved', 'completed', 'cancelled')
      )
      ORDER BY o."createdAt" DESC
    `
    
    const { data: orphanedOrders, error: ooError } = await safeQuerySchema(
      orgSlug,
      orphanedOrdersQuery
    )
    
    if (!ooError && orphanedOrders) {
      report.details.orphanedOrders = orphanedOrders
      report.summary.orphanedOrders = orphanedOrders.length
      console.log(`[Audit API] Found ${orphanedOrders.length} orphaned orders`)
    }

    // 3. Find Dangling Reservations (check both Reservation table and EpisodeInventory)
    console.log('[Audit API] Checking for dangling reservations...')
    
    // First check Reservation table
    const danglingReservationsQuery = `
      SELECT 
        'reservation_table' as source,
        r.id,
        r."showId",
        r."episodeId",
        r."campaignId",
        r."scheduleId",
        r.locked,
        r."expiresAt",
        r."createdAt",
        r.status,
        CASE
          WHEN r."showId" IS NULL THEN 'null_show'
          WHEN NOT EXISTS(SELECT 1 FROM "Show" s WHERE s.id = r."showId") THEN 'show_not_found'
          WHEN r."episodeId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM "Episode" e WHERE e.id = r."episodeId") THEN 'episode_not_found'
          WHEN r."campaignId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM "Campaign" c WHERE c.id = r."campaignId") THEN 'campaign_not_found'
          WHEN r."scheduleId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM "CampaignSchedule" cs WHERE cs.id = r."scheduleId") THEN 'schedule_not_found'
          WHEN r."expiresAt" < NOW() AND r.locked = true THEN 'expired_but_locked'
          WHEN EXISTS(SELECT 1 FROM "Campaign" c WHERE c.id = r."campaignId" AND c.status = 'cancelled') THEN 'campaign_cancelled'
          WHEN EXISTS(SELECT 1 FROM "Campaign" c WHERE c.id = r."campaignId" AND c.status = 'rejected') THEN 'campaign_rejected'
          WHEN EXISTS(SELECT 1 FROM "Campaign" c WHERE c.id = r."campaignId" AND c."deletedAt" IS NOT NULL) THEN 'campaign_deleted'
          ELSE 'unknown'
        END as reason
      FROM "Reservation" r
      WHERE (
        r."showId" IS NULL
        OR NOT EXISTS(SELECT 1 FROM "Show" s WHERE s.id = r."showId")
        OR (r."episodeId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM "Episode" e WHERE e.id = r."episodeId"))
        OR (r."campaignId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM "Campaign" c WHERE c.id = r."campaignId"))
        OR (r."scheduleId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM "CampaignSchedule" cs WHERE cs.id = r."scheduleId"))
        OR (r."expiresAt" < NOW() AND r.locked = true)
        OR EXISTS(SELECT 1 FROM "Campaign" c WHERE c.id = r."campaignId" AND (c.status IN ('cancelled', 'rejected') OR c."deletedAt" IS NOT NULL))
      )
      ORDER BY r."createdAt" DESC
    `
    
    // Also check EpisodeInventory for orphaned reservations
    const episodeInventoryReservationsQuery = `
      SELECT 
        'episode_inventory' as source,
        ei.id,
        ei."showId",
        ei."episodeId",
        s.name as show_name,
        e.title as episode_title,
        ei."airDate",
        ei."preRollReserved",
        ei."midRollReserved",
        ei."postRollReserved",
        (ei."preRollReserved" + ei."midRollReserved" + ei."postRollReserved") as total_reserved,
        ei."holdExpiresAt",
        ei."updatedAt",
        CASE
          WHEN ei."holdExpiresAt" IS NULL THEN 'no_expiration_set'
          WHEN ei."holdExpiresAt" < NOW() THEN 'expired_hold'
          WHEN NOT EXISTS(SELECT 1 FROM "Campaign" c) THEN 'no_campaigns_exist'
          WHEN NOT EXISTS(SELECT 1 FROM "ScheduledSpot" ss WHERE ss."episodeId" = ei."episodeId") THEN 'no_scheduled_spots'
          ELSE 'orphaned_reservation'
        END as reason
      FROM "EpisodeInventory" ei
      LEFT JOIN "Episode" e ON e.id = ei."episodeId"
      LEFT JOIN "Show" s ON s.id = ei."showId"
      WHERE (ei."preRollReserved" > 0 OR ei."midRollReserved" > 0 OR ei."postRollReserved" > 0)
      ORDER BY ei."airDate" DESC
    `
    
    const danglingReservations = []
    
    // Get reservations from Reservation table
    const { data: reservationTableData, error: rtError } = await safeQuerySchema(
      orgSlug,
      danglingReservationsQuery
    )
    
    if (!rtError && reservationTableData) {
      danglingReservations.push(...reservationTableData)
    }
    
    // Get reservations from EpisodeInventory
    const { data: episodeInventoryData, error: eiError } = await safeQuerySchema(
      orgSlug,
      episodeInventoryReservationsQuery
    )
    
    if (!eiError && episodeInventoryData) {
      danglingReservations.push(...episodeInventoryData)
    }
    
    report.details.danglingReservations = danglingReservations
    report.summary.danglingReservations = danglingReservations.length
    console.log(`[Audit API] Found ${danglingReservations.length} dangling reservations (${reservationTableData?.length || 0} from Reservation, ${episodeInventoryData?.length || 0} from EpisodeInventory)`)

    // 4. Find Inventory Mismatches
    console.log('[Audit API] Checking for inventory mismatches...')
    const inventoryMismatchQuery = `
      SELECT 
        s.id as show_id,
        s.name as show_name,
        s."reservedSlotsCount" as reserved_flag,
        COUNT(DISTINCT r.id) as actual_reservations,
        CASE
          WHEN s."reservedSlotsCount" > 0 AND COUNT(r.id) = 0 THEN 'flag_set_but_no_reservations'
          WHEN s."reservedSlotsCount" = 0 AND COUNT(r.id) > 0 THEN 'reservations_exist_but_flag_zero'
          WHEN s."reservedSlotsCount" != COUNT(r.id) THEN 'count_mismatch'
          ELSE 'unknown'
        END as mismatch_detail
      FROM "Show" s
      LEFT JOIN "Reservation" r ON r."showId" = s.id AND r.locked = true
      GROUP BY s.id, s.name, s."reservedSlotsCount"
      HAVING s."reservedSlotsCount" != COUNT(r.id)
      ORDER BY s.name
    `
    
    const { data: inventoryMismatches, error: imError } = await safeQuerySchema(
      orgSlug,
      inventoryMismatchQuery
    )
    
    if (!imError && inventoryMismatches) {
      report.details.inventoryMismatches = inventoryMismatches
      report.summary.inventoryMismatches = inventoryMismatches.length
      console.log(`[Audit API] Found ${inventoryMismatches.length} inventory mismatches`)
    }

    // 5. Find Blocked Show Deletions
    console.log('[Audit API] Checking for blocked show deletions...')
    const blockedDeletionsQuery = `
      WITH show_dependencies AS (
        SELECT 
          s.id as show_id,
          s.name as show_name,
          'reservation' as blocker_type,
          r.id as blocker_id,
          r."expiresAt" < NOW() OR r."campaignId" IS NULL as is_stale,
          CASE
            WHEN r."expiresAt" < NOW() THEN 'release_expired'
            WHEN r."campaignId" IS NULL THEN 'release_orphaned'
            ELSE 'valid_dependency'
          END as recommended_action
        FROM "Show" s
        INNER JOIN "Reservation" r ON r."showId" = s.id
        WHERE r.locked = true
        
        UNION ALL
        
        SELECT 
          s.id as show_id,
          s.name as show_name,
          'episode' as blocker_type,
          e.id as blocker_id,
          false as is_stale,
          'migrate_or_delete_episodes' as recommended_action
        FROM "Show" s
        INNER JOIN "Episode" e ON e."showId" = s.id
        
        UNION ALL
        
        SELECT 
          s.id as show_id,
          s.name as show_name,
          'scheduled_spot' as blocker_type,
          ss.id as blocker_id,
          ss."airDate" < NOW() as is_stale,
          CASE
            WHEN ss."airDate" < NOW() THEN 'archive_past_spots'
            ELSE 'cancel_future_spots'
          END as recommended_action
        FROM "Show" s
        INNER JOIN "Episode" e ON e."showId" = s.id
        INNER JOIN "ScheduledSpot" ss ON ss."episodeId" = e.id
      )
      SELECT 
        show_id,
        show_name,
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'type', blocker_type,
            'id', blocker_id,
            'isStale', is_stale,
            'recommendedAction', recommended_action
          )
        ) as blockers
      FROM show_dependencies
      GROUP BY show_id, show_name
      ORDER BY show_name
    `
    
    const { data: blockedDeletions, error: bdError } = await safeQuerySchema(
      orgSlug,
      blockedDeletionsQuery
    )
    
    if (!bdError && blockedDeletions) {
      report.details.blockedDeletions = blockedDeletions
      report.summary.blockedDeletions = blockedDeletions.length
      console.log(`[Audit API] Found ${blockedDeletions.length} blocked show deletions`)
    }

    // 6. Find Status Inconsistencies (campaigns stuck in workflow)
    console.log('[Audit API] Checking for status inconsistencies...')
    const statusInconsistenciesQuery = `
      SELECT 
        c.id as campaign_id,
        c.name as campaign_name,
        c.probability as current_percent,
        c.status,
        c."updatedAt" as last_transition_at,
        EXTRACT(DAY FROM NOW() - c."updatedAt") as days_since_update,
        CASE
          WHEN c.probability = 90 AND c.status = 'pending' AND EXTRACT(DAY FROM NOW() - c."updatedAt") > 3 
            THEN 'approve_or_reject'
          WHEN c.probability = 65 AND EXTRACT(DAY FROM NOW() - c."updatedAt") > 7 
            THEN 'move_to_negotiation'
          WHEN c.probability = 35 AND EXTRACT(DAY FROM NOW() - c."updatedAt") > 14 
            THEN 'follow_up_or_close'
          WHEN c.status = 'pending' AND c.probability < 90 
            THEN 'update_probability'
          WHEN c.status = 'approved' AND NOT EXISTS(SELECT 1 FROM "Order" o WHERE o."campaignId" = c.id)
            THEN 'create_order'
          ELSE 'review_manually'
        END as suggested_fix,
        EXISTS(SELECT 1 FROM "Reservation" r WHERE r."campaignId" = c.id AND r.locked = true) as has_reservations,
        EXISTS(SELECT 1 FROM "Order" o WHERE o."campaignId" = c.id) as has_order
      FROM "Campaign" c
      WHERE (
        (c.probability = 90 AND c.status = 'pending' AND EXTRACT(DAY FROM NOW() - c."updatedAt") > 3)
        OR (c.probability = 65 AND EXTRACT(DAY FROM NOW() - c."updatedAt") > 7)
        OR (c.probability = 35 AND EXTRACT(DAY FROM NOW() - c."updatedAt") > 14)
        OR (c.status = 'pending' AND c.probability < 90)
        OR (c.status = 'approved' AND NOT EXISTS(SELECT 1 FROM "Order" o WHERE o."campaignId" = c.id))
      )
      ORDER BY c."updatedAt" ASC
    `
    
    const { data: statusInconsistencies, error: siError } = await safeQuerySchema(
      orgSlug,
      statusInconsistenciesQuery
    )
    
    if (!siError && statusInconsistencies) {
      report.details.statusInconsistencies = statusInconsistencies
      report.summary.statusInconsistencies = statusInconsistencies.length
      console.log(`[Audit API] Found ${statusInconsistencies.length} status inconsistencies`)
    }

    // Calculate execution time
    report.metadata.executionTimeMs = Date.now() - startTime

    // Log summary
    console.log('[Audit API] Audit complete:', {
      invisibleCampaigns: report.summary.invisibleCampaigns,
      orphanedOrders: report.summary.orphanedOrders,
      danglingReservations: report.summary.danglingReservations,
      inventoryMismatches: report.summary.inventoryMismatches,
      blockedDeletions: report.summary.blockedDeletions,
      statusInconsistencies: report.summary.statusInconsistencies,
      executionTimeMs: report.metadata.executionTimeMs
    })

    return NextResponse.json(report)
    
  } catch (error) {
    console.error('[Audit API] Error during audit:', error)
    return NextResponse.json(
      { 
        error: 'Failed to complete audit',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}