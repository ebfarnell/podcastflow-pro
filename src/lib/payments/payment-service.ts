import prisma from '@/lib/db/prisma'
import { Prisma } from '@prisma/client'
import { randomUUID } from 'crypto'

export interface PaymentMethodData {
  type: 'card' | 'ach' | 'wire'
  cardNumber?: string
  cardholderName?: string
  expiryMonth?: number
  expiryYear?: number
  cvv?: string
  accountNumber?: string
  routingNumber?: string
  accountName?: string
  billingAddress: {
    line1: string
    line2?: string
    city: string
    state: string
    postalCode: string
    country: string
  }
}

export interface PaymentData {
  amount: number
  currency: string
  description: string
  organizationId: string
  invoiceId?: string
  campaignId?: string
  paymentMethodId: string
  metadata?: any
}

export interface PaymentResult {
  success: boolean
  paymentId?: string
  transactionId?: string
  status?: string
  error?: string
  errorCode?: string
}

export class PaymentService {
  /**
   * Create a new payment method
   */
  async createPaymentMethod(
    organizationId: string,
    userId: string,
    data: PaymentMethodData
  ): Promise<any> {
    try {
      // Mask sensitive data
      let displayInfo = ''
      let maskedData: any = {}

      if (data.type === 'card' && data.cardNumber) {
        const last4 = data.cardNumber.slice(-4)
        displayInfo = `•••• ${last4}`
        maskedData = {
          last4,
          brand: this.detectCardBrand(data.cardNumber),
          expiryMonth: data.expiryMonth,
          expiryYear: data.expiryYear
        }
      } else if (data.type === 'ach' && data.accountNumber) {
        const last4 = data.accountNumber.slice(-4)
        displayInfo = `•••• ${last4}`
        maskedData = {
          last4,
          bankName: 'Bank Account'
        }
      } else if (data.type === 'wire') {
        displayInfo = 'Wire Transfer'
        maskedData = {
          accountName: data.accountName
        }
      }

      // Create payment method record
      const paymentMethod = await prisma.paymentMethod.create({
        data: {
          organizationId,
          type: data.type,
          displayInfo,
          isDefault: false,
          isActive: true,
          billingAddress: data.billingAddress,
          metadata: {
            ...maskedData,
            createdBy: userId
          }
        }
      })

      // If this is the first payment method, make it default
      const count = await prisma.paymentMethod.count({
        where: { organizationId, isActive: true }
      })

      if (count === 1) {
        await prisma.paymentMethod.update({
          where: { id: paymentMethod.id },
          data: { isDefault: true }
        })
      }

      console.log('💳 Payment method created:', paymentMethod.id)
      return paymentMethod
    } catch (error) {
      console.error('Error creating payment method:', error)
      throw error
    }
  }

