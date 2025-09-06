import nodemailer, { Transporter } from 'nodemailer'
import { 
  EmailProvider, 
  EmailProviderConfig, 
  EmailOptions, 
  EmailResult,
  EmailProviderError 
} from './types'

export class SMTPProvider implements EmailProvider {
  name = 'SMTP'
  private transporter: Transporter | null = null
  private config: EmailProviderConfig['smtpConfig'] | null = null
  private verified: boolean = false

  async initialize(config: EmailProviderConfig): Promise<void> {
    if (config.provider !== 'smtp' || !config.smtpConfig) {
      throw new EmailProviderError('Invalid configuration for SMTP provider')
    }

    this.config = config.smtpConfig
    
    // Create nodemailer transporter
    this.transporter = nodemailer.createTransporter({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      auth: this.config.auth ? {
        user: this.config.auth.user,
        pass: this.config.auth.pass
      } : undefined,
      // Additional options for better reliability
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      connectionTimeout: 60000, // 60 seconds
      greetingTimeout: 30000,   // 30 seconds
      socketTimeout: 60000      // 60 seconds
    })

    // Verify connection
    const isConnected = await this.verifyConnection()
    if (!isConnected) {
      throw new EmailProviderError('Failed to connect to SMTP server')
    }
    
    this.verified = true
  }

  async sendEmail(options: EmailOptions): Promise<EmailResult> {
    if (!this.transporter || !this.verified) {
      throw new EmailProviderError('SMTP provider not initialized')
    }

    try {
      // Prepare email options
      const mailOptions: any = {
        from: options.from,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        messageId: options.messageId,
        replyTo: options.replyTo
      }

      // Add optional fields
      if (options.cc) {
        mailOptions.cc = Array.isArray(options.cc) ? options.cc.join(', ') : options.cc
      }
      
      if (options.bcc) {
        mailOptions.bcc = Array.isArray(options.bcc) ? options.bcc.join(', ') : options.bcc
      }

      if (options.html) {
        mailOptions.html = options.html
      }

      if (options.text) {
        mailOptions.text = options.text
      }

      if (options.attachments) {
        mailOptions.attachments = options.attachments.map(att => ({
          filename: att.filename,
          content: att.content,
          path: att.path,
          contentType: att.contentType,
          encoding: att.encoding
        }))
      }

      // Add custom headers for tracking
      if (options.tags || options.trackingId) {
        mailOptions.headers = {}
        
        if (options.trackingId) {
          mailOptions.headers['X-Tracking-ID'] = options.trackingId
        }
        
        if (options.tags) {
          Object.entries(options.tags).forEach(([key, value]) => {
            mailOptions.headers[`X-Tag-${key}`] = value
          })
        }
      }

      // Send email
      const info = await this.transporter.sendMail(mailOptions)

      // Parse recipients
      const toAddresses = Array.isArray(options.to) ? options.to : [options.to]
      const ccAddresses = options.cc ? (Array.isArray(options.cc) ? options.cc : [options.cc]) : []
      const bccAddresses = options.bcc ? (Array.isArray(options.bcc) ? options.bcc : [options.bcc]) : []

      return {
        messageId: info.messageId || '',
        accepted: info.accepted || [...toAddresses, ...ccAddresses, ...bccAddresses],
        rejected: info.rejected || [],
        response: info.response
      }
    } catch (error: any) {
      console.error('SMTP send error:', error)
      
      // Handle specific SMTP errors
      if (error.code === 'ECONNREFUSED') {
        throw new EmailProviderError(
          'Cannot connect to SMTP server',
          'CONNECTION_REFUSED',
          503,
          error
        )
      }
      
      if (error.code === 'EAUTH') {
        throw new EmailProviderError(
          'SMTP authentication failed',
          'AUTH_FAILED',
          401,
          error
        )
      }
      
      if (error.code === 'ETIMEDOUT') {
        throw new EmailProviderError(
          'SMTP connection timeout',
          'TIMEOUT',
          504,
          error
        )
      }

      throw new EmailProviderError(
        error.message || 'Failed to send email',
        error.code,
        error.responseCode,
        error
      )
    }
  }

  async verifyConnection(): Promise<boolean> {
    if (!this.transporter) {
      return false
    }

    try {
      await this.transporter.verify()
      return true
    } catch (error) {
      console.error('SMTP connection verification failed:', error)
      return false
    }
  }

  // SMTP doesn't have built-in quota management
  async getQuota() {
    return {
      max24HourSend: -1, // Unlimited
      maxSendRate: -1,   // Unlimited
      sentLast24Hours: 0 // Would need to track this separately
    }
  }

  // SMTP doesn't provide statistics
  async getSendStatistics() {
    return {
      send: 0,
      bounce: 0,
      complaint: 0,
      delivery: 0,
      reject: 0,
      reputation: 100 // Assume good reputation
    }
  }

  async close(): Promise<void> {
    if (this.transporter) {
      this.transporter.close()
      this.transporter = null
      this.verified = false
    }
  }
}