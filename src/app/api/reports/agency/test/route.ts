import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { safeQuerySchema } from '@/lib/db/schema-db'
import prisma from '@/lib/db/prisma'
import {
  fetchAgencyData,
  checkSalesUserAccess,
  fetchAdvertisers,
  fetchCampaigns,
  fetchBudgets,
  fetchWeeklySpots,
  fetchLineItems,
  processMonthlyData,
  processWeeklyData,
  generateSummaryJson,
  generateMonthlyCSV,
  generateWeeklyCSV,
  generateCampaignsCSV,
  generateLineItemsCSV,
} from '@/lib/reports/agency'

interface TestResult {
  function: string
  status: 'success' | 'error'
  message: string
  data?: any
  error?: string
}

export async function GET(request: NextRequest) {
  const results: TestResult[] = []
  
  try {
    // Get session for testing
    const sessionData = await getSessionFromCookie(request)
    if (!sessionData) {
      return NextResponse.json(
        { error: 'Unauthorized - Please login first' },
        { status: 401 }
      )
    }

    const organizationId = sessionData.organizationId
    const organizationSlug = sessionData.organizationSlug
    const userId = sessionData.userId
    const role = sessionData.role

    // Get org slug if not in session
    let orgSlug = organizationSlug
    if (!orgSlug && organizationId) {
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { slug: true }
      })
      orgSlug = org?.slug || null
    }

    if (!orgSlug) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 400 }
      )
    }

    // Test dates
    const endDate = new Date()
    const startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 11, 1)

    // Test 1: Fetch Agency Data
    try {
      // First get an agency ID to test with
      const { data: agencies } = await safeQuerySchema<any>(
        orgSlug,
        `SELECT id, name FROM "Agency" LIMIT 1`,
        []
      )
      
      if (agencies && agencies.length > 0) {
        const testAgencyId = agencies[0].id
        const agencyResult = await fetchAgencyData(orgSlug, testAgencyId)
        
        results.push({
          function: 'fetchAgencyData',
          status: agencyResult.error ? 'error' : 'success',
          message: agencyResult.error || 'Successfully fetched agency data',
          data: agencyResult.data ? { id: agencyResult.data.id, name: agencyResult.data.name } : null,
          error: agencyResult.error || undefined
        })

        // Test subsequent functions only if we have an agency
        if (agencyResult.data) {
          const agencyId = agencyResult.data.id

          // Test 2: Check Sales User Access
          if (role === 'sales') {
            try {
              const hasAccess = await checkSalesUserAccess(orgSlug, agencyId, userId)
              results.push({
                function: 'checkSalesUserAccess',
                status: 'success',
                message: `Access check completed: ${hasAccess ? 'granted' : 'denied'}`,
                data: { hasAccess }
              })
            } catch (error: any) {
              results.push({
                function: 'checkSalesUserAccess',
                status: 'error',
                message: 'Failed to check user access',
                error: error.message
              })
            }
          }

          // Test 3: Fetch Advertisers
          try {
            const advertisersResult = await fetchAdvertisers(orgSlug, agencyId)
            results.push({
              function: 'fetchAdvertisers',
              status: advertisersResult.error ? 'error' : 'success',
              message: advertisersResult.error || `Found ${advertisersResult.data.length} advertisers`,
              data: { count: advertisersResult.data.length },
              error: advertisersResult.error || undefined
            })

            const advertiserIds = advertisersResult.data.map(a => a.id)

            // Test 4: Fetch Campaigns
            try {
              const campaignsResult = await fetchCampaigns(orgSlug, advertiserIds, startDate, endDate)
              results.push({
                function: 'fetchCampaigns',
                status: campaignsResult.error ? 'error' : 'success',
                message: campaignsResult.error || `Found ${campaignsResult.data.length} campaigns`,
                data: { count: campaignsResult.data.length },
                error: campaignsResult.error || undefined
              })
            } catch (error: any) {
              results.push({
                function: 'fetchCampaigns',
                status: 'error',
                message: 'Failed to fetch campaigns',
                error: error.message
              })
            }

            // Test 5: Fetch Budgets
            try {
              const budgetsResult = await fetchBudgets(orgSlug, agencyId, advertiserIds, startDate, endDate)
              results.push({
                function: 'fetchBudgets',
                status: budgetsResult.error ? 'error' : 'success',
                message: budgetsResult.error || `Found ${budgetsResult.data.length} budget entries`,
                data: { count: budgetsResult.data.length },
                error: budgetsResult.error || undefined
              })

              // Test 6: Process Monthly Data
              if (budgetsResult.data.length > 0) {
                try {
                  const monthlyData = processMonthlyData(budgetsResult.data)
                  results.push({
                    function: 'processMonthlyData',
                    status: 'success',
                    message: `Processed ${monthlyData.length} monthly entries`,
                    data: { count: monthlyData.length }
                  })
                } catch (error: any) {
                  results.push({
                    function: 'processMonthlyData',
                    status: 'error',
                    message: 'Failed to process monthly data',
                    error: error.message
                  })
                }
              }
            } catch (error: any) {
              results.push({
                function: 'fetchBudgets',
                status: 'error',
                message: 'Failed to fetch budgets',
                error: error.message
              })
            }

            // Test 7: Fetch Weekly Spots
            if (advertiserIds.length > 0) {
              try {
                const weeklyResult = await fetchWeeklySpots(orgSlug, advertiserIds, startDate, endDate)
                results.push({
                  function: 'fetchWeeklySpots',
                  status: weeklyResult.error ? 'error' : 'success',
                  message: weeklyResult.error || `Found ${weeklyResult.data.length} weekly entries`,
                  data: { count: weeklyResult.data.length },
                  error: weeklyResult.error || undefined
                })
              } catch (error: any) {
                results.push({
                  function: 'fetchWeeklySpots',
                  status: 'error',
                  message: 'Failed to fetch weekly spots',
                  error: error.message
                })
              }

              // Test 8: Fetch Line Items
              try {
                const lineItemsResult = await fetchLineItems(orgSlug, advertiserIds, startDate, endDate)
                results.push({
                  function: 'fetchLineItems',
                  status: lineItemsResult.error ? 'error' : 'success',
                  message: lineItemsResult.error || `Found ${lineItemsResult.data.length} line items`,
                  data: { count: lineItemsResult.data.length },
                  error: lineItemsResult.error || undefined
                })
              } catch (error: any) {
                results.push({
                  function: 'fetchLineItems',
                  status: 'error',
                  message: 'Failed to fetch line items',
                  error: error.message
                })
              }
            }

          } catch (error: any) {
            results.push({
              function: 'fetchAdvertisers',
              status: 'error',
              message: 'Failed to fetch advertisers',
              error: error.message
            })
          }
        }
      } else {
        results.push({
          function: 'fetchAgencyData',
          status: 'error',
          message: 'No agencies found in the organization',
          error: 'No test data available'
        })
      }
    } catch (error: any) {
      results.push({
        function: 'fetchAgencyData',
        status: 'error',
        message: 'Failed to fetch test agency',
        error: error.message
      })
    }

    // Test 9: CSV Generation Functions (with dummy data)
    try {
      const dummyMonthlyData = [{
        month: '2025-01',
        year: 2025,
        monthNumber: 1,
        goal: 10000,
        actual: 9500,
        advertiserCount: 3,
        variance: -500,
        percentToGoal: 95
      }]
      const csv = generateMonthlyCSV(dummyMonthlyData)
      results.push({
        function: 'generateMonthlyCSV',
        status: 'success',
        message: 'CSV generation function works',
        data: { lines: csv.split('\n').length }
      })
    } catch (error: any) {
      results.push({
        function: 'generateMonthlyCSV',
        status: 'error',
        message: 'CSV generation failed',
        error: error.message
      })
    }

    // Calculate summary
    const successCount = results.filter(r => r.status === 'success').length
    const errorCount = results.filter(r => r.status === 'error').length

    return NextResponse.json({
      summary: {
        total: results.length,
        success: successCount,
        errors: errorCount,
        allPassed: errorCount === 0
      },
      results,
      metadata: {
        organizationId,
        orgSlug,
        userId,
        role,
        testedAt: new Date().toISOString()
      }
    })

  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Test execution failed',
        message: error.message,
        results
      },
      { status: 500 }
    )
  }
}