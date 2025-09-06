import prisma from '@/lib/db/prisma'
import { safeQuerySchema } from '@/lib/db/schema-db'
import handlebars from 'handlebars'

export interface EmailTemplate {
  id: string
  key: string
  name: string
  description?: string | null
  subject: string
  htmlContent: string
  textContent: string
  variables: string[]
  category: string
  isActive: boolean
  isSystemDefault: boolean
  canCustomize: boolean
  organizationId?: string | null
}

export interface RenderedTemplate {
  subject: string
  html: string
  text: string
}

export class EmailTemplateService {
  private compiledTemplates: Map<string, {
    subject: handlebars.TemplateDelegate
    html: handlebars.TemplateDelegate
    text: handlebars.TemplateDelegate
  }> = new Map()

  constructor() {
    // Register common helpers
    handlebars.registerHelper('formatDate', (date: Date | string) => {
      return new Date(date).toLocaleDateString()
    })

    handlebars.registerHelper('formatCurrency', (amount: number) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(amount)
    })

    handlebars.registerHelper('capitalize', (str: string) => {
      return str.charAt(0).toUpperCase() + str.slice(1)
    })

    handlebars.registerHelper('ifEquals', function(arg1: any, arg2: any, options: any) {
      return (arg1 == arg2) ? options.fn(this) : options.inverse(this)
    })
  }

  async getTemplate(key: string, organizationId?: string): Promise<EmailTemplate | null> {
    // First, try to get organization-specific template
    if (organizationId) {
      const orgTemplate = await prisma.emailTemplate.findFirst({
        where: { 
          key,
          organizationId,
          isActive: true
        }
      })

      if (orgTemplate) {
        return orgTemplate
      }
    }

    // Fall back to system default template
    const systemTemplate = await prisma.emailTemplate.findFirst({
      where: {
        key,
        organizationId: null,
        isSystemDefault: true,
        isActive: true
      }
    })

    if (systemTemplate) {
      return systemTemplate
    }

    // If no template found, create a basic one
    return this.createDefaultTemplate(key)
  }

  async renderTemplate(
    template: EmailTemplate, 
    data: Record<string, any>
  ): Promise<RenderedTemplate> {
    const cacheKey = `${template.id}-${template.organizationId || 'system'}`
    
    // Check if template is already compiled
    if (!this.compiledTemplates.has(cacheKey)) {
      this.compiledTemplates.set(cacheKey, {
        subject: handlebars.compile(template.subject),
        html: handlebars.compile(template.htmlContent),
        text: handlebars.compile(template.textContent)
      })
    }

    const compiled = this.compiledTemplates.get(cacheKey)!

    // Add common data
    const renderData = {
      ...data,
      currentYear: new Date().getFullYear(),
      platformName: 'PodcastFlow Pro',
      supportEmail: process.env.SUPPORT_EMAIL || 'support@podcastflow.pro'
    }

    return {
      subject: compiled.subject(renderData),
      html: compiled.html(renderData),
      text: compiled.text(renderData)
    }
  }

  async saveTemplate(
    template: Partial<EmailTemplate>,
    organizationId?: string
  ): Promise<EmailTemplate> {
    if (organizationId) {
      // Save organization-specific template
      const result = await safeQuerySchema(
        organizationId,
        async (db) => {
          if (template.id) {
            // Update existing
            return db.emailTemplate.update({
              where: { id: template.id },
              data: {
                name: template.name!,
                description: template.description,
                subject: template.subject!,
                htmlContent: template.htmlContent!,
                textContent: template.textContent!,
                variables: template.variables || [],
                category: template.category!,
                isActive: template.isActive ?? true
              }
            })
          } else {
            // Create new
            return db.emailTemplate.create({
              data: {
                key: template.key!,
                name: template.name!,
                description: template.description,
                subject: template.subject!,
                htmlContent: template.htmlContent!,
                textContent: template.textContent!,
                variables: template.variables || [],
                category: template.category!,
                isActive: template.isActive ?? true,
                isSystemDefault: false
              }
            })
          }
        },
        { id: template.id }
      )

      if (result.data) {
        // Clear cache for this template
        const cacheKey = `${result.data.id}-${organizationId}`
        this.compiledTemplates.delete(cacheKey)
        
        return {
          ...result.data,
          canCustomize: true
        } as EmailTemplate
      }
    }

    throw new Error('Failed to save template')
  }

  async previewTemplate(
    template: EmailTemplate,
    sampleData?: Record<string, any>
  ): Promise<RenderedTemplate> {
    // Generate sample data if not provided
    const data = sampleData || this.generateSampleData(template.key)
    
    return this.renderTemplate(template, data)
  }

  private createDefaultTemplate(key: string): EmailTemplate {
    const templates: Record<string, Partial<EmailTemplate>> = {
      'user-invitation': {
        name: 'User Invitation',
        subject: 'You\'ve been invited to join {{organizationName}} on PodcastFlow Pro',
        htmlContent: `
          <h2>Welcome to PodcastFlow Pro!</h2>
          <p>Hi {{userName}},</p>
          <p>You've been invited to join <strong>{{organizationName}}</strong> on PodcastFlow Pro.</p>
          <p>Click the link below to set up your account:</p>
          <p><a href="{{inviteLink}}" style="background: #1976d2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">Accept Invitation</a></p>
          <p>This invitation will expire in 7 days.</p>
          <p>Best regards,<br>The PodcastFlow Pro Team</p>
        `,
        textContent: `
Welcome to PodcastFlow Pro!

Hi {{userName}},

You've been invited to join {{organizationName}} on PodcastFlow Pro.

Click the link below to set up your account:
{{inviteLink}}

This invitation will expire in 7 days.

Best regards,
The PodcastFlow Pro Team
        `,
        variables: ['userName', 'organizationName', 'inviteLink'],
        category: 'system'
      },
      'task-assignment': {
        name: 'Task Assignment',
        subject: 'New task assigned: {{taskTitle}}',
        htmlContent: `
          <h3>New Task Assignment</h3>
          <p>Hi {{assigneeName}},</p>
          <p>You have been assigned a new task:</p>
          <div style="background: #f5f5f5; padding: 15px; border-radius: 4px; margin: 20px 0;">
            <h4 style="margin: 0 0 10px 0;">{{taskTitle}}</h4>
            <p style="margin: 5px 0;"><strong>Project:</strong> {{projectName}}</p>
            <p style="margin: 5px 0;"><strong>Due Date:</strong> {{dueDate}}</p>
            <p style="margin: 5px 0;"><strong>Priority:</strong> {{priority}}</p>
            {{#if description}}
            <p style="margin: 10px 0 5px 0;"><strong>Description:</strong></p>
            <p style="margin: 5px 0;">{{description}}</p>
            {{/if}}
          </div>
          <p><a href="{{taskLink}}" style="background: #1976d2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">View Task</a></p>
        `,
        textContent: `
New Task Assignment

Hi {{assigneeName}},

You have been assigned a new task:

Task: {{taskTitle}}
Project: {{projectName}}
Due Date: {{dueDate}}
Priority: {{priority}}
{{#if description}}
Description: {{description}}
{{/if}}

View task: {{taskLink}}
        `,
        variables: ['assigneeName', 'taskTitle', 'projectName', 'dueDate', 'priority', 'description', 'taskLink'],
        category: 'notification'
      }
    }

    const defaultTemplate = templates[key] || {
      name: key.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      subject: 'Notification from PodcastFlow Pro',
      htmlContent: '<p>{{content}}</p>',
      textContent: '{{content}}',
      variables: ['content'],
      category: 'general'
    }

    return {
      id: `default-${key}`,
      key,
      description: null,
      isActive: true,
      isSystemDefault: true,
      canCustomize: true,
      organizationId: null,
      ...defaultTemplate
    } as EmailTemplate
  }

  private generateSampleData(templateKey: string): Record<string, any> {
    const sampleData: Record<string, Record<string, any>> = {
      'user-invitation': {
        userName: 'John Doe',
        organizationName: 'Acme Podcasts',
        inviteLink: 'https://app.podcastflow.pro/invite/sample-token'
      },
      'task-assignment': {
        assigneeName: 'Jane Smith',
        taskTitle: 'Review Q3 Campaign Performance',
        projectName: 'Summer Marketing Campaign',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString(),
        priority: 'High',
        description: 'Please review the Q3 campaign metrics and prepare a summary report.',
        taskLink: 'https://app.podcastflow.pro/tasks/123'
      }
    }

    return sampleData[templateKey] || {
      content: 'This is a sample notification message.',
      userName: 'Sample User',
      date: new Date().toLocaleDateString()
    }
  }

  clearCache(): void {
    this.compiledTemplates.clear()
  }

  async getAllTemplates(organizationId?: string): Promise<EmailTemplate[]> {
    // Get all system templates
    const systemTemplates = await prisma.emailTemplate.findMany({
      where: {
        organizationId: null,
        isSystemDefault: true,
        isActive: true
      }
    })

    // If no organization specified, return only system templates
    if (!organizationId) {
      return systemTemplates
    }

    // Get organization-specific templates
    const orgTemplates = await prisma.emailTemplate.findMany({
      where: {
        organizationId,
        isActive: true
      }
    })

    // Create a map of org templates by key
    const orgTemplateMap = new Map(orgTemplates.map(t => [t.key, t]))

    // Merge templates - org templates override system templates
    const mergedTemplates = systemTemplates.map(systemTemplate => {
      const orgTemplate = orgTemplateMap.get(systemTemplate.key)
      if (orgTemplate) {
        // Remove from map so we don't add it twice
        orgTemplateMap.delete(systemTemplate.key)
        return orgTemplate
      }
      return systemTemplate
    })

    // Add any org-specific templates that don't have system defaults
    orgTemplateMap.forEach(template => {
      mergedTemplates.push(template)
    })

    return mergedTemplates.sort((a, b) => a.name.localeCompare(b.name))
  }

  async createOrUpdateOrgTemplate(
    organizationId: string,
    templateData: {
      key: string
      name: string
      subject: string
      htmlContent: string
      textContent: string
      variables?: any
      category?: string
    }
  ): Promise<EmailTemplate> {
    // Check if org already has this template
    const existing = await prisma.emailTemplate.findFirst({
      where: {
        key: templateData.key,
        organizationId
      }
    })

    if (existing) {
      // Update existing template
      return await prisma.emailTemplate.update({
        where: { id: existing.id },
        data: {
          name: templateData.name,
          subject: templateData.subject,
          htmlContent: templateData.htmlContent,
          textContent: templateData.textContent,
          variables: templateData.variables || [],
          category: templateData.category || 'general',
          updatedAt: new Date()
        }
      })
    } else {
      // Create new org-specific template
      return await prisma.emailTemplate.create({
        data: {
          key: templateData.key,
          name: templateData.name,
          subject: templateData.subject,
          htmlContent: templateData.htmlContent,
          textContent: templateData.textContent,
          variables: templateData.variables || [],
          category: templateData.category || 'general',
          organizationId,
          isActive: true,
          isSystemDefault: false
        }
      })
    }
  }
}