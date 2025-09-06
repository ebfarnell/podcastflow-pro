import { NextRequest, NextResponse } from 'next/server'
import { withApiProtection } from '@/lib/auth/api-protection'
import { comprehensiveQuickBooksService } from '@/lib/quickbooks/comprehensive-service'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


// GET /api/quickbooks/customers/[id] - Get specific customer
export const GET = await withApiProtection(async (
  request: NextRequest,
  { params }: { params: { id: string } },
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

    const customer = await comprehensiveQuickBooksService.getEntity(
      organization.id, 
      'Customer', 
      params.id
    )
    
    return NextResponse.json({
      success: true,
      customer
    })

  } catch (error) {
    console.error('QuickBooks get customer error:', error)
    
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
      { error: 'Failed to fetch customer from QuickBooks' },
      { status: 500 }
    )
  }
}, ['QUICKBOOKS_READ'])

// PUT /api/quickbooks/customers/[id] - Update customer
export const PUT = await withApiProtection(async (
  request: NextRequest,
  { params }: { params: { id: string } },
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
    
    // Ensure ID is included in the update
    body.Id = params.id

    // Validate required fields for update
    if (!body.SyncToken) {
      return NextResponse.json(
        { error: 'SyncToken is required for updates' },
        { status: 400 }
      )
    }

    const customer = await comprehensiveQuickBooksService.updateCustomer(organization.id, body)
    
    return NextResponse.json({
      success: true,
      customer
    })

  } catch (error) {
    console.error('QuickBooks update customer error:', error)
    
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
      
      if (error.message.includes('stale') || error.message.includes('sync')) {
        return NextResponse.json(
          { error: 'Customer data is stale. Please refresh and try again.' },
          { status: 409 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Failed to update customer in QuickBooks' },
      { status: 500 }
    )
  }
}, ['QUICKBOOKS_WRITE'])
