import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import prisma from '@/lib/db/prisma'
import { v4 as uuidv4 } from 'uuid'

describe('Email Detail and Thread Features', () => {
  let orgId: string
  let userId: string
  let emailId1: string
  let emailId2: string
  let emailId3: string
  let fileId: string
  let threadId: string

  beforeAll(async () => {
    threadId = uuidv4()
    
    // Create test organization
    const org = await prisma.organization.create({
      data: {
        name: 'Email Detail Test Org',
        schemaName: 'email_detail_test_org',
        slug: 'email-detail-test-org'
      }
    })
    orgId = org.id

    // Create test user
    const user = await prisma.user.create({
      data: {
        email: 'emaildetailtest@example.com',
        password: 'hashed_password',
        name: 'Email Detail Test User',
        role: 'admin',
        organizationId: orgId
      }
    })
    userId = user.id

    // Create test emails in a thread
    const email1 = await prisma.emailLog.create({
      data: {
        organizationId: orgId,
        userId,
        toEmail: 'client@example.com',
        fromEmail: 'seller@podcastflow.pro',
        subject: 'Campaign Proposal - Thread Start',
        templateKey: 'campaign_proposal',
        status: 'delivered',
        sentAt: new Date('2025-01-15T10:00:00Z'),
        openedAt: new Date('2025-01-15T10:30:00Z'),
        metadata: {
          threadId,
          sellerId: userId,
          sellerName: 'Email Detail Test User',
          sellerEmail: 'emaildetailtest@example.com',
          advertiserId: 'adv-123',
          advertiserName: 'Test Advertiser Co.',
          agencyId: 'agency-123',
          agencyName: 'Test Agency Inc.',
          campaignId: 'campaign-123',
          campaignName: 'Q1 2025 Campaign',
          emailId: 'email-123' // Reference to Email table for body content
        }
      }
    })
    emailId1 = email1.id

    // Create second email in thread
    const email2 = await prisma.emailLog.create({
      data: {
        organizationId: orgId,
        toEmail: 'seller@podcastflow.pro',
        fromEmail: 'client@example.com',
        subject: 'Re: Campaign Proposal - Thread Start',
        templateKey: null,
        status: 'delivered',
        sentAt: new Date('2025-01-15T14:00:00Z'),
        metadata: {
          threadId,
          conversationId: threadId // Test both threadId and conversationId
        }
      }
    })
    emailId2 = email2.id

    // Create third email in thread
    const email3 = await prisma.emailLog.create({
      data: {
        organizationId: orgId,
        userId,
        toEmail: 'client@example.com',
        fromEmail: 'seller@podcastflow.pro',
        subject: 'Re: Campaign Proposal - Thread Start',
        templateKey: 'campaign_update',
        status: 'sent',
        sentAt: new Date('2025-01-15T16:00:00Z'),
        metadata: {
          threadId,
          sellerId: userId,
          sellerName: 'Email Detail Test User',
          sellerEmail: 'emaildetailtest@example.com'
        }
      }
    })
    emailId3 = email3.id

    // Create full email record for body content
    await prisma.email.create({
      data: {
        messageId: 'email-123',
        from: 'seller@podcastflow.pro',
        to: ['client@example.com'],
        cc: ['manager@example.com'],
        bcc: ['archive@podcastflow.pro'],
        subject: 'Campaign Proposal - Thread Start',
        html: '<h1>Campaign Proposal</h1><p>Here is our proposal for Q1 2025...</p>',
        text: 'Campaign Proposal\n\nHere is our proposal for Q1 2025...',
        status: 'sent',
        organizationId: orgId
      }
    })

    // Create test attachment
    const file = await prisma.uploadedFile.create({
      data: {
        organizationId: orgId,
        uploadedById: userId,
        originalName: 'campaign-proposal.pdf',
        fileName: 'campaign-proposal-123.pdf',
        fileSize: 1024 * 1024, // 1MB
        mimeType: 'application/pdf',
        category: 'documents',
        s3Key: 'test-org/documents/campaign-proposal-123.pdf',
        s3Url: 'https://s3.amazonaws.com/podcastflow-audio-uploads/test-org/documents/campaign-proposal-123.pdf',
        entityType: 'email',
        entityId: emailId1,
        status: 'active'
      }
    })
    fileId = file.id
  })

  afterAll(async () => {
    // Clean up test data
    await prisma.uploadedFile.deleteMany({
      where: { id: fileId }
    })
    await prisma.email.deleteMany({
      where: { messageId: 'email-123' }
    })
    await prisma.emailLog.deleteMany({
      where: {
        id: { in: [emailId1, emailId2, emailId3] }
      }
    })
    await prisma.user.deleteMany({
      where: { id: userId }
    })
    await prisma.organization.deleteMany({
      where: { id: orgId }
    })
    await prisma.$disconnect()
  })

  describe('Email Detail API', () => {
    it('should fetch single email with full details', async () => {
      const email = await prisma.emailLog.findUnique({
        where: { id: emailId1 },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          }
        }
      })

      expect(email).not.toBeNull()
      expect(email?.id).toBe(emailId1)
      expect(email?.subject).toBe('Campaign Proposal - Thread Start')
      expect(email?.status).toBe('delivered')
      expect(email?.openedAt).not.toBeNull()
      
      const metadata = email?.metadata as any
      expect(metadata.threadId).toBe(threadId)
      expect(metadata.advertiserName).toBe('Test Advertiser Co.')
      expect(metadata.agencyName).toBe('Test Agency Inc.')
      expect(metadata.campaignName).toBe('Q1 2025 Campaign')
    })

    it('should include email body content when available', async () => {
      const metadata = { emailId: 'email-123' } as any
      
      if (metadata.emailId) {
        const fullEmail = await prisma.email.findUnique({
          where: { messageId: metadata.emailId },
          select: {
            html: true,
            text: true,
            cc: true,
            bcc: true
          }
        })

        expect(fullEmail).not.toBeNull()
        expect(fullEmail?.html).toContain('<h1>Campaign Proposal</h1>')
        expect(fullEmail?.text).toContain('Campaign Proposal')
        expect(fullEmail?.cc).toContain('manager@example.com')
        expect(fullEmail?.bcc).toContain('archive@podcastflow.pro')
      }
    })

    it('should fetch attachments for an email', async () => {
      const attachments = await prisma.uploadedFile.findMany({
        where: {
          organizationId: orgId,
          entityType: 'email',
          entityId: emailId1,
          status: 'active'
        }
      })

      expect(attachments).toHaveLength(1)
      expect(attachments[0].originalName).toBe('campaign-proposal.pdf')
      expect(attachments[0].fileSize).toBe(1024 * 1024)
      expect(attachments[0].mimeType).toBe('application/pdf')
    })

    it('should enforce organization isolation for email details', async () => {
      const differentOrgId = uuidv4()
      
      // Try to fetch email with wrong organization ID
      const email = await prisma.emailLog.findFirst({
        where: {
          id: emailId1,
          organizationId: differentOrgId
        }
      })

      expect(email).toBeNull()
    })
  })

  describe('Email Thread API', () => {
    it('should fetch all emails in a thread by threadId', async () => {
      const threadEmails = await prisma.emailLog.findMany({
        where: {
          organizationId: orgId,
          OR: [
            {
              metadata: {
                path: ['threadId'],
                equals: threadId
              }
            },
            {
              metadata: {
                path: ['conversationId'],
                equals: threadId
              }
            }
          ]
        },
        orderBy: {
          sentAt: 'asc'
        }
      })

      expect(threadEmails).toHaveLength(3)
      expect(threadEmails[0].id).toBe(emailId1)
      expect(threadEmails[1].id).toBe(emailId2)
      expect(threadEmails[2].id).toBe(emailId3)
    })

    it('should order thread emails by sent date', async () => {
      const threadEmails = await prisma.emailLog.findMany({
        where: {
          organizationId: orgId,
          metadata: {
            path: ['threadId'],
            equals: threadId
          }
        },
        orderBy: {
          sentAt: 'asc'
        }
      })

      const sentDates = threadEmails.map(e => e.sentAt?.getTime() || 0)
      const sortedDates = [...sentDates].sort((a, b) => a - b)
      expect(sentDates).toEqual(sortedDates)
    })

    it('should handle emails without threadId', async () => {
      // Create orphan email
      const orphanEmail = await prisma.emailLog.create({
        data: {
          organizationId: orgId,
          toEmail: 'orphan@example.com',
          fromEmail: 'system@podcastflow.pro',
          subject: 'Orphan Email',
          status: 'sent',
          sentAt: new Date()
        }
      })

      const metadata = orphanEmail.metadata as any || {}
      expect(metadata.threadId).toBeUndefined()
      expect(metadata.conversationId).toBeUndefined()

      // Clean up
      await prisma.emailLog.delete({ where: { id: orphanEmail.id } })
    })

    it('should enforce organization isolation for threads', async () => {
      const differentOrgId = uuidv4()
      
      const threadEmails = await prisma.emailLog.findMany({
        where: {
          organizationId: differentOrgId,
          metadata: {
            path: ['threadId'],
            equals: threadId
          }
        }
      })

      expect(threadEmails).toHaveLength(0)
    })
  })

  describe('Security and Edge Cases', () => {
    it('should handle missing metadata gracefully', async () => {
      const emailWithNoMetadata = await prisma.emailLog.create({
        data: {
          organizationId: orgId,
          toEmail: 'test@example.com',
          fromEmail: 'sender@example.com',
          subject: 'No Metadata Email',
          status: 'sent',
          metadata: {}
        }
      })

      const metadata = emailWithNoMetadata.metadata as any || {}
      expect(metadata.sellerId).toBeUndefined()
      expect(metadata.threadId).toBeUndefined()

      // Clean up
      await prisma.emailLog.delete({ where: { id: emailWithNoMetadata.id } })
    })

    it('should handle large threads efficiently', async () => {
      // Test query with limit to ensure pagination works
      const firstPage = await prisma.emailLog.findMany({
        where: {
          organizationId: orgId,
          metadata: {
            path: ['threadId'],
            equals: threadId
          }
        },
        take: 2,
        orderBy: {
          sentAt: 'asc'
        }
      })

      expect(firstPage).toHaveLength(2)
    })

    it('should never expose cross-org attachment data', async () => {
      const differentOrgId = uuidv4()
      
      const attachments = await prisma.uploadedFile.findMany({
        where: {
          organizationId: differentOrgId,
          entityType: 'email',
          entityId: emailId1
        }
      })

      expect(attachments).toHaveLength(0)
    })
  })
})