import prisma from '@/lib/db/prisma'
import { querySchema } from '@/lib/db/schema-db'

export interface InvoiceData {
  organizationId: string
  amount: number
  currency: string
  description: string
  plan: string
  billingPeriod?: string
  dueDate: Date
  taxAmount?: number
  discountAmount?: number
  notes?: string
  createdById?: string
}

export interface InvoiceFilters {
  status?: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
  organizationId?: string
  dateFrom?: Date
  dateTo?: Date
  amountMin?: number
  amountMax?: number
}

export class InvoiceService {
  /**
   * Generate a unique invoice number
   */
  private static generateInvoiceNumber(): string {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const timestamp = now.getTime().toString().slice(-6)
    return `INV-${year}${month}-${timestamp}`
  }

  /**
   * Calculate total amount including tax and discounts
   */
  private static calculateTotalAmount(
    amount: number,
    taxAmount: number = 0,
    discountAmount: number = 0
  ): number {
    return Math.max(0, amount + taxAmount - discountAmount)
  }

  /**
   * Create a new invoice
   */
  static async createInvoice(invoiceData: InvoiceData, organizationSchema: string): Promise<any> {
    const invoiceNumber = this.generateInvoiceNumber()
    const totalAmount = this.calculateTotalAmount(
      invoiceData.amount,
      invoiceData.taxAmount,
      invoiceData.discountAmount
    )

    const schemaDb = querySchema(organizationSchema)
    
    const invoice = await schemaDb.invoice.create({
      data: {
        id: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        invoiceNumber,
        organizationId: invoiceData.organizationId,
        amount: invoiceData.amount,
        currency: invoiceData.currency,
        description: invoiceData.description,
        plan: invoiceData.plan,
        billingPeriod: invoiceData.billingPeriod,
        dueDate: invoiceData.dueDate,
        taxAmount: invoiceData.taxAmount || 0,
        discountAmount: invoiceData.discountAmount || 0,
        totalAmount,
        status: 'draft',
        notes: invoiceData.notes,
        createdById: invoiceData.createdById,
        updatedAt: new Date()
      }
    })

    return invoice
  }

