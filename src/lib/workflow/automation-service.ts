import { safeQuerySchema, getUserOrgSlug } from '@/lib/db/schema-db'
import { invalidateCache } from '@/lib/cache/dashboard-cache'
import prisma from '@/lib/db/prisma'

interface WorkflowContext {
  userId: string
  orgSlug: string
  organizationId: string
  entityId: string
  entityType: 'campaign' | 'order' | 'contract' | 'approval'
  previousState?: string
  newState: string
  metadata?: any
}

interface AutomationRule {
  id: string
  name: string
  trigger: {
    entityType: string
    fromState?: string
    toState: string
    conditions?: any[]
  }
  actions: Array<{
    type: 'create_contract' | 'create_ad_request' | 'send_notification' | 'update_status' | 'assign_task' | 'create_invoice' | 'create_order'
    config: any
  }>
  isActive: boolean
}

// Default automation rules for post-sale workflow
const DEFAULT_AUTOMATION_RULES: AutomationRule[] = [
  {
    id: 'order-approved-to-contract',
    name: 'Auto-generate contract when order is approved',
    trigger: {
      entityType: 'order',
      fromState: 'pending_approval',
      toState: 'approved'
    },
    actions: [
      {
        type: 'create_contract',
        config: {
          templateType: 'insertion_order',
          autoSend: false,
          includeOrderItems: true
        }
      },
      {
        type: 'send_notification',
        config: {
          recipients: ['order_creator', 'admin_users'],
          type: 'order_approved',
          template: 'order_approved_contract_generated'
        }
      }
    ],
    isActive: true
  },
  {
    id: 'order-booked-to-ad-requests',
    name: 'Auto-generate ad requests when order is booked',
    trigger: {
      entityType: 'order',
      fromState: 'approved',
      toState: 'booked'
    },
    actions: [
      {
        type: 'create_ad_request',
        config: {
          createForEachOrderItem: true,
          defaultStatus: 'pending_creation',
          assignToCreativeTeam: true
        }
      },
      {
        type: 'assign_task',
        config: {
          taskType: 'creative_brief',
          assignToRole: 'producer',
          dueInDays: 3,
          priority: 'high'
        }
      }
    ],
    isActive: true
  },
  {
    id: 'contract-signed-to-billing',
    name: 'Trigger billing setup when contract is fully signed',
    trigger: {
      entityType: 'contract',
      toState: 'signed'
    },
    actions: [
      {
        type: 'update_status',
        config: {
          targetEntity: 'order',
          newStatus: 'ready_for_production',
          condition: 'all_contracts_signed'
        }
      },
      {
        type: 'send_notification',
        config: {
          recipients: ['billing_team', 'account_manager'],
          type: 'contract_signed',
          template: 'contract_signed_billing_ready'
        }
      }
    ],
    isActive: true
  },
  {
    id: 'campaign-won-to-order',
    name: 'Auto-create order when campaign probability reaches 100%',
    trigger: {
      entityType: 'campaign',
      toState: 'won',
      conditions: [
        {
          field: 'probability',
          operator: 'equals',
          value: 100
        }
      ]
    },
    actions: [
      {
        type: 'create_order',
        config: {
          includeCampaignDetails: true,
          defaultStatus: 'draft',
          copyOrderItems: true
        }
      },
      {
        type: 'send_notification',
        config: {
          recipients: ['sales_team', 'admin_users'],
          type: 'campaign_won',
          template: 'campaign_won_order_created'
        }
      }
    ],
    isActive: true
  },
  {
    id: 'order-confirmed-to-invoice',
    name: 'Auto-generate invoice when order is confirmed',
    trigger: {
      entityType: 'order',
      fromState: 'booked',
      toState: 'confirmed'
    },
    actions: [
      {
        type: 'create_invoice',
        config: {
          includeOrderItems: true,
          defaultStatus: 'draft',
          paymentTerms: 'Net 30',
          autoCalculateTotals: true
        }
      },
      {
        type: 'send_notification',
        config: {
          recipients: ['billing_team', 'account_manager'],
          type: 'invoice_generated',
          template: 'order_confirmed_invoice_generated'
        }
      }
    ],
    isActive: true
  },
  {
    id: 'monthly-billing-automation',
    name: 'Generate monthly invoices for delivered spots',
    trigger: {
      entityType: 'episode',
      toState: 'aired',
      conditions: [
        {
          field: 'hasActiveOrders',
          operator: 'equals',
          value: true
        }
      ]
    },
    actions: [
      {
        type: 'create_invoice',
        config: {
          invoiceType: 'monthly_delivery',
          groupByAdvertiser: true,
          includeDeliveredSpots: true,
          autoSend: false
        }
      },
      {
        type: 'send_notification',
        config: {
          recipients: ['billing_team'],
          type: 'monthly_invoice_generated',
          template: 'monthly_billing_ready'
        }
      }
    ],
    isActive: false // Disabled by default, enable as needed
  }
]

