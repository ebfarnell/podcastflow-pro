import prisma from '@/lib/db/prisma'

export interface CampaignPaymentData {
  campaignId: string
  amount: number
  paymentMethod?: string
  transactionId?: string
  paymentDate?: Date
  dueDate?: Date
  notes?: string
  reference?: string
}

export interface CampaignInvoiceData {
  campaignId: string
  amount: number
  issueDate?: Date
  dueDate?: Date
  notes?: string
  paymentTerms?: string
  lineItems?: Array<{
    description: string
    quantity: number
    unitPrice: number
    amount: number
  }>
}

/**
 * Campaign-based billing automation system
 * Handles automatic invoice generation and payment processing for campaigns
 */
export class CampaignBillingService {

  /**
   * Create an invoice for a campaign
   */
  async createCampaignInvoice(data: CampaignInvoiceData): Promise<any> {
    try {
      // Get campaign details
      const campaign = await prisma.campaign.findUnique({
        where: { id: data.campaignId },
        include: {
          advertiser: true,
          organization: true
        }
      })

      if (!campaign) {
        throw new Error(`Campaign ${data.campaignId} not found`)
      }

      // Generate invoice number
      const invoiceCount = await prisma.invoice.count({
        where: { organizationId: campaign.organizationId }
      })
      const invoiceNumber = `INV-${Date.now()}-${String(invoiceCount + 1).padStart(4, '0')}`

      // Calculate dates
      const issueDate = data.issueDate || new Date()
      const dueDate = data.dueDate || new Date(issueDate.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 days

      // Prepare line items
      const lineItems = data.lineItems || [
        {
          description: `Campaign: ${campaign.name}`,
          quantity: 1,
          unitPrice: data.amount,
          amount: data.amount
        }
      ]

      // Create invoice
      const invoice = await prisma.invoice.create({
        data: {
          invoiceNumber,
          organizationId: campaign.organizationId,
          clientName: campaign.advertiser.name,
          clientEmail: campaign.advertiser.contactEmail,
          clientAddress: campaign.advertiser.address,
          amount: data.amount,
          totalAmount: data.amount,
          subtotal: data.amount,
          description: `Campaign services: ${campaign.name}`,
          status: 'sent',
          issueDate,
          dueDate,
          paymentTerms: data.paymentTerms || 'Net 30',
          notes: data.notes || `Invoice for campaign: ${campaign.name}`,
          billingPeriod: issueDate.toISOString().substring(0, 7),
          plan: 'campaign'
        }
      })

      // Create invoice items
      await Promise.all(
        lineItems.map(item =>
          prisma.invoiceItem.create({
            data: {
              invoiceId: invoice.id,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              amount: item.amount,
              campaignId: campaign.id
            }
          })
        )
      )

      console.log('✅ Campaign invoice created:', {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        campaignId: campaign.id,
        amount: data.amount
      })

      return invoice

    } catch (error) {
      console.error('❌ Error creating campaign invoice:', error)
      throw error
    }
  }

  /**
   * Process a payment for a campaign and create invoice if needed
   */
  async processCampaignPayment(data: CampaignPaymentData): Promise<any> {
    try {
      // Get campaign details
      const campaign = await prisma.campaign.findUnique({
        where: { id: data.campaignId },
        include: {
          advertiser: true,
          organization: true
        }
      })

      if (!campaign) {
        throw new Error(`Campaign ${data.campaignId} not found`)
      }

      // Create invoice for this payment if not exists
      const invoice = await this.createCampaignInvoice({
        campaignId: data.campaignId,
        amount: data.amount,
        issueDate: data.paymentDate,
        dueDate: data.dueDate,
        notes: data.notes
      })

      // Generate payment number
      const paymentCount = await prisma.payment.count()
      const paymentNumber = `PAY-${Date.now()}-${String(paymentCount + 1).padStart(4, '0')}`

      // Record the payment
      const payment = await prisma.payment.create({
        data: {
          paymentNumber,
          invoiceId: invoice.id,
          amount: data.amount,
          paymentMethod: data.paymentMethod || 'bank_transfer',
          transactionId: data.transactionId,
          status: 'completed',
          paymentDate: data.paymentDate || new Date(),
          processedDate: new Date(),
          notes: data.notes || `Payment for campaign: ${campaign.name}`,
          netAmount: data.amount
        }
      })

      // Update invoice status to paid
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          status: 'paid',
          paidDate: payment.paymentDate
        }
      })

