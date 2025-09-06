import { WorkflowSettingsService } from './workflow-settings-service'
import { safeQuerySchema, querySchema } from '@/lib/db/schema-db'
import { notificationService } from '@/lib/notifications/notification-service'

// Supported workflow events
export enum WorkflowEvent {
  CAMPAIGN_CREATED = 'campaign_created',
  SCHEDULE_CREATED = 'schedule_created',
  SCHEDULE_VALIDATED = 'schedule_validated',
  PROBABILITY_UPDATED = 'probability_updated',
  INVENTORY_RESERVED = 'inventory_reserved',
  CONTRACT_GENERATED = 'contract_generated',
  IO_UPLOADED = 'io_uploaded',
  INVOICE_GENERATED = 'invoice_generated',
  RATE_DELTA_DETECTED = 'rate_delta_detected',
  BUDGET_THRESHOLD_CROSSED = 'budget_threshold_crossed',
  FIRST_SPOT_BOOKED = 'first_spot_booked',
}

// Context for trigger evaluation
export interface TriggerContext {
  orgSlug: string
  orgId: string
  userId: string
  userName?: string
  userRole: string
  event: WorkflowEvent
  entityType: string
  entityId: string
  data: Record<string, any>
}

// Trigger action result
interface ActionResult {
  success: boolean
  error?: string
  data?: any
}

export class TriggerEvaluator {
  /**
   * Evaluate triggers for a workflow event
   */
  static async evaluateEvent(context: TriggerContext): Promise<void> {
    try {
      console.log(`[TriggerEvaluator] Evaluating event: ${context.event}`, {
        entityType: context.entityType,
        entityId: context.entityId,
      })

      // Get enabled triggers for this event
      const triggers = await WorkflowSettingsService.getTriggers(context.orgSlug, {
        event: context.event,
        isEnabled: true,
      })

      if (triggers.length === 0) {
        console.log(`[TriggerEvaluator] No triggers found for event: ${context.event}`)
        return
      }

      // Sort by priority
      triggers.sort((a, b) => (b.priority || 100) - (a.priority || 100))

      // Evaluate each trigger
      for (const trigger of triggers) {
        try {
          await this.evaluateTrigger(trigger, context)
        } catch (error) {
          console.error(`[TriggerEvaluator] Error evaluating trigger ${trigger.id}:`, error)
          // Continue with other triggers
        }
      }
    } catch (error) {
      console.error('[TriggerEvaluator] Error in evaluateEvent:', error)
    }
  }

  /**
   * Evaluate a single trigger
   */
  private static async evaluateTrigger(trigger: any, context: TriggerContext): Promise<void> {
    console.log(`[TriggerEvaluator] Evaluating trigger: ${trigger.name}`)

    // Check if already executed (idempotency)
    const { data: existing } = await safeQuerySchema<any>(
      context.orgSlug,
      `SELECT id FROM "TriggerExecutionLog" 
       WHERE "triggerId" = $1 AND "entityId" = $2 AND event = $3`,
      [trigger.id, context.entityId, context.event]
    )

    if (existing && existing.length > 0) {
      console.log(`[TriggerEvaluator] Trigger ${trigger.id} already executed for entity ${context.entityId}`)
      return
    }

    // Evaluate condition
    if (trigger.condition) {
      const conditionMet = await this.evaluateCondition(trigger.condition, context)
      if (!conditionMet) {
        console.log(`[TriggerEvaluator] Condition not met for trigger: ${trigger.name}`)
        await this.logExecution(trigger, context, 'skipped', null, 'Condition not met')
        return
      }
    }

    // Execute actions
    const results: ActionResult[] = []
    let hasError = false

    for (const action of trigger.actions || []) {
      try {
        const result = await this.executeAction(action, context)
        results.push(result)
        if (!result.success) {
          hasError = true
          console.error(`[TriggerEvaluator] Action failed:`, result.error)
        }
      } catch (error: any) {
        hasError = true
        results.push({ success: false, error: error.message })
        console.error(`[TriggerEvaluator] Action execution error:`, error)
      }
    }

    // Log execution
    await this.logExecution(
      trigger,
      context,
      hasError ? 'failed' : 'success',
      results,
      hasError ? 'One or more actions failed' : undefined
    )

    // Update trigger execution count
    await querySchema(
      context.orgSlug,
      `UPDATE "WorkflowTrigger" 
       SET "lastExecutedAt" = NOW(), 
           "executionCount" = COALESCE("executionCount", 0) + 1
       WHERE id = $1`,
      [trigger.id]
    )
  }

