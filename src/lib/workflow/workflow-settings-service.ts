import { z } from 'zod'
import { safeQuerySchema, querySchema } from '@/lib/db/schema-db'
import { cache } from 'react'

// Validation schemas
const MilestoneThresholdsSchema = z.object({
  pre_sale_active: z.number().min(0).max(100).default(10),
  schedule_available: z.number().min(0).max(100).default(10),
  schedule_valid: z.number().min(0).max(100).default(35),
  talent_approval_required: z.number().min(0).max(100).default(65),
  admin_approval_required: z.number().min(0).max(100).default(90),
  auto_reservation: z.number().min(0).max(100).default(90),
  order_creation: z.number().min(0).max(100).default(100),
})

const ApprovalRulesSchema = z.object({
  campaignApproval: z.object({
    enabled: z.boolean().default(true),
    at: z.number().min(0).max(100).default(90),
    roles: z.array(z.string()).default(['admin', 'master']),
  }),
  talentApproval: z.object({
    enabled: z.boolean().default(true),
    at: z.number().min(0).max(100).default(65),
    types: z.array(z.string()).default(['host_read', 'endorsement']),
    fallback: z.string().default('producer'),
  }),
})

const NotificationSettingsSchema = z.object({
  email: z.boolean().default(true),
  inApp: z.boolean().default(true),
  webhook: z.boolean().default(false),
})

const RateCardDeltaSchema = z.object({
  enabled: z.boolean().default(true),
  threshold_percent: z.number().min(0).max(100).default(10),
  require_approval_above: z.number().min(0).max(100).default(20),
})

const CompetitiveCategorySchema = z.object({
  enabled: z.boolean().default(true),
  mode: z.enum(['warn', 'block']).default('warn'),
  buffer_days: z.number().min(0).max(365).default(30),
})

// Trigger schemas
const TriggerConditionSchema = z.object({
  field: z.string(),
  operator: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'nin', 'contains', 'regex']),
  value: z.any(),
  and: z.array(z.lazy(() => TriggerConditionSchema)).optional(),
  or: z.array(z.lazy(() => TriggerConditionSchema)).optional(),
})

const TriggerActionSchema = z.object({
  type: z.enum(['send_notification', 'create_reservation', 'require_approval', 'change_probability', 'transition_status', 'emit_webhook']),
  config: z.record(z.any()),
})

const WorkflowTriggerSchema = z.object({
  name: z.string().min(1).max(100),
  event: z.enum([
    'campaign_created',
    'schedule_created',
    'schedule_validated',
    'probability_updated',
    'inventory_reserved',
    'contract_generated',
    'io_uploaded',
    'invoice_generated',
    'rate_delta_detected',
    'budget_threshold_crossed',
    'first_spot_booked',
  ]),
  condition: TriggerConditionSchema.nullable().optional(),
  actions: z.array(TriggerActionSchema),
  isEnabled: z.boolean().default(true),
  priority: z.number().min(0).max(1000).default(100),
})

// Cache for settings (TTL: 60 seconds per org)
const settingsCache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL = 60 * 1000 // 60 seconds

// Default settings
const DEFAULT_SETTINGS = {
  'milestone.thresholds': {
    pre_sale_active: 10,
    schedule_available: 10,
    schedule_valid: 35,
    talent_approval_required: 65,
    admin_approval_required: 90,
    auto_reservation: 90,
    order_creation: 100,
  },
  'approval.rules': {
    campaignApproval: {
      enabled: true,
      at: 90,
      roles: ['admin', 'master'],
    },
    talentApproval: {
      enabled: true,
      at: 65,
      types: ['host_read', 'endorsement'],
      fallback: 'producer',
    },
  },
  'notifications.enabled': {
    email: true,
    inApp: true,
    webhook: false,
  },
  'rate_card.delta_tracking': {
    enabled: true,
    threshold_percent: 10,
    require_approval_above: 20,
  },
  'competitive.category_checking': {
    enabled: true,
    mode: 'warn',
    buffer_days: 30,
  },
}

export class WorkflowSettingsService {
  /**
   * Get workflow settings for an organization with caching
   */
  static async getSettings(orgSlug: string, keys?: string[]): Promise<Record<string, any>> {
    const cacheKey = `${orgSlug}:${keys?.join(',') || 'all'}`
    
    // Check cache
    const cached = settingsCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data
    }

