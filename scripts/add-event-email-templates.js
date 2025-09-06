#!/usr/bin/env node

/**
 * Script to add email templates for key event notifications
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const eventTemplates = [
  {
    key: 'task-completion',
    name: 'Task Completion',
    subject: 'Task Completed: {{taskTitle}}',
    htmlContent: `
<h2>Task Completed</h2>
<p>Hi {{managerName}},</p>
<p>The following task has been completed:</p>
<div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
  <h3>{{taskTitle}}</h3>
  <p><strong>Completed by:</strong> {{completedBy}}</p>
  <p><strong>Completion Date:</strong> {{completionDate}}</p>
  {{#if notes}}
  <p><strong>Notes:</strong> {{notes}}</p>
  {{/if}}
</div>
<p><a href="{{taskLink}}" style="background: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Task</a></p>`,
    textContent: `Task Completed: {{taskTitle}}

Hi {{managerName}},

The following task has been completed:
- Title: {{taskTitle}}
- Completed by: {{completedBy}}
- Completion Date: {{completionDate}}
{{#if notes}}- Notes: {{notes}}{{/if}}

View task: {{taskLink}}`,
    variables: ['managerName', 'taskTitle', 'completedBy', 'completionDate', 'notes', 'taskLink'],
    category: 'workflow'
  },
  {
    key: 'ad-submitted',
    name: 'Ad Submitted for Review',
    subject: 'New Ad Submitted: {{campaignName}}',
    htmlContent: `
<h2>Ad Submitted for Review</h2>
<p>Hi {{reviewerName}},</p>
<p>A new ad has been submitted for your review:</p>
<div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
  <h3>{{campaignName}}</h3>
  <p><strong>Advertiser:</strong> {{advertiserName}}</p>
  <p><strong>Show:</strong> {{showName}}</p>
  <p><strong>Type:</strong> {{adType}}</p>
  <p><strong>Duration:</strong> {{duration}} seconds</p>
  <p><strong>Submitted by:</strong> {{submittedBy}}</p>
  <p><strong>Priority:</strong> {{priority}}</p>
</div>
<p><a href="{{reviewLink}}" style="background: #2196F3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Review Ad</a></p>`,
    textContent: `New Ad Submitted: {{campaignName}}

Hi {{reviewerName}},

A new ad has been submitted for your review:
- Campaign: {{campaignName}}
- Advertiser: {{advertiserName}}
- Show: {{showName}}
- Type: {{adType}}
- Duration: {{duration}} seconds
- Submitted by: {{submittedBy}}
- Priority: {{priority}}

Review ad: {{reviewLink}}`,
    variables: ['reviewerName', 'campaignName', 'advertiserName', 'showName', 'adType', 'duration', 'submittedBy', 'priority', 'reviewLink'],
    category: 'approval'
  },
  {
    key: 'ad-approved',
    name: 'Ad Approved',
    subject: 'Ad Approved: {{campaignName}}',
    htmlContent: `
<h2>Ad Approved</h2>
<p>Hi {{submitterName}},</p>
<p>Great news! Your ad has been approved:</p>
<div style="background: #e8f5e9; padding: 15px; border-radius: 5px; margin: 20px 0;">
  <h3>{{campaignName}}</h3>
  <p><strong>Approved by:</strong> {{approvedBy}}</p>
  <p><strong>Approval Date:</strong> {{approvalDate}}</p>
  {{#if comments}}
  <p><strong>Comments:</strong> {{comments}}</p>
  {{/if}}
</div>
<p>The ad is now ready for scheduling and broadcast.</p>
<p><a href="{{campaignLink}}" style="background: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Campaign</a></p>`,
    textContent: `Ad Approved: {{campaignName}}

Hi {{submitterName}},

Great news! Your ad has been approved:
- Campaign: {{campaignName}}
- Approved by: {{approvedBy}}
- Approval Date: {{approvalDate}}
{{#if comments}}- Comments: {{comments}}{{/if}}

The ad is now ready for scheduling and broadcast.

View campaign: {{campaignLink}}`,
    variables: ['submitterName', 'campaignName', 'approvedBy', 'approvalDate', 'comments', 'campaignLink'],
    category: 'approval'
  },
  {
    key: 'ad-rejected',
    name: 'Ad Rejected',
    subject: 'Ad Requires Revision: {{campaignName}}',
    htmlContent: `
<h2>Ad Requires Revision</h2>
<p>Hi {{submitterName}},</p>
<p>Your ad submission requires some revisions:</p>
<div style="background: #ffebee; padding: 15px; border-radius: 5px; margin: 20px 0;">
  <h3>{{campaignName}}</h3>
  <p><strong>Reviewed by:</strong> {{rejectedBy}}</p>
  <p><strong>Review Date:</strong> {{reviewDate}}</p>
  <p><strong>Reason:</strong> {{reason}}</p>
  {{#if feedback}}
  <p><strong>Feedback:</strong> {{feedback}}</p>
  {{/if}}
</div>
<p>Please make the necessary changes and resubmit for approval.</p>
<p><a href="{{revisionLink}}" style="background: #f44336; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Make Revisions</a></p>`,
    textContent: `Ad Requires Revision: {{campaignName}}

Hi {{submitterName}},

Your ad submission requires some revisions:
- Campaign: {{campaignName}}
- Reviewed by: {{rejectedBy}}
- Review Date: {{reviewDate}}
- Reason: {{reason}}
{{#if feedback}}- Feedback: {{feedback}}{{/if}}

Please make the necessary changes and resubmit for approval.

Make revisions: {{revisionLink}}`,
    variables: ['submitterName', 'campaignName', 'rejectedBy', 'reviewDate', 'reason', 'feedback', 'revisionLink'],
    category: 'approval'
  },
  {
    key: 'payment-received',
    name: 'Payment Received',
    subject: 'Payment Received - Thank You!',
    htmlContent: `
<h2>Payment Received</h2>
<p>Hi {{clientName}},</p>
<p>Thank you! We've received your payment:</p>
<div style="background: #e8f5e9; padding: 15px; border-radius: 5px; margin: 20px 0;">
  <p><strong>Invoice Number:</strong> {{invoiceNumber}}</p>
  <p><strong>Amount Paid:</strong> {{amountPaid}}</p>
  <p><strong>Payment Date:</strong> {{paymentDate}}</p>
  <p><strong>Payment Method:</strong> {{paymentMethod}}</p>
</div>
<p>Your account is now up to date. Thank you for your business!</p>
<p><a href="{{receiptLink}}" style="background: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Download Receipt</a></p>`,
    textContent: `Payment Received - Thank You!

Hi {{clientName}},

Thank you! We've received your payment:
- Invoice Number: {{invoiceNumber}}
- Amount Paid: {{amountPaid}}
- Payment Date: {{paymentDate}}
- Payment Method: {{paymentMethod}}

Your account is now up to date. Thank you for your business!

Download receipt: {{receiptLink}}`,
    variables: ['clientName', 'invoiceNumber', 'amountPaid', 'paymentDate', 'paymentMethod', 'receiptLink'],
    category: 'billing'
  },
  {
    key: 'deadline-reminder',
    name: 'Deadline Reminder',
    subject: '{{urgency}} Deadline Approaching: {{itemTitle}}',
    htmlContent: `
<h2>Deadline Reminder</h2>
<p>Hi {{recipientName}},</p>
<p>This is a reminder about an upcoming deadline:</p>
<div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
  <h3>{{itemTitle}}</h3>
  <p><strong>Type:</strong> {{itemType}}</p>
  <p><strong>Deadline:</strong> {{deadline}}</p>
  <p><strong>Time Remaining:</strong> {{timeRemaining}}</p>
  {{#if description}}
  <p><strong>Description:</strong> {{description}}</p>
  {{/if}}
</div>
<p><a href="{{itemLink}}" style="background: #ff9800; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View {{itemType}}</a></p>`,
    textContent: `{{urgency}} Deadline Approaching: {{itemTitle}}

Hi {{recipientName}},

This is a reminder about an upcoming deadline:
- {{itemType}}: {{itemTitle}}
- Deadline: {{deadline}}
- Time Remaining: {{timeRemaining}}
{{#if description}}- Description: {{description}}{{/if}}

View {{itemType}}: {{itemLink}}`,
    variables: ['urgency', 'recipientName', 'itemTitle', 'itemType', 'deadline', 'timeRemaining', 'description', 'itemLink'],
    category: 'reminder'
  },
  {
    key: 'campaign-launch',
    name: 'Campaign Launched',
    subject: 'Campaign Now Live: {{campaignName}}',
    htmlContent: `
<h2>Campaign Launched!</h2>
<p>Hi {{teamMemberName}},</p>
<p>Great news! Your campaign is now live:</p>
<div style="background: #e8f5e9; padding: 15px; border-radius: 5px; margin: 20px 0;">
  <h3>{{campaignName}}</h3>
  <p><strong>Launch Date:</strong> {{launchDate}}</p>
  <p><strong>End Date:</strong> {{endDate}}</p>
  <p><strong>Total Spots:</strong> {{totalSpots}}</p>
  <p><strong>Shows:</strong> {{shows}}</p>
</div>
<p>We'll send you regular performance updates throughout the campaign.</p>
<p><a href="{{dashboardLink}}" style="background: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Campaign Dashboard</a></p>`,
    textContent: `Campaign Now Live: {{campaignName}}

Hi {{teamMemberName}},

Great news! Your campaign is now live:
- Campaign: {{campaignName}}
- Launch Date: {{launchDate}}
- End Date: {{endDate}}
- Total Spots: {{totalSpots}}
- Shows: {{shows}}

We'll send you regular performance updates throughout the campaign.

View campaign dashboard: {{dashboardLink}}`,
    variables: ['teamMemberName', 'campaignName', 'launchDate', 'endDate', 'totalSpots', 'shows', 'dashboardLink'],
    category: 'campaign'
  },
  {
    key: 'budget-alert',
    name: 'Budget Alert',
    subject: '{{alertLevel}}: Budget Alert for {{campaignName}}',
    htmlContent: `
<h2>Budget Alert</h2>
<p>Hi {{managerName}},</p>
<p>This is a budget alert for your campaign:</p>
<div style="background: {{#if isCritical}}#ffebee{{else}}#fff3cd{{/if}}; padding: 15px; border-radius: 5px; margin: 20px 0;">
  <h3>{{campaignName}}</h3>
  <p><strong>Budget Used:</strong> {{budgetUsed}} ({{percentageUsed}}%)</p>
  <p><strong>Budget Remaining:</strong> {{budgetRemaining}}</p>
  <p><strong>Days Remaining:</strong> {{daysRemaining}}</p>
  <p><strong>Projected Overage:</strong> {{projectedOverage}}</p>
</div>
{{#if isCritical}}
<p style="color: #d32f2f;"><strong>Action Required:</strong> This campaign is at risk of exceeding its budget.</p>
{{/if}}
<p><a href="{{campaignLink}}" style="background: {{#if isCritical}}#f44336{{else}}#ff9800{{/if}}; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Review Campaign Budget</a></p>`,
    textContent: `{{alertLevel}}: Budget Alert for {{campaignName}}

Hi {{managerName}},

This is a budget alert for your campaign:
- Campaign: {{campaignName}}
- Budget Used: {{budgetUsed}} ({{percentageUsed}}%)
- Budget Remaining: {{budgetRemaining}}
- Days Remaining: {{daysRemaining}}
- Projected Overage: {{projectedOverage}}

{{#if isCritical}}Action Required: This campaign is at risk of exceeding its budget.{{/if}}

Review campaign budget: {{campaignLink}}`,
    variables: ['alertLevel', 'managerName', 'campaignName', 'budgetUsed', 'percentageUsed', 'budgetRemaining', 'daysRemaining', 'projectedOverage', 'isCritical', 'campaignLink'],
    category: 'alert'
  },
  {
    key: 'performance-alert', 
    name: 'Performance Alert',
    subject: 'Performance Alert: {{campaignName}}',
    htmlContent: `
<h2>Campaign Performance Alert</h2>
<p>Hi {{managerName}},</p>
<p>We've detected a performance issue with your campaign:</p>
<div style="background: #ffebee; padding: 15px; border-radius: 5px; margin: 20px 0;">
  <h3>{{campaignName}}</h3>
  <p><strong>Issue:</strong> {{issueType}}</p>
  <p><strong>Current Performance:</strong> {{currentPerformance}}</p>
  <p><strong>Expected Performance:</strong> {{expectedPerformance}}</p>
  <p><strong>Recommendation:</strong> {{recommendation}}</p>
</div>
<p><a href="{{analyticsLink}}" style="background: #f44336; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Analytics</a></p>`,
    textContent: `Performance Alert: {{campaignName}}

Hi {{managerName}},

We've detected a performance issue with your campaign:
- Campaign: {{campaignName}}
- Issue: {{issueType}}
- Current Performance: {{currentPerformance}}
- Expected Performance: {{expectedPerformance}}
- Recommendation: {{recommendation}}

View analytics: {{analyticsLink}}`,
    variables: ['managerName', 'campaignName', 'issueType', 'currentPerformance', 'expectedPerformance', 'recommendation', 'analyticsLink'],
    category: 'alert'
  }
]

async function addEventTemplates() {
  console.log('🎯 Adding event notification email templates...\n')
  
  let created = 0
  let skipped = 0
  
  for (const template of eventTemplates) {
    try {
      // Check if template already exists
      const existing = await prisma.emailTemplate.findFirst({
        where: {
          key: template.key,
          organizationId: null,
          isSystemDefault: true
        }
      })
      
      if (existing) {
        console.log(`⏭️  Skipping ${template.key} - already exists`)
        skipped++
        continue
      }
      
      // Create system template
      await prisma.emailTemplate.create({
        data: {
          ...template,
          isActive: true,
          isSystemDefault: true,
          organizationId: null
        }
      })
      
      console.log(`✅ Created template: ${template.key}`)
      created++
      
    } catch (error) {
      console.error(`❌ Error creating ${template.key}:`, error.message)
    }
  }
  
  console.log(`\n📊 Summary:`)
  console.log(`   - Created: ${created} templates`)
  console.log(`   - Skipped: ${skipped} templates`)
  console.log(`   - Total system templates: ${created + skipped + 9}`)
}

// Run the script
addEventTemplates()
  .catch(console.error)
  .finally(() => prisma.$disconnect())