  /**
   * Evaluate a condition
   */
  private static async evaluateCondition(
    condition: any,
    context: TriggerContext
  ): Promise<boolean> {
    // Handle AND conditions
    if (condition.and && Array.isArray(condition.and)) {
      for (const subCondition of condition.and) {
        const result = await this.evaluateCondition(subCondition, context)
        if (!result) return false
      }
      return true
    }

    // Handle OR conditions
    if (condition.or && Array.isArray(condition.or)) {
      for (const subCondition of condition.or) {
        const result = await this.evaluateCondition(subCondition, context)
        if (result) return true
      }
      return false
    }

    // Evaluate single condition
    const { field, operator, value } = condition
    const fieldValue = this.getFieldValue(field, context.data)

    switch (operator) {
      case 'eq':
        return fieldValue === value
      case 'neq':
        return fieldValue !== value
      case 'gt':
        return Number(fieldValue) > Number(value)
      case 'gte':
        return Number(fieldValue) >= Number(value)
      case 'lt':
        return Number(fieldValue) < Number(value)
      case 'lte':
        return Number(fieldValue) <= Number(value)
      case 'in':
        return Array.isArray(value) && value.includes(fieldValue)
      case 'nin':
        return Array.isArray(value) && !value.includes(fieldValue)
      case 'contains':
        return String(fieldValue).includes(String(value))
      case 'regex':
        return new RegExp(value).test(String(fieldValue))
      default:
        return false
    }
  }

