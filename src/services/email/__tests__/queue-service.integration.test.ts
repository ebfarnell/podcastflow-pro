import { EmailQueueService } from '../queue-service'
import { EmailTemplateService } from '../template-service'
import { EmailService } from '../email-service'
import prisma from '@/lib/db/prisma'
import { beforeEach, describe, expect, it, jest, afterEach } from '@jest/globals'

// This is an integration test that tests the full flow
describe('EmailQueueService Integration', () => {
  let queueService: EmailQueueService
  let templateService: EmailTemplateService
  let emailService: EmailService
  
  // Test data
  const testOrgId = 'test-org-123'
  const testUserId = 'test-user-123'
  
  beforeEach(async () => {
    // Clear test data
    await prisma.emailQueue.deleteMany({
      where: { organizationId: testOrgId }
    })
    await prisma.emailTemplate.deleteMany({
      where: { 
        OR: [
          { organizationId: testOrgId },
          { key: 'test-template' }
        ]
      }
    })
    
    queueService = new EmailQueueService()
    templateService = new EmailTemplateService()
    emailService = new EmailService()
    
    // Mock email sending
    jest.spyOn(emailService, 'sendEmail').mockResolvedValue({
      messageId: 'test-message-id',
      success: true
    })
  })
  
  afterEach(async () => {
    // Cleanup
    await prisma.emailQueue.deleteMany({
      where: { organizationId: testOrgId }
    })
    await prisma.emailTemplate.deleteMany({
      where: { 
        OR: [
          { organizationId: testOrgId },
          { key: 'test-template' }
        ]
      }
    })
    jest.restoreAllMocks()
  })

  describe('Template-based email processing', () => {
    it('should process email with system template', async () => {
      // Create system template
      await prisma.emailTemplate.create({
        data: {
          key: 'test-template',
          name: 'Test Template',
          subject: 'Test: {{title}}',
          htmlContent: '<p>Hello {{userName}}</p>',
          textContent: 'Hello {{userName}}',
          isActive: true,
          isSystemDefault: true,
          organizationId: null,
          category: 'test'
        }
      })
      
      // Queue email
      const queueId = await queueService.queueEmail(
        {
          to: 'test@example.com',
          subject: 'Test Email',
          html: '<p>Test</p>',
          text: 'Test'
        },
        testOrgId,
        new Date()
      )
      
      // Update queue item to use template
      await prisma.emailQueue.update({
        where: { id: queueId },
        data: {
          templateKey: 'test-template',
          templateData: {
            title: 'Integration Test',
            userName: 'Test User'
          }
        }
      })
      
      // Process queue
      await queueService.processQueue(emailService)
      
      // Verify email was sent with rendered template
      expect(emailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          subject: 'Test: Integration Test',
          html: '<p>Hello Test User</p>',
          text: 'Hello Test User'
        }),
        testOrgId
      )
      
      // Verify queue status
      const queueItem = await prisma.emailQueue.findUnique({
        where: { id: queueId }
      })
      expect(queueItem?.status).toBe('sent')
    })

    it('should use org-specific template over system template', async () => {
      // Create system template
      await prisma.emailTemplate.create({
        data: {
          key: 'test-template',
          name: 'System Template',
          subject: 'System: {{title}}',
          htmlContent: '<p>System {{userName}}</p>',
          textContent: 'System {{userName}}',
          isActive: true,
          isSystemDefault: true,
          organizationId: null,
          category: 'test'
        }
      })
      
      // Create org-specific template
      await prisma.emailTemplate.create({
        data: {
          key: 'test-template',
          name: 'Org Template',
          subject: 'Org: {{title}}',
          htmlContent: '<p>Welcome to our org, {{userName}}</p>',
          textContent: 'Welcome to our org, {{userName}}',
          isActive: true,
          isSystemDefault: false,
          organizationId: testOrgId,
          category: 'test'
        }
      })
      
      // Queue email
      const queueId = await queueService.queueEmail(
        {
          to: 'test@example.com',
          subject: 'Test Email',
          html: '<p>Test</p>',
          text: 'Test'
        },
        testOrgId,
        new Date()
      )
      
      // Update queue item to use template
      await prisma.emailQueue.update({
        where: { id: queueId },
        data: {
          templateKey: 'test-template',
          templateData: {
            title: 'Integration Test',
            userName: 'Test User'
          }
        }
      })
      
      // Process queue
      await queueService.processQueue(emailService)
      
      // Verify org template was used
      expect(emailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Org: Integration Test',
          html: '<p>Welcome to our org, Test User</p>',
          text: 'Welcome to our org, Test User'
        }),
        testOrgId
      )
    })

    it('should handle template not found error gracefully', async () => {
      // Queue email with non-existent template
      const queueId = await queueService.queueEmail(
        {
          to: 'test@example.com',
          subject: 'Test Email',
          html: '<p>Test</p>',
          text: 'Test'
        },
        testOrgId,
        new Date()
      )
      
      await prisma.emailQueue.update({
        where: { id: queueId },
        data: {
          templateKey: 'non-existent-template',
          templateData: { test: 'data' }
        }
      })
      
      // Process queue
      await queueService.processQueue(emailService)
      
      // Verify email was not sent
      expect(emailService.sendEmail).not.toHaveBeenCalled()
      
      // Verify queue item shows error
      const queueItem = await prisma.emailQueue.findUnique({
        where: { id: queueId }
      })
      expect(queueItem?.status).toBe('pending')
      expect(queueItem?.lastError).toContain('not found')
    })
  })

  describe('Legacy direct email processing', () => {
    it('should process direct email without template', async () => {
      // Queue direct email
      const queueId = await queueService.queueEmail(
        {
          to: 'test@example.com',
          subject: 'Direct Email',
          html: '<p>Direct HTML content</p>',
          text: 'Direct text content'
        },
        testOrgId,
        new Date()
      )
      
      // Process queue
      await queueService.processQueue(emailService)
      
      // Verify email was sent
      expect(emailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          subject: 'Direct Email',
          html: '<p>Direct HTML content</p>',
          text: 'Direct text content'
        }),
        testOrgId
      )
      
      // Verify queue status
      const queueItem = await prisma.emailQueue.findUnique({
        where: { id: queueId }
      })
      expect(queueItem?.status).toBe('sent')
    })
  })
})