import { querySchema, safeQuerySchema } from '@/lib/db/schema-db'
import prisma from '@/lib/db/prisma'
import { getTenantClient } from '@/lib/db/tenant-isolation'
import { notificationService } from '@/lib/notifications/notification-service'
import { 
  notifyScheduleBuilt, 
  notifyAdminApprovalRequested, 
  notifyCampaignApproved,
  notifyCampaignRejected,
  notifyInventoryReleased
} from '@/lib/notifications/notifier-service'
import { activityService } from '@/lib/activities/activity-service'
import { Prisma } from '@prisma/client'
import { v4 as uuidv4 } from 'uuid'
import { workflowLogger, WorkflowPhase } from './workflow-logger'
import { 
  WORKFLOW_STATES, 
  WORKFLOW_EVENTS,
  WorkflowSettings,
  DEFAULT_WORKFLOW_SETTINGS,
  getNextStateForEvent,
  isScheduleValid 
} from './workflow-constants'
import { WorkflowSettingsService } from './workflow-settings-service'
import { TriggerEvaluator, WorkflowEvent } from './trigger-evaluator'

export interface CampaignWorkflowContext {
  campaignId: string
  organizationId: string
  organizationSlug: string
  userId: string
  userName: string
  userRole: string
}

export class CampaignWorkflowService {
  /**
   * Handle campaign probability/status update with workflow automation
   */
  async handleCampaignStatusUpdate(
    context: CampaignWorkflowContext,
    newProbability: number,
    newStatus?: string
  ) {
    const workflowId = `wf_${Date.now()}_${context.campaignId}`
    const startTime = workflowLogger.startWorkflow(workflowId, 'campaign_90pct', {
      campaignId: context.campaignId,
      organizationId: context.organizationId,
      newProbability,
      newStatus
    })

    try {
      // Get campaign details using querySchema
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
      const campaigns = await querySchema<any>(context.organizationSlug, campaignQuery, [context.campaignId])
      
      if (!campaigns || campaigns.length === 0) {
        throw new Error('Campaign not found')
      }
      
      const campaign = campaigns[0]

      // Get workflow settings from the new settings service
      const [milestoneSettings, approvalSettings, notificationSettings, rateCardSettings] = await Promise.all([
        WorkflowSettingsService.getSetting(context.organizationSlug, 'milestone.thresholds'),
        WorkflowSettingsService.getSetting(context.organizationSlug, 'approval.rules'),
        WorkflowSettingsService.getSetting(context.organizationSlug, 'notifications.enabled'),
        WorkflowSettingsService.getSetting(context.organizationSlug, 'rate_card.delta_tracking')
      ])

      const workflowSettings = {
        autoReserveAt90: milestoneSettings?.auto_reservation === newProbability,
        requireAdminApprovalAt90: approvalSettings?.campaignApproval?.enabled && 
                                  approvalSettings?.campaignApproval?.at === newProbability,
        requireTalentApprovalAt65: approvalSettings?.talentApproval?.enabled && 
                                   approvalSettings?.talentApproval?.at === newProbability,
        notifyOnStatusChange: notificationSettings?.inApp !== false,
        thresholds: milestoneSettings || {
          pre_sale_active: 10,
          schedule_available: 10,
          schedule_valid: 35,
          talent_approval_required: 65,
          admin_approval_required: 90,
          auto_reservation: 90,
          order_creation: 100,
          rejection_fallback: 65
        },
        approvalRoles: approvalSettings?.campaignApproval?.roles || ['admin', 'master'],
        talentApprovalTypes: approvalSettings?.talentApproval?.types || ['host_read', 'endorsement'],
        rateCardDeltaEnabled: rateCardSettings?.enabled !== false,
        rateCardDeltaThreshold: rateCardSettings?.threshold_percent || 10
      }

      const oldProbability = campaign.probability
      const oldStatus = campaign.status

      // Trigger custom workflow events
      await TriggerEvaluator.evaluateEvent({
        orgSlug: context.organizationSlug,
        orgId: context.organizationId,
        userId: context.userId,
        userName: context.userName,
        userRole: context.userRole,
        event: WorkflowEvent.PROBABILITY_UPDATED,
        entityType: 'campaign',
        entityId: context.campaignId,
        data: {
          campaign,
          oldProbability,
          newProbability,
          oldStatus,
          newStatus
        }
      })

      // Handle 10% milestone - Pre-sale active
      if (oldProbability < workflowSettings.thresholds.pre_sale_active && 
          newProbability >= workflowSettings.thresholds.pre_sale_active) {
        console.log(`🎯 [${workflowSettings.thresholds.pre_sale_active}% Milestone] Campaign is now pre-sale active`)
        
        // Make schedule builder available
        await this.enableScheduleBuilder(context, campaign)
      }

      // Handle 35% milestone - Schedule validation
      if (oldProbability < workflowSettings.thresholds.schedule_valid && 
          newProbability >= workflowSettings.thresholds.schedule_valid) {
        console.log(`🎯 [${workflowSettings.thresholds.schedule_valid}% Milestone] Validating schedule`)
        
        // Check if schedule exists and is valid
        const hasValidSchedule = await this.validateSchedule(context, campaign)
        
        if (hasValidSchedule && rateCardSettings?.enabled) {
          // Start rate card delta tracking
          await this.startRateCardDeltaTracking(context, campaign)
        }
      }

      // Handle 65% milestone - Talent approval
      if (workflowSettings.requireTalentApprovalAt65 &&
          oldProbability < workflowSettings.thresholds.talent_approval_required && 
          newProbability >= workflowSettings.thresholds.talent_approval_required) {
        console.log(`🎯 [${workflowSettings.thresholds.talent_approval_required}% Milestone] Creating talent approval requests`)
        
        await this.createTalentApprovalRequests(
          context, 
          campaign, 
          workflowSettings.talentApprovalTypes
        )
      }

      // Handle 90% milestone - Admin approval + auto-reservation
      if (oldProbability < workflowSettings.thresholds.admin_approval_required && 
          newProbability >= workflowSettings.thresholds.admin_approval_required) {
        console.log(`🎯 [${workflowSettings.thresholds.admin_approval_required}% Milestone] Starting admin approval workflow`)
        
        await this.handle90PercentTransition(context, campaign, workflowSettings)
      }

      // Handle 100% milestone - Order creation
      if (oldProbability < workflowSettings.thresholds.order_creation && 
          newProbability >= workflowSettings.thresholds.order_creation) {
        console.log(`🎯 [${workflowSettings.thresholds.order_creation}% Milestone] Creating order`)
        
        await this.createOrderFromCampaign(context, campaign)
      }

      workflowLogger.endWorkflow(workflowId, true)
      
    } catch (error: any) {
      workflowLogger.logError(workflowId, error.message, { context })
      workflowLogger.endWorkflow(workflowId, false, error.message)
      throw error
    }
  }