  /**
   * Get field value from data object using dot notation
   */
  private static getFieldValue(field: string, data: any): any {
    const parts = field.split('.')
    let value = data

    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = value[part]
      } else {
        return undefined
      }
    }

    return value
  }

  /**
   * Execute an action
   */
  private static async executeAction(
    action: any,
    context: TriggerContext
  ): Promise<ActionResult> {
    const { type, config } = action

    switch (type) {
      case 'send_notification':
        return await this.actionSendNotification(config, context)
      
      case 'create_reservation':
        return await this.actionCreateReservation(config, context)
      
      case 'require_approval':
        return await this.actionRequireApproval(config, context)
      
      case 'change_probability':
        return await this.actionChangeProbability(config, context)
      
      case 'transition_status':
        return await this.actionTransitionStatus(config, context)
      
      case 'emit_webhook':
        return await this.actionEmitWebhook(config, context)
      
      default:
        return { success: false, error: `Unknown action type: ${type}` }
    }
  }

  /**
   * Action: Send notification
   */
  private static async actionSendNotification(
    config: any,
    context: TriggerContext
  ): Promise<ActionResult> {
    try {
      const { toRoles, toUsers, templateId, data, channels } = config

      // Determine recipients
      let userIds: string[] = []
      
      if (toUsers && Array.isArray(toUsers)) {
        userIds = toUsers
      }
      
      if (toRoles && Array.isArray(toRoles)) {
        const { data: roleUsers } = await safeQuerySchema<any>(
          'public',
          `SELECT id FROM "User" 
           WHERE "organizationId" = $1 AND role = ANY($2) AND status = 'active'`,
          [context.orgId, toRoles]
        )
        
        if (roleUsers) {
          userIds = [...userIds, ...roleUsers.map((u: any) => u.id)]
        }
      }

      // Remove duplicates
      userIds = [...new Set(userIds)]

      // Send notifications
      for (const userId of userIds) {
        await notificationService.createNotification({
          userId,
          title: data?.title || `Workflow Event: ${context.event}`,
          message: data?.message || `A workflow trigger was executed for ${context.entityType} ${context.entityId}`,
          type: 'workflow',
          category: 'automation',
          actionUrl: data?.actionUrl,
          metadata: {
            triggeredBy: context.userId,
            event: context.event,
            entityType: context.entityType,
            entityId: context.entityId,
            ...data,
          },
        })
      }

      return { success: true, data: { recipients: userIds.length } }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  /**
   * Action: Create reservation
   */
  private static async actionCreateReservation(
    config: any,
    context: TriggerContext
  ): Promise<ActionResult> {
    try {
      if (context.entityType !== 'campaign') {
        return { success: false, error: 'Reservations can only be created for campaigns' }
      }

      // Import workflow service to avoid circular dependency
      const { CampaignWorkflowService } = await import('./campaign-workflow-service')
      
      // Create reservation (reuse existing logic)
      const workflowContext = {
        organizationSlug: context.orgSlug,
        organizationId: context.orgId,
        userId: context.userId,
        userName: context.userName,
        userRole: context.userRole,
      }

      const reservationId = await new CampaignWorkflowService().createInventoryReservations(
        workflowContext as any,
        context.data.campaign
      )

      return { success: true, data: { reservationId } }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  /**
   * Action: Require approval
   */
  private static async actionRequireApproval(
    config: any,
    context: TriggerContext
  ): Promise<ActionResult> {
    try {
      const { type: approvalType, roles } = config

      if (context.entityType !== 'campaign') {
        return { success: false, error: 'Approvals can only be created for campaigns' }
      }

      const approvalId = `appr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      // Create approval request
      await querySchema(
        context.orgSlug,
        `INSERT INTO "CampaignApproval" (
          id, "campaignId", status, "requiredRoles", 
          "requestedBy", "requestedAt", "createdAt"
        ) VALUES ($1, $2, 'pending', $3, $4, NOW(), NOW())`,
        [approvalId, context.entityId, roles || ['admin'], context.userId]
      )

      // Send notifications to approvers
      const { data: approvers } = await safeQuerySchema<any>(
        'public',
        `SELECT id, email, name FROM "User" 
         WHERE "organizationId" = $1 AND role = ANY($2) AND status = 'active'`,
        [context.orgId, roles || ['admin']]
      )

      if (approvers) {
        for (const approver of approvers) {
          await notificationService.createNotification({
            userId: approver.id,
            title: 'Campaign Approval Required',
            message: `Campaign "${context.data.campaign?.name}" requires your approval`,
            type: 'approval',
            category: 'campaign',
            priority: 'high',
            actionUrl: `/admin/approvals`,
            metadata: {
              campaignId: context.entityId,
              approvalId,
            },
          })
        }
      }

      return { success: true, data: { approvalId } }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  /**
   * Action: Change probability
   */
  private static async actionChangeProbability(
    config: any,
    context: TriggerContext
  ): Promise<ActionResult> {
    try {
      if (context.entityType !== 'campaign') {
        return { success: false, error: 'Probability can only be changed for campaigns' }
      }

      const { to, operation = 'set' } = config
      let newProbability = to

      if (operation === 'add') {
        newProbability = (context.data.campaign?.probability || 0) + to
      } else if (operation === 'subtract') {
        newProbability = (context.data.campaign?.probability || 0) - to
      }

      // Ensure probability is within bounds
      newProbability = Math.max(0, Math.min(100, newProbability))

      await querySchema(
        context.orgSlug,
        `UPDATE "Campaign" 
         SET probability = $2, "updatedAt" = NOW()
         WHERE id = $1`,
        [context.entityId, newProbability]
      )

      return { success: true, data: { probability: newProbability } }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  /**
   * Action: Transition status
   */
  private static async actionTransitionStatus(
    config: any,
    context: TriggerContext
  ): Promise<ActionResult> {
    try {
      if (context.entityType !== 'campaign') {
        return { success: false, error: 'Status can only be changed for campaigns' }
      }

      const { to } = config

      await querySchema(
        context.orgSlug,
        `UPDATE "Campaign" 
         SET status = $2, "updatedAt" = NOW()
         WHERE id = $1`,
        [context.entityId, to]
      )

      return { success: true, data: { status: to } }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  /**
   * Action: Emit webhook
   */
  private static async actionEmitWebhook(
    config: any,
    context: TriggerContext
  ): Promise<ActionResult> {
    try {
      const { url, secret, payload, method = 'POST', headers = {} } = config

      // Prepare payload
      const webhookPayload = {
        event: context.event,
        entityType: context.entityType,
        entityId: context.entityId,
        organizationId: context.orgId,
        triggeredBy: context.userId,
        timestamp: new Date().toISOString(),
        data: payload || context.data,
      }

      // Add signature if secret provided
      if (secret) {
        const crypto = await import('crypto')
        const signature = crypto
          .createHmac('sha256', secret)
          .update(JSON.stringify(webhookPayload))
          .digest('hex')
        headers['X-Webhook-Signature'] = signature
      }

      // Send webhook
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify(webhookPayload),
      })

      if (!response.ok) {
        throw new Error(`Webhook failed with status: ${response.status}`)
      }

      return { success: true, data: { status: response.status } }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  /**
   * Log trigger execution
   */
  private static async logExecution(
    trigger: any,
    context: TriggerContext,
    status: 'success' | 'failed' | 'skipped',
    results: any,
    error?: string
  ): Promise<void> {
    try {
      await querySchema(
        context.orgSlug,
        `INSERT INTO "TriggerExecutionLog" (
          id, "triggerId", "entityType", "entityId", event,
          condition, actions, result, status, error,
          "executedAt", "executedBy"
        ) VALUES (
          gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10
        )`,
        [
          trigger.id,
          context.entityType,
          context.entityId,
          context.event,
          trigger.condition ? JSON.stringify(trigger.condition) : null,
          trigger.actions ? JSON.stringify(trigger.actions) : null,
          results ? JSON.stringify(results) : null,
          status,
          error,
          context.userId,
        ]
      )
    } catch (logError) {
      console.error('[TriggerEvaluator] Error logging execution:', logError)
    }
  }
}