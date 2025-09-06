import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { UserService } from '@/lib/auth/user-service'
import { generateMonthlyInvoices, checkOverdueInvoices, generateInvoiceForOrganization } from '@/lib/billing/invoice-generator'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


// POST /api/master/invoices/generate - Generate invoices
export async function POST(request: NextRequest) {
  try {
    // Check authentication and master role only
    const cookieStore = cookies()
    const authToken = cookieStore.get('auth-token')

    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user || user.role !== 'master') {
      return NextResponse.json({ error: 'Unauthorized - Master role required' }, { status: 401 })
    }

    const body = await request.json()
    const { action, organizationId, options } = body

    switch (action) {
      case 'generate-monthly':
        // Generate monthly invoices for all organizations
        const monthlyResult = await generateMonthlyInvoices()
        return NextResponse.json({
          success: true,
          ...monthlyResult
        })

      case 'check-overdue':
        // Check and update overdue invoices
        const overdueResult = await checkOverdueInvoices()
        return NextResponse.json({
          success: true,
          ...overdueResult
        })

      case 'generate-single':
        // Generate invoice for a specific organization
        if (!organizationId) {
          return NextResponse.json(
            { error: 'organizationId is required for single invoice generation' },
            { status: 400 }
          )
        }
        
        const invoice = await generateInvoiceForOrganization(organizationId, options)
        return NextResponse.json({
          success: true,
          invoice
        })

      default:
        return NextResponse.json(
          { error: 'Invalid action. Valid actions: generate-monthly, check-overdue, generate-single' },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('❌ Invoice generation API error:', error)
    return NextResponse.json(
      { error: 'Failed to generate invoices' },
      { status: 500 }
    )
  }
}