  /**
   * Process a payment
   */
  async processPayment(data: PaymentData): Promise<PaymentResult> {
    try {
      // Get payment method
      const paymentMethod = await prisma.paymentMethod.findFirst({
        where: {
          id: data.paymentMethodId,
          organizationId: data.organizationId,
          isActive: true
        }
      })

      if (!paymentMethod) {
        return {
          success: false,
          error: 'Payment method not found',
          errorCode: 'PAYMENT_METHOD_NOT_FOUND'
        }
      }

      // Create payment record
      const payment = await prisma.payment.create({
        data: {
          organizationId: data.organizationId,
          paymentMethodId: data.paymentMethodId,
          amount: data.amount,
          currency: data.currency,
          status: 'processing',
          description: data.description,
          invoiceId: data.invoiceId,
          campaignId: data.campaignId,
          metadata: data.metadata || {}
        }
      })

      // Simulate payment processing
      // In production, this would integrate with Stripe, Square, etc.
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Generate transaction ID with crypto UUID
      const transactionId = `txn_${Date.now()}_${randomUUID().replace(/-/g, '').slice(0, 8)}`

      // Update payment status
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'completed',
          transactionId,
          processedAt: new Date(),
          metadata: {
            ...payment.metadata,
            processor: 'demo',
            processorResponse: 'Payment successful'
          }
        }
      })

      // If this payment is for an invoice, update invoice status
      if (data.invoiceId) {
        await prisma.invoice.update({
          where: { id: data.invoiceId },
          data: {
            status: 'paid',
            paidAt: new Date(),
            paymentId: payment.id
          }
        })
      }

      // If this payment is for a campaign, update campaign payment status
      if (data.campaignId) {
        await prisma.campaign.update({
          where: { id: data.campaignId },
          data: {
            paymentStatus: 'paid',
            paidAt: new Date()
          }
        })
      }

      console.log('💰 Payment processed successfully:', payment.id)

      return {
        success: true,
        paymentId: payment.id,
        transactionId,
        status: 'completed'
      }
    } catch (error) {
      console.error('Error processing payment:', error)
      return {
        success: false,
        error: 'Payment processing failed',
        errorCode: 'PAYMENT_FAILED'
      }
    }
  }

  /**
   * Get payment methods for an organization
   */
  async getPaymentMethods(organizationId: string) {
    return prisma.paymentMethod.findMany({
      where: {
        organizationId,
        isActive: true
      },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' }
      ]
    })
  }

  /**
   * Set default payment method
   */
  async setDefaultPaymentMethod(organizationId: string, paymentMethodId: string) {
    // First, unset all defaults
    await prisma.paymentMethod.updateMany({
      where: {
        organizationId,
        isDefault: true
      },
      data: { isDefault: false }
    })

    // Then set the new default
    return prisma.paymentMethod.update({
      where: {
        id: paymentMethodId,
        organizationId
      },
      data: { isDefault: true }
    })
  }

  /**
   * Delete (deactivate) a payment method
   */
  async deletePaymentMethod(organizationId: string, paymentMethodId: string) {
    // Don't delete, just deactivate
    const paymentMethod = await prisma.paymentMethod.update({
      where: {
        id: paymentMethodId,
        organizationId
      },
      data: {
        isActive: false,
        isDefault: false
      }
    })

    // If this was the default, set another as default
    if (paymentMethod.isDefault) {
      const nextDefault = await prisma.paymentMethod.findFirst({
        where: {
          organizationId,
          isActive: true
        },
        orderBy: { createdAt: 'desc' }
      })

      if (nextDefault) {
        await prisma.paymentMethod.update({
          where: { id: nextDefault.id },
          data: { isDefault: true }
        })
      }
    }

    return paymentMethod
  }

  /**
   * Get payment history
   */
  async getPaymentHistory(
    organizationId: string,
    options: {
      limit?: number
      offset?: number
      status?: string
      startDate?: Date
      endDate?: Date
    } = {}
  ) {
    const where: Prisma.PaymentWhereInput = {
      organizationId
    }

    if (options.status) {
      where.status = options.status
    }

    if (options.startDate || options.endDate) {
      where.createdAt = {}
      if (options.startDate) {
        where.createdAt.gte = options.startDate
      }
      if (options.endDate) {
        where.createdAt.lte = options.endDate
      }
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          paymentMethod: {
            select: {
              type: true,
              displayInfo: true
            }
          },
          invoice: {
            select: {
              invoiceNumber: true
            }
          },
          campaign: {
            select: {
              name: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: options.limit || 50,
        skip: options.offset || 0
      }),
      prisma.payment.count({ where })
    ])

    return { payments, total }
  }

  /**
   * Get payment summary
   */
  async getPaymentSummary(organizationId: string) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)

    const [
      totalPaid,
      pendingPayments,
      last30Days,
      previousMonth,
      failedPayments
    ] = await Promise.all([
      prisma.payment.aggregate({
        where: {
          organizationId,
          status: 'completed'
        },
        _sum: { amount: true }
      }),
      prisma.payment.aggregate({
        where: {
          organizationId,
          status: 'pending'
        },
        _sum: { amount: true }
      }),
      prisma.payment.aggregate({
        where: {
          organizationId,
          status: 'completed',
          createdAt: { gte: thirtyDaysAgo }
        },
        _sum: { amount: true }
      }),
      prisma.payment.aggregate({
        where: {
          organizationId,
          status: 'completed',
          createdAt: {
            gte: sixtyDaysAgo,
            lt: thirtyDaysAgo
          }
        },
        _sum: { amount: true }
      }),
      prisma.payment.count({
        where: {
          organizationId,
          status: 'failed',
          createdAt: { gte: thirtyDaysAgo }
        }
      })
    ])

    return {
      totalPaid: totalPaid._sum.amount || 0,
      pendingAmount: pendingPayments._sum.amount || 0,
      last30Days: last30Days._sum.amount || 0,
      previousMonth: previousMonth._sum.amount || 0,
      failedPayments,
      monthOverMonthGrowth: previousMonth._sum.amount
        ? ((last30Days._sum.amount || 0) - (previousMonth._sum.amount || 0)) / previousMonth._sum.amount * 100
        : 0
    }
  }

  /**
   * Detect card brand from number
   */
  private detectCardBrand(cardNumber: string): string {
    const cleanNumber = cardNumber.replace(/\s/g, '')
    
    if (/^4/.test(cleanNumber)) return 'Visa'
    if (/^5[1-5]/.test(cleanNumber)) return 'Mastercard'
    if (/^3[47]/.test(cleanNumber)) return 'American Express'
    if (/^6(?:011|5)/.test(cleanNumber)) return 'Discover'
    
    return 'Unknown'
  }

  /**
   * Validate payment method data
   */
  validatePaymentMethod(data: PaymentMethodData): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (data.type === 'card') {
      if (!data.cardNumber || !/^\d{13,19}$/.test(data.cardNumber.replace(/\s/g, ''))) {
        errors.push('Invalid card number')
      }
      if (!data.cardholderName) {
        errors.push('Cardholder name is required')
      }
      if (!data.expiryMonth || data.expiryMonth < 1 || data.expiryMonth > 12) {
        errors.push('Invalid expiry month')
      }
      if (!data.expiryYear || data.expiryYear < new Date().getFullYear()) {
        errors.push('Invalid expiry year')
      }
      if (!data.cvv || !/^\d{3,4}$/.test(data.cvv)) {
        errors.push('Invalid CVV')
      }
    } else if (data.type === 'ach') {
      if (!data.accountNumber || !/^\d{4,17}$/.test(data.accountNumber)) {
        errors.push('Invalid account number')
      }
      if (!data.routingNumber || !/^\d{9}$/.test(data.routingNumber)) {
        errors.push('Invalid routing number')
      }
      if (!data.accountName) {
        errors.push('Account name is required')
      }
    }

    // Validate billing address
    if (!data.billingAddress?.line1) errors.push('Address line 1 is required')
    if (!data.billingAddress?.city) errors.push('City is required')
    if (!data.billingAddress?.state) errors.push('State is required')
    if (!data.billingAddress?.postalCode) errors.push('Postal code is required')
    if (!data.billingAddress?.country) errors.push('Country is required')

    return {
      valid: errors.length === 0,
      errors
    }
  }
}

export const paymentService = new PaymentService()