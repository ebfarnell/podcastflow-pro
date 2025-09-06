import prisma from '@/lib/db/prisma'
import { InvoiceStatus } from '@prisma/client'

interface PlanPricing {
  starter: number
  professional: number
  enterprise: number
}

const PLAN_PRICING: PlanPricing = {
  starter: 299,
  professional: 599,
  enterprise: 1299
}

export async function generateMonthlyInvoices() {
  try {
    console.log('🧾 Starting monthly invoice generation...')
    
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    const billingPeriod = `${year}-${String(month).padStart(2, '0')}`
    
    // Get all active organizations
    const organizations = await prisma.organization.findMany({
      where: {
        isActive: true
      },
      include: {
        invoices: {
          where: {
            billingPeriod: billingPeriod
          }
        }
      }
    })

    let invoicesCreated = 0
    let invoicesSkipped = 0

    for (const org of organizations) {
      // Skip if invoice already exists for this billing period
      if (org.invoices.length > 0) {
        console.log(`⏭️ Skipping ${org.name} - invoice already exists for ${billingPeriod}`)
        invoicesSkipped++
        continue
      }

      // Determine the plan - defaulting to starter for now
      // In production, this would come from subscription data
      const plan = 'starter'
      const amount = PLAN_PRICING[plan]

      // Generate invoice number with timestamp
      const timestamp = Date.now().toString().slice(-6)
      const invoiceNumber = `INV-${year}-${String(month).padStart(2, '0')}-${timestamp}`

      // Create invoice with 30-day payment terms
      const dueDate = new Date(year, month - 1, 15) // Due on 15th of the month
      dueDate.setMonth(dueDate.getMonth() + 1) // Next month

      const invoice = await prisma.invoice.create({
        data: {
          invoiceNumber,
          organizationId: org.id,
          amount,
          currency: 'USD',
          description: `${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan - Monthly Subscription`,
          billingPeriod,
          plan,
          dueDate,
          status: 'pending',
          totalAmount: amount,
          items: {
            create: {
              description: `${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan - ${billingPeriod}`,
              quantity: 1,
              unitPrice: amount,
              amount: amount
            }
          }
        }
      })

      console.log(`✅ Created invoice ${invoice.invoiceNumber} for ${org.name}`)
      invoicesCreated++
    }

    console.log(`\n📊 Invoice generation complete:`)
    console.log(`   - Invoices created: ${invoicesCreated}`)
    console.log(`   - Invoices skipped: ${invoicesSkipped}`)
    console.log(`   - Total organizations: ${organizations.length}`)

    return {
      success: true,
      invoicesCreated,
      invoicesSkipped,
      totalOrganizations: organizations.length
    }

  } catch (error) {
    console.error('❌ Error generating invoices:', error)
    throw error
  }
}

export async function checkOverdueInvoices() {
  try {
    console.log('🔍 Checking for overdue invoices...')
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Find all pending invoices past due date
    const overdueInvoices = await prisma.invoice.findMany({
      where: {
        status: 'pending',
        dueDate: {
          lt: today
        }
      },
      include: {
        organization: true
      }
    })

    let updatedCount = 0

    for (const invoice of overdueInvoices) {
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: 'overdue' }
      })

      console.log(`⚠️ Marked invoice ${invoice.invoiceNumber} as overdue (${invoice.organization.name})`)
      updatedCount++
    }

    console.log(`\n📊 Overdue check complete:`)
    console.log(`   - Invoices marked overdue: ${updatedCount}`)

    return {
      success: true,
      overdueCount: updatedCount
    }

  } catch (error) {
    console.error('❌ Error checking overdue invoices:', error)
    throw error
  }
}

export async function generateInvoiceForOrganization(
  organizationId: string,
  options?: {
    amount?: number
    description?: string
    plan?: string
    dueDate?: Date
    items?: Array<{
      description: string
      quantity: number
      unitPrice: number
      campaignId?: string
    }>
  }
) {
  try {
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId }
    })

    if (!organization) {
      throw new Error('Organization not found')
    }

    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const timestamp = Date.now().toString().slice(-6)
    const invoiceNumber = `INV-${year}-${month}-${timestamp}`

    // Use provided values or defaults
    const plan = options?.plan || 'starter'
    const amount = options?.amount || PLAN_PRICING[plan]
    const description = options?.description || `${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan - Monthly Subscription`
    const dueDate = options?.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    // Create invoice
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        organizationId,
        amount,
        currency: 'USD',
        description,
        billingPeriod: `${year}-${month}`,
        plan,
        dueDate,
        status: 'pending',
        totalAmount: amount,
        items: options?.items ? {
          create: options.items.map(item => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            amount: item.unitPrice * item.quantity,
            campaignId: item.campaignId
          }))
        } : {
          create: {
            description,
            quantity: 1,
            unitPrice: amount,
            amount
          }
        }
      },
      include: {
        organization: true,
        items: true
      }
    })

    console.log(`✅ Created invoice ${invoice.invoiceNumber} for ${organization.name}`)

    return invoice

  } catch (error) {
    console.error('❌ Error generating invoice for organization:', error)
    throw error
  }
}