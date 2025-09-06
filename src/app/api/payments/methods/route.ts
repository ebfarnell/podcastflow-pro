import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import { paymentService } from '@/lib/payments/payment-service'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


export async function GET(request: NextRequest) {
  try {
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const paymentMethods = await paymentService.getPaymentMethods(user.organizationId)

    return NextResponse.json({ paymentMethods })
  } catch (error) {
    console.error('Error fetching payment methods:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Validate payment method data
    const validation = paymentService.validatePaymentMethod(body)
    if (!validation.valid) {
      return NextResponse.json({ 
        error: 'Invalid payment method data',
        errors: validation.errors 
      }, { status: 400 })
    }

    const paymentMethod = await paymentService.createPaymentMethod(
      user.organizationId,
      user.id,
      body
    )

    return NextResponse.json({ 
      message: 'Payment method created successfully',
      paymentMethod 
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating payment method:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
