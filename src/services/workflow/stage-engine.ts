import prisma from '@/lib/db/prisma'
import { safeQuerySchema } from '@/lib/db/schema-db'
// We'll use existing notification system
import { NotificationDispatcher } from '@/services/notifications/dispatcher'

const createNotification = async (data: any) => {
  // This is a placeholder - integrate with existing notification system
  console.log('Notification:', data)
}
import { reserveInventory, releaseInventory } from '@/services/inventory/reservation-service'
import { createTalentApproval } from '@/services/approvals/talent-approval-service'
import { checkCategoryConflicts } from '@/services/exclusivity/conflict-checker'
import { generateContract } from '@/services/contracts/contract-service'
import { createBillingSchedule } from '@/services/billing/billing-schedule-service'
import { v4 as uuidv4 } from 'uuid'

interface StageTransitionOptions {
  campaignId: string
  targetStage: number
  organizationId: string
  schemaName: string
  userId: string
  idempotencyKey?: string
  force?: boolean
}

interface TransitionResult {
  success: boolean
  previousStage: number
  currentStage: number
  sideEffects: any[]
  errors: string[]
}

export class StageEngine {
  private static idempotencyCache = new Map<string, TransitionResult>()

  static async transitionToStage(options: StageTransitionOptions): Promise<TransitionResult> {
    const { campaignId, targetStage, organizationId, schemaName, userId, idempotencyKey, force } = options
    
    // Check idempotency
    const cacheKey = idempotencyKey || `${campaignId}-${targetStage}-${Date.now()}`
    if (this.idempotencyCache.has(cacheKey)) {
      console.log(`Idempotent response for transition ${cacheKey}`)
      return this.idempotencyCache.get(cacheKey)!
    }

    const result: TransitionResult = {
      success: false,
      previousStage: 0,
      currentStage: 0,
      sideEffects: [],
      errors: [],
    }

    try {
      // Get organization settings
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { settings: true },
      })

      const settings = (org?.settings as any)?.workflowAutomation || {}

      // Get campaign with lock for update
      const { data: campaigns } = await safeQuerySchema(schemaName, async (schema) => {
        return await prisma.$queryRawUnsafe(`
          SELECT * FROM "${schema}"."Campaign" 
          WHERE id = $1
          FOR UPDATE
        `, campaignId)
      })

      if (!campaigns || campaigns.length === 0) {
        result.errors.push('Campaign not found')
        return result
      }

      const campaign = campaigns[0]
      result.previousStage = campaign.probability

      // Check if transition is allowed
      if (!force && campaign.probability > targetStage) {
        result.errors.push(`Cannot transition backwards from ${campaign.probability}% to ${targetStage}%`)
        return result
      }

      // Execute stage-specific logic
      if (targetStage >= 10 && settings.autoStages?.at10 !== false) {
        await this.handle10PercentStage(campaign, schemaName, result)
      }

      if (targetStage >= 35 && settings.autoStages?.at35 !== false && campaign.probability < 35) {
        await this.handle35PercentStage(campaign, schemaName, settings, result)
      }

      if (targetStage >= 65 && settings.autoStages?.at65 !== false && campaign.probability < 65) {
        await this.handle65PercentStage(campaign, schemaName, settings, userId, result)
      }

      if (targetStage >= 90 && settings.autoStages?.at90 !== false && campaign.probability < 90) {
        await this.handle90PercentStage(campaign, schemaName, settings, userId, result)
      }

      if (targetStage >= 100 && settings.autoStages?.at100 !== false && campaign.probability < 100) {
        await this.handle100PercentStage(campaign, schemaName, settings, userId, result)
      }

      // Update campaign probability
      await safeQuerySchema(schemaName, async (schema) => {
        return await prisma.$executeRawUnsafe(`
          UPDATE "${schema}"."Campaign" 
          SET probability = $1, "updatedAt" = NOW()
          WHERE id = $2
        `, targetStage, campaignId)
      })

      result.currentStage = targetStage
      result.success = true

      // Send notifications
      await this.sendTransitionNotifications(campaign, targetStage, organizationId, result.sideEffects)

      // Cache result for idempotency
      this.idempotencyCache.set(cacheKey, result)

