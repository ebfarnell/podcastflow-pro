import { NextRequest, NextResponse } from 'next/server'
import { withApiProtection } from '@/lib/auth/api-protection'
import { comprehensiveQuickBooksService } from '@/lib/quickbooks/comprehensive-service'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


// GET /api/quickbooks/invoices - Get invoices
export const GET = await withApiProtection(async (
  request: NextRequest,
  context: any,
  { user, organization }
) => {
  try {
    // Check if user has appropriate permissions
    if (!user || !['master', 'admin', 'sales'].includes(user.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const url = new URL(request.url)
    const startPosition = parseInt(url.searchParams.get('startPosition') || '1')
    const maxResults = parseInt(url.searchParams.get('maxResults') || '100')
    const customerId = url.searchParams.get('customerId')
    const startDate = url.searchParams.get('startDate')
    const endDate = url.searchParams.get('endDate')

    // Build query filters
    let query = 'SELECT * FROM Invoice'
    const conditions: string[] = []

    if (customerId) {
      conditions.push(`CustomerRef = '${customerId}'`)
    }

    if (startDate && endDate) {
      conditions.push(`TxnDate >= '${startDate}' AND TxnDate <= '${endDate}'`)
    } else if (startDate) {
      conditions.push(`TxnDate >= '${startDate}'`)
    } else if (endDate) {
      conditions.push(`TxnDate <= '${endDate}'`)
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`
    }

    query += ` ORDER BY TxnDate DESC STARTPOSITION ${startPosition} MAXRESULTS ${maxResults}`

    const response = await comprehensiveQuickBooksService.queryEntities(organization.id, query)
    
    return NextResponse.json({
      success: true,
      invoices: response.QueryResponse?.Invoice || [],
      startPosition: response.QueryResponse?.startPosition || startPosition,
      maxResults: response.QueryResponse?.maxResults || maxResults,
      totalCount: response.QueryResponse?.totalCount
    })

  } catch (error) {
    console.error('QuickBooks invoices error:', error)
    
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
      { error: 'Failed to fetch invoices from QuickBooks' },
      { status: 500 }
    )
  }
}, ['QUICKBOOKS_READ'])

// POST /api/quickbooks/invoices - Create new invoice
export const POST = await withApiProtection(async (
  request: NextRequest,
  context: any,
  { user, organization }
) => {
  try {
    // Check if user has appropriate permissions
    if (!user || !['master', 'admin', 'sales'].includes(user.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const body = await request.json()
    
    // Validate required fields
    if (!body.CustomerRef || !body.Line || !Array.isArray(body.Line) || body.Line.length === 0) {
      return NextResponse.json(
        { error: 'CustomerRef and at least one Line item are required' },
        { status: 400 }
      )
    }

    // Validate line items
    for (const line of body.Line) {
      if (!line.Amount || !line.DetailType) {
        return NextResponse.json(
          { error: 'Each line item must have Amount and DetailType' },
          { status: 400 }
        )
      }
      
      if (line.DetailType === 'SalesItemLineDetail' && !line.SalesItemLineDetail?.ItemRef) {
        return NextResponse.json(
          { error: 'SalesItemLineDetail requires ItemRef' },
          { status: 400 }
        )
      }
    }

    const invoice = await comprehensiveQuickBooksService.createInvoice(organization.id, body)
    
    return NextResponse.json({
      success: true,
      invoice
    })

  } catch (error) {
    console.error('QuickBooks create invoice error:', error)
    
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
      
      if (error.message.includes('validation') || error.message.includes('required')) {
        return NextResponse.json(
          { error: 'Invalid invoice data. Please check all required fields.' },
          { status: 400 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Failed to create invoice in QuickBooks' },
      { status: 500 }
    )
  }
}, ['QUICKBOOKS_WRITE'])
