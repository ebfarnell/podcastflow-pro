import { NextRequest, NextResponse } from 'next/server'
import { withApiProtection } from '@/lib/auth/api-protection'
import { comprehensiveQuickBooksService } from '@/lib/quickbooks/comprehensive-service'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


// GET /api/quickbooks/customers - Get customers
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

    const customers = await comprehensiveQuickBooksService.getCustomers(organization.id)
    
    return NextResponse.json({
      success: true,
      customers
    })

  } catch (error) {
    console.error('QuickBooks customers error:', error)
    
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
      { error: 'Failed to fetch customers from QuickBooks' },
      { status: 500 }
    )
  }
}, ['QUICKBOOKS_READ'])

// POST /api/quickbooks/customers - Create new customer
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
    if (!body.Name && !body.CompanyName) {
      return NextResponse.json(
        { error: 'Name or CompanyName is required' },
        { status: 400 }
      )
    }

    const customer = await comprehensiveQuickBooksService.createCustomer(organization.id, body)
    
    return NextResponse.json({
      success: true,
      customer
    })

  } catch (error) {
    console.error('QuickBooks create customer error:', error)
    
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
      { error: 'Failed to create customer in QuickBooks' },
      { status: 500 }
    )
  }
}, ['QUICKBOOKS_WRITE'])