export class WorkflowAutomationService {
  private static instance: WorkflowAutomationService
  private rules: AutomationRule[] = DEFAULT_AUTOMATION_RULES

  static getInstance(): WorkflowAutomationService {
    if (!WorkflowAutomationService.instance) {
      WorkflowAutomationService.instance = new WorkflowAutomationService()
    }
    return WorkflowAutomationService.instance
  }

  async executeAutomations(context: WorkflowContext): Promise<void> {
    try {
      console.log(`🤖 Executing automations for ${context.entityType} ${context.entityId}: ${context.previousState} → ${context.newState}`)

      // Find matching rules
      const matchingRules = this.findMatchingRules(context)
      
      if (matchingRules.length === 0) {
        console.log(`No automation rules matched for ${context.entityType} transition`)
        return
      }

      // Execute all matching rules
      for (const rule of matchingRules) {
        await this.executeRule(rule, context)
      }

      // Invalidate cache after automations
      invalidateCache.organization(context.orgSlug)

    } catch (error) {
      console.error('Error executing workflow automations:', error)
      // Don't throw - automations should not block the main workflow
    }
  }

  private findMatchingRules(context: WorkflowContext): AutomationRule[] {
    return this.rules.filter(rule => {
      if (!rule.isActive) return false
      
      // Check entity type
      if (rule.trigger.entityType !== context.entityType) return false
      
      // Check state transition
      if (rule.trigger.fromState && rule.trigger.fromState !== context.previousState) return false
      if (rule.trigger.toState !== context.newState) return false
      
      // Check additional conditions
      if (rule.trigger.conditions) {
        return this.evaluateConditions(rule.trigger.conditions, context)
      }
      
      return true
    })
  }

  private evaluateConditions(conditions: any[], context: WorkflowContext): boolean {
    // Simple condition evaluation - can be extended
    return conditions.every(condition => {
      const value = context.metadata?.[condition.field]
      switch (condition.operator) {
        case 'equals':
          return value === condition.value
        case 'greater_than':
          return value > condition.value
        case 'less_than':
          return value < condition.value
        case 'contains':
          return Array.isArray(value) ? value.includes(condition.value) : String(value).includes(condition.value)
        default:
          return true
      }
    })
  }

  private async executeRule(rule: AutomationRule, context: WorkflowContext): Promise<void> {
    console.log(`📋 Executing rule: ${rule.name}`)

    for (const action of rule.actions) {
      try {
        await this.executeAction(action, context)
      } catch (error) {
        console.error(`Error executing action ${action.type} for rule ${rule.name}:`, error)
        // Continue with other actions even if one fails
      }
    }
  }

  private async executeAction(action: any, context: WorkflowContext): Promise<void> {
    switch (action.type) {
      case 'create_contract':
        await this.createContract(action.config, context)
        break
      case 'create_ad_request':
        await this.createAdRequest(action.config, context)
        break
      case 'create_order':
        await this.createOrder(action.config, context)
        break
      case 'create_invoice':
        await this.createInvoice(action.config, context)
        break
      case 'send_notification':
        await this.sendNotification(action.config, context)
        break
      case 'assign_task':
        await this.assignTask(action.config, context)
        break
      case 'update_status':
        await this.updateEntityStatus(action.config, context)
        break
      default:
        console.log(`Unknown action type: ${action.type}`)
    }
  }

