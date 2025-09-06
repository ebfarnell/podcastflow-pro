import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { UserService } from '@/lib/auth/user-service'
import { InvoiceService } from '@/services/invoiceService'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


// POST /api/master/invoices/generate-monthly - Generate monthly subscription invoices
export async function POST(request: NextRequest) {
  try {
    // Check authentication and master role
    const cookieStore = cookies()
    const authToken = cookieStore.get('auth-token')

    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user || user.role !== 'master') {
      return NextResponse.json({ error: 'Unauthorized - Master access required' }, { status: 401 })
    }

    console.log('🏭 Generating monthly invoices...')

    const result = await InvoiceService.generateMonthlyInvoices()

    console.log(`✅ Invoice generation complete: ${result.created} created`)
    if (result.errors.length > 0) {
      console.warn('⚠️ Errors during generation:', result.errors)
    }

    return NextResponse.json({
      success: true,
      message: `Generated ${result.created} monthly invoices`,
      created: result.created,
      errors: result.errors
    })

  } catch (error) {
    console.error('❌ Error generating monthly invoices:', error)
    return NextResponse.json(
      { error: 'Failed to generate monthly invoices' },
      { status: 500 }
    )
  }
}
