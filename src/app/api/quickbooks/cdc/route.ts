import { NextRequest, NextResponse } from 'next/server'
import { withApiProtection } from '@/lib/auth/api-protection'
import { comprehensiveQuickBooksService } from '@/lib/quickbooks/comprehensive-service'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


// GET /api/quickbooks/cdc - Change Data Capture (incremental sync)
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
    const entities = url.searchParams.get('entities')
    const changedSince = url.searchParams.get('changedSince')

    // Validate required parameters
    if (!entities) {
      return NextResponse.json(
        { error: 'entities parameter is required (comma-separated list)' },
        { status: 400 }
      )
    }

    if (!changedSince) {
      return NextResponse.json(
        { error: 'changedSince parameter is required (ISO 8601 date)' },
        { status: 400 }
      )
    }

    // Validate date format
    const changedSinceDate = new Date(changedSince)
    if (isNaN(changedSinceDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid changedSince date format. Use ISO 8601 format (YYYY-MM-DDTHH:mm:ssZ)' },
        { status: 400 }
      )
    }

    // Validate entities list
    const entityList = entities.split(',').map(e => e.trim())
    const validEntities = [
      'Account', 'Customer', 'Vendor', 'Item', 'Invoice', 'Bill', 'Payment',
      'Employee', 'Class', 'Department', 'TaxCode', 'TaxRate', 'Term',
      'PaymentMethod', 'TimeActivity', 'Transfer', 'Deposit', 'Purchase',
      'PurchaseOrder', 'Estimate', 'CreditMemo', 'RefundReceipt', 'SalesReceipt',
      'JournalEntry', 'VendorCredit', 'BillPayment', 'Budget', 'ExchangeRate'
    ]

    const invalidEntities = entityList.filter(entity => !validEntities.includes(entity))
    if (invalidEntities.length > 0) {
      return NextResponse.json(
        { 
          error: `Invalid entities: ${invalidEntities.join(', ')}`,
          validEntities 
        },
        { status: 400 }
      )
    }

    // Execute CDC request
    const cdcRequest = {
      entities: entityList,
      changedSince
    }

    const changedData = await comprehensiveQuickBooksService.getChangedEntities(
      organization.id,
      cdcRequest
    )

    // Process and summarize the response
    const summary = {
      requestTimestamp: new Date().toISOString(),
      changedSince,
      entitiesRequested: entityList,
      totalChanges: 0,
      changesByEntity: {} as Record<string, number>
    }

    // Count changes by entity type
    if (changedData.CDCResponse) {
      for (const response of changedData.CDCResponse) {
        for (const entity of entityList) {
          if (response[entity]) {
            const count = Array.isArray(response[entity]) ? response[entity].length : 1
            summary.changesByEntity[entity] = count
            summary.totalChanges += count
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: changedData,
      summary,
      request: cdcRequest
    })

  } catch (error) {
    console.error('QuickBooks CDC error:', error)
    
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
          { error: 'Invalid date format or date range. Please check your changedSince parameter.' },
          { status: 400 }
        )
      }

      if (error.message.includes('rate limit') || error.message.includes('throttle')) {
        return NextResponse.json(
          { error: 'Rate limit exceeded. Please try again later.' },
          { status: 429 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Failed to retrieve changed data from QuickBooks' },
      { status: 500 }
    )
  }
}, ['QUICKBOOKS_READ'])

// POST /api/quickbooks/cdc - Trigger incremental sync based on CDC
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
    
    // Validate request body
    if (!body.entities || !Array.isArray(body.entities) || body.entities.length === 0) {
      return NextResponse.json(
        { error: 'entities array is required' },
        { status: 400 }
      )
    }

    if (!body.changedSince) {
      return NextResponse.json(
        { error: 'changedSince is required' },
        { status: 400 }
      )
    }

    // Get changed entities
    const changedData = await comprehensiveQuickBooksService.getChangedEntities(
      organization.id,
      body
    )

    // Create sync job for the detected changes
    const syncJob = await prisma.quickBooksSync.create({
      data: {
        organizationId: organization.id,
        syncType: 'incremental',
        status: 'completed',
        startedAt: new Date(),
        completedAt: new Date(),
        createdBy: user.id,
        errors: {
          cdcRequest: body,
          cdcResponse: changedData,
          processedAt: new Date().toISOString()
        }
      }
    })

    return NextResponse.json({
      success: true,
      syncJobId: syncJob.id,
      changedData,
      request: body
    })

  } catch (error) {
    console.error('QuickBooks CDC sync error:', error)
    
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
      { error: 'Failed to process incremental sync' },
      { status: 500 }
    )
  }
}, ['QUICKBOOKS_WRITE'])
