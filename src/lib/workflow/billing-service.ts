import { safeQuerySchema } from '@/lib/db/schema-db'
import { calculateDueDate, formatCurrency } from '@/lib/utils/contract-utils'
import { addMonths, setDate, isAfter, isBefore, startOfDay } from 'date-fns'

export interface InvoiceGenerationData {
  orderId: string
  lineItems?: string[]
  billingPeriod?: string
  dueDate?: Date
  notes?: string
}

export interface PreBillCheckResult {
  required: boolean
  reason?: string
  thresholdAmount?: number
  advertiserId: string
}

export class BillingService {
  async checkPreBillRequirements(
    orgSlug: string,
    advertiserId: string,
    orderAmount: number
  ): Promise<PreBillCheckResult> {
    try {
      const { data } = await safeQuerySchema(orgSlug,
        `SELECT check_prebill_requirements($1, $2, $3) as result`,
        [orgSlug, advertiserId, orderAmount]
      )

      if (!data || !data[0]?.result) {
        return {
          required: false,
          advertiserId
        }
      }

      return {
        ...data[0].result,
        advertiserId
      }
    } catch (error) {
      console.error('Pre-bill check error:', error)
      return {
        required: false,
        advertiserId
      }
    }
  }

  async flagAdvertiserForPreBill(
    orgSlug: string,
    advertiserId: string,
    reason: string,
    flaggedById: string,
    notes?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: advertiser } = await safeQuerySchema(orgSlug, async (db) => {
        return db.advertiser.findUnique({
          where: { id: advertiserId },
          select: { organizationId: true }
        })
      })

      if (!advertiser) {
        return { success: false, error: 'Advertiser not found' }
      }

      const { error } = await safeQuerySchema(orgSlug, async (db) => {
        await db.preBillAdvertiser.upsert({
          where: {
            organizationId_advertiserId: {
              organizationId: advertiser.organizationId,
              advertiserId
            }
          },
          update: {
            reason,
            notes,
            isActive: true,
            updatedAt: new Date()
          },
          create: {
            organizationId: advertiser.organizationId,
            advertiserId,
            reason,
            flaggedById,
            notes,
            isActive: true
          }
        })
      })

      if (error) {
        return { success: false, error: 'Failed to flag advertiser' }
      }