  /**
   * Get invoices with filtering and pagination
   */
  static async getInvoices(
    organizationSchema: string,
    filters: InvoiceFilters = {},
    limit: number = 50,
    offset: number = 0
  ): Promise<{ invoices: any[], total: number }> {
    const schemaDb = querySchema(organizationSchema)
    
    const whereClause: any = {}
    
    if (filters.status) {
      whereClause.status = filters.status
    }
    
    if (filters.organizationId) {
      whereClause.organizationId = filters.organizationId
    }
    
    if (filters.dateFrom || filters.dateTo) {
      whereClause.issueDate = {}
      if (filters.dateFrom) {
        whereClause.issueDate.gte = filters.dateFrom
      }
      if (filters.dateTo) {
        whereClause.issueDate.lte = filters.dateTo
      }
    }
    
    if (filters.amountMin || filters.amountMax) {
      whereClause.totalAmount = {}
      if (filters.amountMin) {
        whereClause.totalAmount.gte = filters.amountMin
      }
      if (filters.amountMax) {
        whereClause.totalAmount.lte = filters.amountMax
      }
    }

    const [invoices, total] = await Promise.all([
      schemaDb.invoice.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              email: true,
              plan: true
            }
          },
          items: true,
          payments: true
        }
      }),
      schemaDb.invoice.count({ where: whereClause })
    ])

    return { invoices, total }
  }

  /**
   * Update invoice status and handle business logic
   */
  static async updateInvoiceStatus(
    invoiceId: string,
    status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled',
    organizationSchema: string,
    paidDate?: Date
  ): Promise<any> {
    const schemaDb = querySchema(organizationSchema)
    
    const updateData: any = {
      status,
      updatedAt: new Date()
    }

    if (status === 'paid' && paidDate) {
      updateData.paidDate = paidDate
    } else if (status !== 'paid') {
      updateData.paidDate = null
    }

    const invoice = await schemaDb.invoice.update({
      where: { id: invoiceId },
      data: updateData,
      include: {
        organization: {
          select: { id: true, name: true, email: true }
        }
      }
    })

    return invoice
  }

  /**
   * Delete an invoice (only if draft or cancelled)
   */
  static async deleteInvoice(invoiceId: string, organizationSchema: string): Promise<void> {
    const schemaDb = querySchema(organizationSchema)
    
    // First check the invoice status
    const invoice = await schemaDb.invoice.findUnique({
      where: { id: invoiceId },
      select: { status: true, invoiceNumber: true }
    })

    if (!invoice) {
      throw new Error('Invoice not found')
    }

    if (invoice.status === 'paid') {
      throw new Error('Cannot delete paid invoices')
    }

    if (invoice.status === 'sent') {
      throw new Error('Cannot delete sent invoices. Cancel them first.')
    }

    await schemaDb.invoice.delete({
      where: { id: invoiceId }
    })
  }

  /**
   * Generate monthly subscription invoices for all organizations
   */
  static async generateMonthlyInvoices(): Promise<{ created: number, errors: string[] }> {
    const errors: string[] = []
    let created = 0

    try {
      // Get all active organizations that are not hidden from billing
      const organizations = await prisma.organization.findMany({
        where: {
          isActive: true,
          NOT: {
            hiddenFromBilling: true
          }
        }
      })

      for (const org of organizations) {
        try {
          if (!org.slug) {
            errors.push(`Organization ${org.name} has no slug`)
            continue
          }

          const schemaName = `org_${org.slug.replace(/-/g, '_')}`
          
          // Check if invoice already exists for this month
          const currentMonth = new Date()
          const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
          const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)
          
          const schemaDb = querySchema(schemaName)
          const existingInvoice = await schemaDb.invoice.findFirst({
            where: {
              organizationId: org.id,
              issueDate: {
                gte: startOfMonth,
                lte: endOfMonth
              },
              billingPeriod: `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`
            }
          })

          if (existingInvoice) {
            continue // Skip if invoice already exists
          }

          // Create monthly subscription invoice
          const dueDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1) // First of next month
          const billingAmount = org.billingAmount || 299 // Default to $299
          const plan = org.plan || 'professional'

          await this.createInvoice({
            organizationId: org.id,
            amount: billingAmount,
            currency: 'USD',
            description: `${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan - Monthly Subscription`,
            plan,
            billingPeriod: `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`,
            dueDate,
            createdById: 'system' // System-generated invoice
          }, schemaName)

          created++
        } catch (orgError: any) {
          errors.push(`Error creating invoice for ${org.name}: ${orgError.message}`)
        }
      }
    } catch (error: any) {
      errors.push(`System error: ${error.message}`)
    }

    return { created, errors }
  }

  /**
   * Mark overdue invoices (run daily via cron)
   */
  static async markOverdueInvoices(): Promise<{ updated: number, errors: string[] }> {
    const errors: string[] = []
    let updated = 0

    try {
      const organizations = await prisma.organization.findMany({
        where: { isActive: true },
        select: { slug: true, name: true }
      })

      for (const org of organizations) {
        try {
          if (!org.slug) continue

          const schemaName = `org_${org.slug.replace(/-/g, '_')}`
          const schemaDb = querySchema(schemaName)

          const overdueCount = await schemaDb.invoice.updateMany({
            where: {
              status: 'sent',
              dueDate: {
                lt: new Date()
              }
            },
            data: {
              status: 'overdue',
              updatedAt: new Date()
            }
          })

          updated += overdueCount.count
        } catch (orgError: any) {
          errors.push(`Error updating overdue invoices for ${org.name}: ${orgError.message}`)
        }
      }
    } catch (error: any) {
      errors.push(`System error: ${error.message}`)
    }

    return { updated, errors }
  }
}