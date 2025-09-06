// Email template service

import prisma from '@/lib/db/prisma'
import { safeQuerySchema } from '@/lib/db/schema-db'
import { EmailTemplate } from './types'

// System default templates (always available)
const SYSTEM_TEMPLATES: Record<string, Omit<EmailTemplate, 'id' | 'createdAt' | 'updatedAt'>> = {
  user_invitation: {
    key: 'user_invitation',
    name: 'User Invitation',
    description: 'Sent when a new user is invited to join an organization',
    subject: "You've been invited to join {{organizationName}} on PodcastFlow Pro",
    htmlContent: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Welcome to {{organizationName}}!</h2>
      <p>Hi {{userName}},</p>
      <p>You've been invited to join {{organizationName}} on PodcastFlow Pro as a {{userRole}}.</p>
      <p>Click the button below to accept your invitation and set up your account:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="{{inviteLink}}" style="background-color: #2196F3; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Accept Invitation</a>
      </div>
      <p>This invitation will expire in 7 days.</p>
      <p>If you have any questions, please contact us at {{supportEmail}}.</p>
    </div>`,
    textContent: `Welcome to {{organizationName}}!

Hi {{userName}},

You've been invited to join {{organizationName}} on PodcastFlow Pro as a {{userRole}}.

Accept your invitation here: {{inviteLink}}

This invitation will expire in 7 days.

If you have any questions, please contact us at {{supportEmail}}.`,
    variables: ['organizationName', 'userName', 'userRole', 'inviteLink', 'supportEmail'],
    category: 'user_management',
    isActive: true,
    isSystemDefault: true,
    canCustomize: true
  },
  
  password_reset: {
    key: 'password_reset',
    name: 'Password Reset',
    description: 'Sent when a user requests a password reset',
    subject: 'Reset your PodcastFlow Pro password',
    htmlContent: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Password Reset Request</h2>
      <p>Hi {{userName}},</p>
      <p>We received a request to reset your password for PodcastFlow Pro.</p>
      <p>Click the button below to reset your password:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="{{resetLink}}" style="background-color: #2196F3; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
      </div>
      <p>This link will expire in 1 hour.</p>
      <p>If you didn't request this, please ignore this email.</p>
    </div>`,
    textContent: `Password Reset Request

Hi {{userName}},

We received a request to reset your password for PodcastFlow Pro.

Reset your password here: {{resetLink}}

This link will expire in 1 hour.

If you didn't request this, please ignore this email.`,
    variables: ['userName', 'resetLink'],
    category: 'authentication',
    isActive: true,
    isSystemDefault: true,
    canCustomize: false
  },
  
  task_assignment: {
    key: 'task_assignment',
    name: 'Task Assignment',
    description: 'Sent when a task is assigned to a user',
    subject: 'New task assigned: {{taskTitle}}',
    htmlContent: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>New Task Assigned</h2>
      <p>Hi {{assigneeName}},</p>
      <p>{{assignerName}} has assigned you a new task:</p>
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <h3 style="margin-top: 0;">{{taskTitle}}</h3>
        <p>{{taskDescription}}</p>
        <p><strong>Due Date:</strong> {{dueDate}}</p>
        <p><strong>Priority:</strong> {{priority}}</p>
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="{{taskLink}}" style="background-color: #2196F3; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">View Task</a>
      </div>
    </div>`,
    textContent: `New Task Assigned

Hi {{assigneeName}},

{{assignerName}} has assigned you a new task:

Task: {{taskTitle}}
Description: {{taskDescription}}
Due Date: {{dueDate}}
Priority: {{priority}}

View task: {{taskLink}}`,
    variables: ['assigneeName', 'assignerName', 'taskTitle', 'taskDescription', 'dueDate', 'priority', 'taskLink'],
    category: 'tasks',
    isActive: true,
    isSystemDefault: true,
    canCustomize: true
  },
  
  campaign_status_change: {
    key: 'campaign_status_change',
    name: 'Campaign Status Change',
    description: 'Sent when a campaign status changes',
    subject: 'Campaign {{campaignName}} is now {{newStatus}}',
    htmlContent: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Campaign Status Update</h2>
      <p>Hi {{userName}},</p>
      <p>The status of campaign <strong>{{campaignName}}</strong> has changed:</p>
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Previous Status:</strong> {{previousStatus}}</p>
        <p><strong>New Status:</strong> {{newStatus}}</p>
        <p><strong>Changed By:</strong> {{changedBy}}</p>
        <p><strong>Date:</strong> {{changeDate}}</p>
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="{{campaignLink}}" style="background-color: #2196F3; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">View Campaign</a>
      </div>
    </div>`,
    textContent: `Campaign Status Update

Hi {{userName}},

The status of campaign "{{campaignName}}" has changed:

Previous Status: {{previousStatus}}
New Status: {{newStatus}}
Changed By: {{changedBy}}
Date: {{changeDate}}

View campaign: {{campaignLink}}`,
    variables: ['userName', 'campaignName', 'previousStatus', 'newStatus', 'changedBy', 'changeDate', 'campaignLink'],
    category: 'campaigns',
    isActive: true,
    isSystemDefault: true,
    canCustomize: true
  },
  
  approval_request: {
    key: 'approval_request',
    name: 'Approval Request',
    description: 'Sent when approval is needed',
    subject: 'Approval needed: {{itemTitle}}',
    htmlContent: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Approval Request</h2>
      <p>Hi {{approverName}},</p>
      <p>{{requesterName}} has requested your approval for:</p>
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <h3 style="margin-top: 0;">{{itemTitle}}</h3>
        <p>{{itemDescription}}</p>
        <p><strong>Type:</strong> {{itemType}}</p>
        <p><strong>Requested:</strong> {{requestDate}}</p>
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="{{approvalLink}}" style="background-color: #4CAF50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 0 10px;">Approve</a>
        <a href="{{approvalLink}}" style="background-color: #f44336; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 0 10px;">Reject</a>
      </div>
    </div>`,
    textContent: `Approval Request

Hi {{approverName}},

{{requesterName}} has requested your approval for:

{{itemTitle}}
{{itemDescription}}

Type: {{itemType}}
Requested: {{requestDate}}

Review request: {{approvalLink}}`,
    variables: ['approverName', 'requesterName', 'itemTitle', 'itemDescription', 'itemType', 'requestDate', 'approvalLink'],
    category: 'approvals',
    isActive: true,
    isSystemDefault: true,
    canCustomize: true
  },
  
  ad_approval_assigned: {
    key: 'ad_approval_assigned',
    name: 'Ad Approval Assignment',
    description: 'Sent when an ad production task is assigned',
    subject: '🎙️ New Ad Production Assignment - {{campaignName}}',
    htmlContent: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>New Ad Production Assignment</h2>
      <p>Hi {{userName}},</p>
      <p>You have been assigned a new ad production task:</p>
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <h3 style="margin-top: 0;">Campaign Details</h3>
        <p><strong>Campaign:</strong> {{campaignName}}</p>
        <p><strong>Advertiser:</strong> {{advertiserName}}</p>
        <p><strong>Show:</strong> {{showName}}</p>
        <p><strong>Type:</strong> {{type}}</p>
        <p><strong>Duration:</strong> {{duration}} seconds</p>
        <p><strong>Priority:</strong> {{priority}}</p>
        <p><strong>Deadline:</strong> {{deadline}}</p>
      </div>
    </div>`,
    textContent: `New Ad Production Assignment

Hi {{userName}},

You have been assigned a new ad production task:

Campaign: {{campaignName}}
Advertiser: {{advertiserName}}
Show: {{showName}}
Type: {{type}}
Duration: {{duration}} seconds
Priority: {{priority}}
Deadline: {{deadline}}`,
    variables: ['userName', 'campaignName', 'advertiserName', 'showName', 'type', 'duration', 'priority', 'deadline'],
    category: 'ad_production',
    isActive: true,
    isSystemDefault: true,
    canCustomize: true
  }
}