      return { success: true }
    } catch (error) {
      console.error('Flag advertiser error:', error)
      return { success: false, error: error.message || 'Failed to flag advertiser' }
    }
  }

  async generateInvoice(
    orgSlug: string,
    data: InvoiceGenerationData
  ): Promise<{ success: boolean; invoiceId?: string; error?: string }> {
    try {
      // Get order details
      const { data: order, error: orderError } = await safeQuerySchema(orgSlug, async (db) => {
        return db.order.findUnique({
          where: { id: data.orderId },
          include: {
            advertiser: true,
            campaign: true,
            lineItems: data.lineItems ? {
              where: { id: { in: data.lineItems } }
            } : true
          }
        })
      })

      if (orderError || !order) {
        return { success: false, error: 'Order not found' }
      }

      // Get billing settings
      const { data: settings } = await safeQuerySchema(orgSlug, async (db) => {
        return db.billingSettings.findUnique({
          where: { organizationId: order.organizationId }
        })
      })

      // Generate invoice number
      const invoiceNumber = await this.generateInvoiceNumber(orgSlug, settings?.invoicePrefix || 'INV')

      // Calculate amounts
      const lineItemsTotal = order.lineItems.reduce((sum, item) => sum + item.rate, 0)
      const taxAmount = 0 // TODO: Implement tax calculation based on location
      const totalAmount = lineItemsTotal + taxAmount - (order.discountAmount || 0)

      // Create invoice
      const { data: invoice, error: invoiceError } = await safeQuerySchema(orgSlug, async (db) => {
        return db.invoice.create({
          data: {
            invoiceNumber,
            organizationId: order.organizationId,
            amount: lineItemsTotal,
            description: `Invoice for ${order.campaign?.name || order.name}`,
            billingPeriod: data.billingPeriod || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
            plan: 'custom',
            issueDate: new Date(),
            dueDate: data.dueDate || calculateDueDate(new Date(), order.paymentTerms || 'Net 30'),
            taxAmount,
            discountAmount: order.discountAmount || 0,
            totalAmount,
            notes: data.notes,
            status: 'pending'
          }
        })
      })

      if (invoiceError || !invoice) {
        return { success: false, error: 'Failed to create invoice' }
      }

      // Create invoice items
      const invoiceItems = order.lineItems.map(item => ({
        invoiceId: invoice.id,
        orderId: order.id,
        description: `${item.placementType} - ${item.showName || 'Show'} - ${new Date(item.airDate).toLocaleDateString()}`,
        quantity: 1,
        unitPrice: item.rate,
        amount: item.rate
      }))

      await safeQuerySchema(orgSlug, async (db) => {
        await db.invoiceItem.createMany({
          data: invoiceItems
        })
      })

      return {
        success: true,
        invoiceId: invoice.id
      }
    } catch (error) {
      console.error('Invoice generation error:', error)
      return { success: false, error: error.message || 'Invoice generation failed' }
    }
  }

  async scheduleInvoiceGeneration(
    orgSlug: string,
    orderId: string,
    scheduleType: 'monthly' | 'milestone' | 'custom',
    dayOfMonth?: number,
    autoSend: boolean = false
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: order } = await safeQuerySchema(orgSlug, async (db) => {
        return db.order.findUnique({
          where: { id: orderId },
          select: { organizationId: true, startDate: true }
        })
      })

      if (!order) {
        return { success: false, error: 'Order not found' }
      }

      // Get billing settings for default day
      const { data: settings } = await safeQuerySchema(orgSlug, async (db) => {
        return db.billingSettings.findUnique({
          where: { organizationId: order.organizationId }
        })
      })

      const invoiceDay = dayOfMonth || settings?.defaultInvoiceDay || 1
      let nextInvoiceDate = new Date()

      if (scheduleType === 'monthly') {
        // Set to the specified day of next month
        nextInvoiceDate = setDate(addMonths(startOfDay(new Date()), 1), invoiceDay)
        
        // If the date has already passed this month, use this month
        const thisMonthDate = setDate(startOfDay(new Date()), invoiceDay)
        if (isAfter(thisMonthDate, new Date()) && isAfter(thisMonthDate, new Date(order.startDate))) {
          nextInvoiceDate = thisMonthDate
        }
      }

      const { error } = await safeQuerySchema(orgSlug, async (db) => {
        await db.invoiceSchedule.upsert({
          where: {
            organizationId_orderId: {
              organizationId: order.organizationId,
              orderId
            }
          },
          update: {
            scheduleType,
            dayOfMonth: invoiceDay,
            frequency: scheduleType,
            nextInvoiceDate,
            isActive: true,
            autoSend,
            updatedAt: new Date()
          },
          create: {
            organizationId: order.organizationId,
            orderId,
            scheduleType,
            dayOfMonth: invoiceDay,
            frequency: scheduleType,
            nextInvoiceDate,
            isActive: true,
            autoSend
          }
        })
      })

      if (error) {
        return { success: false, error: 'Failed to create invoice schedule' }
      }

      return { success: true }
    } catch (error) {
      console.error('Schedule invoice error:', error)
      return { success: false, error: error.message || 'Failed to schedule invoice' }
    }
  }

  async processScheduledInvoices(orgSlug: string): Promise<void> {
    try {
      const today = startOfDay(new Date())

      // Get all due invoice schedules
      const { data: schedules } = await safeQuerySchema(orgSlug, async (db) => {
        return db.invoiceSchedule.findMany({
          where: {
            isActive: true,
            nextInvoiceDate: {
              lte: today
            }
          },
          include: {
            order: {
              include: {
                lineItems: {
                  where: {
                    airDate: {
                      lte: today
                    },
                    invoiced: false
                  }
                }
              }
            }
          }
        })
      })

      if (!schedules || schedules.length === 0) {
        return
      }

      // Process each schedule
      for (const schedule of schedules) {
        if (schedule.order.lineItems.length === 0) {
          continue // No items to invoice
        }

        // Generate invoice
        const result = await this.generateInvoice(orgSlug, {
          orderId: schedule.orderId,
          lineItems: schedule.order.lineItems.map(item => item.id)
        })

        if (result.success) {
          // Mark line items as invoiced
          await safeQuerySchema(orgSlug, async (db) => {
            await db.orderLineItem.updateMany({
              where: {
                id: { in: schedule.order.lineItems.map(item => item.id) }
              },
              data: { invoiced: true }
            })
          })

          // Update schedule for next invoice
          const nextDate = schedule.scheduleType === 'monthly'
            ? addMonths(schedule.nextInvoiceDate, 1)
            : null

          await safeQuerySchema(orgSlug, async (db) => {
            await db.invoiceSchedule.update({
              where: { id: schedule.id },
              data: {
                lastInvoiceDate: today,
                nextInvoiceDate: nextDate,
                isActive: nextDate ? true : false
              }
            })
          })

          // TODO: Send invoice if autoSend is enabled
          if (schedule.autoSend && result.invoiceId) {
            // Implement email sending
          }
        }
      }
    } catch (error) {
      console.error('Process scheduled invoices error:', error)
    }
  }

  private async generateInvoiceNumber(orgSlug: string, prefix: string): Promise<string> {
    const year = new Date().getFullYear()
    const month = String(new Date().getMonth() + 1).padStart(2, '0')
    
    // Get the last invoice number for this month
    const { data } = await safeQuerySchema(orgSlug, async (db) => {
      return db.invoice.findFirst({
        where: {
          invoiceNumber: {
            startsWith: `${prefix}-${year}${month}`
          }
        },
        orderBy: {
          invoiceNumber: 'desc'
        },
        select: {
          invoiceNumber: true
        }
      })
    })

    let sequenceNumber = 1
    if (data?.invoiceNumber) {
      const lastSequence = parseInt(data.invoiceNumber.split('-').pop() || '0')
      sequenceNumber = lastSequence + 1
    }

    return `${prefix}-${year}${month}-${String(sequenceNumber).padStart(4, '0')}`
  }
}

// Export singleton instance
export const billingService = new BillingService()