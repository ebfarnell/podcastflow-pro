import { NextRequest, NextResponse } from 'next/server'
import { withApiProtection } from '@/lib/auth/api-protection'
import { comprehensiveQuickBooksService } from '@/lib/quickbooks/comprehensive-service'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


// GET /api/quickbooks/reports - Get QuickBooks reports
export const GET = await withApiProtection(async (
  request: NextRequest,
  context: any,
  { user, organization }
) => {
  try {
    // Check if user has appropriate permissions
    if (!user || !['master', 'admin'].includes(user.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const url = new URL(request.url)
    const reportName = url.searchParams.get('reportName')
    const startDate = url.searchParams.get('startDate')
    const endDate = url.searchParams.get('endDate')
    const asOfDate = url.searchParams.get('asOfDate')
    const accountingMethod = url.searchParams.get('accountingMethod') as 'Cash' | 'Accrual' | null
    const summarizeColumnBy = url.searchParams.get('summarizeColumnBy') as 'Days' | 'Weeks' | 'Months' | 'Quarters' | 'Years' | null
    const customer = url.searchParams.get('customer')
    const vendor = url.searchParams.get('vendor')
    const department = url.searchParams.get('department')
    const classParam = url.searchParams.get('class')

    // Validate required parameters
    if (!reportName) {
      return NextResponse.json(
        { error: 'reportName parameter is required' },
        { status: 400 }
      )
    }

    // Validate report name
    const validReports = [
      'BalanceSheet',
      'ProfitAndLoss',
      'CashFlow',
      'TrialBalance',
      'ARAgingSummary',
      'APAgingSummary',
      'InventoryValuationSummary',
      'GeneralLedger',
      'CustomerBalanceDetail',
      'VendorBalanceDetail',
      'ItemSales',
      'TaxSummary'
    ]

    if (!validReports.includes(reportName)) {
      return NextResponse.json(
        { error: `Invalid report name. Valid reports: ${validReports.join(', ')}` },
        { status: 400 }
      )
    }

    // Build report request
    const reportRequest: any = {
      reportName,
      accountingMethod: accountingMethod || 'Accrual'
    }

    // Date validation and assignment
    if (reportName === 'BalanceSheet') {
      if (asOfDate) {
        reportRequest.asOfDate = asOfDate
      } else {
        // Default to current date for balance sheet
        reportRequest.asOfDate = new Date().toISOString().split('T')[0]
      }
    } else {
      // For P&L and other period reports
      if (startDate && endDate) {
        reportRequest.startDate = startDate
        reportRequest.endDate = endDate
      } else if (startDate || endDate) {
        return NextResponse.json(
          { error: 'Both startDate and endDate are required for period reports' },
          { status: 400 }
        )
      } else {
        // Default to current year
        const currentYear = new Date().getFullYear()
        reportRequest.startDate = `${currentYear}-01-01`
        reportRequest.endDate = `${currentYear}-12-31`
      }
    }

    // Optional parameters
    if (summarizeColumnBy) {
      reportRequest.summarizeColumnBy = summarizeColumnBy
    }
    if (customer) {
      reportRequest.customer = customer
    }
    if (vendor) {
      reportRequest.vendor = vendor
    }
    if (department) {
      reportRequest.department = department
    }
    if (classParam) {
      reportRequest.class = classParam
    }

    const report = await comprehensiveQuickBooksService.getReport(organization.id, reportRequest)
    
    return NextResponse.json({
      success: true,
      report,
      reportName,
      parameters: reportRequest
    })

  } catch (error) {
    console.error('QuickBooks reports error:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('not found') || error.message.includes('not connected')) {
        return NextResponse.json(
          { error: 'QuickBooks integration not found or not connected' },
          { status: 404 }
        )
      }
      
      if (error.message.includes('token') || error.message.includes('unauthorized')) {
        return NextResponse.json(
          { error: 'QuickBooks authentication failed. Please reconnect.' },
          { status: 401 }
        )
      }
      
      if (error.message.includes('date') || error.message.includes('invalid')) {
        return NextResponse.json(
          { error: 'Invalid date format. Use YYYY-MM-DD format.' },
          { status: 400 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Failed to generate report from QuickBooks' },
      { status: 500 }
    )
  }
}, ['QUICKBOOKS_READ'])

// POST /api/quickbooks/reports - Generate custom report with advanced options
export const POST = await withApiProtection(async (
  request: NextRequest,
  context: any,
  { user, organization }
) => {
  try {
    // Check if user has appropriate permissions
    if (!user || !['master', 'admin'].includes(user.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const body = await request.json()
    
    // Validate required fields
    if (!body.reportName) {
      return NextResponse.json(
        { error: 'reportName is required' },
        { status: 400 }
      )
    }

    const report = await comprehensiveQuickBooksService.getReport(organization.id, body)
    
    return NextResponse.json({
      success: true,
      report,
      parameters: body
    })

  } catch (error) {
    console.error('QuickBooks custom report error:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('not found') || error.message.includes('not connected')) {
        return NextResponse.json(
          { error: 'QuickBooks integration not found or not connected' },
          { status: 404 }
        )
      }
      
      if (error.message.includes('token') || error.message.includes('unauthorized')) {
        return NextResponse.json(
          { error: 'QuickBooks authentication failed. Please reconnect.' },
          { status: 401 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Failed to generate custom report from QuickBooks' },
      { status: 500 }
    )
  }
}, ['QUICKBOOKS_READ'])
