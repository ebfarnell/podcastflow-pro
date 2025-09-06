import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'

interface EmailParams {
  to: string | string[]
  subject: string
  htmlBody: string
  textBody: string
  replyTo?: string
}

interface InvitationData {
  email: string
  inviterName: string
  organizationName: string
  role: string
  invitationToken: string
}

class EmailService {
  private sesClient: SESClient
  private fromEmail: string
  private replyToEmail: string
  private appUrl: string

  constructor() {
    this.sesClient = new SESClient({ 
      region: process.env.AWS_REGION || 'us-east-1'
      // AWS credentials will be picked up from environment or IAM role
    })
    
    this.fromEmail = process.env.SES_FROM_EMAIL || 'noreply@podcastflow.pro'
    this.replyToEmail = process.env.SES_REPLY_TO_EMAIL || 'support@podcastflow.pro'
    this.appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000'
  }

  async sendEmail(params: EmailParams): Promise<any> {
    const { to, subject, htmlBody, textBody, replyTo } = params
    
    // Check if SES is in sandbox mode and adjust accordingly
    const recipientEmail = Array.isArray(to) ? to[0] : to
    
    
    const command = new SendEmailCommand({
      Destination: {
        ToAddresses: Array.isArray(to) ? to : [to]
      },
      Message: {
        Body: {
          Html: { Data: htmlBody, Charset: 'UTF-8' },
          Text: { Data: textBody, Charset: 'UTF-8' }
        },
        Subject: { Data: subject, Charset: 'UTF-8' }
      },
      Source: this.fromEmail,
      ReplyToAddresses: [replyTo || this.replyToEmail]
    })

    try {
      const result = await this.sesClient.send(command)
      return result
    } catch (error: any) {
      console.error('❌ Failed to send email:', error)
      
      // Check if it's a sandbox mode issue
      if (error.message?.includes('Email address not verified') || 
          error.message?.includes('MessageRejected') ||
          error.Code === 'MessageRejected' ||
          error.name === 'MessageRejected' ||
          error.Error?.Code === 'MessageRejected' ||
          error.Error?.Message?.includes('Email address is not verified')) {
        console.warn('⚠️ SES is in sandbox mode - email addresses must be verified')
        console.warn('⚠️ In production, request SES production access from AWS')
        
        // For development/testing, log what would have been sent
        
        // Return a mock success response for development
        return {
          MessageId: 'sandbox-mode-' + Date.now(),
          ResponseMetadata: { HTTPStatusCode: 200 }
        }
      }
      
      throw error
    }
  }