      // Update campaign financial tracking
      await this.updateCampaignFinancials(data.campaignId, {
        totalPaid: data.amount,
        lastPaymentDate: payment.paymentDate,
        lastPaymentId: payment.id
      })

      console.log('✅ Campaign payment processed:', {
        paymentId: payment.id,
        paymentNumber: payment.paymentNumber,
        campaignId: campaign.id,
        amount: data.amount
      })

      return {
        invoice,
        payment,
        campaign
      }

    } catch (error) {
      console.error('❌ Error processing campaign payment:', error)
      throw error
    }
  }

  /**
   * Generate monthly recurring invoices for active campaigns
   */
  async generateMonthlyRecurringInvoices(organizationId?: string): Promise<any[]> {
    try {
      console.log('🔄 Generating monthly recurring invoices...')

      // Get active campaigns that need billing
      const campaigns = await prisma.campaign.findMany({
        where: {
          status: 'active',
          ...(organizationId && { organizationId }),
          // Only campaigns with budget that haven't been fully billed
          budget: { gt: 0 }
        },
        include: {
          advertiser: true,
          organization: true,
          analytics: {
            where: {
              date: {
                gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) // This month
              }
            }
          }
        }
      })

      const results = []

      for (const campaign of campaigns) {
        try {
          // Calculate monthly billing amount
          const monthlyBudget = this.calculateMonthlyBilling(campaign)
          
          if (monthlyBudget > 0) {
            // Check if invoice already exists for this month
            const existingInvoice = await this.getMonthlyInvoice(
              campaign.id, 
              new Date().getFullYear(), 
              new Date().getMonth()
            )

            if (!existingInvoice) {
              const invoice = await this.createCampaignInvoice({
                campaignId: campaign.id,
                amount: monthlyBudget,
                notes: `Monthly billing for ${new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}`
              })

              results.push({
                campaignId: campaign.id,
                campaignName: campaign.name,
                invoiceId: invoice.id,
                amount: monthlyBudget,
                status: 'created'
              })
            } else {
              results.push({
                campaignId: campaign.id,
                campaignName: campaign.name,
                invoiceId: existingInvoice.id,
                amount: existingInvoice.totalAmount,
                status: 'already_exists'
              })
            }
          }
        } catch (error) {
          console.error(`❌ Error processing campaign ${campaign.id}:`, error)
          results.push({
            campaignId: campaign.id,
            campaignName: campaign.name,
            status: 'error',
            error: error.message
          })
        }
      }

      console.log('✅ Monthly recurring invoices generated:', {
        processed: campaigns.length,
        created: results.filter(r => r.status === 'created').length,
        existing: results.filter(r => r.status === 'already_exists').length,
        errors: results.filter(r => r.status === 'error').length
      })

      return results

    } catch (error) {
      console.error('❌ Error generating monthly recurring invoices:', error)
      throw error
    }
  }

  /**
   * Calculate commission for agencies
   */
  async calculateAgencyCommission(campaignId: string, paymentAmount: number): Promise<any | null> {
    try {
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        include: { agency: true }
      })

      if (!campaign || !campaign.agency || !campaign.agencyId) {
        return null
      }

      // For now, use a default 10% commission rate
      // This could be enhanced to store commission rates in the Agency model
      const commissionRate = 0.10 // 10%
      const commissionAmount = paymentAmount * commissionRate

      // Create expense record for commission
      const expense = await prisma.expense.create({
        data: {
          organizationId: campaign.organizationId,
          amount: commissionAmount,
          description: `Agency commission: ${campaign.agency.name} - ${campaign.name}`,
          category: 'Commission',
          vendor: campaign.agency.name,
          vendorId: campaign.agencyId,
          status: 'pending',
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          metadata: {
            campaignId,
            paymentAmount,
            commissionRate
          }
        }
      })

      console.log('✅ Agency commission calculated:', {
        campaignId,
        agencyId: campaign.agencyId,
        agencyName: campaign.agency.name,
        paymentAmount,
        commissionRate,
        commissionAmount,
        expenseId: expense.id
      })

      return expense

    } catch (error) {
      console.error('❌ Error calculating agency commission:', error)
      throw error
    }
  }

  /**
   * Private helper methods
   */
  private calculateMonthlyBilling(campaign: any): number {
    // Simple monthly budget allocation
    // Could be enhanced with more sophisticated billing logic
    const monthlyBudget = (campaign.budget || 0) / 12
    return Math.round(monthlyBudget * 100) / 100
  }

  private async getMonthlyInvoice(campaignId: string, year: number, month: number): Promise<any | null> {
    const startDate = new Date(year, month, 1)
    const endDate = new Date(year, month + 1, 0)

    const invoice = await prisma.invoice.findFirst({
      where: {
        items: {
          some: {
            campaignId
          }
        },
        issueDate: {
          gte: startDate,
          lte: endDate
        }
      }
    })

    return invoice
  }

  private async updateCampaignFinancials(campaignId: string, data: any): Promise<void> {
    // Update campaign with financial tracking
    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        updatedAt: new Date(),
        // Note: Add financial tracking fields to Campaign model if needed
        // totalPaid: data.totalPaid,
        // lastPaymentDate: data.lastPaymentDate,
        // lastPaymentId: data.lastPaymentId
      }
    })
  }

  /**
   * Get billing metrics for a campaign
   */
  async getCampaignBillingMetrics(campaignId: string): Promise<any> {
    try {
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        include: {
          analytics: true,
          invoiceItems: {
            include: {
              invoice: {
                include: {
                  payments: true
                }
              }
            }
          }
        }
      })

      if (!campaign) {
        throw new Error(`Campaign ${campaignId} not found`)
      }

      // Calculate totals
      const totalBilled = campaign.invoiceItems.reduce((sum, item) => sum + item.amount, 0)
      const totalPaid = campaign.invoiceItems.reduce((sum, item) => {
        const paidAmount = item.invoice.payments.reduce((paySum, payment) => paySum + payment.amount, 0)
        return sum + paidAmount
      }, 0)

      const totalSpent = campaign.analytics.reduce((sum, analytics) => sum + analytics.spent, 0)

      return {
        campaignId,
        campaignName: campaign.name,
        budget: campaign.budget || 0,
        totalBilled,
        totalPaid,
        totalSpent,
        remainingBudget: (campaign.budget || 0) - totalPaid,
        budgetUtilization: campaign.budget > 0 ? (totalPaid / campaign.budget) * 100 : 0,
        invoiceCount: campaign.invoiceItems.length,
        lastBillingDate: campaign.invoiceItems.length > 0 
          ? Math.max(...campaign.invoiceItems.map(item => new Date(item.invoice.issueDate).getTime()))
          : null
      }

    } catch (error) {
      console.error('❌ Error getting campaign billing metrics:', error)
      throw error
    }
  }

  /**
   * Validate campaign eligibility for billing
   */
  async validateCampaignForBilling(campaignId: string): Promise<boolean> {
    try {
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        include: {
          advertiser: true,
          organization: true
        }
      })

      if (!campaign) {
        console.log(`❌ Campaign ${campaignId} not found`)
        return false
      }

      if (campaign.status !== 'active') {
        console.log(`❌ Campaign ${campaignId} is not active (status: ${campaign.status})`)
        return false
      }

      if (!campaign.budget || campaign.budget <= 0) {
        console.log(`❌ Campaign ${campaignId} has no budget`)
        return false
      }

      if (!campaign.advertiser) {
        console.log(`❌ Campaign ${campaignId} has no advertiser`)
        return false
      }

      return true

    } catch (error) {
      console.error('❌ Error validating campaign for billing:', error)
      return false
    }
  }
}

// Export singleton instance
export const campaignBillingService = new CampaignBillingService()