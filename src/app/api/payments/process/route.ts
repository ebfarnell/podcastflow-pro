import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import { paymentService } from '@/lib/payments/payment-service'
import { activityService } from '@/lib/activities/activity-service'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


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
    const {
      amount,
      currency = 'USD',
      description,
      invoiceId,
      campaignId,
      paymentMethodId
    } = body

    // Validate required fields
    if (!amount || !description || !paymentMethodId) {
      return NextResponse.json({ 
        error: 'Missing required fields: amount, description, paymentMethodId' 
      }, { status: 400 })
    }

    // Process the payment
    const result = await paymentService.processPayment({
      amount: parseFloat(amount),
      currency,
      description,
      organizationId: user.organizationId,
      invoiceId,
      campaignId,
      paymentMethodId,
      metadata: {
        processedBy: user.id,
        processedByName: user.name,
        processedByEmail: user.email
      }
    })

    if (result.success) {
      // Log activity
      await activityService.logActivity({
        type: 'payment',
        action: 'processed',
        title: 'Payment Processed',
        description: `Payment of $${amount} processed successfully`,
        actorId: user.id,
        actorName: user.name,
        actorEmail: user.email,
        actorRole: user.role,
        targetType: 'payment',
        targetId: result.paymentId,
        targetName: description,
        organizationId: user.organizationId,
        metadata: {
          amount,
          currency,
          transactionId: result.transactionId,
          campaignId,
          invoiceId
        }
      })

      return NextResponse.json({
        message: 'Payment processed successfully',
        paymentId: result.paymentId,
        transactionId: result.transactionId,
        status: result.status
      })
    } else {
      return NextResponse.json({
        error: result.error || 'Payment processing failed',
        errorCode: result.errorCode
      }, { status: 400 })
    }
  } catch (error) {
    console.error('Error processing payment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
