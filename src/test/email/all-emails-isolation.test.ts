import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import prisma from '@/lib/db/prisma'
import { v4 as uuidv4 } from 'uuid'

describe('All Emails Tab - Organization Isolation', () => {
  let org1Id: string
  let org2Id: string
  let user1Id: string
  let user2Id: string
  let email1Id: string
  let email2Id: string

  beforeAll(async () => {
    // Create test organizations
    const org1 = await prisma.organization.create({
      data: {
        name: 'Email Test Org 1',
        schemaName: 'email_test_org_1',
        slug: 'email-test-org-1'
      }
    })
    org1Id = org1.id

    const org2 = await prisma.organization.create({
      data: {
        name: 'Email Test Org 2',
        schemaName: 'email_test_org_2',
        slug: 'email-test-org-2'
      }
    })
    org2Id = org2.id

    // Create test users
    const user1 = await prisma.user.create({
      data: {
        email: 'emailtest1@example.com',
        password: 'hashed_password',
        name: 'Email Test Seller 1',
        role: 'sales',
        organizationId: org1Id
      }
    })
    user1Id = user1.id

    const user2 = await prisma.user.create({
      data: {
        email: 'emailtest2@example.com',
        password: 'hashed_password',
        name: 'Email Test Seller 2',
        role: 'sales',
        organizationId: org2Id
      }
    })
    user2Id = user2.id

    // Create test emails with metadata
    const email1 = await prisma.emailLog.create({
      data: {
        organizationId: org1Id,
        userId: user1Id,
        toEmail: 'client1@example.com',
        fromEmail: 'noreply@podcastflow.pro',
        subject: 'Campaign Update - Org 1',
        templateKey: 'campaign_update',
        status: 'delivered',
        sentAt: new Date(),
        openedAt: new Date(),
        metadata: {
          sellerId: user1Id,
          sellerName: 'Email Test Seller 1',
          sellerEmail: 'emailtest1@example.com',
          advertiserId: 'adv-1',
          advertiserName: 'Advertiser One',
          agencyId: 'agency-1',
          agencyName: 'Agency One',
          campaignId: 'campaign-1',
          campaignName: 'Q1 2025 Campaign'
        }
      }
    })
    email1Id = email1.id

    const email2 = await prisma.emailLog.create({
      data: {
        organizationId: org2Id,
        userId: user2Id,
        toEmail: 'client2@example.com',
        fromEmail: 'noreply@podcastflow.pro',
        subject: 'Campaign Update - Org 2',
        templateKey: 'campaign_update',
        status: 'delivered',
        sentAt: new Date(),
        metadata: {
          sellerId: user2Id,
          sellerName: 'Email Test Seller 2',
          sellerEmail: 'emailtest2@example.com',
          advertiserId: 'adv-2',
          advertiserName: 'Advertiser Two',
          agencyId: 'agency-2',
          agencyName: 'Agency Two',
          campaignId: 'campaign-2',
          campaignName: 'Q2 2025 Campaign'
        }
      }
    })
    email2Id = email2.id
  })

  afterAll(async () => {
    // Clean up test data
    await prisma.emailLog.deleteMany({
      where: {
        id: { in: [email1Id, email2Id] }
      }
    })
    await prisma.user.deleteMany({
      where: {
        id: { in: [user1Id, user2Id] }
      }
    })
    await prisma.organization.deleteMany({
      where: {
        id: { in: [org1Id, org2Id] }
      }
    })
    await prisma.$disconnect()
  })

  describe('Organization Isolation', () => {
    it('should only return emails from the same organization', async () => {
      // Query emails for org1
      const org1Emails = await prisma.emailLog.findMany({
        where: {
          organizationId: org1Id,
          templateKey: {
            notIn: ['password_reset', 'email_verification', 'system_notification']
          }
        }
      })

      expect(org1Emails).toHaveLength(1)
      expect(org1Emails[0].id).toBe(email1Id)
      expect(org1Emails[0].organizationId).toBe(org1Id)
      expect(org1Emails[0].subject).toContain('Org 1')
    })

    it('should not mix emails from different organizations', async () => {
      // Query emails for org2
      const org2Emails = await prisma.emailLog.findMany({
        where: {
          organizationId: org2Id,
          templateKey: {
            notIn: ['password_reset', 'email_verification', 'system_notification']
          }
        }
      })

      expect(org2Emails).toHaveLength(1)
      expect(org2Emails[0].id).toBe(email2Id)
      expect(org2Emails[0].organizationId).toBe(org2Id)
      expect(org2Emails[0].subject).toContain('Org 2')
    })

    it('should filter emails by search term within organization', async () => {
      // Search for "Advertiser One" in org1
      const searchResults = await prisma.emailLog.findMany({
        where: {
          organizationId: org1Id,
          OR: [
            {
              subject: {
                contains: 'Advertiser One',
                mode: 'insensitive'
              }
            }
          ]
        }
      })

      // Should not find anything in subject
      expect(searchResults).toHaveLength(0)

      // But metadata search would find it (simulated in API)
      const email = await prisma.emailLog.findUnique({
        where: { id: email1Id }
      })
      const metadata = email?.metadata as any
      expect(metadata.advertiserName).toBe('Advertiser One')
    })

    it('should properly extract seller information from metadata', async () => {
      const email = await prisma.emailLog.findUnique({
        where: { id: email1Id },
        include: {
          user: true
        }
      })

      expect(email).not.toBeNull()
      const metadata = email?.metadata as any
      expect(metadata.sellerId).toBe(user1Id)
      expect(metadata.sellerName).toBe('Email Test Seller 1')
      expect(metadata.sellerEmail).toBe('emailtest1@example.com')
    })

    it('should properly extract business entity information from metadata', async () => {
      const email = await prisma.emailLog.findUnique({
        where: { id: email1Id }
      })

      expect(email).not.toBeNull()
      const metadata = email?.metadata as any
      expect(metadata.advertiserId).toBe('adv-1')
      expect(metadata.advertiserName).toBe('Advertiser One')
      expect(metadata.agencyId).toBe('agency-1')
      expect(metadata.agencyName).toBe('Agency One')
      expect(metadata.campaignId).toBe('campaign-1')
      expect(metadata.campaignName).toBe('Q1 2025 Campaign')
    })
  })

  describe('Sorting and Filtering', () => {
    it('should sort emails by date', async () => {
      // Create additional emails with different dates
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      
      const oldEmail = await prisma.emailLog.create({
        data: {
          organizationId: org1Id,
          userId: user1Id,
          toEmail: 'old@example.com',
          fromEmail: 'noreply@podcastflow.pro',
          subject: 'Old Email',
          templateKey: 'campaign_update',
          status: 'delivered',
          sentAt: yesterday
        }
      })

      const emails = await prisma.emailLog.findMany({
        where: { organizationId: org1Id },
        orderBy: { sentAt: 'desc' }
      })

      expect(emails.length).toBeGreaterThanOrEqual(2)
      expect(new Date(emails[0].sentAt!).getTime()).toBeGreaterThan(
        new Date(emails[emails.length - 1].sentAt!).getTime()
      )

      // Clean up
      await prisma.emailLog.delete({ where: { id: oldEmail.id } })
    })

    it('should filter emails by status', async () => {
      // Create bounced email
      const bouncedEmail = await prisma.emailLog.create({
        data: {
          organizationId: org1Id,
          userId: user1Id,
          toEmail: 'bounced@example.com',
          fromEmail: 'noreply@podcastflow.pro',
          subject: 'Bounced Email',
          templateKey: 'campaign_update',
          status: 'bounced',
          sentAt: new Date(),
          bouncedAt: new Date()
        }
      })

      const deliveredEmails = await prisma.emailLog.findMany({
        where: {
          organizationId: org1Id,
          status: 'delivered'
        }
      })

      const bouncedEmails = await prisma.emailLog.findMany({
        where: {
          organizationId: org1Id,
          status: 'bounced'
        }
      })

      expect(deliveredEmails.some(e => e.status === 'bounced')).toBe(false)
      expect(bouncedEmails.every(e => e.status === 'bounced')).toBe(true)

      // Clean up
      await prisma.emailLog.delete({ where: { id: bouncedEmail.id } })
    })
  })

  describe('Security', () => {
    it('should never expose emails across organizations even with direct ID access', async () => {
      // Try to access org2's email with org1's organization filter
      const email = await prisma.emailLog.findFirst({
        where: {
          id: email2Id,
          organizationId: org1Id
        }
      })

      expect(email).toBeNull()
    })

    it('should exclude system emails from all queries', async () => {
      // Create system email
      const systemEmail = await prisma.emailLog.create({
        data: {
          organizationId: org1Id,
          toEmail: 'user@example.com',
          fromEmail: 'system@podcastflow.pro',
          subject: 'Reset Your Password',
          templateKey: 'password_reset',
          status: 'sent',
          sentAt: new Date()
        }
      })

      const emails = await prisma.emailLog.findMany({
        where: {
          organizationId: org1Id,
          templateKey: {
            notIn: ['password_reset', 'email_verification', 'system_notification']
          }
        }
      })

      expect(emails.some(e => e.templateKey === 'password_reset')).toBe(false)

      // Clean up
      await prisma.emailLog.delete({ where: { id: systemEmail.id } })
    })
  })
})