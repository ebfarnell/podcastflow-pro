import { EmailTemplateService } from '../template-service'
import prisma from '@/lib/db/prisma'
import { beforeEach, describe, expect, it, jest } from '@jest/globals'

// Mock Prisma
jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  default: {
    emailTemplate: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}))

describe('EmailTemplateService', () => {
  let service: EmailTemplateService
  const mockPrisma = prisma as jest.Mocked<typeof prisma>

  beforeEach(() => {
    service = new EmailTemplateService()
    jest.clearAllMocks()
  })

  describe('getTemplate', () => {
    const systemTemplate = {
      id: 'system-1',
      key: 'user-invitation',
      name: 'User Invitation',
      subject: 'You are invited',
      htmlContent: '<p>Hello {{name}}</p>',
      textContent: 'Hello {{name}}',
      organizationId: null,
      isSystemDefault: true,
      isActive: true,
      category: 'notification',
      variables: ['name'],
    }

    const orgTemplate = {
      id: 'org-1',
      key: 'user-invitation',
      name: 'Custom User Invitation',
      subject: 'Welcome to our org',
      htmlContent: '<p>Welcome {{name}}</p>',
      textContent: 'Welcome {{name}}',
      organizationId: 'org-123',
      isSystemDefault: false,
      isActive: true,
      category: 'notification',
      variables: ['name'],
    }

    it('should return organization-specific template when available', async () => {
      mockPrisma.emailTemplate.findFirst
        .mockResolvedValueOnce(orgTemplate) // First call for org template
        .mockResolvedValueOnce(systemTemplate) // Second call for system template

      const result = await service.getTemplate('user-invitation', 'org-123')
      
      expect(result).toEqual(orgTemplate)
      expect(mockPrisma.emailTemplate.findFirst).toHaveBeenCalledWith({
        where: {
          key: 'user-invitation',
          organizationId: 'org-123',
          isActive: true,
        },
      })
    })

    it('should fallback to system template when org template not found', async () => {
      mockPrisma.emailTemplate.findFirst
        .mockResolvedValueOnce(null) // No org template
        .mockResolvedValueOnce(systemTemplate) // System template exists

      const result = await service.getTemplate('user-invitation', 'org-123')
      
      expect(result).toEqual(systemTemplate)
      expect(mockPrisma.emailTemplate.findFirst).toHaveBeenCalledTimes(2)
    })

    it('should return system template when no organizationId provided', async () => {
      mockPrisma.emailTemplate.findFirst.mockResolvedValueOnce(systemTemplate)

      const result = await service.getTemplate('user-invitation')
      
      expect(result).toEqual(systemTemplate)
      expect(mockPrisma.emailTemplate.findFirst).toHaveBeenCalledWith({
        where: {
          key: 'user-invitation',
          organizationId: null,
          isSystemDefault: true,
          isActive: true,
        },
      })
    })

    it('should create default template when no template found', async () => {
      mockPrisma.emailTemplate.findFirst.mockResolvedValue(null)

      const result = await service.getTemplate('unknown-template')
      
      expect(result).toBeDefined()
      expect(result?.key).toBe('unknown-template')
      expect(result?.name).toBe('Custom Template')
    })
  })

  describe('getAllTemplates', () => {
    const systemTemplates = [
      {
        id: 'sys-1',
        key: 'user-invitation',
        name: 'User Invitation',
        organizationId: null,
        isSystemDefault: true,
        isActive: true,
      },
      {
        id: 'sys-2',
        key: 'password-reset',
        name: 'Password Reset',
        organizationId: null,
        isSystemDefault: true,
        isActive: true,
      },
    ]

    const orgTemplates = [
      {
        id: 'org-1',
        key: 'user-invitation',
        name: 'Custom Invitation',
        organizationId: 'org-123',
        isSystemDefault: false,
        isActive: true,
      },
      {
        id: 'org-2',
        key: 'custom-template',
        name: 'Custom Template',
        organizationId: 'org-123',
        isSystemDefault: false,
        isActive: true,
      },
    ]

    it('should return only system templates when no org specified', async () => {
      mockPrisma.emailTemplate.findMany.mockResolvedValueOnce(systemTemplates)

      const result = await service.getAllTemplates()
      
      expect(result).toEqual(systemTemplates)
      expect(mockPrisma.emailTemplate.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: null,
          isSystemDefault: true,
          isActive: true,
        },
      })
    })

    it('should merge org and system templates correctly', async () => {
      mockPrisma.emailTemplate.findMany
        .mockResolvedValueOnce(systemTemplates as any)
        .mockResolvedValueOnce(orgTemplates as any)

      const result = await service.getAllTemplates('org-123')
      
      expect(result).toHaveLength(3)
      // Should have org's custom invitation instead of system
      expect(result.find(t => t.key === 'user-invitation')?.id).toBe('org-1')
      // Should have system password-reset
      expect(result.find(t => t.key === 'password-reset')?.id).toBe('sys-2')
      // Should have org's custom template
      expect(result.find(t => t.key === 'custom-template')?.id).toBe('org-2')
    })
  })

  describe('createOrUpdateOrgTemplate', () => {
    const templateData = {
      key: 'user-invitation',
      name: 'Custom Invitation',
      subject: 'Welcome!',
      htmlContent: '<p>Welcome</p>',
      textContent: 'Welcome',
      variables: ['name'],
      category: 'notification',
    }

    it('should create new org template when none exists', async () => {
      mockPrisma.emailTemplate.findFirst.mockResolvedValueOnce(null)
      mockPrisma.emailTemplate.create.mockResolvedValueOnce({
        id: 'new-1',
        ...templateData,
        organizationId: 'org-123',
        isSystemDefault: false,
        isActive: true,
      } as any)

      const result = await service.createOrUpdateOrgTemplate('org-123', templateData)
      
      expect(mockPrisma.emailTemplate.create).toHaveBeenCalledWith({
        data: {
          ...templateData,
          organizationId: 'org-123',
          isActive: true,
          isSystemDefault: false,
        },
      })
    })

    it('should update existing org template', async () => {
      const existing = {
        id: 'existing-1',
        key: 'user-invitation',
        organizationId: 'org-123',
      }
      
      mockPrisma.emailTemplate.findFirst.mockResolvedValueOnce(existing as any)
      mockPrisma.emailTemplate.update.mockResolvedValueOnce({
        id: 'existing-1',
        ...templateData,
        organizationId: 'org-123',
      } as any)

      const result = await service.createOrUpdateOrgTemplate('org-123', templateData)
      
      expect(mockPrisma.emailTemplate.update).toHaveBeenCalledWith({
        where: { id: 'existing-1' },
        data: expect.objectContaining({
          name: templateData.name,
          subject: templateData.subject,
          htmlContent: templateData.htmlContent,
          textContent: templateData.textContent,
        }),
      })
    })
  })

  describe('renderTemplate', () => {
    it('should render template with provided data', async () => {
      const template = {
        id: 'test-1',
        key: 'test-template',
        name: 'Test Template',
        subject: 'Hello {{name}}',
        htmlContent: '<p>Hello {{name}}, welcome to {{organizationName}}</p>',
        textContent: 'Hello {{name}}, welcome to {{organizationName}}',
        isActive: true,
        isSystemDefault: false,
        canCustomize: true,
      }

      const data = {
        name: 'John Doe',
        organizationName: 'Acme Corp',
      }

      const result = await service.renderTemplate(template, data)
      
      expect(result.subject).toBe('Hello John Doe')
      expect(result.html).toContain('Hello John Doe, welcome to Acme Corp')
      expect(result.text).toContain('Hello John Doe, welcome to Acme Corp')
    })

    it('should include default data in rendering', async () => {
      const template = {
        id: 'test-2',
        key: 'test-template',
        name: 'Test Template',
        subject: 'PodcastFlow Pro - {{currentYear}}',
        htmlContent: '<p>© {{currentYear}} {{platformName}}</p>',
        textContent: '© {{currentYear}} {{platformName}}',
        isActive: true,
        isSystemDefault: false,
        canCustomize: true,
      }

      const result = await service.renderTemplate(template, {})
      
      expect(result.subject).toContain(new Date().getFullYear().toString())
      expect(result.html).toContain('PodcastFlow Pro')
    })
  })
})