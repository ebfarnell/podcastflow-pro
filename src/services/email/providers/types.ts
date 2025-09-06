// Email provider interface
export interface EmailProviderConfig {
  provider: 'ses' | 'smtp'
  sesConfig?: {
    region: string
    accessKeyId?: string
    secretAccessKey?: string
    useIAMRole: boolean
  }
  smtpConfig?: {
    host: string
    port: number
    secure: boolean
    auth?: {
      user: string
      pass: string
    }
  }
}

export interface EmailOptions {
  from: string
  to: string | string[]
  cc?: string | string[]
  bcc?: string | string[]
  subject: string
  html?: string
  text?: string
  replyTo?: string
  attachments?: EmailAttachment[]
  tags?: Record<string, string>
  messageId?: string
  trackingId?: string
}

export interface EmailAttachment {
  filename: string
  content?: Buffer | string
  path?: string
  contentType?: string
  encoding?: string
}

export interface EmailResult {
  messageId: string
  accepted: string[]
  rejected: string[]
  response?: string
  error?: string
}

export interface EmailProvider {
  name: string
  initialize(config: EmailProviderConfig): Promise<void>
  sendEmail(options: EmailOptions): Promise<EmailResult>
  verifyConnection(): Promise<boolean>
  getQuota?(): Promise<EmailQuota>
  getSendStatistics?(): Promise<EmailStatistics>
}

export interface EmailQuota {
  max24HourSend: number
  maxSendRate: number
  sentLast24Hours: number
}

export interface EmailStatistics {
  send: number
  bounce: number
  complaint: number
  delivery: number
  reject: number
  reputation?: number
}

export class EmailProviderError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number,
    public details?: any
  ) {
    super(message)
    this.name = 'EmailProviderError'
  }
}