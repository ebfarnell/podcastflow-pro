import { 
  SESClient, 
  SendEmailCommand,
  GetSendQuotaCommand,
  GetSendStatisticsCommand,
  VerifyEmailIdentityCommand,
  ListVerifiedEmailAddressesCommand,
  SendRawEmailCommand
} from '@aws-sdk/client-ses'
import { 
  EmailProvider, 
  EmailProviderConfig, 
  EmailOptions, 
  EmailResult,
  EmailQuota,
  EmailStatistics,
  EmailProviderError 
} from './types'

export class SESProvider implements EmailProvider {
  name = 'Amazon SES'
  private client: SESClient | null = null
  private config: EmailProviderConfig['sesConfig'] | null = null
  private verified: boolean = false

  async initialize(config: EmailProviderConfig): Promise<void> {
    if (config.provider !== 'ses' || !config.sesConfig) {
      throw new EmailProviderError('Invalid configuration for SES provider')
    }

    this.config = config.sesConfig
    
    const sesConfig: any = {
      region: this.config.region || 'us-east-1'
    }

    // Use explicit credentials if not using IAM role
    if (!this.config.useIAMRole && this.config.accessKeyId && this.config.secretAccessKey) {
      sesConfig.credentials = {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey
      }
    }

    this.client = new SESClient(sesConfig)
    
    // Verify connection
    const isConnected = await this.verifyConnection()
    if (!isConnected) {
      throw new EmailProviderError('Failed to connect to AWS SES')
    }
    
    this.verified = true
  }

  async sendEmail(options: EmailOptions): Promise<EmailResult> {
    if (!this.client || !this.verified) {
      throw new EmailProviderError('SES provider not initialized')
    }

    try {
      // Prepare recipients
      const toAddresses = Array.isArray(options.to) ? options.to : [options.to]
      const ccAddresses = options.cc ? (Array.isArray(options.cc) ? options.cc : [options.cc]) : []
      const bccAddresses = options.bcc ? (Array.isArray(options.bcc) ? options.bcc : [options.bcc]) : []

      // If there are attachments, we need to use SendRawEmail
      if (options.attachments && options.attachments.length > 0) {
        return await this.sendRawEmail(options)
      }

      // Build the email command
      const command = new SendEmailCommand({
        Source: options.from,
        Destination: {
          ToAddresses: toAddresses,
          CcAddresses: ccAddresses.length > 0 ? ccAddresses : undefined,
          BccAddresses: bccAddresses.length > 0 ? bccAddresses : undefined
        },
        Message: {
          Subject: {
            Data: options.subject,
            Charset: 'UTF-8'
          },
          Body: {
            ...(options.html && {
              Html: {
                Data: options.html,
                Charset: 'UTF-8'
              }
            }),
            ...(options.text && {
              Text: {
                Data: options.text,
                Charset: 'UTF-8'
              }
            })
          }
        },
        ReplyToAddresses: options.replyTo ? [options.replyTo] : undefined,
        ConfigurationSetName: process.env.SES_CONFIGURATION_SET,
        Tags: options.tags ? Object.entries(options.tags).map(([Name, Value]) => ({ Name, Value })) : undefined
      })

      const response = await this.client.send(command)

      return {
        messageId: response.MessageId || '',
        accepted: [...toAddresses, ...ccAddresses, ...bccAddresses],
        rejected: [],
        response: response.$metadata.httpStatusCode?.toString()
      }
    } catch (error: any) {
      console.error('SES send error:', error)
      
      // Handle specific SES errors
      if (error.name === 'MessageRejected') {
        throw new EmailProviderError(
          'Email rejected by SES',
          'MESSAGE_REJECTED',
          400,
          error
        )
      }
      
      if (error.name === 'MailFromDomainNotVerified') {
        throw new EmailProviderError(
          'Sender domain not verified in SES',
          'DOMAIN_NOT_VERIFIED',
          400,
          error
        )
      }
      
      if (error.name === 'ConfigurationSetDoesNotExist') {
        throw new EmailProviderError(
          'SES configuration set not found',
          'CONFIG_SET_NOT_FOUND',
          400,
          error
        )
      }

      throw new EmailProviderError(
        error.message || 'Failed to send email',
        error.name,
        error.$metadata?.httpStatusCode,
        error
      )
    }
  }