      // Clean up old cache entries after 1 hour
      setTimeout(() => this.idempotencyCache.delete(cacheKey), 3600000)

    } catch (error) {
      console.error('Stage transition error:', error)
      result.errors.push(error instanceof Error ? error.message : 'Unknown error')
    }

    return result
  }

  private static async handle10PercentStage(campaign: any, schemaName: string, result: TransitionResult) {
    // Mark campaign as active pre-sale
    result.sideEffects.push({
      action: 'CAMPAIGN_ACTIVATED',
      description: 'Campaign marked as active pre-sale',
      scheduleBuilderEnabled: true,
      timestamp: new Date().toISOString(),
    })

    // Enable schedule builder access
    await safeQuerySchema(schemaName, async (schema) => {
      return await prisma.$executeRawUnsafe(`
        UPDATE "${schema}"."Campaign" 
        SET status = 'active_presale', "updatedAt" = NOW()
        WHERE id = $1 AND status = 'draft'
      `, campaign.id)
    })
  }

  private static async handle35PercentStage(
    campaign: any, 
    schemaName: string, 
    settings: any, 
    result: TransitionResult
  ) {
    // Check if schedule exists using ScheduleBuilder table
    const { data: schedule } = await safeQuerySchema(schemaName, async (schema) => {
      return await prisma.$queryRawUnsafe(`
        SELECT sb.*, COUNT(sbi.id) as item_count
        FROM "${schema}"."ScheduleBuilder" sb
        LEFT JOIN "${schema}"."ScheduleBuilderItem" sbi ON sb.id = sbi."scheduleId"
        WHERE sb."campaignId" = $1
        GROUP BY sb.id
        ORDER BY sb."createdAt" DESC
        LIMIT 1
      `, campaign.id)
    })

    if (schedule && schedule.length > 0 && schedule[0].item_count > 0) {
      // Get the schedule items to extract rate information
      const { data: items } = await safeQuerySchema(schemaName, async (schema) => {
        return await prisma.$queryRawUnsafe(`
          SELECT "rateCardPrice", "negotiatedPrice", "placementType"
          FROM "${schema}"."ScheduleBuilderItem" 
          WHERE "scheduleId" = $1
        `, schedule[0].id)
      })
      
      // Store baseline rates for delta tracking
      result.sideEffects.push({
        action: 'RATE_DELTA_TRACKING_STARTED',
        description: 'Rate card delta tracking initiated',
        scheduleId: schedule[0].id,
        itemCount: schedule[0].item_count,
        baselineRates: items || [],
        timestamp: new Date().toISOString(),
      })
      
      result.sideEffects.push({
        action: 'SCHEDULE_VALIDATED',
        description: 'Schedule marked as validated with items',
        scheduleId: schedule[0].id,
        timestamp: new Date().toISOString(),
      })
    } else {
      result.sideEffects.push({
        action: 'SCHEDULE_CHECK',
        description: 'No valid schedule with items found',
        timestamp: new Date().toISOString(),
      })
    }
  }

  private static async handle65PercentStage(
    campaign: any, 
    schemaName: string, 
    settings: any, 
    userId: string,
    result: TransitionResult
  ) {
    // Check for talent approval requirement
    const { data: spots } = await safeQuerySchema(schemaName, async (schema) => {
      return await prisma.$queryRawUnsafe(`
        SELECT DISTINCT "spotType" FROM "${schema}"."ScheduledSpot" 
        WHERE "campaignId" = $1
      `, campaign.id)
    })

    const spotTypes = spots?.map((s: any) => s.spotType) || []
    const needsTalentApproval = 
      (settings.talentApprovals?.hostRead && spotTypes.includes('host_read')) ||
      (settings.talentApprovals?.endorsed && spotTypes.includes('endorsement'))

    if (needsTalentApproval) {
      const approvalId = await createTalentApproval({
        campaignId: campaign.id,
        schemaName,
        requestedBy: userId,
        spotTypes,
      })

      result.sideEffects.push({
        action: 'TALENT_APPROVAL_REQUESTED',
        description: 'Talent/Producer approval request created',
        approvalId,
        timestamp: new Date().toISOString(),
      })
    }

    // Check category exclusivity conflicts
    if (settings.exclusivity?.policy && campaign.categoryId) {
      const conflicts = await checkCategoryConflicts({
        campaignId: campaign.id,
        categoryId: campaign.categoryId,
        schemaName,
        policy: settings.exclusivity.policy,
      })

      if (conflicts.length > 0) {
        result.sideEffects.push({
          action: 'EXCLUSIVITY_CONFLICT_DETECTED',
          description: `Category exclusivity ${settings.exclusivity.policy === 'BLOCK' ? 'blocked' : 'warning'}`,
          conflicts,
          timestamp: new Date().toISOString(),
        })

        if (settings.exclusivity.policy === 'BLOCK') {
          throw new Error('Category exclusivity conflict - transition blocked')
        }
      }
    }
  }

  private static async handle90PercentStage(
    campaign: any, 
    schemaName: string, 
    settings: any, 
    userId: string,
    result: TransitionResult
  ) {
    // Reserve inventory
    if (settings.inventory?.reserveAt90 !== false) {
      const reservationIds = await reserveInventory({
        campaignId: campaign.id,
        schemaName,
        ttlHours: settings.inventory?.reservationTtlHours || 72,
        userId,
      })

      result.sideEffects.push({
        action: 'INVENTORY_RESERVED',
        description: `Inventory reserved with ${settings.inventory?.reservationTtlHours || 72} hour TTL`,
        reservationIds,
        timestamp: new Date().toISOString(),
      })
    }

    // Move to reservations status
    await safeQuerySchema(schemaName, async (schema) => {
      return await prisma.$executeRawUnsafe(`
        UPDATE "${schema}"."Campaign" 
        SET status = 'in_reservations', "updatedAt" = NOW()
        WHERE id = $1
      `, campaign.id)
    })

    result.sideEffects.push({
      action: 'MOVED_TO_RESERVATIONS',
      description: 'Campaign moved to reservations pending approval',
      timestamp: new Date().toISOString(),
    })
  }

  private static async handle100PercentStage(
    campaign: any, 
    schemaName: string, 
    settings: any, 
    userId: string,
    result: TransitionResult
  ) {
    // Create order (Post-Sale)
    const orderId = uuidv4()
    await safeQuerySchema(schemaName, async (schema) => {
      return await prisma.$executeRawUnsafe(`
        INSERT INTO "${schema}"."Order" (
          id, "campaignId", "advertiserId", "agencyId", 
          "totalAmount", status, "createdAt", "updatedAt", "createdBy"
        )
        SELECT 
          $1, id, "advertiserId", "agencyId",
          "totalBudget", 'confirmed', NOW(), NOW(), $2
        FROM "${schema}"."Campaign"
        WHERE id = $3
      `, orderId, userId, campaign.id)
    })

    result.sideEffects.push({
      action: 'ORDER_CREATED',
      description: 'Campaign copied to Post-Sale (Order)',
      orderId,
      timestamp: new Date().toISOString(),
    })

    // Generate ad requests
    const adRequestIds = await this.generateAdRequests(campaign.id, schemaName, userId)
    result.sideEffects.push({
      action: 'AD_REQUESTS_GENERATED',
      description: 'Ad requests created for shows/talent',
      adRequestIds,
      timestamp: new Date().toISOString(),
    })

    // Generate contract
    if (settings.contracts?.autoGenerate !== false) {
      const contractId = await generateContract({
        orderId,
        schemaName,
        templateId: settings.contracts?.emailTemplateId || 'contract_default',
        userId,
      })

      result.sideEffects.push({
        action: 'CONTRACT_GENERATED',
        description: `Contract generated using template: ${settings.contracts?.emailTemplateId || 'default'}`,
        contractId,
        timestamp: new Date().toISOString(),
      })
    }

    // Create billing schedule
    if (settings.billing) {
      const billingScheduleId = await createBillingSchedule({
        orderId,
        schemaName,
        dayOfMonth: settings.billing.invoiceDayOfMonth || 15,
        timezone: settings.billing.timezone || 'America/Los_Angeles',
        prebillEnabled: settings.billing.prebillWhenNoTerms,
        userId,
      })

      result.sideEffects.push({
        action: 'BILLING_SCHEDULE_CREATED',
        description: `Monthly billing schedule created (day ${settings.billing.invoiceDayOfMonth || 15})`,
        billingScheduleId,
        prebillEnabled: settings.billing.prebillWhenNoTerms,
        timestamp: new Date().toISOString(),
      })
    }

    // Update campaign status to approved
    await safeQuerySchema(schemaName, async (schema) => {
      return await prisma.$executeRawUnsafe(`
        UPDATE "${schema}"."Campaign" 
        SET status = 'approved', "updatedAt" = NOW()
        WHERE id = $1
      `, campaign.id)
    })
  }

  private static async generateAdRequests(campaignId: string, schemaName: string, userId: string): Promise<string[]> {
    // Get scheduled spots
    const { data: spots } = await safeQuerySchema(schemaName, async (schema) => {
      return await prisma.$queryRawUnsafe(`
        SELECT DISTINCT "showId" FROM "${schema}"."ScheduledSpot"
        WHERE "campaignId" = $1
      `, campaignId)
    })

    const adRequestIds: string[] = []
    
    for (const spot of spots || []) {
      const adRequestId = uuidv4()
      await safeQuerySchema(schemaName, async (schema) => {
        return await prisma.$executeRawUnsafe(`
          INSERT INTO "${schema}"."AdRequest" (
            id, "campaignId", "showId", status, 
            "createdAt", "updatedAt", "createdBy"
          ) VALUES ($1, $2, $3, 'pending', NOW(), NOW(), $4)
        `, adRequestId, campaignId, spot.showId, userId)
      })
      adRequestIds.push(adRequestId)
    }

    return adRequestIds
  }

  private static async sendTransitionNotifications(
    campaign: any, 
    targetStage: number, 
    organizationId: string,
    sideEffects: any[]
  ) {
    const notifications = []

    // Base notification for status change
    notifications.push({
      type: 'campaign_status_changed',
      title: 'Campaign Status Updated',
      message: `Campaign ${campaign.name} moved to ${targetStage}%`,
      organizationId,
      data: { campaignId: campaign.id, stage: targetStage },
    })

    // Add specific notifications based on side effects
    for (const effect of sideEffects) {
      switch (effect.action) {
        case 'TALENT_APPROVAL_REQUESTED':
          notifications.push({
            type: 'talent_approval_requested',
            title: 'Talent Approval Required',
            message: `Campaign ${campaign.name} requires talent approval`,
            organizationId,
            data: { campaignId: campaign.id, approvalId: effect.approvalId },
          })
          break
        case 'INVENTORY_RESERVED':
          notifications.push({
            type: 'inventory_reserved',
            title: 'Inventory Reserved',
            message: `Inventory reserved for campaign ${campaign.name}`,
            organizationId,
            data: { campaignId: campaign.id, reservationIds: effect.reservationIds },
          })
          break
        case 'CONTRACT_GENERATED':
          notifications.push({
            type: 'contract_generated',
            title: 'Contract Generated',
            message: `Contract generated for campaign ${campaign.name}`,
            organizationId,
            data: { campaignId: campaign.id, contractId: effect.contractId },
          })
          break
      }
    }

    // Dispatch all notifications
    for (const notification of notifications) {
      await createNotification(notification)
    }
  }

  static async rejectAt90Percent(campaignId: string, schemaName: string, userId: string): Promise<TransitionResult> {
    const result: TransitionResult = {
      success: false,
      previousStage: 90,
      currentStage: 65,
      sideEffects: [],
      errors: [],
    }

    try {
      // Release inventory reservations
      const releasedCount = await releaseInventory({ campaignId, schemaName })
      
      result.sideEffects.push({
        action: 'INVENTORY_RELEASED',
        description: `Released ${releasedCount} inventory reservations`,
        timestamp: new Date().toISOString(),
      })

      // Move campaign back to 65%
      await safeQuerySchema(schemaName, async (schema) => {
        return await prisma.$executeRawUnsafe(`
          UPDATE "${schema}"."Campaign" 
          SET probability = 65, status = 'needs_revision', "updatedAt" = NOW()
          WHERE id = $1
        `, campaignId)
      })

      result.success = true

    } catch (error) {
      console.error('Error rejecting campaign at 90%:', error)
      result.errors.push(error instanceof Error ? error.message : 'Unknown error')
    }

    return result
  }
}