    // Build query
    let query = `
      SELECT key, value, "isEnabled"
      FROM "WorkflowAutomationSetting"
      WHERE "isEnabled" = true
    `
    const params: any[] = []
    
    if (keys && keys.length > 0) {
      query += ` AND key = ANY($1)`
      params.push(keys)
    }

    // Fetch from database
    const { data, error } = await safeQuerySchema<any>(orgSlug, query, params)
    
    if (error) {
      console.error('[WorkflowSettings] Error fetching settings:', error)
      // Return defaults on error
      if (keys) {
        const result: Record<string, any> = {}
        keys.forEach(key => {
          if (DEFAULT_SETTINGS[key as keyof typeof DEFAULT_SETTINGS]) {
            result[key] = DEFAULT_SETTINGS[key as keyof typeof DEFAULT_SETTINGS]
          }
        })
        return result
      }
      return DEFAULT_SETTINGS
    }

    // Merge with defaults
    const settings: Record<string, any> = {}
    
    // Start with defaults if no specific keys requested
    if (!keys) {
      Object.assign(settings, DEFAULT_SETTINGS)
    } else {
      // Only include requested defaults
      keys.forEach(key => {
        if (DEFAULT_SETTINGS[key as keyof typeof DEFAULT_SETTINGS]) {
          settings[key] = DEFAULT_SETTINGS[key as keyof typeof DEFAULT_SETTINGS]
        }
      })
    }

    // Override with database values
    if (data && data.length > 0) {
      data.forEach((row: any) => {
        settings[row.key] = row.value
      })
    }

    // Cache the result
    settingsCache.set(cacheKey, { data: settings, timestamp: Date.now() })

