/**
 * Workflow State Machine Constants and Helpers
 * Central source of truth for campaign workflow states and transitions
 */

export const WORKFLOW_STATES = {
  // Pre-sale states (probability-based)
  ACTIVE_PRESALE: 10,      // Active Pre-Sale (new default)
  PROSPECTING: 35,          // Qualified/Working
  QUALIFIED: 65,            // Negotiation
  PENDING_APPROVAL: 90,     // Pending Approval
  
  // Post-sale states
  WON: 100,                 // Approved/Won
  
  // Rejection fallback
  REJECTION_FALLBACK: 65,   // Where campaigns go when rejected from 90%
} as const

export const WORKFLOW_STATUS_LABELS: Record<number, string> = {
  10: 'Active Pre-Sale',
  35: 'Prospecting',
  65: 'Qualified',
  90: 'Pending Approval',
  100: 'Won'
}

export const WORKFLOW_EVENTS = {
  CREATE: 'campaign_created',
  FIRST_VALID_SCHEDULE: 'first_valid_schedule',
  SCHEDULE_UPDATE: 'schedule_updated',
  SUBMIT_FOR_APPROVAL: 'submit_for_approval',
  APPROVE: 'approve',
  REJECT: 'reject',
  MANUAL_UPDATE: 'manual_update'
} as const

export interface WorkflowTransition {
  from: number
  to: number
  event: string
  requiresRole?: string[]
  conditions?: string[]
}

export const WORKFLOW_TRANSITIONS: WorkflowTransition[] = [
  // Auto-advance from 10% to 35% on first valid schedule
  {
    from: WORKFLOW_STATES.ACTIVE_PRESALE,
    to: WORKFLOW_STATES.PROSPECTING,
    event: WORKFLOW_EVENTS.FIRST_VALID_SCHEDULE,
    conditions: ['has_valid_schedule']
  },
  
  // Manual progression through sales stages
  {
    from: WORKFLOW_STATES.PROSPECTING,
    to: WORKFLOW_STATES.QUALIFIED,
    event: WORKFLOW_EVENTS.MANUAL_UPDATE
  },
  
  // Submit for approval (65% to 90%)
  {
    from: WORKFLOW_STATES.QUALIFIED,
    to: WORKFLOW_STATES.PENDING_APPROVAL,
    event: WORKFLOW_EVENTS.SUBMIT_FOR_APPROVAL,
    conditions: ['has_schedule', 'has_budget']
  },
  
  // Approval (90% to 100%)
  {
    from: WORKFLOW_STATES.PENDING_APPROVAL,
    to: WORKFLOW_STATES.WON,
    event: WORKFLOW_EVENTS.APPROVE,
    requiresRole: ['admin', 'master']
  },
  
  // Rejection (90% back to 65%)
  {
    from: WORKFLOW_STATES.PENDING_APPROVAL,
    to: WORKFLOW_STATES.REJECTION_FALLBACK,
    event: WORKFLOW_EVENTS.REJECT,
    requiresRole: ['admin', 'master']
  }
]

/**
 * Get the next state for a given event
 */
export function getNextStateForEvent(
  currentState: number,
  event: string,
  userRole?: string,
  conditions?: Record<string, boolean>
): number | null {
  const transition = WORKFLOW_TRANSITIONS.find(t => 
    t.from === currentState && 
    t.event === event &&
    (!t.requiresRole || (userRole && t.requiresRole.includes(userRole))) &&
    (!t.conditions || t.conditions.every(c => conditions?.[c]))
  )
  
  return transition?.to ?? null
}

/**
 * Check if a schedule is valid (has placements, dates, and budget)
 */
export function isScheduleValid(schedule: any): boolean {
  if (!schedule) return false
  
  const hasItems = schedule.scheduleItems?.length > 0 || schedule.itemCount > 0
  const hasBudget = schedule.totalValue > 0 || schedule.netAmount > 0
  const hasDates = schedule.startDate && schedule.endDate
  
  return hasItems && hasBudget && hasDates
}

/**
 * Get workflow settings with feature flags
 */
export interface WorkflowSettings {
  v2PresaleTiming: boolean
  autoReserveAt90: boolean
  requireAdminApprovalAt90: boolean
  notifyOnStatusChange: boolean
  autoAssignAdRequests: boolean
  autoGenerateContracts: boolean
  autoGenerateInvoices: boolean
  defaultInvoiceDay: number
  autoSendInvoices: boolean
  thresholds: {
    approval_trigger: number
    auto_win: number
    rejection_fallback: number
    reservation_threshold: number
  }
}

export const DEFAULT_WORKFLOW_SETTINGS: WorkflowSettings = {
  v2PresaleTiming: true,  // Feature flag for new timing
  autoReserveAt90: true,
  requireAdminApprovalAt90: true,
  notifyOnStatusChange: true,
  autoAssignAdRequests: true,
  autoGenerateContracts: false,
  autoGenerateInvoices: false,
  defaultInvoiceDay: 1,
  autoSendInvoices: false,
  thresholds: {
    approval_trigger: 90,
    auto_win: 100,
    rejection_fallback: 65,
    reservation_threshold: 80
  }
}