  /**
   * Handle 65% milestone - Create talent approval requests
   */
  private async createTalentApprovalRequests(
    context: CampaignWorkflowContext,
    campaign: any,
    approvalTypes: string[]
  ) {
    // Get scheduled spots that need talent approval
    const spotsQuery = `
      SELECT DISTINCT 
        ss."showId",
        s.name as "showName",
        s."talentId",
        u.name as "talentName",
        u.email as "talentEmail",
        ss."placementType",
        COUNT(*) as "spotCount",
        MIN(ss."airDate") as "firstAirDate",
        MAX(ss."airDate") as "lastAirDate"
      FROM "ScheduledSpot" ss
      LEFT JOIN "Show" s ON s.id = ss."showId"
      LEFT JOIN public."User" u ON u.id = s."talentId"
      WHERE ss."campaignId" = $1
        AND ss."spotType" = ANY($2)
        AND s."talentId" IS NOT NULL
      GROUP BY ss."showId", s.name, s."talentId", u.name, u.email, ss."placementType"
    `
    
    const { data: talentSpots } = await safeQuerySchema(
      context.organizationSlug, 
      spotsQuery, 
      [campaign.id, approvalTypes]
    )
    
    if (!talentSpots || talentSpots.length === 0) {
      console.log('✅ No spots requiring talent approval found')
      return
    }
    
    // Create approval requests for each unique talent/show combination
    for (const spot of talentSpots) {
      // Check if approval already exists
      const existingQuery = `
        SELECT id FROM "TalentApprovalRequest"
        WHERE "campaignId" = $1 
          AND "showId" = $2 
          AND "talentId" = $3
          AND status IN ('pending', 'approved')
      `
      const { data: existing } = await safeQuerySchema(
        context.organizationSlug,
        existingQuery,
        [campaign.id, spot.showId, spot.talentId]
      )
      
      if (existing && existing.length > 0) {
        continue
      }
      
      // Create talent approval request
      const approvalId = uuidv4()
      const summaryData = {
        campaignName: campaign.name,
        advertiserName: campaign.advertiser_name,
        agencyName: campaign.agency_name,
        spotCount: spot.spotCount,
        firstAirDate: spot.firstAirDate,
        lastAirDate: spot.lastAirDate,
        placementType: spot.placementType,
        budget: campaign.budget
      }
      
      const insertQuery = `
        INSERT INTO "TalentApprovalRequest" (
          id, "campaignId", "showId", "talentId", "spotType",
          "requestedAt", "requestedBy", status, "expiresAt",
          "summaryData", "organizationId", "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, $3, $4, $5,
          NOW(), $6, 'pending', $7,
          $8, $9, NOW(), NOW()
        )
      `
      
      const expirationDate = new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)) // 7 days
      