    return settings
  }

  /**
   * Get a single setting value
   */
  static async getSetting(orgSlug: string, key: string): Promise<any> {
    const settings = await this.getSettings(orgSlug, [key])
    return settings[key]
  }

  /**
   * Update workflow settings
   */
  static async updateSettings(
    orgSlug: string,
    settings: Record<string, any>,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Validate each setting based on its key
      const validatedSettings: Record<string, any> = {}
      
      for (const [key, value] of Object.entries(settings)) {
        switch (key) {
          case 'milestone.thresholds':
            validatedSettings[key] = MilestoneThresholdsSchema.parse(value)
            break
          case 'approval.rules':
            validatedSettings[key] = ApprovalRulesSchema.parse(value)
            break
          case 'notifications.enabled':
            validatedSettings[key] = NotificationSettingsSchema.parse(value)
            break
          case 'rate_card.delta_tracking':
            validatedSettings[key] = RateCardDeltaSchema.parse(value)
            break
          case 'competitive.category_checking':
            validatedSettings[key] = CompetitiveCategorySchema.parse(value)
            break
          default:
            // Allow custom settings without validation
            validatedSettings[key] = value
        }
      }

      // Upsert each setting
      for (const [key, value] of Object.entries(validatedSettings)) {
        const query = `
          INSERT INTO "WorkflowAutomationSetting" (
            key, value, "updatedBy", "updatedAt"
          ) VALUES ($1, $2, $3, NOW())
          ON CONFLICT (key) DO UPDATE SET
            value = $2,
            "updatedBy" = $3,
            "updatedAt" = NOW()
        `
        
        await querySchema(orgSlug, query, [key, JSON.stringify(value), userId])
      }

      // Clear cache for this org
      for (const [cacheKey] of settingsCache.entries()) {
        if (cacheKey.startsWith(orgSlug)) {
          settingsCache.delete(cacheKey)
        }
      }

      return { success: true }
    } catch (error: any) {
      console.error('[WorkflowSettings] Update error:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Get custom triggers for an organization
   */
  static async getTriggers(
    orgSlug: string,
    options?: { event?: string; isEnabled?: boolean }
  ): Promise<any[]> {
    let query = `
      SELECT * FROM "WorkflowTrigger"
      WHERE 1=1
    `
    const params: any[] = []
    let paramIndex = 1

    if (options?.event) {
      query += ` AND event = $${paramIndex++}`
      params.push(options.event)
    }

    if (options?.isEnabled !== undefined) {
      query += ` AND "isEnabled" = $${paramIndex++}`
      params.push(options.isEnabled)
    }

    query += ` ORDER BY priority DESC, "createdAt" DESC`

    const { data, error } = await safeQuerySchema<any>(orgSlug, query, params)
    
    if (error) {
      console.error('[WorkflowSettings] Error fetching triggers:', error)
      return []
    }

    return data || []
  }

  /**
   * Create a custom trigger
   */
  static async createTrigger(
    orgSlug: string,
    trigger: z.infer<typeof WorkflowTriggerSchema>,
    userId: string
  ): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      // Validate trigger
      const validated = WorkflowTriggerSchema.parse(trigger)
      
      const id = `trg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      const query = `
        INSERT INTO "WorkflowTrigger" (
          id, name, event, condition, actions, "isEnabled", priority,
          "createdBy", "createdAt", "updatedBy", "updatedAt"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, NOW(), $8, NOW()
        )
      `
      
      await querySchema(orgSlug, query, [
        id,
        validated.name,
        validated.event,
        validated.condition ? JSON.stringify(validated.condition) : null,
        JSON.stringify(validated.actions),
        validated.isEnabled,
        validated.priority,
        userId,
      ])

      return { success: true, id }
    } catch (error: any) {
      console.error('[WorkflowSettings] Create trigger error:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Update a custom trigger
   */
  static async updateTrigger(
    orgSlug: string,
    triggerId: string,
    updates: Partial<z.infer<typeof WorkflowTriggerSchema>>,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const setClauses: string[] = []
      const params: any[] = []
      let paramIndex = 1

      if (updates.name !== undefined) {
        setClauses.push(`name = $${paramIndex++}`)
        params.push(updates.name)
      }

      if (updates.event !== undefined) {
        setClauses.push(`event = $${paramIndex++}`)
        params.push(updates.event)
      }

      if (updates.condition !== undefined) {
        setClauses.push(`condition = $${paramIndex++}`)
        params.push(updates.condition ? JSON.stringify(updates.condition) : null)
      }

      if (updates.actions !== undefined) {
        setClauses.push(`actions = $${paramIndex++}`)
        params.push(JSON.stringify(updates.actions))
      }

      if (updates.isEnabled !== undefined) {
        setClauses.push(`"isEnabled" = $${paramIndex++}`)
        params.push(updates.isEnabled)
      }

      if (updates.priority !== undefined) {
        setClauses.push(`priority = $${paramIndex++}`)
        params.push(updates.priority)
      }

      setClauses.push(`"updatedBy" = $${paramIndex++}`)
      params.push(userId)

      setClauses.push(`"updatedAt" = NOW()`)

      params.push(triggerId) // For WHERE clause

      const query = `
        UPDATE "WorkflowTrigger"
        SET ${setClauses.join(', ')}
        WHERE id = $${paramIndex}
      `

      await querySchema(orgSlug, query, params)

      return { success: true }
    } catch (error: any) {
      console.error('[WorkflowSettings] Update trigger error:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Delete (disable) a custom trigger
   */
  static async deleteTrigger(
    orgSlug: string,
    triggerId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Soft delete by disabling
      const query = `
        UPDATE "WorkflowTrigger"
        SET "isEnabled" = false,
            "updatedBy" = $2,
            "updatedAt" = NOW()
        WHERE id = $1
      `

      await querySchema(orgSlug, query, [triggerId, userId])

      return { success: true }
    } catch (error: any) {
      console.error('[WorkflowSettings] Delete trigger error:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Clear cache for an organization
   */
  static clearCache(orgSlug: string): void {
    for (const [key] of settingsCache.entries()) {
      if (key.startsWith(orgSlug)) {
        settingsCache.delete(key)
      }
    }
  }

  /**
   * Get action templates
   */
  static async getActionTemplates(orgSlug: string): Promise<any[]> {
    const query = `
      SELECT * FROM "WorkflowActionTemplate"
      ORDER BY "isSystem" DESC, name ASC
    `

    const { data, error } = await safeQuerySchema<any>(orgSlug, query, [])
    
    if (error) {
      console.error('[WorkflowSettings] Error fetching action templates:', error)
      return []
    }

    return data || []
  }
}

// Export cached version for use in components
export const getWorkflowSettings = cache(WorkflowSettingsService.getSettings)
export const getWorkflowTriggers = cache(WorkflowSettingsService.getTriggers)