  async verifyConnection(): Promise<boolean> {
    if (!this.client) {
      return false
    }

    try {
      // Try to get send quota as a connection test
      const command = new GetSendQuotaCommand({})
      await this.client.send(command)
      return true
    } catch (error) {
      console.error('SES connection verification failed:', error)
      return false
    }
  }

  async getQuota(): Promise<EmailQuota> {
    if (!this.client || !this.verified) {
      throw new EmailProviderError('SES provider not initialized')
    }

    try {
      const command = new GetSendQuotaCommand({})
      const response = await this.client.send(command)

      return {
        max24HourSend: response.Max24HourSend || 0,
        maxSendRate: response.MaxSendRate || 0,
        sentLast24Hours: response.SentLast24Hours || 0
      }
    } catch (error: any) {
      throw new EmailProviderError(
        'Failed to get SES quota',
        error.name,
        error.$metadata?.httpStatusCode,
        error
      )
    }
  }

  async getSendStatistics(): Promise<EmailStatistics> {
    if (!this.client || !this.verified) {
      throw new EmailProviderError('SES provider not initialized')
    }

    try {
      const command = new GetSendStatisticsCommand({})
      const response = await this.client.send(command)

      // Aggregate statistics from the last 24 hours
      const stats = {
        send: 0,
        bounce: 0,
        complaint: 0,
        delivery: 0,
        reject: 0
      }

      if (response.SendDataPoints) {
        // Get statistics from the last 24 hours
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
        
        response.SendDataPoints
          .filter(point => point.Timestamp && new Date(point.Timestamp) > oneDayAgo)
          .forEach(point => {
            stats.send += point.DeliveryAttempts || 0
            stats.bounce += point.Bounces || 0
            stats.complaint += point.Complaints || 0
            stats.delivery += (point.DeliveryAttempts || 0) - (point.Bounces || 0) - (point.Rejects || 0)
            stats.reject += point.Rejects || 0
          })
      }

      // Calculate reputation (simple formula based on bounce and complaint rates)
      const totalSent = stats.send || 1 // Avoid division by zero
      const bounceRate = (stats.bounce / totalSent) * 100
      const complaintRate = (stats.complaint / totalSent) * 100
      
      // Reputation score: 100 - (bounce rate * 5) - (complaint rate * 10)
      // This gives more weight to complaints than bounces
      stats.reputation = Math.max(0, 100 - (bounceRate * 5) - (complaintRate * 10))

      return stats
    } catch (error: any) {
      throw new EmailProviderError(
        'Failed to get SES statistics',
        error.name,
        error.$metadata?.httpStatusCode,
        error
      )
    }
  }

  async verifyEmailAddress(email: string): Promise<boolean> {
    if (!this.client || !this.verified) {
      throw new EmailProviderError('SES provider not initialized')
    }

    try {
      const command = new VerifyEmailIdentityCommand({ EmailAddress: email })
      await this.client.send(command)
      return true
    } catch (error: any) {
      throw new EmailProviderError(
        'Failed to verify email address',
        error.name,
        error.$metadata?.httpStatusCode,
        error
      )
    }
  }

  async listVerifiedEmails(): Promise<string[]> {
    if (!this.client || !this.verified) {
      throw new EmailProviderError('SES provider not initialized')
    }

    try {
      const command = new ListVerifiedEmailAddressesCommand({})
      const response = await this.client.send(command)
      return response.VerifiedEmailAddresses || []
    } catch (error: any) {
      throw new EmailProviderError(
        'Failed to list verified emails',
        error.name,
        error.$metadata?.httpStatusCode,
        error
      )
    }
  }

  private async sendRawEmail(options: EmailOptions): Promise<EmailResult> {
    // For emails with attachments, we need to build a MIME message
    // This is a simplified version - in production, you'd want to use a library like nodemailer
    throw new EmailProviderError(
      'Raw email with attachments not yet implemented',
      'NOT_IMPLEMENTED',
      501
    )
  }
}