      await safeQuerySchema(
        context.organizationSlug,
        insertQuery,
        [
          approvalId,
          campaign.id,
          spot.showId,
          spot.talentId,
          spot.spotCount > 0 ? 'host_read' : 'endorsement',
          context.userId,
          expirationDate,
          JSON.stringify(summaryData),
          context.organizationId
        ]
      )
      
      // Send notification to talent
      if (spot.talentEmail) {
        await notificationService.createNotification({
          userId: spot.talentId,
          title: 'Talent Approval Required',
          message: `Your approval is needed for campaign "${campaign.name}"`,
          type: 'approval',
          category: 'talent',
          actionUrl: `/talent/approvals/${approvalId}`,
          metadata: {
            campaignId: campaign.id,
            showId: spot.showId,
            approvalId
          }
        })
      }
    }
  }

  /**
   * Handle 90% milestone transition with configurable settings
   */
  private async handle90PercentTransition(
    context: CampaignWorkflowContext,
    campaign: any,
    workflowSettings: any
  ) {
    const subWorkflowId = `wf_90pct_${Date.now()}_${context.campaignId}`
    
    workflowLogger.info('Starting 90% transition', {
      workflowId: subWorkflowId,
      workflowType: 'campaign_90pct_transition',
      campaignId: campaign.id,
      organizationSlug: context.organizationSlug,
      phase: WorkflowPhase.EXECUTION,
      metadata: {
        campaignName: campaign.name,
        workflowSettings
      }
    })

    // Check for pending talent approvals (unless admin override)
    if (context.userRole !== 'master' && context.userRole !== 'admin') {
      const pendingApprovalsQuery = `
        SELECT COUNT(*) as "pendingCount"
        FROM "TalentApprovalRequest"
        WHERE "campaignId" = $1
          AND status = 'pending'
      `
      const { data: pendingData } = await safeQuerySchema(
        context.organizationSlug,
        pendingApprovalsQuery,
        [campaign.id]
      )
      
      const pendingCount = pendingData?.[0]?.pendingCount || 0
      
      if (pendingCount > 0) {
        console.warn(`⚠️ ${pendingCount} talent approvals are still pending`)
        
        // Check for denied approvals
        const deniedApprovalsQuery = `
          SELECT COUNT(*) as "deniedCount"
          FROM "TalentApprovalRequest"
          WHERE "campaignId" = $1
            AND status = 'denied'
        `
        const { data: deniedData } = await safeQuerySchema(
          context.organizationSlug,
          deniedApprovalsQuery,
          [campaign.id]
        )
        
        const deniedCount = deniedData?.[0]?.deniedCount || 0
        
        if (deniedCount > 0) {
          throw new Error(`Cannot proceed to 90%: ${deniedCount} talent approvals were denied`)
        }
      }
    }

    // Create inventory reservations if enabled
    if (workflowSettings.autoReserveAt90) {
      console.log('📦 Creating inventory reservations...')
      
      try {
        const reservationId = await this.createInventoryReservations(context, campaign)
        console.log('✅ Reservations created:', reservationId)
        
        // Update campaign with reservation ID
        await querySchema(
          context.organizationSlug,
          `UPDATE "Campaign" 
           SET "reservationId" = $2, "reservationCreatedAt" = $3
           WHERE id = $1`,
          [campaign.id, reservationId, new Date()]
        )
      } catch (error) {
        console.error('❌ Failed to create reservations:', error)
        throw error
      }
    }

    // Create admin approval request if enabled
    if (workflowSettings.requireAdminApprovalAt90) {
      console.log('📋 Creating admin approval request...')
      try {
        const approvalRequestId = await this.createAdminApprovalRequest(
          context, 
          campaign,
          workflowSettings.approvalRoles
        )
        console.log('✅ Approval request created:', approvalRequestId)
        
        // Update campaign with approval request ID
        await querySchema(
          context.organizationSlug,
          `UPDATE "Campaign" 
           SET "approvalRequestId" = $2
           WHERE id = $1`,
          [campaign.id, approvalRequestId]
        )
      } catch (error) {
        console.error('❌ Failed to create approval request:', error)
        throw error
      }
    }

    workflowLogger.info('90% transition completed', {
      workflowId: subWorkflowId,
      workflowType: 'campaign_90pct_transition',
      campaignId: campaign.id,
      phase: WorkflowPhase.COMPLETE
    })
  }

  // Keep existing helper methods...
  private validateThreshold(value: any, defaultValue: number, min: number, max: number): number {
    const num = Number(value)
    if (isNaN(num)) return defaultValue
    if (num < min) return min
    if (num > max) return max
    return num
  }

  // Export the create inventory reservations method so it can be used by trigger evaluator
  public async createInventoryReservations(
    context: CampaignWorkflowContext,
    campaign: any
  ): Promise<string> {
    console.log('📦 [Reservations] Starting inventory reservation creation')
    
    // Create an actual Reservation record that will show in pending approvals
    const reservationId = uuidv4()
    
    // Get show IDs from scheduled spots
    const showsQuery = `
      SELECT DISTINCT "showId" 
      FROM "ScheduledSpot" 
      WHERE "campaignId" = $1
    `
    const { data: shows } = await safeQuerySchema<any>(context.organizationSlug, showsQuery, [campaign.id])
    
    const showIds = shows?.map((s: any) => s.showId) || []
    
    console.log(`📦 [Reservations] Creating reservation for ${showIds.length} shows`)
    
    // Create the reservation with 'held' status so it appears in pending approvals
    const createReservationQuery = `
      INSERT INTO "Reservation" (
        id, "reservationNumber", "campaignId", "advertiserId", "agencyId", 
        "totalAmount", "estimatedRevenue",
        status, notes, "createdBy", "createdAt", "updatedAt",
        "organizationId", "expiresAt"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        'held', $8, $9, NOW(), NOW(), $10, $11
      )
      RETURNING id
    `
    
    const expiresAt = new Date(Date.now() + (14 * 24 * 60 * 60 * 1000)) // 14 days
    const reservationNumber = `RES-${Date.now()}`
    
    const { data: reservation } = await safeQuerySchema<any>(
      context.organizationSlug,
      createReservationQuery,
      [
        reservationId,
        reservationNumber,
        campaign.id,
        campaign.advertiserId,
        campaign.agencyId,
        campaign.budget,
        campaign.budget * 0.9, // estimated revenue at 90%
        `Auto-generated reservation for campaign at 90% probability: ${campaign.name}`,
        context.userId,
        context.organizationId,
        expiresAt
      ]
    )
    
    if (!reservation || reservation.length === 0) {
      throw new Error('Failed to create reservation')
    }
    
    console.log(`✅ [Reservations] Created reservation ${reservationId} with status 'held' for approval`)
    
    // Get scheduled spots from the campaign
    const spotsQuery = `
      SELECT ss.*, s.name as "showName", e.id as "episodeId"
      FROM "ScheduledSpot" ss
      LEFT JOIN "Show" s ON s.id = ss."showId"
      LEFT JOIN "Episode" e ON e."showId" = ss."showId" 
        AND DATE(e."airDate") = DATE(ss."airDate")
      WHERE ss."campaignId" = $1
    `
    const scheduledSpots = await querySchema<any>(context.organizationSlug, spotsQuery, [campaign.id])
    
    console.log(`📦 [Reservations] Found ${scheduledSpots?.length || 0} scheduled spots`)
    
    if (!scheduledSpots || scheduledSpots.length === 0) {
      console.warn('⚠️ [Reservations] No scheduled spots found for campaign')
      return reservationId
    }
    
    // Create ReservationItem records for each scheduled spot
    for (const spot of scheduledSpots) {
      const itemId = uuidv4()
      const createItemQuery = `
        INSERT INTO "ReservationItem" (
          id, "reservationId", "showId", "episodeId", 
          date, "placementType", "spotNumber", length,
          rate, status, notes, "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW()
        )
      `
      
      await safeQuerySchema(
        context.organizationSlug,
        createItemQuery,
        [
          itemId,
          reservationId,
          spot.showId,
          spot.episodeId,
          spot.airDate,
          spot.placementType || 'mid_roll',
          1, // spotNumber
          spot.duration || 30,
          spot.rate || 0,
          'held',
          `Reserved for ${spot.showName} on ${new Date(spot.airDate).toLocaleDateString()}`
        ]
      )
    }
    
    console.log(`✅ [Reservations] Created ${scheduledSpots.length} reservation items`)
    
    return reservationId
  }

  // Add other existing methods...
  private async enableScheduleBuilder(context: CampaignWorkflowContext, campaign: any) {
    // Implementation
  }

  private async validateSchedule(context: CampaignWorkflowContext, campaign: any): Promise<boolean> {
    // Implementation
    return true
  }

  private async startRateCardDeltaTracking(context: CampaignWorkflowContext, campaign: any) {
    // Implementation
  }

  private async createAdminApprovalRequest(
    context: CampaignWorkflowContext, 
    campaign: any,
    approvalRoles: string[]
  ): Promise<string> {
    const approvalId = uuidv4()
    
    await querySchema(
      context.organizationSlug,
      `INSERT INTO "CampaignApproval" (
        id, "campaignId", status, "requiredRoles", 
        "requestedBy", "requestedAt", "createdAt"
      ) VALUES ($1, $2, 'pending', $3, $4, NOW(), NOW())`,
      [approvalId, campaign.id, approvalRoles, context.userId]
    )
    
    // Calculate rate card variance
    const { data: rateData } = await safeQuerySchema<any>(
      context.organizationSlug,
      `SELECT 
        AVG(CASE 
          WHEN ss."negotiatedRate" > 0 AND s."defaultRate" > 0 
          THEN ((ss."negotiatedRate" - s."defaultRate") / s."defaultRate" * 100)
          ELSE 0 
        END) as variance
      FROM "ScheduledSpot" ss
      JOIN "Show" s ON s.id = ss."showId"
      WHERE ss."campaignId" = $1`,
      [campaign.id]
    )
    
    const variance = rateData?.[0]?.variance || 0
    
    // Send notification using the new notifier service
    await notifyAdminApprovalRequested(
      campaign.id,
      campaign.name,
      campaign.advertiser_name || 'Unknown',
      campaign.budget || 0,
      Math.round(variance),
      variance,
      context.userId, // seller ID
      context.organizationId
    )
    
    return approvalId
  }

  private async createOrderFromCampaign(context: CampaignWorkflowContext, campaign: any) {
    // Implementation
  }

  private async releaseInventoryReservations(context: CampaignWorkflowContext, reservationId: string) {
    // Implementation
  }

  private async clearApprovalNotifications(
    context: CampaignWorkflowContext, 
    campaignId: string, 
    approvalRequestId: string
  ) {
    // Implementation
  }
}