export class TemplateService {
  /**
   * Get a template by key, with fallback to system default
   */
  async getTemplate(orgId: string | null, templateKey: string): Promise<EmailTemplate | null> {
    // Try custom template first if org is provided
    if (orgId) {
      const { data: custom } = await safeQuerySchema(orgId, 
        'SELECT * FROM "EmailTemplate" WHERE key = $1 AND "isActive" = true',
        [templateKey]
      )
      
      if (custom && custom.length > 0) {
        return {
          ...custom[0],
          isSystemDefault: false,
          canCustomize: true
        }
      }
    }
    
    // Fall back to system default
    const systemTemplate = SYSTEM_TEMPLATES[templateKey]
    if (!systemTemplate) {
      return null
    }
    
    return {
      id: `system_${templateKey}`,
      ...systemTemplate,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  }
  
  /**
   * List all available templates for an organization
   */
  async listTemplates(orgId: string | null): Promise<EmailTemplate[]> {
    const templates: EmailTemplate[] = []
    
    // Add all system templates
    for (const [key, template] of Object.entries(SYSTEM_TEMPLATES)) {
      templates.push({
        id: `system_${key}`,
        ...template,
        createdAt: new Date(),
        updatedAt: new Date()
      })
    }
    
    // Override with custom templates if org is provided
    if (orgId) {
      const { data: custom } = await safeQuerySchema(orgId, 
        'SELECT * FROM "EmailTemplate" WHERE "isActive" = true',
        []
      )
      
      if (custom) {
        custom.forEach((customTemplate: any) => {
          const index = templates.findIndex(t => t.key === customTemplate.key)
          if (index >= 0) {
            // Replace system template with custom version
            templates[index] = {
              ...customTemplate,
              isSystemDefault: false,
              canCustomize: true
            }
          } else {
            // Add new custom template
            templates.push({
              ...customTemplate,
              isSystemDefault: false,
              canCustomize: true
            })
          }
        })
      }
    }
    
    return templates
  }
  
  /**
   * Create or update a custom template
   */
  async saveTemplate(orgId: string, template: Partial<EmailTemplate>): Promise<EmailTemplate> {
    if (!template.key) {
      throw new Error('Template key is required')
    }
    
    // Check if template already exists
    const { data: existing } = await safeQuerySchema(orgId,
      'SELECT id FROM "EmailTemplate" WHERE key = $1',
      [template.key]
    )
    
    if (existing && existing.length > 0) {
      // Update existing template
      const { data: updated } = await safeQuerySchema(orgId,
        `UPDATE "EmailTemplate" 
         SET name = $2, description = $3, subject = $4, 
             "htmlContent" = $5, "textContent" = $6, 
             variables = $7, category = $8, 
             "updatedAt" = NOW()
         WHERE key = $1
         RETURNING *`,
        [
          template.key,
          template.name,
          template.description,
          template.subject,
          template.htmlContent,
          template.textContent,
          JSON.stringify(template.variables || []),
          template.category
        ]
      )
      
      return {
        ...updated[0],
        isSystemDefault: false,
        canCustomize: true
      }
    } else {
      // Create new template
      const { data: created } = await safeQuerySchema(orgId,
        `INSERT INTO "EmailTemplate" 
         (key, name, description, subject, "htmlContent", "textContent", variables, category)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          template.key,
          template.name,
          template.description,
          template.subject,
          template.htmlContent,
          template.textContent,
          JSON.stringify(template.variables || []),
          template.category
        ]
      )
      
      return {
        ...created[0],
        isSystemDefault: false,
        canCustomize: true
      }
    }
  }
  
  /**
   * Render a template with data
   */
  renderTemplate(template: EmailTemplate, data: Record<string, any>): {
    subject: string
    htmlContent: string
    textContent: string
  } {
    const replacePlaceholders = (text: string): string => {
      return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return data[key] !== undefined ? String(data[key]) : match
      })
    }
    
    return {
      subject: replacePlaceholders(template.subject),
      htmlContent: replacePlaceholders(template.htmlContent),
      textContent: replacePlaceholders(template.textContent)
    }
  }
  
  /**
   * Validate template data
   */
  validateTemplateData(template: EmailTemplate, data: Record<string, any>): {
    valid: boolean
    missing: string[]
  } {
    const missing: string[] = []
    
    for (const variable of template.variables) {
      if (data[variable] === undefined || data[variable] === null) {
        missing.push(variable)
      }
    }
    
    return {
      valid: missing.length === 0,
      missing
    }
  }
}

export const templateService = new TemplateService()