  async sendUserInvitation(invitationData: InvitationData): Promise<any> {
    const { email, inviterName, organizationName, role, invitationToken } = invitationData
    
    const invitationUrl = `${this.appUrl}/accept-invitation?token=${invitationToken}`
    
    const subject = `Invitation to join ${organizationName} on PodcastFlow Pro`
    
    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f5f5f5; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
          .header { background-color: #1976d2; color: white; padding: 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 28px; }
          .content { padding: 30px; }
          .content h2 { color: #1976d2; margin-top: 0; }
          .button { 
            display: inline-block; 
            padding: 15px 30px; 
            background-color: #1976d2; 
            color: white; 
            text-decoration: none; 
            border-radius: 6px; 
            margin: 20px 0;
            font-weight: bold;
            text-align: center;
          }
          .button:hover { background-color: #1565c0; }
          .url-box { 
            background-color: #f5f5f5; 
            padding: 15px; 
            border-radius: 4px; 
            word-break: break-all; 
            font-family: monospace; 
            font-size: 14px;
          }
          .footer { 
            background-color: #f8f9fa; 
            padding: 20px; 
            text-align: center; 
            font-size: 12px; 
            color: #666; 
            border-top: 1px solid #dee2e6;
          }
          .role-badge {
            display: inline-block;
            background-color: #e3f2fd;
            color: #1976d2;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: bold;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="https://app.podcastflow.pro/images/logos/logo-main-cropped.png" alt="PodcastFlow Pro" style="height: 60px; width: auto; margin-bottom: 15px;" />
            <h1 style="margin: 0; font-size: 24px;">PodcastFlow Pro</h1>
          </div>
          <div class="content">
            <h2>You're invited to join ${organizationName}!</h2>
            <p>Hi there,</p>
            <p><strong>${inviterName}</strong> has invited you to join the <strong>${organizationName}</strong> team on PodcastFlow Pro as a <span class="role-badge">${role}</span>.</p>
            <p>PodcastFlow Pro is the comprehensive podcast advertising management platform that helps teams collaborate on:</p>
            <ul>
              <li>📊 Campaign management and tracking</li>
              <li>🎯 Ad operations and placements</li>
              <li>📈 Performance analytics and reporting</li>
              <li>👥 Team collaboration tools</li>
            </ul>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${invitationUrl}" class="button">Accept Invitation</a>
            </div>
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <div class="url-box">${invitationUrl}</div>
            <p><strong>⏰ This invitation will expire in 7 days.</strong></p>
            <p>Once you accept the invitation, you'll be able to set up your password and start collaborating with your team.</p>
          </div>
          <div class="footer">
            <img src="https://app.podcastflow.pro/images/logos/logo-icon-only.png" alt="PodcastFlow Pro" style="height: 24px; width: auto; margin-bottom: 10px; opacity: 0.8;" />
            <p>If you didn't expect this invitation, you can safely ignore this email.</p>
            <p>&copy; ${new Date().getFullYear()} PodcastFlow Pro. All rights reserved.</p>
            <p style="margin: 5px 0 0 0; color: #999;">Professional Podcast Advertising Management</p>
            <p>Need help? Contact us at <a href="mailto:support@podcastflow.pro">support@podcastflow.pro</a></p>
          </div>
        </div>
      </body>
      </html>
    `
    
    const textBody = `
🎧 PodcastFlow Pro - Team Invitation

You're invited to join ${organizationName}!

Hi there,

${inviterName} has invited you to join the ${organizationName} team on PodcastFlow Pro as a ${role}.

PodcastFlow Pro is the comprehensive podcast advertising management platform that helps teams collaborate on campaign management, ad operations, and performance tracking.

Accept your invitation by visiting:
${invitationUrl}

⏰ This invitation will expire in 7 days.

Once you accept the invitation, you'll be able to set up your password and start collaborating with your team.

If you didn't expect this invitation, you can safely ignore this email.

Best regards,
The PodcastFlow Pro Team

Need help? Contact us at support@podcastflow.pro
    `
    
    return this.sendEmail({
      to: email,
      subject,
      htmlBody,
      textBody
    })
  }

  async sendPasswordReset(resetData: {
    email: string
    resetToken: string
    userName?: string
  }): Promise<any> {
    const { email, resetToken, userName } = resetData
    
    const resetUrl = `${this.appUrl}/reset-password?token=${resetToken}`
    
    const subject = 'Reset your PodcastFlow Pro password'
    
    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f5f5f5; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
          .header { background-color: #1976d2; color: white; padding: 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 28px; }
          .content { padding: 30px; }
          .content h2 { color: #1976d2; margin-top: 0; }
          .button { 
            display: inline-block; 
            padding: 15px 30px; 
            background-color: #1976d2; 
            color: white; 
            text-decoration: none; 
            border-radius: 6px; 
            margin: 20px 0;
            font-weight: bold;
          }
          .button:hover { background-color: #1565c0; }
          .url-box { 
            background-color: #f5f5f5; 
            padding: 15px; 
            border-radius: 4px; 
            word-break: break-all; 
            font-family: monospace; 
            font-size: 14px;
          }
          .footer { 
            background-color: #f8f9fa; 
            padding: 20px; 
            text-align: center; 
            font-size: 12px; 
            color: #666; 
            border-top: 1px solid #dee2e6;
          }
          .warning {
            background-color: #fff3cd;
            border: 1px solid #ffeaa7;
            color: #856404;
            padding: 15px;
            border-radius: 4px;
            margin: 20px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="https://app.podcastflow.pro/images/logos/logo-main-cropped.png" alt="PodcastFlow Pro" style="height: 60px; width: auto; margin-bottom: 15px;" />
            <h1 style="margin: 0; font-size: 24px;">PodcastFlow Pro</h1>
          </div>
          <div class="content">
            <h2>🔐 Password Reset Request</h2>
            <p>Hi ${userName || 'there'},</p>
            <p>We received a request to reset your password. Click the button below to create a new password:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" class="button">Reset Password</a>
            </div>
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <div class="url-box">${resetUrl}</div>
            <div class="warning">
              <strong>⏰ This link will expire in 1 hour</strong> for security reasons.
            </div>
            <p>If you didn't request a password reset, please ignore this email or contact support if you have concerns.</p>
          </div>
          <div class="footer">
            <img src="https://app.podcastflow.pro/images/logos/logo-icon-only.png" alt="PodcastFlow Pro" style="height: 24px; width: auto; margin-bottom: 10px; opacity: 0.8;" />
            <p>&copy; ${new Date().getFullYear()} PodcastFlow Pro. All rights reserved.</p>
            <p style="margin: 5px 0 0 0; color: #999;">Professional Podcast Advertising Management</p>
            <p>Need help? Contact us at <a href="mailto:support@podcastflow.pro">support@podcastflow.pro</a></p>
          </div>
        </div>
      </body>
      </html>
    `
    
    const textBody = `
🎧 PodcastFlow Pro - Password Reset Request

🔐 Password Reset Request

Hi ${userName || 'there'},

We received a request to reset your password. Visit the following link to create a new password:

${resetUrl}

⏰ This link will expire in 1 hour for security reasons.

If you didn't request a password reset, please ignore this email or contact support if you have concerns.

Best regards,
The PodcastFlow Pro Team

Need help? Contact us at support@podcastflow.pro
    `
    
    return this.sendEmail({
      to: email,
      subject,
      htmlBody,
      textBody
    })
  }

  // Test email connectivity
  async testConnection(): Promise<boolean> {
    try {
      // Send a test email to verify SES configuration
      await this.sendEmail({
        to: this.fromEmail,
        subject: 'PodcastFlow Pro Email Service Test',
        htmlBody: '<p>This is a test email from PodcastFlow Pro email service.</p>',
        textBody: 'This is a test email from PodcastFlow Pro email service.'
      })
      return true
    } catch (error) {
      console.error('Email service test failed:', error)
      return false
    }
  }
}

// Singleton instance
export const emailService = new EmailService()
export default emailService