// Notification Event Types and Payloads

// Pre-Sale Workflow Events
export interface CampaignCreatedEvent {
  eventType: 'campaign_created'
  campaignId: string
  campaignName: string
  advertiserName: string
  status: string
  sellerId: string
  actionUrl: string
}

export interface ScheduleBuiltEvent {
  eventType: 'schedule_built'
  campaignId: string
  campaignName: string
  showCount: number
  spotCount: number
  totalValue: number
  actionUrl: string
}

export interface TalentApprovalRequestedEvent {
  eventType: 'talent_approval_requested'
  campaignId: string
  campaignName: string
  showId: string
  showName: string
  advertiserName: string
  talentId: string
  actionUrl: string
}

export interface AdminApprovalRequestedEvent {
  eventType: 'admin_approval_requested'
  campaignId: string
  campaignName: string
  advertiserName: string
  budget: number
  variance: number
  rateCardDelta: number
  sellerId: string
  actionUrl: string
}

export interface CampaignApprovedEvent {
  eventType: 'campaign_approved'
  campaignId: string
  campaignName: string
  approverName: string
  approverId: string
  nextSteps: string
  actionUrl: string
}

export interface CampaignRejectedEvent {
  eventType: 'campaign_rejected'
  campaignId: string
  campaignName: string
  rejectorName: string
  rejectorId: string
  reason: string
  actionUrl: string
}

// Inventory Events
export interface InventoryConflictEvent {
  eventType: 'inventory_conflict'
  campaignId: string
  campaignName: string
  showId: string
  showName: string
  date: string
  conflictDetails: string
  conflictingCampaignId?: string
  actionUrl: string
}

export interface InventoryReleasedEvent {
  eventType: 'inventory_released'
  campaignId: string
  campaignName: string
  reason: string
  spotCount: number
  showIds: string[]
}

export interface BulkPlacementFailedEvent {
  eventType: 'bulk_placement_failed'
  campaignId: string
  campaignName: string
  requested: number
  placed: number
  issue: string
  actionUrl: string
}

export interface RateCardUpdatedEvent {
  eventType: 'rate_card_updated'
  showIds: string[]
  changes: Array<{
    showId: string
    showName: string
    oldRate: number
    newRate: number
  }>
  affectedCampaigns: string[]
}

// Post-Sale / Billing Events
export interface OrderCreatedEvent {
  eventType: 'order_created'
  orderId: string
  orderNumber: string
  campaignId: string
  campaignName: string
  totalValue: number
  actionUrl: string
}

export interface ContractGeneratedEvent {
  eventType: 'contract_generated'
  contractId: string
  campaignId: string
  campaignName: string
  requiresSignature: boolean
  actionUrl: string
}

export interface ContractSignedEvent {
  eventType: 'contract_signed'
  contractId: string
  signerName: string
  signerId: string
  signedDate: string
  campaignId: string
}

export interface InvoiceGeneratedEvent {
  eventType: 'invoice_generated'
  invoiceId: string
  invoiceNumber: string
  amount: number
  dueDate: string
  advertiserId: string
  advertiserName: string
  actionUrl: string
}

export interface PaymentReceivedEvent {
  eventType: 'payment_received'
  invoiceId: string
  invoiceNumber: string
  amount: number
  paymentDate: string
  paymentMethod: string
}

export interface InvoiceOverdueEvent {
  eventType: 'invoice_overdue'
  invoiceId: string
  invoiceNumber: string
  amount: number
  daysOverdue: number
  advertiserName: string
  actionUrl: string
}

// Content/Show Operations Events
export interface AdRequestCreatedEvent {
  eventType: 'ad_request_created'
  requestId: string
  campaignId: string
  campaignName: string
  showId: string
  showName: string
  spotType: string
  dueDate: string
  producerId?: string
  talentId?: string
  actionUrl: string
}

export interface CategoryConflictEvent {
  eventType: 'category_conflict'
  showId: string
  showName: string
  date: string
  advertisers: string
  category: string
  severity: 'warning' | 'error'
  actionUrl: string
}

// Integration Events
export interface YouTubeQuotaReachedEvent {
  eventType: 'youtube_quota_reached'
  usage: number
  limit: number
  resetTime: string
  syncPaused: boolean
}

export interface IntegrationSyncFailedEvent {
  eventType: 'integration_sync_failed'
  integration: string
  error: string
  lastSuccess: string
  retryScheduled: boolean
  actionUrl: string
}

// Backup Events
export interface BackupCompletedEvent {
  eventType: 'backup_completed'
  backupId: string
  size: string
  duration: string
  location: string
}

export interface BackupFailedEvent {
  eventType: 'backup_failed'
  error: string
  time: string
  nextRetry?: string
}

// Security Events
export interface SecurityPolicyChangedEvent {
  eventType: 'security_policy_changed'
  changedBy: string
  changedById: string
  policy: string
  change: string
  timestamp: string
}

export interface ApiKeyRotatedEvent {
  eventType: 'api_key_rotated'
  keyName: string
  rotatedBy: string
  rotatedById: string
  expiryDate?: string
}

