import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import prisma from '@/lib/db/prisma'
import { SESProvider } from '@/services/email/providers/ses-provider'
import { EmailProviderConfig } from '@/services/email/providers/types'

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin and master can send test emails
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { to, template = 'test', subject = 'Test Email from PodcastFlow Pro' } = await request.json()

    if (!to || !Array.isArray(to) || to.length === 0) {
      return NextResponse.json({ error: 'Recipients required' }, { status: 400 })
    }

    // Get organization and email settings
    const organization = await prisma.organization.findUnique({
      where: { id: session.organizationId! },
      select: {
        id: true,
        name: true,
        settings: true
      }
    })

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const settings = organization.settings as any || {}
    const emailSettings = settings.emailSettings || {}

    // Get SES configuration from environment
    const sesConfig: EmailProviderConfig = {
      provider: 'ses',
      sesConfig: {
        region: process.env.AWS_SES_REGION || process.env.AWS_REGION || 'us-east-1',
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        fromEmail: emailSettings.fromEmail || process.env.EMAIL_FROM || 'notifications@app.podcastflow.pro',
        fromName: emailSettings.fromName || organization.name || 'PodcastFlow Pro',
        replyTo: emailSettings.replyToAddress || process.env.REPLY_TO_EMAIL || 'support@podcastflow.pro',
        useIAMRole: false
      }
    }

    // Initialize SES provider
    const sesProvider = new SESProvider()
    await sesProvider.initialize(sesConfig)

    // Get SES status info
    const [quota, stats, verifiedEmails] = await Promise.all([
      sesProvider.getQuota(),
      sesProvider.getSendStatistics(),
      sesProvider.listVerifiedEmails()
    ])

    // Build test email content
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>${subject}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #2196F3; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 8px 8px; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
            .status-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            .status-table th, .status-table td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
            .status-table th { background-color: #f0f0f0; font-weight: bold; }
            .badge { display: inline-block; padding: 3px 8px; border-radius: 3px; font-size: 11px; font-weight: bold; }
            .badge-success { background-color: #4CAF50; color: white; }
            .badge-warning { background-color: #FF9800; color: white; }
            .badge-info { background-color: #2196F3; color: white; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>PodcastFlow Pro - Test Email</h1>
            </div>
            <div class="content">
              <h2>Email Configuration Test Successful!</h2>
              <p>This test email confirms that your organization's email settings are working correctly.</p>
              
              <h3>Organization Details:</h3>
              <table class="status-table">
                <tr>
                  <th>Organization</th>
                  <td>${organization.name}</td>
                </tr>
                <tr>
                  <th>Sent By</th>
                  <td>${session.email}</td>
                </tr>
                <tr>
                  <th>Timestamp</th>
                  <td>${new Date().toLocaleString()}</td>
                </tr>
              </table>

              <h3>SES Configuration Status:</h3>
              <table class="status-table">
                <tr>
                  <th>Region</th>
                  <td><span class="badge badge-info">${sesConfig.sesConfig?.region}</span></td>
                </tr>
                <tr>
                  <th>From Email</th>
                  <td>${sesConfig.sesConfig?.fromEmail}</td>
                </tr>
                <tr>
                  <th>Reply-To</th>
                  <td>${sesConfig.sesConfig?.replyTo}</td>
                </tr>
                <tr>
                  <th>24hr Quota</th>
                  <td>${quota.max24HourSend} emails (${quota.sentLast24Hours} sent)</td>
                </tr>
                <tr>
                  <th>Send Rate</th>
                  <td>${quota.maxSendRate} emails/second</td>
                </tr>
                <tr>
                  <th>Reputation Score</th>
                  <td>
                    <span class="badge ${stats.reputation > 80 ? 'badge-success' : stats.reputation > 60 ? 'badge-warning' : 'badge-warning'}">
                      ${stats.reputation.toFixed(1)}%
                    </span>
                  </td>
                </tr>
                <tr>
                  <th>Verified Domains</th>
                  <td>${verifiedEmails.filter(e => !e.includes('@')).join(', ') || 'None'}</td>
                </tr>
                <tr>
                  <th>Verified Emails</th>
                  <td>${verifiedEmails.filter(e => e.includes('@')).join(', ')}</td>
                </tr>
              </table>

              <h3>24hr Statistics:</h3>
              <table class="status-table">
                <tr>
                  <th>Sent</th>
                  <td>${stats.send}</td>
                </tr>
                <tr>
                  <th>Delivered</th>
                  <td>${stats.delivery}</td>
                </tr>
                <tr>
                  <th>Bounced</th>
                  <td>${stats.bounce}</td>
                </tr>
                <tr>
                  <th>Complaints</th>
                  <td>${stats.complaint}</td>
                </tr>
                <tr>
                  <th>Rejected</th>
                  <td>${stats.reject}</td>
                </tr>
              </table>

              <div class="footer">
                <p><strong>Note:</strong> This is a test email to verify your email configuration.</p>
                <p>If you received this email, your settings are working correctly.</p>
                <p style="margin-top: 10px;">
                  ${emailSettings.emailFooter || `© ${new Date().getFullYear()} ${organization.name}. All rights reserved.`}
                </p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `

    const textContent = `
PodcastFlow Pro - Test Email

Email Configuration Test Successful!

This test email confirms that your organization's email settings are working correctly.

Organization: ${organization.name}
Sent By: ${session.email}
Timestamp: ${new Date().toLocaleString()}

SES Configuration:
- Region: ${sesConfig.sesConfig?.region}
- From: ${sesConfig.sesConfig?.fromEmail}
- Reply-To: ${sesConfig.sesConfig?.replyTo}
- 24hr Quota: ${quota.max24HourSend} (${quota.sentLast24Hours} sent)
- Reputation: ${stats.reputation.toFixed(1)}%

If you received this email, your settings are working correctly.

${emailSettings.emailFooter || `© ${new Date().getFullYear()} ${organization.name}. All rights reserved.`}
    `

    // Send test email
    const result = await sesProvider.sendEmail({
      from: `${sesConfig.sesConfig?.fromName} <${sesConfig.sesConfig?.fromEmail}>`,
      to,
      subject,
      html: htmlContent,
      text: textContent,
      replyTo: sesConfig.sesConfig?.replyTo,
      tags: {
        organizationId: organization.id,
        type: 'test',
        sender: session.userId
      }
    })

    // Log the test email
    for (const recipient of to) {
      await prisma.emailLog.create({
        data: {
          organizationId: organization.id,
          userId: session.userId,
          toEmail: recipient,
          fromEmail: sesConfig.sesConfig?.fromEmail || '',
          recipient, // deprecated field
          subject,
          templateKey: 'test',
          status: 'sent',
          messageId: result.messageId,
          metadata: {
            sesResponse: result.response,
            quota,
            stats,
            testEmail: true
          },
          sentAt: new Date()
        }
      })
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      accepted: result.accepted,
      rejected: result.rejected,
      sesStatus: {
        region: sesConfig.sesConfig?.region,
        quota,
        stats,
        verifiedEmails,
        mode: quota.max24HourSend > 200 ? 'production' : 'sandbox'
      }
    })
  } catch (error: any) {
    console.error('Test email error:', error)
    return NextResponse.json({
      error: error.message || 'Failed to send test email',
      code: error.code,
      details: error.details
    }, { status: error.statusCode || 500 })
  }
}