import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { UserService } from '@/lib/auth/user-service'
import prisma from '@/lib/db/prisma'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


// GET /api/master/payments/[id] - Get specific payment
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Check authentication
    const cookieStore = cookies()
    const authToken = cookieStore.get('auth-token')

    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user || (user.role !== 'master' && user.role !== 'admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const paymentId = params.id

    // Get payment with related data
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        invoice: {
          include: {
            organization: true
          }
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      payment
    })

  } catch (error) {
    console.error('❌ Master payment GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch payment' },
      { status: 500 }
    )
  }
}

// PUT /api/master/payments/[id] - Update payment
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Check authentication
    const cookieStore = cookies()
    const authToken = cookieStore.get('auth-token')

    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user || (user.role !== 'master' && user.role !== 'admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const paymentId = params.id
    const body = await request.json()
    
    console.log('✏️ Updating payment:', paymentId, 'with data:', body)

    // Build update data
    const updateData: any = {}
    
    // Only update fields that were provided
    if (body.status !== undefined) {
      updateData.status = body.status
      
      // Update processedDate based on status
      if (body.status === 'completed' && !body.processedDate) {
        updateData.processedDate = new Date()
      } else if (body.status !== 'completed') {
        updateData.processedDate = null
      }
    }
    
    if (body.transactionId !== undefined) updateData.transactionId = body.transactionId
    if (body.notes !== undefined) updateData.notes = body.notes
    if (body.processorFee !== undefined) {
      updateData.processorFee = body.processorFee ? parseFloat(body.processorFee) : null
      
      // Recalculate net amount if processor fee changed
      const payment = await prisma.payment.findUnique({ where: { id: paymentId } })
      if (payment) {
        updateData.netAmount = payment.amount - (body.processorFee || 0)
      }
    }

    // Update the payment
    const updatedPayment = await prisma.payment.update({
      where: { id: paymentId },
      data: updateData,
      include: {
        invoice: {
          include: {
            organization: true,
            payments: true
          }
        }
      }
    })

    // Check if we need to update invoice status
    if (body.status === 'completed' || body.status === 'failed') {
      const invoice = updatedPayment.invoice
      const completedPayments = invoice.payments
        .filter(p => p.status === 'completed')
        .reduce((sum, p) => sum + p.amount, 0)

      let newInvoiceStatus = invoice.status
      let paidDate = invoice.paidDate

      if (completedPayments >= invoice.totalAmount) {
        newInvoiceStatus = 'paid'
        paidDate = new Date()
      } else if (completedPayments > 0) {
        newInvoiceStatus = 'partial'
      } else if (invoice.dueDate < new Date() && newInvoiceStatus === 'pending') {
        newInvoiceStatus = 'overdue'
      }

      if (newInvoiceStatus !== invoice.status) {
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            status: newInvoiceStatus,
            paidDate: newInvoiceStatus === 'paid' ? paidDate : null
          }
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Payment updated successfully',
      payment: updatedPayment
    })

  } catch (error) {
    console.error('❌ Master payment PUT error:', error)
    return NextResponse.json(
      { error: 'Failed to update payment' },
      { status: 500 }
    )
  }
}

// DELETE /api/master/payments/[id] - Delete payment (soft delete by changing status)
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Check authentication - only master can delete
    const cookieStore = cookies()
    const authToken = cookieStore.get('auth-token')

    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user || user.role !== 'master') {
      return NextResponse.json({ error: 'Unauthorized - Master role required' }, { status: 401 })
    }

    const paymentId = params.id

    // Update payment status to cancelled instead of hard delete
    const payment = await prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'cancelled' },
      include: {
        invoice: {
          include: {
            payments: true
          }
        }
      }
    })

    // Recalculate invoice status
    const completedPayments = payment.invoice.payments
      .filter(p => p.status === 'completed')
      .reduce((sum, p) => sum + p.amount, 0)

    let newInvoiceStatus = 'pending'
    if (completedPayments >= payment.invoice.totalAmount) {
      newInvoiceStatus = 'paid'
    } else if (completedPayments > 0) {
      newInvoiceStatus = 'partial'
    } else if (payment.invoice.dueDate < new Date()) {
      newInvoiceStatus = 'overdue'
    }

    await prisma.invoice.update({
      where: { id: payment.invoice.id },
      data: {
        status: newInvoiceStatus,
        paidDate: newInvoiceStatus === 'paid' ? payment.invoice.paidDate : null
      }
    })

    console.log('✅ Payment cancelled:', paymentId)

    return NextResponse.json({
      success: true,
      message: 'Payment cancelled successfully',
      paymentId
    })

  } catch (error) {
    console.error('❌ Master payment DELETE error:', error)
    return NextResponse.json(
      { error: 'Failed to cancel payment' },
      { status: 500 }
    )
  }
}