// Union type for all events
export type NotificationEvent =
  | CampaignCreatedEvent
  | ScheduleBuiltEvent
  | TalentApprovalRequestedEvent
  | AdminApprovalRequestedEvent
  | CampaignApprovedEvent
  | CampaignRejectedEvent
  | InventoryConflictEvent
  | InventoryReleasedEvent
  | BulkPlacementFailedEvent
  | RateCardUpdatedEvent
  | OrderCreatedEvent
  | ContractGeneratedEvent
  | ContractSignedEvent
  | InvoiceGeneratedEvent
  | PaymentReceivedEvent
  | InvoiceOverdueEvent
  | AdRequestCreatedEvent
  | CategoryConflictEvent
  | YouTubeQuotaReachedEvent
  | IntegrationSyncFailedEvent
  | BackupCompletedEvent
  | BackupFailedEvent
  | SecurityPolicyChangedEvent
  | ApiKeyRotatedEvent

// Event metadata for UI display
export const EVENT_METADATA = {
  // Pre-Sale Workflow
  campaign_created: {
    name: 'Campaign Created',
    description: 'New campaign has been created',
    category: 'Pre-Sale',
    defaultChannels: ['email', 'inApp'],
    severity: 'normal'
  },
  schedule_built: {
    name: 'Schedule Built',
    description: 'Campaign schedule has been built',
    category: 'Pre-Sale',
    defaultChannels: ['email', 'inApp'],
    severity: 'normal'
  },
  talent_approval_requested: {
    name: 'Talent Approval Requested',
    description: 'Host read approval is required',
    category: 'Pre-Sale',
    defaultChannels: ['email', 'inApp'],
    severity: 'high'
  },
  admin_approval_requested: {
    name: 'Admin Approval Requested',
    description: 'Campaign requires admin approval',
    category: 'Pre-Sale',
    defaultChannels: ['email', 'inApp'],
    severity: 'high'
  },
  campaign_approved: {
    name: 'Campaign Approved',
    description: 'Campaign has been approved',
    category: 'Pre-Sale',
    defaultChannels: ['email', 'inApp'],
    severity: 'normal'
  },
  campaign_rejected: {
    name: 'Campaign Rejected',
    description: 'Campaign has been rejected',
    category: 'Pre-Sale',
    defaultChannels: ['email', 'inApp'],
    severity: 'high'
  },

  // Inventory
  inventory_conflict: {
    name: 'Inventory Conflict',
    description: 'Inventory scheduling conflict detected',
    category: 'Inventory',
    defaultChannels: ['email', 'inApp'],
    severity: 'high'
  },
  inventory_released: {
    name: 'Inventory Released',
    description: 'Inventory has been released',
    category: 'Inventory',
    defaultChannels: ['inApp'],
    severity: 'normal'
  },
  bulk_placement_failed: {
    name: 'Bulk Placement Failed',
    description: 'Unable to place all requested spots',
    category: 'Inventory',
    defaultChannels: ['email', 'inApp'],
    severity: 'high'
  },
  rate_card_updated: {
    name: 'Rate Card Updated',
    description: 'Show rate cards have been updated',
    category: 'Inventory',
    defaultChannels: ['email'],
    severity: 'normal'
  },

  // Post-Sale / Billing
  order_created: {
    name: 'Order Created',
    description: 'New order has been created',
    category: 'Post-Sale',
    defaultChannels: ['email'],
    severity: 'normal'
  },
  contract_generated: {
    name: 'Contract Generated',
    description: 'Contract is ready for signature',
    category: 'Post-Sale',
    defaultChannels: ['email'],
    severity: 'normal'
  },
  contract_signed: {
    name: 'Contract Signed',
    description: 'Contract has been signed',
    category: 'Post-Sale',
    defaultChannels: ['email'],
    severity: 'normal'
  },
  invoice_generated: {
    name: 'Invoice Generated',
    description: 'New invoice has been generated',
    category: 'Billing',
    defaultChannels: ['email'],
    severity: 'normal'
  },
  payment_received: {
    name: 'Payment Received',
    description: 'Payment has been received',
    category: 'Billing',
    defaultChannels: ['email'],
    severity: 'normal'
  },
  invoice_overdue: {
    name: 'Invoice Overdue',
    description: 'Invoice is past due',
    category: 'Billing',
    defaultChannels: ['email'],
    severity: 'high'
  },

  // Content/Show Operations
  ad_request_created: {
    name: 'Ad Request Created',
    description: 'New ad request needs fulfillment',
    category: 'Content',
    defaultChannels: ['email', 'inApp'],
    severity: 'high'
  },
  category_conflict: {
    name: 'Category Conflict',
    description: 'Category exclusivity conflict detected',
    category: 'Content',
    defaultChannels: ['email', 'inApp'],
    severity: 'high'
  },

  // Integrations & Data
  youtube_quota_reached: {
    name: 'YouTube Quota Reached',
    description: 'YouTube API daily quota exhausted',
    category: 'Integration',
    defaultChannels: ['email'],
    severity: 'high'
  },
  integration_sync_failed: {
    name: 'Integration Sync Failed',
    description: 'Integration synchronization failed',
    category: 'Integration',
    defaultChannels: ['email'],
    severity: 'high'
  },
  backup_completed: {
    name: 'Backup Completed',
    description: 'Backup completed successfully',
    category: 'System',
    defaultChannels: ['email'],
    severity: 'low'
  },
  backup_failed: {
    name: 'Backup Failed',
    description: 'Backup process failed',
    category: 'System',
    defaultChannels: ['email'],
    severity: 'urgent'
  },

  // Security
  security_policy_changed: {
    name: 'Security Policy Changed',
    description: 'Security policy has been modified',
    category: 'Security',
    defaultChannels: ['email'],
    severity: 'high'
  },
  api_key_rotated: {
    name: 'API Key Rotated',
    description: 'API key has been rotated',
    category: 'Security',
    defaultChannels: ['email'],
    severity: 'normal'
  }
} as const