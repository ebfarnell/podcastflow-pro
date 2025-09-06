// Default email templates for PodcastFlow Pro

export interface DefaultTemplate {
  key: string
  name: string
  description: string
  subject: string
  htmlContent: string
  textContent: string
  variables: string[]
  category: string
}

export const defaultTemplates: DefaultTemplate[] = [
  {
    key: 'user-invitation',
    name: 'User Invitation',
    description: 'Sent when a new user is invited to join an organization',
    subject: 'You\'ve been invited to join {{organizationName}} on PodcastFlow Pro',
    htmlContent: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invitation to PodcastFlow Pro</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f4f4; padding: 20px 0;">
    <tr>
      <td align="center">
        <table cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: #1976d2; padding: 40px 30px; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; text-align: center;">Welcome to PodcastFlow Pro</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333333;">Hi {{userName}},</p>
              
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333333;">
                You've been invited to join <strong>{{organizationName}}</strong> on PodcastFlow Pro, 
                the leading podcast advertising management platform.
              </p>
              
              <p style="margin: 0 0 30px 0; font-size: 16px; color: #333333;">
                {{inviterName}} has invited you to collaborate as a <strong>{{role}}</strong>.
              </p>
              
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <a href="{{inviteLink}}" style="display: inline-block; background-color: #1976d2; color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 4px; font-size: 16px; font-weight: bold;">Accept Invitation</a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 30px 0 20px 0; font-size: 14px; color: #666666;">
                This invitation will expire in 7 days. If you're unable to click the button above, 
                copy and paste this link into your browser:
              </p>
              
              <p style="margin: 0 0 20px 0; font-size: 14px; color: #1976d2; word-break: break-all;">
                {{inviteLink}}
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f8f8; padding: 30px; border-radius: 0 0 8px 8px;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #666666; text-align: center;">
                Need help? Contact us at <a href="mailto:{{supportEmail}}" style="color: #1976d2;">{{supportEmail}}</a>
              </p>
              <p style="margin: 0; font-size: 12px; color: #999999; text-align: center;">
                © {{currentYear}} PodcastFlow Pro. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    textContent: `Welcome to PodcastFlow Pro

Hi {{userName}},

You've been invited to join {{organizationName}} on PodcastFlow Pro, the leading podcast advertising management platform.

{{inviterName}} has invited you to collaborate as a {{role}}.

Accept your invitation:
{{inviteLink}}

This invitation will expire in 7 days.

Need help? Contact us at {{supportEmail}}

© {{currentYear}} PodcastFlow Pro. All rights reserved.`,
    variables: ['userName', 'organizationName', 'inviterName', 'role', 'inviteLink'],
    category: 'system'
  },
  
  {
    key: 'password-reset',
    name: 'Password Reset',
    description: 'Sent when a user requests to reset their password',
    subject: 'Reset your PodcastFlow Pro password',
    htmlContent: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f4f4; padding: 20px 0;">
    <tr>
      <td align="center">
        <table cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: #1976d2; padding: 40px 30px; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; text-align: center;">Password Reset Request</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333333;">Hi {{userName}},</p>
              
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333333;">
                We received a request to reset your password for your PodcastFlow Pro account.
              </p>
              
              <p style="margin: 0 0 30px 0; font-size: 16px; color: #333333;">
                Click the button below to create a new password:
              </p>
              
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <a href="{{resetLink}}" style="display: inline-block; background-color: #1976d2; color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 4px; font-size: 16px; font-weight: bold;">Reset Password</a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 30px 0 20px 0; font-size: 14px; color: #666666;">
                This link will expire in 1 hour for security reasons. If you didn't request this password reset, 
                you can safely ignore this email.
              </p>
              
              <p style="margin: 0 0 20px 0; font-size: 14px; color: #666666;">
                If you're unable to click the button above, copy and paste this link into your browser:
              </p>
              
              <p style="margin: 0 0 20px 0; font-size: 14px; color: #1976d2; word-break: break-all;">
                {{resetLink}}
              </p>
              
              <div style="background-color: #fff3cd; border: 1px solid #ffeeba; border-radius: 4px; padding: 15px; margin-top: 30px;">
                <p style="margin: 0; font-size: 14px; color: #856404;">
                  <strong>Security Tip:</strong> Never share your password with anyone. PodcastFlow Pro staff will never ask for your password.
                </p>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f8f8; padding: 30px; border-radius: 0 0 8px 8px;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #666666; text-align: center;">
                Need help? Contact us at <a href="mailto:{{supportEmail}}" style="color: #1976d2;">{{supportEmail}}</a>
              </p>
              <p style="margin: 0; font-size: 12px; color: #999999; text-align: center;">
                © {{currentYear}} PodcastFlow Pro. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    textContent: `Password Reset Request

Hi {{userName}},

We received a request to reset your password for your PodcastFlow Pro account.

Reset your password:
{{resetLink}}

This link will expire in 1 hour for security reasons. If you didn't request this password reset, you can safely ignore this email.

Security Tip: Never share your password with anyone. PodcastFlow Pro staff will never ask for your password.

Need help? Contact us at {{supportEmail}}

© {{currentYear}} PodcastFlow Pro. All rights reserved.`,
    variables: ['userName', 'resetLink'],
    category: 'system'
  },
  
  {
    key: 'task-assignment',
    name: 'Task Assignment',
    description: 'Sent when a task is assigned to a user',
    subject: 'New task assigned: {{taskTitle}}',
    htmlContent: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Task Assignment</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f4f4; padding: 20px 0;">
    <tr>
      <td align="center">
        <table cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: #1976d2; padding: 30px; border-radius: 8px 8px 0 0;">
              <h2 style="margin: 0; color: #ffffff; font-size: 24px;">New Task Assignment</h2>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 30px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333333;">Hi {{assigneeName}},</p>
              
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333333;">
                {{assignerName}} has assigned you a new task:
              </p>
              
              <div style="background-color: #f8f9fa; border-left: 4px solid #1976d2; padding: 20px; margin: 0 0 20px 0;">
                <h3 style="margin: 0 0 10px 0; color: #333333; font-size: 18px;">{{taskTitle}}</h3>
                
                <table cellpadding="0" cellspacing="0" style="width: 100%;">
                  <tr>
                    <td style="padding: 5px 0;">
                      <strong style="color: #666666;">Campaign:</strong> {{campaignName}}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 5px 0;">
                      <strong style="color: #666666;">Due Date:</strong> 
                      <span style="color: {{#ifEquals priority 'high'}}#dc3545{{else}}#333333{{/ifEquals}};">{{dueDate}}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 5px 0;">
                      <strong style="color: #666666;">Priority:</strong> 
                      <span style="padding: 2px 8px; border-radius: 3px; font-size: 12px; font-weight: bold; 
                        {{#ifEquals priority 'high'}}background-color: #dc3545; color: white;{{/ifEquals}}
                        {{#ifEquals priority 'medium'}}background-color: #ffc107; color: #333;{{/ifEquals}}
                        {{#ifEquals priority 'low'}}background-color: #28a745; color: white;{{/ifEquals}}">
                        {{capitalize priority}}
                      </span>
                    </td>
                  </tr>
                </table>
                
                {{#if description}}
                <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #dee2e6;">
                  <strong style="color: #666666;">Description:</strong>
                  <p style="margin: 5px 0 0 0; color: #333333;">{{description}}</p>
                </div>
                {{/if}}
              </div>
              
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <a href="{{taskLink}}" style="display: inline-block; background-color: #1976d2; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-size: 16px;">View Task Details</a>
                  </td>
                </tr>
              </table>
              
              {{#if additionalNotes}}
              <div style="margin-top: 30px; padding: 15px; background-color: #e3f2fd; border-radius: 4px;">
                <p style="margin: 0; font-size: 14px; color: #1565c0;">
                  <strong>Note from {{assignerName}}:</strong> {{additionalNotes}}
                </p>
              </div>
              {{/if}}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f8f8; padding: 20px 30px; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; font-size: 12px; color: #999999; text-align: center;">
                You're receiving this because you're assigned to tasks in {{organizationName}}.
                <br>
                <a href="{{preferencesLink}}" style="color: #1976d2;">Manage email preferences</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    textContent: `New Task Assignment

Hi {{assigneeName}},

{{assignerName}} has assigned you a new task:

{{taskTitle}}

Campaign: {{campaignName}}
Due Date: {{dueDate}}
Priority: {{priority}}

{{#if description}}
Description:
{{description}}
{{/if}}

View task details: {{taskLink}}

{{#if additionalNotes}}
Note from {{assignerName}}: {{additionalNotes}}
{{/if}}

You're receiving this because you're assigned to tasks in {{organizationName}}.
Manage email preferences: {{preferencesLink}}`,
    variables: ['assigneeName', 'assignerName', 'taskTitle', 'campaignName', 'dueDate', 'priority', 'description', 'taskLink', 'additionalNotes', 'organizationName', 'preferencesLink'],
    category: 'notification'
  },
  
  {
    key: 'campaign-status-update',
    name: 'Campaign Status Update',
    description: 'Sent when a campaign status changes',
    subject: 'Campaign {{campaignName}} is now {{newStatus}}',
    htmlContent: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Campaign Status Update</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f4f4; padding: 20px 0;">
    <tr>
      <td align="center">
        <table cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: {{#ifEquals newStatus 'live'}}#28a745{{else}}{{#ifEquals newStatus 'completed'}}#6c757d{{else}}#1976d2{{/ifEquals}}{{/ifEquals}}; padding: 30px; border-radius: 8px 8px 0 0;">
              <h2 style="margin: 0; color: #ffffff; font-size: 24px;">Campaign Status Update</h2>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 30px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333333;">Hi {{userName}},</p>
              
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333333;">
                The campaign <strong>{{campaignName}}</strong> status has been updated.
              </p>
              
              <div style="background-color: #f8f9fa; border-radius: 4px; padding: 20px; margin: 0 0 20px 0;">
                <table cellpadding="0" cellspacing="0" style="width: 100%;">
                  <tr>
                    <td style="padding: 8px 0;">
                      <strong>Previous Status:</strong> {{previousStatus}}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;">
                      <strong>New Status:</strong> 
                      <span style="font-weight: bold; color: {{#ifEquals newStatus 'live'}}#28a745{{else}}{{#ifEquals newStatus 'completed'}}#6c757d{{else}}#1976d2{{/ifEquals}}{{/ifEquals}};">
                        {{capitalize newStatus}}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;">
                      <strong>Updated By:</strong> {{updatedBy}}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;">
                      <strong>Updated At:</strong> {{updatedAt}}
                    </td>
                  </tr>
                </table>
              </div>
              
              {{#if statusMessage}}
              <div style="background-color: #e3f2fd; border-left: 4px solid #1976d2; padding: 15px; margin: 0 0 20px 0;">
                <p style="margin: 0; color: #1565c0;">
                  <strong>Update Note:</strong> {{statusMessage}}
                </p>
              </div>
              {{/if}}
              
              {{#ifEquals newStatus 'live'}}
              <div style="background-color: #d4edda; border: 1px solid #c3e6cb; border-radius: 4px; padding: 15px; margin: 0 0 20px 0;">
                <p style="margin: 0; color: #155724;">
                  🎉 <strong>Great news!</strong> Your campaign is now live and running.
                </p>
              </div>
              {{/ifEquals}}
              
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <a href="{{campaignLink}}" style="display: inline-block; background-color: #1976d2; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-size: 16px;">View Campaign</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f8f8; padding: 20px 30px; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; font-size: 12px; color: #999999; text-align: center;">
                You're receiving this because you're involved in this campaign.
                <br>
                <a href="{{preferencesLink}}" style="color: #1976d2;">Manage email preferences</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    textContent: `Campaign Status Update

Hi {{userName}},

The campaign "{{campaignName}}" status has been updated.

Previous Status: {{previousStatus}}
New Status: {{newStatus}}
Updated By: {{updatedBy}}
Updated At: {{updatedAt}}

{{#if statusMessage}}
Update Note: {{statusMessage}}
{{/if}}

{{#ifEquals newStatus 'live'}}
🎉 Great news! Your campaign is now live and running.
{{/ifEquals}}

View campaign: {{campaignLink}}

You're receiving this because you're involved in this campaign.
Manage email preferences: {{preferencesLink}}`,
    variables: ['userName', 'campaignName', 'previousStatus', 'newStatus', 'updatedBy', 'updatedAt', 'statusMessage', 'campaignLink', 'preferencesLink'],
    category: 'notification'
  },
  
  {
    key: 'payment-reminder',
    name: 'Payment Reminder',
    description: 'Sent as a reminder for upcoming or overdue payments',
    subject: '{{#if isOverdue}}Overdue{{else}}Upcoming{{/if}} Payment Reminder - Invoice #{{invoiceNumber}}',
    htmlContent: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Reminder</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f4f4; padding: 20px 0;">
    <tr>
      <td align="center">
        <table cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: {{#if isOverdue}}#dc3545{{else}}#ffc107{{/if}}; padding: 30px; border-radius: 8px 8px 0 0;">
              <h2 style="margin: 0; color: {{#if isOverdue}}#ffffff{{else}}#333333{{/if}}; font-size: 24px;">
                {{#if isOverdue}}Overdue Payment Reminder{{else}}Payment Due Soon{{/if}}
              </h2>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 30px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333333;">Dear {{clientName}},</p>
              
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333333;">
                This is a {{#if isOverdue}}reminder that payment for{{else}}friendly reminder that payment for{{/if}} 
                invoice <strong>#{{invoiceNumber}}</strong> {{#if isOverdue}}is overdue{{else}}is due soon{{/if}}.
              </p>
              
              <div style="background-color: #f8f9fa; border-radius: 4px; padding: 20px; margin: 0 0 20px 0;">
                <h3 style="margin: 0 0 15px 0; color: #333333; font-size: 18px;">Invoice Details</h3>
                <table cellpadding="0" cellspacing="0" style="width: 100%;">
                  <tr>
                    <td style="padding: 5px 0;"><strong>Invoice Number:</strong></td>
                    <td style="padding: 5px 0; text-align: right;">#{{invoiceNumber}}</td>
                  </tr>
                  <tr>
                    <td style="padding: 5px 0;"><strong>Campaign:</strong></td>
                    <td style="padding: 5px 0; text-align: right;">{{campaignName}}</td>
                  </tr>
                  <tr>
                    <td style="padding: 5px 0;"><strong>Amount Due:</strong></td>
                    <td style="padding: 5px 0; text-align: right; font-size: 18px; font-weight: bold; color: #333333;">{{formatCurrency amountDue}}</td>
                  </tr>
                  <tr>
                    <td style="padding: 5px 0;"><strong>Due Date:</strong></td>
                    <td style="padding: 5px 0; text-align: right; color: {{#if isOverdue}}#dc3545{{else}}#333333{{/if}}; font-weight: bold;">{{dueDate}}</td>
                  </tr>
                  {{#if isOverdue}}
                  <tr>
                    <td style="padding: 5px 0;"><strong>Days Overdue:</strong></td>
                    <td style="padding: 5px 0; text-align: right; color: #dc3545; font-weight: bold;">{{daysOverdue}} days</td>
                  </tr>
                  {{/if}}
                </table>
              </div>
              
              {{#if isOverdue}}
              <div style="background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px; padding: 15px; margin: 0 0 20px 0;">
                <p style="margin: 0; color: #721c24;">
                  <strong>Important:</strong> This invoice is {{daysOverdue}} days overdue. Please make payment as soon as possible to avoid any service interruptions.
                </p>
              </div>
              {{/if}}
              
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="padding: 0 0 20px 0;">
                    <a href="{{paymentLink}}" style="display: inline-block; background-color: #28a745; color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 4px; font-size: 16px; font-weight: bold;">Pay Now</a>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <a href="{{invoiceLink}}" style="color: #1976d2; font-size: 14px;">View Invoice Details</a>
                  </td>
                </tr>
              </table>
              
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6;">
                <p style="margin: 0 0 10px 0; font-size: 14px; color: #666666;">
                  <strong>Payment Methods Accepted:</strong>
                </p>
                <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #666666;">
                  <li>Credit Card (Visa, MasterCard, American Express)</li>
                  <li>ACH Bank Transfer</li>
                  <li>Wire Transfer</li>
                </ul>
              </div>
              
              <p style="margin: 20px 0 0 0; font-size: 14px; color: #666666;">
                If you have any questions about this invoice or need assistance with payment, 
                please contact our billing department at <a href="mailto:billing@podcastflow.pro" style="color: #1976d2;">billing@podcastflow.pro</a>.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f8f8; padding: 20px 30px; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; font-size: 12px; color: #999999; text-align: center;">
                Thank you for your business!
                <br><br>
                PodcastFlow Pro | <a href="mailto:billing@podcastflow.pro" style="color: #1976d2;">billing@podcastflow.pro</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    textContent: `{{#if isOverdue}}Overdue Payment Reminder{{else}}Payment Due Soon{{/if}}

Dear {{clientName}},

This is a {{#if isOverdue}}reminder that payment for{{else}}friendly reminder that payment for{{/if}} invoice #{{invoiceNumber}} {{#if isOverdue}}is overdue{{else}}is due soon{{/if}}.

Invoice Details:
- Invoice Number: #{{invoiceNumber}}
- Campaign: {{campaignName}}
- Amount Due: {{formatCurrency amountDue}}
- Due Date: {{dueDate}}
{{#if isOverdue}}- Days Overdue: {{daysOverdue}} days{{/if}}

{{#if isOverdue}}Important: This invoice is {{daysOverdue}} days overdue. Please make payment as soon as possible to avoid any service interruptions.{{/if}}

Pay Now: {{paymentLink}}
View Invoice Details: {{invoiceLink}}

Payment Methods Accepted:
- Credit Card (Visa, MasterCard, American Express)
- ACH Bank Transfer
- Wire Transfer

If you have any questions about this invoice or need assistance with payment, please contact our billing department at billing@podcastflow.pro.

Thank you for your business!

PodcastFlow Pro | billing@podcastflow.pro`,
    variables: ['clientName', 'invoiceNumber', 'campaignName', 'amountDue', 'dueDate', 'isOverdue', 'daysOverdue', 'paymentLink', 'invoiceLink'],
    category: 'billing'
  },
  
  {
    key: 'report-ready',
    name: 'Report Ready',
    description: 'Sent when a requested report is ready for download',
    subject: 'Your {{reportType}} report is ready',
    htmlContent: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Report Ready</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f4f4; padding: 20px 0;">
    <tr>
      <td align="center">
        <table cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: #1976d2; padding: 30px; border-radius: 8px 8px 0 0;">
              <h2 style="margin: 0; color: #ffffff; font-size: 24px;">Your Report is Ready</h2>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 30px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333333;">Hi {{userName}},</p>
              
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333333;">
                Your requested <strong>{{reportType}}</strong> report has been generated and is ready for download.
              </p>
              
              <div style="background-color: #f8f9fa; border-radius: 4px; padding: 20px; margin: 0 0 20px 0;">
                <h3 style="margin: 0 0 15px 0; color: #333333; font-size: 18px;">Report Details</h3>
                <table cellpadding="0" cellspacing="0" style="width: 100%;">
                  <tr>
                    <td style="padding: 5px 0;"><strong>Report Type:</strong></td>
                    <td style="padding: 5px 0;">{{reportType}}</td>
                  </tr>
                  <tr>
                    <td style="padding: 5px 0;"><strong>Period:</strong></td>
                    <td style="padding: 5px 0;">{{reportPeriod}}</td>
                  </tr>
                  {{#if campaignName}}
                  <tr>
                    <td style="padding: 5px 0;"><strong>Campaign:</strong></td>
                    <td style="padding: 5px 0;">{{campaignName}}</td>
                  </tr>
                  {{/if}}
                  <tr>
                    <td style="padding: 5px 0;"><strong>Generated:</strong></td>
                    <td style="padding: 5px 0;">{{generatedAt}}</td>
                  </tr>
                  <tr>
                    <td style="padding: 5px 0;"><strong>Format:</strong></td>
                    <td style="padding: 5px 0;">{{reportFormat}}</td>
                  </tr>
                </table>
              </div>
              
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="padding: 0 0 20px 0;">
                    <a href="{{downloadLink}}" style="display: inline-block; background-color: #28a745; color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 4px; font-size: 16px; font-weight: bold;">Download Report</a>
                  </td>
                </tr>
              </table>
              
              <div style="background-color: #fff3cd; border: 1px solid #ffeeba; border-radius: 4px; padding: 15px; margin: 0 0 20px 0;">
                <p style="margin: 0; font-size: 14px; color: #856404;">
                  <strong>Note:</strong> This download link will expire in 7 days. Please download your report before {{expiryDate}}.
                </p>
              </div>
              
              {{#if reportSummary}}
              <div style="margin-top: 30px;">
                <h4 style="margin: 0 0 10px 0; color: #333333; font-size: 16px;">Report Summary</h4>
                <p style="margin: 0; font-size: 14px; color: #666666;">{{reportSummary}}</p>
              </div>
              {{/if}}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f8f8; padding: 20px 30px; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; font-size: 12px; color: #999999; text-align: center;">
                You requested this report on {{requestDate}}.
                <br>
                <a href="{{preferencesLink}}" style="color: #1976d2;">Manage email preferences</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    textContent: `Your Report is Ready

Hi {{userName}},

Your requested {{reportType}} report has been generated and is ready for download.

Report Details:
- Report Type: {{reportType}}
- Period: {{reportPeriod}}
{{#if campaignName}}- Campaign: {{campaignName}}{{/if}}
- Generated: {{generatedAt}}
- Format: {{reportFormat}}

Download Report: {{downloadLink}}

Note: This download link will expire in 7 days. Please download your report before {{expiryDate}}.

{{#if reportSummary}}
Report Summary:
{{reportSummary}}
{{/if}}

You requested this report on {{requestDate}}.
Manage email preferences: {{preferencesLink}}`,
    variables: ['userName', 'reportType', 'reportPeriod', 'campaignName', 'generatedAt', 'reportFormat', 'downloadLink', 'expiryDate', 'reportSummary', 'requestDate', 'preferencesLink'],
    category: 'notification'
  },
  
  {
    key: 'approval-request',
    name: 'Approval Request',
    description: 'Sent when approval is needed for an action',
    subject: 'Approval needed: {{approvalType}}',
    htmlContent: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Approval Request</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f4f4; padding: 20px 0;">
    <tr>
      <td align="center">
        <table cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: #ff9800; padding: 30px; border-radius: 8px 8px 0 0;">
              <h2 style="margin: 0; color: #ffffff; font-size: 24px;">Approval Required</h2>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 30px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333333;">Hi {{approverName}},</p>
              
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333333;">
                {{requesterName}} has submitted a <strong>{{approvalType}}</strong> that requires your approval.
              </p>
              
              <div style="background-color: #f8f9fa; border-radius: 4px; padding: 20px; margin: 0 0 20px 0;">
                <h3 style="margin: 0 0 15px 0; color: #333333; font-size: 18px;">{{itemTitle}}</h3>
                <table cellpadding="0" cellspacing="0" style="width: 100%;">
                  <tr>
                    <td style="padding: 5px 0;"><strong>Type:</strong></td>
                    <td style="padding: 5px 0;">{{approvalType}}</td>
                  </tr>
                  <tr>
                    <td style="padding: 5px 0;"><strong>Requested By:</strong></td>
                    <td style="padding: 5px 0;">{{requesterName}}</td>
                  </tr>
                  <tr>
                    <td style="padding: 5px 0;"><strong>Submitted:</strong></td>
                    <td style="padding: 5px 0;">{{submittedAt}}</td>
                  </tr>
                  {{#if deadline}}
                  <tr>
                    <td style="padding: 5px 0;"><strong>Deadline:</strong></td>
                    <td style="padding: 5px 0; color: #ff9800; font-weight: bold;">{{deadline}}</td>
                  </tr>
                  {{/if}}
                </table>
                
                {{#if description}}
                <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #dee2e6;">
                  <strong>Description:</strong>
                  <p style="margin: 5px 0 0 0; color: #666666;">{{description}}</p>
                </div>
                {{/if}}
              </div>
              
              {{#if requestNote}}
              <div style="background-color: #e3f2fd; border-left: 4px solid #1976d2; padding: 15px; margin: 0 0 20px 0;">
                <p style="margin: 0; font-size: 14px; color: #1565c0;">
                  <strong>Note from {{requesterName}}:</strong> {{requestNote}}
                </p>
              </div>
              {{/if}}
              
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-right: 10px;">
                          <a href="{{approveLink}}" style="display: inline-block; background-color: #28a745; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-size: 16px; font-weight: bold;">Approve</a>
                        </td>
                        <td style="padding-left: 10px;">
                          <a href="{{rejectLink}}" style="display: inline-block; background-color: #dc3545; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-size: 16px; font-weight: bold;">Reject</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top: 15px;">
                    <a href="{{detailsLink}}" style="color: #1976d2; font-size: 14px;">View Full Details</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f8f8; padding: 20px 30px; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; font-size: 12px; color: #999999; text-align: center;">
                You're receiving this because you're an approver for {{organizationName}}.
                <br>
                <a href="{{preferencesLink}}" style="color: #1976d2;">Manage email preferences</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    textContent: `Approval Required

Hi {{approverName}},

{{requesterName}} has submitted a {{approvalType}} that requires your approval.

{{itemTitle}}

Type: {{approvalType}}
Requested By: {{requesterName}}
Submitted: {{submittedAt}}
{{#if deadline}}Deadline: {{deadline}}{{/if}}

{{#if description}}
Description:
{{description}}
{{/if}}

{{#if requestNote}}
Note from {{requesterName}}: {{requestNote}}
{{/if}}

Approve: {{approveLink}}
Reject: {{rejectLink}}
View Full Details: {{detailsLink}}

You're receiving this because you're an approver for {{organizationName}}.
Manage email preferences: {{preferencesLink}}`,
    variables: ['approverName', 'requesterName', 'approvalType', 'itemTitle', 'submittedAt', 'deadline', 'description', 'requestNote', 'approveLink', 'rejectLink', 'detailsLink', 'organizationName', 'preferencesLink'],
    category: 'notification'
  },
  
  {
    key: 'daily-digest',
    name: 'Daily Digest',
    description: 'Daily summary of activities and notifications',
    subject: 'Your PodcastFlow Pro daily digest - {{date}}',
    htmlContent: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily Digest</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f4f4; padding: 20px 0;">
    <tr>
      <td align="center">
        <table cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: #1976d2; padding: 30px; border-radius: 8px 8px 0 0;">
              <h2 style="margin: 0 0 5px 0; color: #ffffff; font-size: 24px;">Daily Digest</h2>
              <p style="margin: 0; color: #e3f2fd; font-size: 16px;">{{date}}</p>
            </td>
          </tr>
          
          <!-- Summary -->
          <tr>
            <td style="padding: 30px 30px 20px 30px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333333;">Hi {{userName}},</p>
              
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333333;">
                Here's your daily summary of activities in PodcastFlow Pro:
              </p>
              
              <!-- Quick Stats -->
              <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 30px;">
                <tr>
                  <td width="33%" align="center" style="padding: 15px; background-color: #e3f2fd; border-radius: 4px;">
                    <p style="margin: 0; font-size: 28px; font-weight: bold; color: #1976d2;">{{stats.tasksCompleted}}</p>
                    <p style="margin: 5px 0 0 0; font-size: 14px; color: #666666;">Tasks Completed</p>
                  </td>
                  <td width="33%" align="center" style="padding: 15px; background-color: #f3e5f5; border-radius: 4px;">
                    <p style="margin: 0; font-size: 28px; font-weight: bold; color: #9c27b0;">{{stats.newTasks}}</p>
                    <p style="margin: 5px 0 0 0; font-size: 14px; color: #666666;">New Tasks</p>
                  </td>
                  <td width="33%" align="center" style="padding: 15px; background-color: #e8f5e9; border-radius: 4px;">
                    <p style="margin: 0; font-size: 28px; font-weight: bold; color: #4caf50;">{{stats.campaignsActive}}</p>
                    <p style="margin: 5px 0 0 0; font-size: 14px; color: #666666;">Active Campaigns</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Tasks Section -->
          {{#if tasks}}
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <h3 style="margin: 0 0 15px 0; color: #333333; font-size: 18px; border-bottom: 2px solid #1976d2; padding-bottom: 10px;">
                📋 Tasks Update
              </h3>
              
              {{#if tasks.overdue}}
              <div style="background-color: #ffebee; border-left: 4px solid #f44336; padding: 15px; margin-bottom: 15px;">
                <p style="margin: 0 0 10px 0; font-weight: bold; color: #c62828;">Overdue Tasks ({{tasks.overdue.length}})</p>
                {{#each tasks.overdue}}
                <p style="margin: 5px 0; font-size: 14px;">
                  • <a href="{{this.link}}" style="color: #c62828; text-decoration: none;">{{this.title}}</a> - Due {{this.dueDate}}
                </p>
                {{/each}}
              </div>
              {{/if}}
              
              {{#if tasks.dueSoon}}
              <div style="background-color: #fff8e1; border-left: 4px solid #ffc107; padding: 15px; margin-bottom: 15px;">
                <p style="margin: 0 0 10px 0; font-weight: bold; color: #f57c00;">Due Soon ({{tasks.dueSoon.length}})</p>
                {{#each tasks.dueSoon}}
                <p style="margin: 5px 0; font-size: 14px;">
                  • <a href="{{this.link}}" style="color: #f57c00; text-decoration: none;">{{this.title}}</a> - Due {{this.dueDate}}
                </p>
                {{/each}}
              </div>
              {{/if}}
              
              {{#if tasks.newAssignments}}
              <div style="background-color: #e3f2fd; border-left: 4px solid #1976d2; padding: 15px;">
                <p style="margin: 0 0 10px 0; font-weight: bold; color: #1565c0;">New Assignments ({{tasks.newAssignments.length}})</p>
                {{#each tasks.newAssignments}}
                <p style="margin: 5px 0; font-size: 14px;">
                  • <a href="{{this.link}}" style="color: #1565c0; text-decoration: none;">{{this.title}}</a> - Assigned by {{this.assignedBy}}
                </p>
                {{/each}}
              </div>
              {{/if}}
            </td>
          </tr>
          {{/if}}
          
          <!-- Campaigns Section -->
          {{#if campaigns}}
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <h3 style="margin: 0 0 15px 0; color: #333333; font-size: 18px; border-bottom: 2px solid #1976d2; padding-bottom: 10px;">
                📢 Campaign Updates
              </h3>
              
              {{#each campaigns}}
              <div style="background-color: #f8f9fa; padding: 15px; margin-bottom: 10px; border-radius: 4px;">
                <p style="margin: 0 0 5px 0; font-weight: bold;">
                  <a href="{{this.link}}" style="color: #333333; text-decoration: none;">{{this.name}}</a>
                </p>
                <p style="margin: 0; font-size: 14px; color: #666666;">{{this.update}}</p>
              </div>
              {{/each}}
            </td>
          </tr>
          {{/if}}
          
          <!-- Upcoming Section -->
          {{#if upcoming}}
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <h3 style="margin: 0 0 15px 0; color: #333333; font-size: 18px; border-bottom: 2px solid #1976d2; padding-bottom: 10px;">
                📅 Upcoming This Week
              </h3>
              
              <ul style="margin: 0; padding-left: 20px; color: #666666;">
                {{#each upcoming}}
                <li style="margin-bottom: 8px; font-size: 14px;">
                  <strong>{{this.date}}:</strong> {{this.event}}
                </li>
                {{/each}}
              </ul>
            </td>
          </tr>
          {{/if}}
          
          <!-- CTA -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <a href="{{dashboardLink}}" style="display: inline-block; background-color: #1976d2; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-size: 16px;">View Full Dashboard</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f8f8; padding: 20px 30px; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; font-size: 12px; color: #999999; text-align: center;">
                You're receiving this daily digest for {{organizationName}}.
                <br>
                <a href="{{preferencesLink}}" style="color: #1976d2;">Change digest frequency</a> | 
                <a href="{{unsubscribeLink}}" style="color: #1976d2;">Unsubscribe from digest</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    textContent: `Daily Digest - {{date}}

Hi {{userName}},

Here's your daily summary of activities in PodcastFlow Pro:

Quick Stats:
- Tasks Completed: {{stats.tasksCompleted}}
- New Tasks: {{stats.newTasks}}
- Active Campaigns: {{stats.campaignsActive}}

{{#if tasks}}
📋 Tasks Update
{{#if tasks.overdue}}
Overdue Tasks ({{tasks.overdue.length}}):
{{#each tasks.overdue}}• {{this.title}} - Due {{this.dueDate}}
{{/each}}
{{/if}}

{{#if tasks.dueSoon}}
Due Soon ({{tasks.dueSoon.length}}):
{{#each tasks.dueSoon}}• {{this.title}} - Due {{this.dueDate}}
{{/each}}
{{/if}}

{{#if tasks.newAssignments}}
New Assignments ({{tasks.newAssignments.length}}):
{{#each tasks.newAssignments}}• {{this.title}} - Assigned by {{this.assignedBy}}
{{/each}}
{{/if}}
{{/if}}

{{#if campaigns}}
📢 Campaign Updates
{{#each campaigns}}
{{this.name}}: {{this.update}}
{{/each}}
{{/if}}

{{#if upcoming}}
📅 Upcoming This Week
{{#each upcoming}}
- {{this.date}}: {{this.event}}
{{/each}}
{{/if}}

View Full Dashboard: {{dashboardLink}}

You're receiving this daily digest for {{organizationName}}.
Change digest frequency: {{preferencesLink}}
Unsubscribe from digest: {{unsubscribeLink}}`,
    variables: ['userName', 'date', 'stats', 'tasks', 'campaigns', 'upcoming', 'dashboardLink', 'organizationName', 'preferencesLink', 'unsubscribeLink'],
    category: 'digest'
  },
  
  {
    key: 'system-announcement',
    name: 'System Announcement',
    description: 'Important system updates and maintenance notifications',
    subject: '{{#ifEquals priority "critical"}}🚨 Critical: {{/ifEquals}}{{subject}}',
    htmlContent: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>System Announcement</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f4f4; padding: 20px 0;">
    <tr>
      <td align="center">
        <table cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: {{#ifEquals priority 'critical'}}#dc3545{{else}}{{#ifEquals priority 'important'}}#ff9800{{else}}#1976d2{{/ifEquals}}{{/ifEquals}}; padding: 30px; border-radius: 8px 8px 0 0;">
              <h2 style="margin: 0; color: #ffffff; font-size: 24px;">
                {{#ifEquals priority 'critical'}}⚠️ Critical System Announcement{{else}}System Announcement{{/ifEquals}}
              </h2>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 30px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333333;">Dear PodcastFlow Pro User,</p>
              
              <h3 style="margin: 0 0 15px 0; color: #333333; font-size: 20px;">{{subject}}</h3>
              
              <div style="font-size: 16px; color: #333333; line-height: 1.6;">
                {{{announcementBody}}}
              </div>
              
              {{#if actionRequired}}
              <div style="background-color: #fff3cd; border: 1px solid #ffeeba; border-radius: 4px; padding: 15px; margin: 20px 0;">
                <p style="margin: 0 0 10px 0; font-weight: bold; color: #856404;">Action Required:</p>
                <p style="margin: 0; color: #856404;">{{actionRequired}}</p>
              </div>
              {{/if}}
              
              {{#if affectedServices}}
              <div style="margin: 20px 0;">
                <p style="margin: 0 0 10px 0; font-weight: bold; color: #333333;">Affected Services:</p>
                <ul style="margin: 0; padding-left: 20px; color: #666666;">
                  {{#each affectedServices}}
                  <li>{{this}}</li>
                  {{/each}}
                </ul>
              </div>
              {{/if}}
              
              {{#if timeline}}
              <div style="background-color: #f8f9fa; border-radius: 4px; padding: 15px; margin: 20px 0;">
                <p style="margin: 0 0 10px 0; font-weight: bold; color: #333333;">Timeline:</p>
                {{#each timeline}}
                <p style="margin: 5px 0; font-size: 14px; color: #666666;">
                  <strong>{{this.time}}:</strong> {{this.event}}
                </p>
                {{/each}}
              </div>
              {{/if}}
              
              {{#if contactInfo}}
              <div style="margin-top: 30px; padding: 20px; background-color: #e3f2fd; border-radius: 4px;">
                <p style="margin: 0 0 10px 0; font-weight: bold; color: #1565c0;">Need Help?</p>
                <p style="margin: 0; font-size: 14px; color: #1565c0;">
                  {{contactInfo}}
                </p>
              </div>
              {{/if}}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f8f8; padding: 20px 30px; border-radius: 0 0 8px 8px;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #666666; text-align: center;">
                Thank you for your patience and understanding.
              </p>
              <p style="margin: 0; font-size: 12px; color: #999999; text-align: center;">
                The PodcastFlow Pro Team | <a href="https://status.podcastflow.pro" style="color: #1976d2;">System Status Page</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    textContent: `System Announcement

Dear PodcastFlow Pro User,

{{subject}}

{{{announcementBody}}}

{{#if actionRequired}}
Action Required:
{{actionRequired}}
{{/if}}

{{#if affectedServices}}
Affected Services:
{{#each affectedServices}}- {{this}}
{{/each}}
{{/if}}

{{#if timeline}}
Timeline:
{{#each timeline}}{{this.time}}: {{this.event}}
{{/each}}
{{/if}}

{{#if contactInfo}}
Need Help?
{{contactInfo}}
{{/if}}

Thank you for your patience and understanding.

The PodcastFlow Pro Team
System Status Page: https://status.podcastflow.pro`,
    variables: ['subject', 'announcementBody', 'priority', 'actionRequired', 'affectedServices', 'timeline', 'contactInfo'],
    category: 'system'
  }
]