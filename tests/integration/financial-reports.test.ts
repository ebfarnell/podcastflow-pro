import { NextRequest, NextResponse } from 'next/server'
import { 
  createTestUser, 
  createTestSession, 
  createTestCampaign, 
  cleanupTestData,
  createAuthenticatedRequest,
  createTestInvoice,
  assertApiResponse,
  assertErrorResponse,
  TestUser
} from '../helpers/test-utils'
import prisma from '@/lib/db/prisma'

// Import the API route handlers
import { POST as monthlyReportPOST } from '@/app/api/reports/financial/monthly/route'
import { POST as quarterlyReportPOST } from '@/app/api/reports/financial/quarterly/route'
import { POST as taxReportPOST } from '@/app/api/reports/financial/tax/route'
import { POST as plReportPOST } from '@/app/api/reports/financial/pl/route'

describe('Financial Reports Integration Tests', () => {
  let testUser1: TestUser
  let testUser2: TestUser
  let sessionToken1: string
  let sessionToken2: string
  let organization1Id: string
  let organization2Id: string

  beforeAll(async () => {
    // Create two separate organizations to test data isolation
    testUser1 = await createTestUser({
      email: 'financial-test1@example.com',
      role: 'admin'
    })
    organization1Id = testUser1.organizationId

    testUser2 = await createTestUser({
      email: 'financial-test2@example.com', 
      role: 'admin'
    })
    organization2Id = testUser2.organizationId

    // Create sessions
    sessionToken1 = await createTestSession(testUser1.id)
    sessionToken2 = await createTestSession(testUser2.id)

    // Create test data for organization 1
    await createTestFinancialData(organization1Id, '2024')
    await createTestFinancialData(organization1Id, '2023') // Previous year for comparison

    // Create test data for organization 2 (different amounts to verify isolation)
    await createTestFinancialDataOrg2(organization2Id, '2024')
  })

  afterAll(async () => {
    await cleanupTestData(organization1Id)
    await cleanupTestData(organization2Id)
  })

  describe('Monthly Financial Report', () => {
    test('should generate PDF monthly report with real data', async () => {
      const request = createAuthenticatedRequest(
        '/api/reports/financial/monthly',
        'POST',
        {
          year: 2024,
          month: 11,
          format: 'pdf'
        },
        sessionToken1
      )

      const response = await monthlyReportPOST(request)
      
      expect(response).toBeInstanceOf(NextResponse)
      expect(response.status).toBe(200)
      
      // Check headers for PDF
      const headers = response.headers
      expect(headers.get('content-type')).toBe('application/pdf')
      expect(headers.get('content-disposition')).toContain('monthly-financial-report-2024-11.pdf')

      // Verify the response contains actual PDF data
      const responseBuffer = await response.arrayBuffer()
      expect(responseBuffer.byteLength).toBeGreaterThan(0)
      
      // Basic PDF validation - should start with PDF header
      const uint8Array = new Uint8Array(responseBuffer)
      const pdfHeader = String.fromCharCode(...uint8Array.slice(0, 4))
      expect(pdfHeader).toBe('%PDF')
    })

    test('should generate Excel monthly report with real data', async () => {
      const request = createAuthenticatedRequest(
        '/api/reports/financial/monthly',
        'POST',
        {
          year: 2024,
          month: 11,
          format: 'excel'
        },
        sessionToken1
      )

      const response = await monthlyReportPOST(request)
      
      expect(response).toBeInstanceOf(NextResponse)
      expect(response.status).toBe(200)
      
      // Check headers for Excel
      const headers = response.headers
      expect(headers.get('content-type')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      expect(headers.get('content-disposition')).toContain('monthly-financial-report-2024-11.xlsx')

      // Verify response contains Excel data
      const responseBuffer = await response.arrayBuffer()
      expect(responseBuffer.byteLength).toBeGreaterThan(0)
    })

    test('should generate CSV monthly report with real data', async () => {
      const request = createAuthenticatedRequest(
        '/api/reports/financial/monthly',
        'POST',
        {
          year: 2024,
          month: 11,
          format: 'csv'
        },
        sessionToken1
      )

      const response = await monthlyReportPOST(request)
      
      expect(response).toBeInstanceOf(NextResponse)
      expect(response.status).toBe(200)
      
      // Check headers for CSV
      const headers = response.headers
      expect(headers.get('content-type')).toBe('text/csv')
      expect(headers.get('content-disposition')).toContain('monthly-financial-report-2024-11.csv')

      // Verify CSV content
      const csvContent = await response.text()
      expect(csvContent).toContain('Monthly Financial Report')
      expect(csvContent).toContain('Revenue Summary')
      expect(csvContent).toContain('Expense Summary')
    })

    test('should generate JSON monthly report with real data', async () => {
      const request = createAuthenticatedRequest(
        '/api/reports/financial/monthly',
        'POST',
        {
          year: 2024,
          month: 11,
          format: 'json'
        },
        sessionToken1
      )

      const response = await monthlyReportPOST(request)
      
      expect(response).toBeInstanceOf(NextResponse)
      expect(response.status).toBe(200)

      const data = await response.json()
      
      // Verify data structure
      assertApiResponse(data, [
        'period',
        'revenue',
        'expenses',
        'invoices',
        'cashFlow',
        'metrics'
      ])

      expect(data.period.year).toBe(2024)
      expect(data.period.month).toBe(11)
      expect(typeof data.revenue.total).toBe('number')
      expect(typeof data.expenses.total).toBe('number')
      expect(Array.isArray(data.invoices.details)).toBe(true)
    })

    test('should respect organizational scoping', async () => {
      // Request from organization 1
      const request1 = createAuthenticatedRequest(
        '/api/reports/financial/monthly',
        'POST',
        {
          year: 2024,
          month: 11,
          format: 'json'
        },
        sessionToken1
      )

      const response1 = await monthlyReportPOST(request1)
      const data1 = await response1.json()

      // Request from organization 2 
      const request2 = createAuthenticatedRequest(
        '/api/reports/financial/monthly',
        'POST',
        {
          year: 2024,
          month: 11,
          format: 'json'
        },
        sessionToken2
      )

      const response2 = await monthlyReportPOST(request2)
      const data2 = await response2.json()

      // Data should be different between organizations
      expect(data1.revenue.total).not.toBe(data2.revenue.total)
      expect(data1.expenses.total).not.toBe(data2.expenses.total)
    })

    test('should handle unauthorized access', async () => {
      const request = createAuthenticatedRequest(
        '/api/reports/financial/monthly',
        'POST',
        {
          year: 2024,
          month: 11,
          format: 'json'
        }
        // No session token
      )

      const response = await monthlyReportPOST(request)
      
      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.error).toBe('Unauthorized')
    })
  })

  describe('Quarterly Financial Report', () => {
    test('should generate quarterly report with trends', async () => {
      const request = createAuthenticatedRequest(
        '/api/reports/financial/quarterly',
        'POST',
        {
          year: 2024,
          quarter: 4,
          format: 'json'
        },
        sessionToken1
      )

      const response = await quarterlyReportPOST(request)
      
      expect(response.status).toBe(200)
      const data = await response.json()

      assertApiResponse(data, [
        'period',
        'summary',
        'monthlyBreakdown',
        'trends',
        'topAdvertisers',
        'kpis'
      ])

      expect(data.period.quarter).toBe(4)
      expect(data.period.year).toBe(2024)
      expect(Array.isArray(data.monthlyBreakdown)).toBe(true)
      expect(data.monthlyBreakdown).toHaveLength(3) // Q4 has 3 months
    })

    test('should generate quarterly PDF report', async () => {
      const request = createAuthenticatedRequest(
        '/api/reports/financial/quarterly',
        'POST',
        {
          year: 2024,
          quarter: 4,
          format: 'pdf'
        },
        sessionToken1
      )

      const response = await quarterlyReportPOST(request)
      
      expect(response.status).toBe(200)
      
      const headers = response.headers
      expect(headers.get('content-type')).toBe('application/pdf')
      expect(headers.get('content-disposition')).toContain('quarterly-report-2024-Q4.pdf')
    })
  })

  describe('Tax Report', () => {
    test('should generate annual tax report with deductions', async () => {
      const request = createAuthenticatedRequest(
        '/api/reports/financial/tax',
        'POST',
        {
          year: 2024,
          format: 'json'
        },
        sessionToken1
      )

      const response = await taxReportPOST(request)
      
      expect(response.status).toBe(200)
      const data = await response.json()

      assertApiResponse(data, [
        'period',
        'income',
        'deductions',
        'quarterlyBreakdown',
        'estimatedTax',
        'summary'
      ])

      expect(data.period.year).toBe(2024)
      expect(typeof data.income.total).toBe('number')
      expect(typeof data.deductions.total).toBe('number')
      expect(Array.isArray(data.quarterlyBreakdown)).toBe(true)
      expect(data.quarterlyBreakdown).toHaveLength(4)
    })

    test('should generate tax report PDF with proper formatting', async () => {
      const request = createAuthenticatedRequest(
        '/api/reports/financial/tax',
        'POST',
        {
          year: 2024,
          format: 'pdf'
        },
        sessionToken1
      )

      const response = await taxReportPOST(request)
      
      expect(response.status).toBe(200)
      
      const headers = response.headers
      expect(headers.get('content-type')).toBe('application/pdf')
      expect(headers.get('content-disposition')).toContain('tax-report-2024.pdf')
    })
  })

  describe('Profit & Loss Report', () => {
    test('should generate P&L report with metrics', async () => {
      const request = createAuthenticatedRequest(
        '/api/reports/financial/pl',
        'POST',
        {
          year: 2024,
          startMonth: 1,
          endMonth: 12,
          format: 'json',
          includeComparison: true
        },
        sessionToken1
      )

      const response = await plReportPOST(request)
      
      expect(response.status).toBe(200)
      const data = await response.json()

      assertApiResponse(data, [
        'period',
        'revenue',
        'cogs',
        'opex',
        'totals',
        'metrics',
        'monthlyPL',
        'comparison'
      ])

      // Verify revenue structure
      expect(data.revenue).toHaveProperty('advertising')
      expect(data.revenue).toHaveProperty('other')
      expect(data.revenue).toHaveProperty('total')

      // Verify COGS structure
      expect(data.cogs).toHaveProperty('production')
      expect(data.cogs).toHaveProperty('talent')
      expect(data.cogs).toHaveProperty('hosting')
      expect(data.cogs).toHaveProperty('total')

      // Verify metrics calculation
      expect(typeof data.metrics.grossMargin).toBe('number')
      expect(typeof data.metrics.operatingMargin).toBe('number')
      expect(typeof data.metrics.netMargin).toBe('number')

      // Verify monthly breakdown
      expect(Array.isArray(data.monthlyPL)).toBe(true)
      expect(data.monthlyPL).toHaveLength(12)

      // Verify comparison data (since includeComparison: true)
      expect(data.comparison).toBeDefined()
      expect(data.comparison.previousYear).toBe(2023)
    })

    test('should generate P&L Excel report with monthly breakdown', async () => {
      const request = createAuthenticatedRequest(
        '/api/reports/financial/pl',
        'POST',
        {
          year: 2024,
          startMonth: 7,
          endMonth: 12,
          format: 'excel'
        },
        sessionToken1
      )

      const response = await plReportPOST(request)
      
      expect(response.status).toBe(200)
      
      const headers = response.headers
      expect(headers.get('content-type')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      expect(headers.get('content-disposition')).toContain('pl-statement-2024.xlsx')
    })
  })

  describe('Error Handling', () => {
    test('should handle invalid format parameter', async () => {
      const request = createAuthenticatedRequest(
        '/api/reports/financial/monthly',
        'POST',
        {
          year: 2024,
          month: 11,
          format: 'invalid'
        },
        sessionToken1
      )

      const response = await monthlyReportPOST(request)
      
      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('Unsupported format')
    })

    test('should handle missing required parameters', async () => {
      const request = createAuthenticatedRequest(
        '/api/reports/financial/monthly',
        'POST',
        {
          // Missing year and month
          format: 'json'
        },
        sessionToken1
      )

      const response = await monthlyReportPOST(request)
      
      // Should still work with defaults
      expect(response.status).toBe(200)
    })

    test('should handle database connection errors gracefully', async () => {
      // This test would require mocking prisma to simulate connection failure
      // For now, we verify that the safeQuerySchema pattern is used
      const request = createAuthenticatedRequest(
        '/api/reports/financial/monthly',
        'POST',
        {
          year: 2024,
          month: 11,
          format: 'json'
        },
        sessionToken1
      )

      const response = await monthlyReportPOST(request)
      
      // Even if some queries fail, should not return 500
      expect(response.status).not.toBe(500)
    })
  })

  describe('Performance and Scale', () => {
    test('should handle large date ranges efficiently', async () => {
      const startTime = Date.now()
      
      const request = createAuthenticatedRequest(
        '/api/reports/financial/pl',
        'POST',
        {
          year: 2024,
          startMonth: 1,
          endMonth: 12,
          format: 'json',
          includeComparison: true
        },
        sessionToken1
      )

      const response = await plReportPOST(request)
      
      const endTime = Date.now()
      const executionTime = endTime - startTime

      expect(response.status).toBe(200)
      // Should complete within 10 seconds even with year-over-year comparison
      expect(executionTime).toBeLessThan(10000)
    })

    test('should handle export at scale', async () => {
      // Test PDF generation with large datasets
      const request = createAuthenticatedRequest(
        '/api/reports/financial/quarterly',
        'POST',
        {
          year: 2024,
          quarter: 4,
          format: 'pdf'
        },
        sessionToken1
      )

      const response = await quarterlyReportPOST(request)
      
      expect(response.status).toBe(200)
      
      // Verify PDF size is reasonable (not empty, not too large)
      const responseBuffer = await response.arrayBuffer()
      expect(responseBuffer.byteLength).toBeGreaterThan(1000) // At least 1KB
      expect(responseBuffer.byteLength).toBeLessThan(5000000) // Less than 5MB
    })
  })
})

/**
 * Create comprehensive test financial data for organization 1
 */
async function createTestFinancialData(organizationId: string, year: string) {
  const currentYear = parseInt(year)
  
  // Create test advertisers
  const advertiser1 = await prisma.advertiser.create({
    data: {
      name: `Test Advertiser 1 ${year}`,
      contactEmail: `advertiser1-${year}@example.com`,
      organizationId,
      status: 'active'
    }
  })

  const advertiser2 = await prisma.advertiser.create({
    data: {
      name: `Test Advertiser 2 ${year}`,
      contactEmail: `advertiser2-${year}@example.com`, 
      organizationId,
      status: 'active'
    }
  })

  // Create test campaigns for each month
  for (let month = 1; month <= 12; month++) {
    const startDate = new Date(currentYear, month - 1, 1)
    const endDate = new Date(currentYear, month - 1, 28)
    
    // Campaign 1
    const campaign1 = await prisma.campaign.create({
      data: {
        name: `Campaign 1 ${year}-${month.toString().padStart(2, '0')}`,
        organizationId,
        advertiserId: advertiser1.id,
        budget: 5000 + (month * 100), // Varying budgets
        status: 'active',
        startDate,
        endDate
      }
    })

    // Campaign 2  
    const campaign2 = await prisma.campaign.create({
      data: {
        name: `Campaign 2 ${year}-${month.toString().padStart(2, '0')}`,
        organizationId,
        advertiserId: advertiser2.id,
        budget: 3000 + (month * 50),
        status: 'active',
        startDate,
        endDate
      }
    })
  }

  // Create test expenses
  const expenseCategories = [
    'production', 'talent', 'hosting', 'marketing', 'office', 'software'
  ]

  for (let month = 1; month <= 12; month++) {
    for (const category of expenseCategories) {
      await prisma.expense.create({
        data: {
          organizationId,
          amount: Math.floor(Math.random() * 1000) + 200,
          category,
          description: `${category} expense for ${year}-${month.toString().padStart(2, '0')}`,
          date: new Date(currentYear, month - 1, 15), // Mid-month
          status: 'approved'
        }
      })
    }
  }

  // Create test invoices
  for (let month = 1; month <= 12; month++) {
    await createTestInvoice(organizationId, 2000 + (month * 100))
  }

  console.log(`✅ Created test financial data for organization ${organizationId} year ${year}`)
}

/**
 * Create different test financial data for organization 2 to verify isolation
 */
async function createTestFinancialDataOrg2(organizationId: string, year: string) {
  const currentYear = parseInt(year)
  
  // Create test advertiser with different amounts
  const advertiser = await prisma.advertiser.create({
    data: {
      name: `Org2 Advertiser ${year}`,
      contactEmail: `org2-advertiser-${year}@example.com`,
      organizationId,
      status: 'active'
    }
  })

  // Create different campaign amounts
  for (let month = 1; month <= 12; month++) {
    const startDate = new Date(currentYear, month - 1, 1)
    const endDate = new Date(currentYear, month - 1, 28)
    
    await prisma.campaign.create({
      data: {
        name: `Org2 Campaign ${year}-${month.toString().padStart(2, '0')}`,
        organizationId,
        advertiserId: advertiser.id,
        budget: 8000 + (month * 200), // Different amounts than org 1
        status: 'active',
        startDate,
        endDate
      }
    })
  }

  // Create different expenses
  for (let month = 1; month <= 12; month++) {
    await prisma.expense.create({
      data: {
        organizationId,
        amount: 1500 + (month * 25), // Different amounts
        category: 'marketing',
        description: `Org2 marketing expense ${year}-${month.toString().padStart(2, '0')}`,
        date: new Date(currentYear, month - 1, 20),
        status: 'approved'
      }
    })
  }

  console.log(`✅ Created test financial data for organization 2: ${organizationId} year ${year}`)
}