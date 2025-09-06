// Email system types and interfaces

export interface EmailOptions {
  to: string | string[]
  subject: string
  templateKey?: string
  templateData?: Record<string, any>
  replyTo?: string
  cc?: string | string[]
  bcc?: string | string[]
  attachments?: EmailAttachment[]
  metadata?: Record<string, any>
  organizationId?: string
  userId?: string
}

export interface EmailAttachment {
  filename: string
  content: Buffer | string
  contentType?: string
}

export interface EmailResult {
  success: boolean
  messageId?: string | null
  error?: string
  details?: any
}

export interface EmailProvider {
  send(options: EmailOptions): Promise<EmailResult>
  verifyConnection(): Promise<boolean>
  getQuota(): Promise<EmailQuota>
}

export interface EmailQuota {
  dailyQuota: number
  sendRate: number
  sentToday: number
  remainingToday: number
}

export interface PlatformEmailSettingsData {
  id: string
  provider: 'ses' | 'smtp' | null
  sesConfig: {
    configured: boolean
    region?: string
    accessKeyId?: string
    secretAccessKey?: string
    useIAMRole: boolean
    sandboxMode?: boolean
  }
  smtpConfig: {
    configured: boolean
    host?: string
    port?: number
    secure?: boolean
    auth?: {
      user?: string
      pass?: string
    }
  }
  quotaLimits: {
    dailyQuota: number
    sendRate: number
    maxRecipients: number
  }
  monitoring: {
    trackOpens: boolean
    trackClicks: boolean
    trackBounces: boolean
    trackComplaints: boolean
  }
  suppressionList: {
    enabled: boolean
    autoAddBounces: boolean
    autoAddComplaints: boolean
  }
  isConfigured: boolean
  createdAt: Date
  updatedAt: Date
}

export interface OrganizationEmailSettings {
  configured: boolean
  replyToAddress: string | null
  supportEmail: string | null
  emailFooter: string | null
  notifications: {
    userInvitations: boolean
    taskAssignments: boolean
    campaignUpdates: boolean
    paymentReminders: boolean
    reportReady: boolean
    deadlineReminders: boolean
    approvalRequests: boolean
    adCopyUpdates: boolean
  }
  sendingRules: {
    dailyLimitPerUser: number
    allowedDomains: string[]
    requireApproval: boolean
    ccOnCertainEmails: boolean
    ccAddress: string | null
  }
}

export interface OrganizationEmailBranding {
  enabled: boolean
  logoUrl: string | null
  primaryColor: string
  secondaryColor: string
  customCSS: string | null
}

export interface UserEmailPreferences {
  configured: boolean
  enabled: boolean
  frequency: 'immediate' | 'daily' | 'weekly'
  format: 'html' | 'text'
  categories: {
    taskAssignments: boolean
    taskComments: boolean
    taskDeadlines: boolean
    campaignStatusChanges: boolean
    campaignComments: boolean
    mentions: boolean
    approvalRequests: boolean
    approvalDecisions: boolean
    reportCompletion: boolean
    systemAnnouncements: boolean
  }
  digestSettings: {
    dailyDigestTime: string // HH:MM format
    weeklyDigestDay: number // 0-6, 0 = Sunday
    includeTaskSummary: boolean
    includeCampaignSummary: boolean
    includeUpcomingDeadlines: boolean
  }
}

export interface EmailTemplate {
  id: string
  key: string
  name: string
  description?: string
  subject: string
  htmlContent: string
  textContent: string
  variables: string[]
  category: string
  isActive: boolean
  isSystemDefault?: boolean
  canCustomize?: boolean
  basedOnSystemTemplate?: string
  createdAt: Date
  updatedAt: Date
}

export interface EmailLogEntry {
  id: string
  organizationId: string
  userId?: string
  recipient: string
  subject?: string
  templateKey?: string
  status: 'pending' | 'queued' | 'sending' | 'sent' | 'delivered' | 'failed' | 'bounced' | 'complained'
  providerMessageId?: string
  errorMessage?: string
  metadata: Record<string, any>
  sentAt?: Date
  deliveredAt?: Date
  openedAt?: Date
  clickedAt?: Date
  bouncedAt?: Date
  complainedAt?: Date
  createdAt: Date
}

export interface EmailAnalytics {
  period: {
    startDate: Date
    endDate: Date
  }
  hasData: boolean
  message?: string
  summary: {
    sent: number
    delivered: number
    opened: number
    clicked: number
    bounced: number
    complained: number
  }
  charts?: {
    daily: Array<{
      date: string
      sent: number
      delivered: number
      opened: number
      clicked: number
    }>
    byStatus: Array<{
      status: string
      count: number
    }>
    byTemplate: Array<{
      templateKey: string
      sent: number
      delivered: number
      opened: number
    }>
  }
}

export interface EmailSuppressionEntry {
  id: string
  email: string
  reason: 'bounce' | 'complaint' | 'manual' | 'unsubscribe'
  source?: string
  metadata: Record<string, any>
  addedAt: Date
}