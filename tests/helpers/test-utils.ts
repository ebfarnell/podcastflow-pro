import { NextRequest } from 'next/server'
import prisma from '@/lib/db/prisma'

/**
 * Test utilities for API testing
 */

export interface TestUser {
  id: string
  email: string
  password: string
  role: string
  organizationId: string
  sessionToken?: string
}

export interface TestCampaign {
  id: string
  name: string
  organizationId: string
  advertiserId: string
  budget: number
  status: string
}

/**
 * Create a test user in the database
 */
export async function createTestUser(userData: Partial<TestUser> = {}): Promise<TestUser> {
  const bcrypt = require('bcryptjs')
  
  const defaultUser = {
    email: `test-${Date.now()}@example.com`,
    password: 'password123',
    role: 'admin',
    name: 'Test User',
    ...userData
  }

  // Create organization first if not provided
  let organizationId = userData.organizationId
  if (!organizationId) {
    const organization = await prisma.organization.create({
      data: {
        name: `Test Org ${Date.now()}`,
        email: defaultUser.email,
        plan: 'professional',
        status: 'active'
      }
    })
    organizationId = organization.id
  }

  const hashedPassword = await bcrypt.hash(defaultUser.password, 10)

  const user = await prisma.user.create({
    data: {
      email: defaultUser.email,
      password: hashedPassword,
      role: defaultUser.role,
      name: defaultUser.name,
      organizationId,
      emailVerified: true,
      isActive: true
    }
  })

  return {
    id: user.id,
    email: user.email,
    password: defaultUser.password,
    role: user.role,
    organizationId: user.organizationId!,
  }
}

/**
 * Create a test session for a user
 */
export async function createTestSession(userId: string): Promise<string> {
  const session = await prisma.session.create({
    data: {
      userId,
      token: `test-token-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000), // 8 hours
      createdAt: new Date(),
      lastActiveAt: new Date()
    }
  })

  return session.token
}

/**
 * Create a test campaign
 */
export async function createTestCampaign(campaignData: Partial<TestCampaign> = {}): Promise<TestCampaign> {
  // Create advertiser first
  const advertiser = await prisma.advertiser.create({
    data: {
      name: `Test Advertiser ${Date.now()}`,
      contactEmail: `advertiser-${Date.now()}@example.com`,
      organizationId: campaignData.organizationId!,
      status: 'active'
    }
  })

  const defaultCampaign = {
    name: `Test Campaign ${Date.now()}`,
    budget: 5000,
    status: 'active',
    startDate: new Date(),
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    ...campaignData,
    advertiserId: advertiser.id
  }

  const campaign = await prisma.campaign.create({
    data: defaultCampaign
  })

  return {
    id: campaign.id,
    name: campaign.name,
    organizationId: campaign.organizationId,
    advertiserId: campaign.advertiserId,
    budget: campaign.budget,
    status: campaign.status
  }
}

/**
 * Create authenticated request with session token
 */
export function createAuthenticatedRequest(
  url: string,
  method: string = 'GET',
  body?: any,
  sessionToken?: string
): NextRequest {
  const requestUrl = `http://localhost:3000${url}`
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }

  if (sessionToken) {
    headers['Cookie'] = `auth-token=${sessionToken}`
  }

  const requestInit: RequestInit = {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  }

  return new NextRequest(requestUrl, requestInit)
}

/**
 * Clean up test data by organization
 */
export async function cleanupTestData(organizationId: string): Promise<void> {
  try {
    // Delete in order due to foreign key constraints
    await prisma.session.deleteMany({
      where: {
        user: {
          organizationId
        }
      }
    })

    await prisma.campaignAnalytics.deleteMany({
      where: { organizationId }
    })

    await prisma.payment.deleteMany({
      where: {
        invoice: {
          organizationId
        }
      }
    })

    await prisma.invoiceItem.deleteMany({
      where: {
        invoice: {
          organizationId
        }
      }
    })

    await prisma.invoice.deleteMany({
      where: { organizationId }
    })

    await prisma.expense.deleteMany({
      where: { organizationId }
    })

    await prisma.campaign.deleteMany({
      where: { organizationId }
    })

    await prisma.advertiser.deleteMany({
      where: { organizationId }
    })

    await prisma.agency.deleteMany({
      where: { organizationId }
    })

    await prisma.user.deleteMany({
      where: { organizationId }
    })

    await prisma.organization.delete({
      where: { id: organizationId }
    })

    console.log(`✅ Cleaned up test data for organization: ${organizationId}`)

  } catch (error) {
    console.warn(`⚠️ Cleanup warning for organization ${organizationId}:`, error)
  }
}

/**
 * Wait for a specified amount of time
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Generate test analytics data
 */
export async function createTestAnalytics(campaignId: string, organizationId: string, date: Date = new Date()): Promise<void> {
  await prisma.campaignAnalytics.create({
    data: {
      campaignId,
      organizationId,
      date,
      impressions: Math.floor(Math.random() * 1000) + 100,
      clicks: Math.floor(Math.random() * 50) + 10,
      conversions: Math.floor(Math.random() * 5) + 1,
      spent: Math.floor(Math.random() * 100) + 20,
      ctr: 0,
      conversionRate: 0,
      cpc: 0,
      cpa: 0,
      engagementRate: Math.random() * 20 + 5,
      averageViewTime: Math.floor(Math.random() * 30) + 10,
      bounceRate: Math.random() * 30 + 10,
      adPlaybacks: Math.floor(Math.random() * 200) + 50,
      completionRate: Math.random() * 50 + 30,
      skipRate: Math.random() * 20 + 5
    }
  })
}

/**
 * Assert response structure
 */
export function assertApiResponse(response: any, expectedFields: string[]): void {
  expect(response).toBeDefined()
  
  for (const field of expectedFields) {
    expect(response).toHaveProperty(field)
  }
}

/**
 * Assert error response
 */
export function assertErrorResponse(response: any, expectedStatus: number = 500): void {
  expect(response).toBeDefined()
  expect(response).toHaveProperty('error')
  expect(typeof response.error).toBe('string')
}

/**
 * Create test invoice
 */
export async function createTestInvoice(organizationId: string, amount: number = 1000): Promise<any> {
  return await prisma.invoice.create({
    data: {
      invoiceNumber: `TEST-INV-${Date.now()}`,
      organizationId,
      clientName: 'Test Client',
      clientEmail: 'test@example.com',
      amount,
      totalAmount: amount,
      subtotal: amount,
      status: 'sent',
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      description: 'Test invoice',
      paymentTerms: 'Net 30',
      billingPeriod: new Date().toISOString().substring(0, 7),
      plan: 'test'
    }
  })
}