  private async createContract(config: any, context: WorkflowContext): Promise<void> {
    if (context.entityType !== 'order') return

    console.log('🗃️ Auto-creating contract for order:', context.entityId)

    // Get order details
    const { data: orders, error } = await safeQuerySchema(context.orgSlug, `
      SELECT o.*, c.name as campaign_name, a.name as advertiser_name, ag.name as agency_name
      FROM "Order" o
      LEFT JOIN "Campaign" c ON c.id = o."campaignId"
      LEFT JOIN "Advertiser" a ON a.id = o."advertiserId"
      LEFT JOIN "Agency" ag ON ag.id = o."agencyId"
      WHERE o.id = $1
    `, [context.entityId])

    if (error || !orders?.[0]) {
      console.error('Failed to fetch order for contract creation:', error)
      return
    }

    const order = orders[0]

    // Get order items
    const { data: orderItems } = await safeQuerySchema(context.orgSlug, `
      SELECT oi.*, s.name as show_name
      FROM "OrderItem" oi
      LEFT JOIN "Show" s ON s.id = oi."showId"
      WHERE oi."orderId" = $1
    `, [context.entityId])

    // Generate contract number
    const currentYear = new Date().getFullYear()
    const contractNumber = `IO-${currentYear}-${String(Date.now()).slice(-5)}`

    // Create contract
    const contractId = `con_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const { error: contractError } = await safeQuerySchema(context.orgSlug, `
      INSERT INTO "Contract" (
        id, "contractNumber", "orderId", "campaignId", "advertiserId", "agencyId",
        "contractType", "title", "totalAmount", "netAmount", "startDate", "endDate",
        "paymentTerms", "createdById", "createdAt", "updatedAt", "status"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW(), 'draft'
      )
    `, [
      contractId,
      contractNumber,
      order.id,
      order.campaignId,
      order.advertiserId,
      order.agencyId || null,
      config.templateType || 'insertion_order',
      `${config.templateType === 'insertion_order' ? 'Insertion Order' : 'Contract'} - ${order.campaign_name}`,
      order.totalAmount,
      order.netAmount,
      order.startDate || new Date(),
      order.endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Default 30 days
      'Net 30',
      context.userId
    ])

    if (contractError) {
      console.error('Failed to create contract:', contractError)
      return
    }

    // Create contract line items if configured
    if (config.includeOrderItems && orderItems) {
      for (const item of orderItems) {
        const lineItemId = `cli_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        
        await safeQuerySchema(context.orgSlug, `
          INSERT INTO "ContractLineItem" (
            id, "contractId", "description", "quantity", "unitPrice", "totalPrice",
            "netPrice", "showId", "orderItemId", "createdAt", "updatedAt"
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()
          )
        `, [
          lineItemId,
          contractId,
          `${item.show_name} - ${item.placementType} spot`,
          1,
          item.rate,
          item.rate,
          item.rate,
          item.showId,
          item.id
        ])
      }
    }

    console.log(`✅ Contract ${contractNumber} created successfully`)
  }

  private async createAdRequest(config: any, context: WorkflowContext): Promise<void> {
    if (context.entityType !== 'order') return

    console.log('🎨 Auto-creating ad requests for order:', context.entityId)

    // Get order items
    const { data: orderItems } = await safeQuerySchema(context.orgSlug, `
      SELECT oi.*, s.name as show_name, o."campaignId", c.name as campaign_name
      FROM "OrderItem" oi
      LEFT JOIN "Show" s ON s.id = oi."showId"
      LEFT JOIN "Order" o ON o.id = oi."orderId"
      LEFT JOIN "Campaign" c ON c.id = o."campaignId"
      WHERE oi."orderId" = $1
    `, [context.entityId])

    if (!orderItems) return

    for (const item of orderItems) {
      const approvalId = `app_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      await safeQuerySchema(context.orgSlug, `
        INSERT INTO "AdApproval" (
          id, "orderId", "campaignId", "orderItemId", "showId",
          "title", "status", "assignedToId", "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()
        )
      `, [
        approvalId,
        context.entityId,
        item.campaignId,
        item.id,
        item.showId,
        `Ad Creative for ${item.show_name} - ${item.campaign_name}`,
        config.defaultStatus || 'pending_creation',
        context.userId // Will be reassigned if needed
      ])
    }

    console.log(`✅ Ad requests created for ${orderItems.length} order items`)
  }

  private async createOrder(config: any, context: WorkflowContext): Promise<void> {
    if (context.entityType !== 'campaign') return

    console.log('📋 Auto-creating order from campaign:', context.entityId)

    // Get campaign details
    const { data: campaigns } = await safeQuerySchema(context.orgSlug, `
      SELECT c.*, a.name as advertiser_name, ag.name as agency_name
      FROM "Campaign" c
      LEFT JOIN "Advertiser" a ON a.id = c."advertiserId"
      LEFT JOIN "Agency" ag ON ag.id = c."agencyId"
      WHERE c.id = $1
    `, [context.entityId])

    if (!campaigns?.[0]) return

    const campaign = campaigns[0]
    const orderNumber = `ORD-${Date.now()}`
    const orderId = `ord_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    await safeQuerySchema(context.orgSlug, `
      INSERT INTO "Order" (
        id, "orderNumber", "campaignId", "advertiserId", "agencyId",
        "totalAmount", "netAmount", "status", "createdBy", "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()
      )
    `, [
      orderId,
      orderNumber,
      campaign.id,
      campaign.advertiserId,
      campaign.agencyId || null,
      campaign.budget || 0,
      campaign.budget || 0,
      config.defaultStatus || 'draft',
      context.userId
    ])

    console.log(`✅ Order ${orderNumber} created from campaign`)
  }

  private async createInvoice(config: any, context: WorkflowContext): Promise<void> {
    if (context.entityType !== 'order' && context.entityType !== 'episode') return

    console.log('💰 Auto-creating invoice for:', context.entityType, context.entityId)

    if (context.entityType === 'order') {
      // Get order details
      const { data: orders, error } = await safeQuerySchema(context.orgSlug, `
        SELECT o.*, c.name as campaign_name, a.name as advertiser_name, ag.name as agency_name
        FROM "Order" o
        LEFT JOIN "Campaign" c ON c.id = o."campaignId"
        LEFT JOIN "Advertiser" a ON a.id = o."advertiserId"
        LEFT JOIN "Agency" ag ON ag.id = o."agencyId"
        WHERE o.id = $1
      `, [context.entityId])

      if (error || !orders?.[0]) {
        console.error('Failed to fetch order for invoice creation:', error)
        return
      }

      const order = orders[0]

      // Get order items
      const { data: orderItems } = await safeQuerySchema(context.orgSlug, `
        SELECT oi.*, s.name as show_name
        FROM "OrderItem" oi
        LEFT JOIN "Show" s ON s.id = oi."showId"
        WHERE oi."orderId" = $1
      `, [context.entityId])

      if (!orderItems || orderItems.length === 0) {
        console.log('No order items found, skipping invoice creation')
        return
      }

      // Generate invoice number
      const currentYear = new Date().getFullYear()
      const invoiceNumber = `INV-${currentYear}-${String(Date.now()).slice(-5)}`
      
      // Calculate totals
      const totalAmount = orderItems.reduce((sum, item) => sum + (item.rate || 0), 0)

      // Create invoice
      const invoiceId = `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      const { error: invoiceError } = await safeQuerySchema(context.orgSlug, `
        INSERT INTO "Invoice" (
          id, "invoiceNumber", "organizationId", amount, currency, description,
          "issueDate", "dueDate", status, notes, "totalAmount", "createdAt", "updatedAt",
          "createdById"
        ) VALUES (
          $1, $2, $3, $4, 'USD', $5, NOW(), $6, $7, $8, $9, NOW(), NOW(), $10
        )
      `, [
        invoiceId,
        invoiceNumber,
        context.orgSlug,
        totalAmount,
        `Invoice for ${order.campaign_name} - Order ${order.orderNumber}`,
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        config.defaultStatus || 'draft',
        `Auto-generated from order ${order.orderNumber}`,
        totalAmount,
        context.userId
      ])

      if (invoiceError) {
        console.error('Failed to create invoice:', invoiceError)
        return
      }

      // Create invoice items if configured
      if (config.includeOrderItems && orderItems) {
        for (const item of orderItems) {
          const lineItemId = `ili_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          
          await safeQuerySchema(context.orgSlug, `
            INSERT INTO "InvoiceItem" (
              id, "invoiceId", description, quantity, "unitPrice", amount, "createdAt", "updatedAt"
            ) VALUES (
              $1, $2, $3, 1, $4, $5, NOW(), NOW()
            )
          `, [
            lineItemId,
            invoiceId,
            `${item.show_name} - ${item.placementType} spot - ${new Date(item.airDate).toLocaleDateString()}`,
            item.rate,
            item.rate
          ])
        }
      }

      console.log(`✅ Invoice ${invoiceNumber} created successfully for order ${order.orderNumber}`)

    } else if (context.entityType === 'episode') {
      // Handle monthly/delivered spot invoicing
      console.log('📺 Processing episode-based billing automation')
      
      // Get episode with active orders
      const { data: episodes } = await safeQuerySchema(context.orgSlug, `
        SELECT e.*, s.name as show_name
        FROM "Episode" e
        LEFT JOIN "Show" s ON s.id = e."showId"
        WHERE e.id = $1
      `, [context.entityId])

      if (!episodes?.[0]) return

      const episode = episodes[0]

      // Get active order items for this episode
      const { data: activeOrderItems } = await safeQuerySchema(context.orgSlug, `
        SELECT oi.*, o.id as order_id, o."orderNumber", o."advertiserId", 
               a.name as advertiser_name, c.name as campaign_name
        FROM "OrderItem" oi
        JOIN "Order" o ON o.id = oi."orderId"
        LEFT JOIN "Advertiser" a ON a.id = o."advertiserId"
        LEFT JOIN "Campaign" c ON c.id = o."campaignId"
        WHERE oi."episodeId" = $1 
        AND o.status IN ('confirmed', 'booked')
        AND oi."airDate" <= NOW()
      `, [context.entityId])

      if (!activeOrderItems || activeOrderItems.length === 0) {
        console.log('No active order items found for billing')
        return
      }

      // Group by advertiser if configured
      if (config.groupByAdvertiser) {
        const groupedByAdvertiser = activeOrderItems.reduce((groups, item) => {
          const key = item.advertiserId
          if (!groups[key]) {
            groups[key] = {
              advertiser: { id: item.advertiserId, name: item.advertiser_name },
              items: []
            }
          }
          groups[key].items.push(item)
          return groups
        }, {})

        // Create separate invoice for each advertiser
        for (const [advertiserId, group] of Object.entries(groupedByAdvertiser)) {
          await this.createMonthlyInvoice(group as any, episode, config, context)
        }
      } else {
        // Create single invoice for all items
        await this.createMonthlyInvoice({ items: activeOrderItems }, episode, config, context)
      }
    }
  }

  private async createMonthlyInvoice(group: any, episode: any, config: any, context: WorkflowContext): Promise<void> {
    const items = group.items
    const totalAmount = items.reduce((sum, item) => sum + (item.rate || 0), 0)
    
    if (totalAmount === 0) return

    // Generate invoice number
    const currentYear = new Date().getFullYear()
    const currentMonth = new Date().getMonth() + 1
    const invoiceNumber = `INV-${currentYear}${String(currentMonth).padStart(2, '0')}-${String(Date.now()).slice(-5)}`
    
    const invoiceId = `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const advertiserName = group.advertiser?.name || 'Multiple Advertisers'
    
    const { error: invoiceError } = await safeQuerySchema(context.orgSlug, `
      INSERT INTO "Invoice" (
        id, "invoiceNumber", "organizationId", amount, currency, description,
        "issueDate", "dueDate", status, notes, "totalAmount", "createdAt", "updatedAt",
        "createdById", "billingPeriod"
      ) VALUES (
        $1, $2, $3, $4, 'USD', $5, NOW(), $6, $7, $8, $9, NOW(), NOW(), $10, $11
      )
    `, [
      invoiceId,
      invoiceNumber,
      context.orgSlug,
      totalAmount,
      `Monthly Delivery Invoice - ${advertiserName}`,
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      config.autoSend ? 'sent' : 'draft',
      `Auto-generated monthly billing for ${episode.show_name} - ${episode.title}`,
      totalAmount,
      context.userId,
      `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
    ])

    if (invoiceError) {
      console.error('Failed to create monthly invoice:', invoiceError)
      return
    }

    // Create invoice items
    for (const item of items) {
      const lineItemId = `ili_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      await safeQuerySchema(context.orgSlug, `
        INSERT INTO "InvoiceItem" (
          id, "invoiceId", description, quantity, "unitPrice", amount, "campaignId", "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, $3, 1, $4, $5, $6, NOW(), NOW()
        )
      `, [
        lineItemId,
        invoiceId,
        `${episode.show_name} - ${item.placementType} - ${new Date(item.airDate).toLocaleDateString()}`,
        item.rate,
        item.rate,
        item.campaignId || null
      ])
    }

    console.log(`✅ Monthly invoice ${invoiceNumber} created for ${advertiserName} - $${totalAmount.toLocaleString()}`)
  }

  private async sendNotification(config: any, context: WorkflowContext): Promise<void> {
    console.log('📧 Sending automated notifications:', config.type)
    
    // Get recipient user IDs based on config
    const recipients = await this.resolveNotificationRecipients(config.recipients, context)
    
    for (const recipientId of recipients) {
      const notificationId = `not_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      await safeQuerySchema(context.orgSlug, `
        INSERT INTO "Notification" (
          id, "userId", "type", "title", "message", "entityType", "entityId",
          "isRead", "createdAt"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, false, NOW()
        )
      `, [
        notificationId,
        recipientId,
        config.type,
        this.generateNotificationTitle(config, context),
        this.generateNotificationMessage(config, context),
        context.entityType,
        context.entityId
      ])
    }
  }

  private async resolveNotificationRecipients(recipients: string[], context: WorkflowContext): Promise<string[]> {
    const userIds: string[] = []
    
    for (const recipient of recipients) {
      if (recipient === 'order_creator' || recipient === 'entity_creator') {
        // Get the creator of the entity
        const { data: entities } = await safeQuerySchema(context.orgSlug, `
          SELECT "createdBy" FROM "${context.entityType.charAt(0).toUpperCase() + context.entityType.slice(1)}"
          WHERE id = $1
        `, [context.entityId])
        
        if (entities?.[0]?.createdBy) {
          userIds.push(entities[0].createdBy)
        }
      } else if (recipient === 'admin_users') {
        // Get all admin users in the organization
        const adminUsers = await prisma.user.findMany({
          where: {
            organizationId: context.organizationId,
            role: { in: ['admin', 'master'] }
          },
          select: { id: true }
        })
        userIds.push(...adminUsers.map(u => u.id))
      } else if (recipient === 'billing_team' || recipient === 'account_manager') {
        // Get users with admin or sales roles for billing notifications
        const billingUsers = await prisma.user.findMany({
          where: {
            organizationId: context.organizationId,
            role: { in: ['admin', 'master', 'sales'] }
          },
          select: { id: true }
        })
        userIds.push(...billingUsers.map(u => u.id))
      } else if (recipient === 'sales_team') {
        // Get all sales users
        const salesUsers = await prisma.user.findMany({
          where: {
            organizationId: context.organizationId,
            role: 'sales'
          },
          select: { id: true }
        })
        userIds.push(...salesUsers.map(u => u.id))
      }
    }
    
    return [...new Set(userIds)] // Remove duplicates
  }

  private generateNotificationTitle(config: any, context: WorkflowContext): string {
    const entityType = context.entityType.charAt(0).toUpperCase() + context.entityType.slice(1)
    
    switch (config.type) {
      case 'order_approved':
        return `${entityType} Approved - Contract Generated`
      case 'campaign_won':
        return `Campaign Won - Order Created`
      case 'contract_signed':
        return `Contract Fully Signed - Ready for Production`
      case 'invoice_generated':
        return `Invoice Generated - Order Confirmed`
      case 'monthly_invoice_generated':
        return `Monthly Billing Generated`
      default:
        return `${entityType} Status Updated`
    }
  }

  private generateNotificationMessage(config: any, context: WorkflowContext): string {
    const entityType = context.entityType.charAt(0).toUpperCase() + context.entityType.slice(1)
    
    switch (config.type) {
      case 'order_approved':
        return `The ${entityType.toLowerCase()} has been approved and a contract has been automatically generated. Please review and send for signature.`
      case 'campaign_won':
        return `Congratulations! The campaign has been won and an order has been automatically created. Please review the order details.`
      case 'contract_signed':
        return `The contract has been fully signed by all parties. The order is now ready for production and billing setup.`
      case 'invoice_generated':
        return `An invoice has been automatically generated for the confirmed order. Please review and send to the client.`
      case 'monthly_invoice_generated':
        return `Monthly delivery invoices have been generated based on aired episodes. Please review billing summary and send invoices.`
      default:
        return `The ${entityType.toLowerCase()} status has been updated to ${context.newState}.`
    }
  }

  private async assignTask(config: any, context: WorkflowContext): Promise<void> {
    console.log('📋 Auto-assigning task:', config.taskType)
    
    // Find users with the specified role
    const roleUsers = await prisma.user.findMany({
      where: {
        organizationId: context.organizationId,
        role: config.assignToRole
      },
      select: { id: true }
    })
    
    if (roleUsers.length === 0) return
    
    // Assign to first available user (can be enhanced with load balancing)
    const assigneeId = roleUsers[0].id
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + (config.dueInDays || 7))
    
    const taskId = `tsk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    await safeQuerySchema(context.orgSlug, `
      INSERT INTO "Task" (
        id, "title", "description", "assignedToId", "entityType", "entityId",
        "taskType", "priority", "status", "dueDate", "createdBy", "createdAt"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, $10, NOW()
      )
    `, [
      taskId,
      `${config.taskType} for ${context.entityType}`,
      `Automated task created for ${context.entityType} ${context.entityId}`,
      assigneeId,
      context.entityType,
      context.entityId,
      config.taskType,
      config.priority || 'medium',
      dueDate,
      context.userId
    ])
  }

  private async updateEntityStatus(config: any, context: WorkflowContext): Promise<void> {
    console.log('🔄 Auto-updating entity status:', config.targetEntity)
    
    // This would implement conditional status updates
    // For now, we'll skip complex condition evaluation
  }

  // Public method to manually trigger automations (for testing)
  async triggerAutomation(ruleId: string, context: WorkflowContext): Promise<void> {
    const rule = this.rules.find(r => r.id === ruleId)
    if (!rule) {
      throw new Error(`Automation rule ${ruleId} not found`)
    }
    
    await this.executeRule(rule, context)
  }

  // Get available automation rules
  getAutomationRules(): AutomationRule[] {
    return this.rules
  }

  // Enable/disable specific rules
  setRuleStatus(ruleId: string, isActive: boolean): void {
    const rule = this.rules.find(r => r.id === ruleId)
    if (rule) {
      rule.isActive = isActive
    }
  }
}

export const workflowAutomation = WorkflowAutomationService.getInstance()