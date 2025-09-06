const AWS = require('aws-sdk');
const ses = new AWS.SES({ region: process.env.AWS_REGION || 'us-east-1' });

class EmailService {
  constructor() {
    this.fromEmail = process.env.SES_FROM_EMAIL || 'noreply@podcastflow.pro';
    this.replyToEmail = process.env.SES_REPLY_TO_EMAIL || 'support@podcastflow.pro';
    this.appUrl = process.env.APP_URL || 'https://app.podcastflow.pro';
  }

  async sendEmail(params) {
    const { to, subject, htmlBody, textBody, replyTo } = params;
    
    const emailParams = {
      Destination: {
        ToAddresses: Array.isArray(to) ? to : [to]
      },
      Message: {
        Body: {
          Html: { Data: htmlBody },
          Text: { Data: textBody }
        },
        Subject: { Data: subject }
      },
      Source: this.fromEmail,
      ReplyToAddresses: [replyTo || this.replyToEmail]
    };

    try {
      const result = await ses.sendEmail(emailParams).promise();
      console.log('Email sent successfully:', result.MessageId);
      return result;
    } catch (error) {
      console.error('Failed to send email:', error);
      throw error;
    }
  }

  async sendTeamInvitation(invitationData) {
    const { email, inviterName, organizationName, role, invitationToken } = invitationData;
    
    const invitationUrl = `${this.appUrl}/accept-invitation?token=${invitationToken}`;
    
    const subject = `Invitation to join ${organizationName} on PodcastFlow Pro`;
    
    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #1976d2; color: white; padding: 20px; text-align: center; }
          .content { background-color: #f5f5f5; padding: 20px; margin-top: 20px; }
          .button { 
            display: inline-block; 
            padding: 12px 24px; 
            background-color: #1976d2; 
            color: white; 
            text-decoration: none; 
            border-radius: 4px; 
            margin: 20px 0;
          }
          .footer { margin-top: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>PodcastFlow Pro</h1>
          </div>
          <div class="content">
            <h2>You're invited to join ${organizationName}</h2>
            <p>Hi there,</p>
            <p>${inviterName} has invited you to join the ${organizationName} team on PodcastFlow Pro as a ${role}.</p>
            <p>PodcastFlow Pro is the comprehensive podcast advertising management platform that helps teams collaborate on campaign management, ad operations, and performance tracking.</p>
            <p style="text-align: center;">
              <a href="${invitationUrl}" class="button">Accept Invitation</a>
            </p>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all;">${invitationUrl}</p>
            <p>This invitation will expire in 7 days.</p>
          </div>
          <div class="footer">
            <p>If you didn't expect this invitation, you can safely ignore this email.</p>
            <p>&copy; ${new Date().getFullYear()} PodcastFlow Pro. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const textBody = `
You're invited to join ${organizationName} on PodcastFlow Pro

Hi there,

${inviterName} has invited you to join the ${organizationName} team on PodcastFlow Pro as a ${role}.

Accept your invitation by visiting:
${invitationUrl}

This invitation will expire in 7 days.

If you didn't expect this invitation, you can safely ignore this email.

Best regards,
The PodcastFlow Pro Team
    `;
    
    return this.sendEmail({
      to: email,
      subject,
      htmlBody,
      textBody
    });
  }

  async sendPasswordReset(resetData) {
    const { email, resetToken, userName } = resetData;
    
    const resetUrl = `${this.appUrl}/reset-password?token=${resetToken}`;
    
    const subject = 'Reset your PodcastFlow Pro password';
    
    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #1976d2; color: white; padding: 20px; text-align: center; }
          .content { background-color: #f5f5f5; padding: 20px; margin-top: 20px; }
          .button { 
            display: inline-block; 
            padding: 12px 24px; 
            background-color: #1976d2; 
            color: white; 
            text-decoration: none; 
            border-radius: 4px; 
            margin: 20px 0;
          }
          .footer { margin-top: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>PodcastFlow Pro</h1>
          </div>
          <div class="content">
            <h2>Password Reset Request</h2>
            <p>Hi ${userName || 'there'},</p>
            <p>We received a request to reset your password. Click the button below to create a new password:</p>
            <p style="text-align: center;">
              <a href="${resetUrl}" class="button">Reset Password</a>
            </p>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all;">${resetUrl}</p>
            <p>This link will expire in 1 hour for security reasons.</p>
            <p>If you didn't request a password reset, please ignore this email or contact support if you have concerns.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} PodcastFlow Pro. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const textBody = `
Password Reset Request

Hi ${userName || 'there'},

We received a request to reset your password. Visit the following link to create a new password:

${resetUrl}

This link will expire in 1 hour for security reasons.

If you didn't request a password reset, please ignore this email or contact support if you have concerns.

Best regards,
The PodcastFlow Pro Team
    `;
    
    return this.sendEmail({
      to: email,
      subject,
      htmlBody,
      textBody
    });
  }

  async sendCampaignNotification(notificationData) {
    const { email, campaignName, status, message, actionUrl } = notificationData;
    
    const subject = `Campaign Update: ${campaignName}`;
    
    const statusColors = {
      active: '#4caf50',
      paused: '#ff9800',
      completed: '#2196f3',
      error: '#f44336'
    };
    
    const statusColor = statusColors[status] || '#666';
    
    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #1976d2; color: white; padding: 20px; text-align: center; }
          .content { background-color: #f5f5f5; padding: 20px; margin-top: 20px; }
          .status { 
            display: inline-block; 
            padding: 4px 12px; 
            background-color: ${statusColor}; 
            color: white; 
            border-radius: 4px; 
            font-weight: bold;
          }
          .button { 
            display: inline-block; 
            padding: 12px 24px; 
            background-color: #1976d2; 
            color: white; 
            text-decoration: none; 
            border-radius: 4px; 
            margin: 20px 0;
          }
          .footer { margin-top: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>PodcastFlow Pro</h1>
          </div>
          <div class="content">
            <h2>Campaign Update</h2>
            <p><strong>Campaign:</strong> ${campaignName}</p>
            <p><strong>Status:</strong> <span class="status">${status.toUpperCase()}</span></p>
            <p>${message}</p>
            ${actionUrl ? `
              <p style="text-align: center;">
                <a href="${actionUrl}" class="button">View Campaign</a>
              </p>
            ` : ''}
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} PodcastFlow Pro. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const textBody = `
Campaign Update: ${campaignName}

Status: ${status.toUpperCase()}

${message}

${actionUrl ? `View campaign details at: ${actionUrl}` : ''}

Best regards,
The PodcastFlow Pro Team
    `;
    
    return this.sendEmail({
      to: email,
      subject,
      htmlBody,
      textBody
    });
  }

  async sendReportReady(reportData) {
    const { email, reportName, reportType, downloadUrl } = reportData;
    
    const subject = `Your ${reportType} report is ready`;
    
    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #1976d2; color: white; padding: 20px; text-align: center; }
          .content { background-color: #f5f5f5; padding: 20px; margin-top: 20px; }
          .button { 
            display: inline-block; 
            padding: 12px 24px; 
            background-color: #1976d2; 
            color: white; 
            text-decoration: none; 
            border-radius: 4px; 
            margin: 20px 0;
          }
          .footer { margin-top: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>PodcastFlow Pro</h1>
          </div>
          <div class="content">
            <h2>Your Report is Ready</h2>
            <p>Your ${reportType} report "${reportName}" has been generated and is ready for download.</p>
            <p style="text-align: center;">
              <a href="${downloadUrl}" class="button">Download Report</a>
            </p>
            <p>This download link will expire in 24 hours.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} PodcastFlow Pro. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const textBody = `
Your Report is Ready

Your ${reportType} report "${reportName}" has been generated and is ready for download.

Download your report at:
${downloadUrl}

This download link will expire in 24 hours.

Best regards,
The PodcastFlow Pro Team
    `;
    
    return this.sendEmail({
      to: email,
      subject,
      htmlBody,
      textBody
    });
  }
}

module.exports = EmailService;