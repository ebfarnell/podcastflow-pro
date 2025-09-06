import prisma from '@/lib/db/prisma'
import { safeQuerySchema } from '@/lib/db/schema-db'
import { v4 as uuidv4 } from 'uuid'
// We'll use existing notification system
const createNotification = async (data: any) => {
  // This is a placeholder - integrate with existing notification system
  console.log('Notification:', data)
}

interface CreateBillingScheduleOptions {
  orderId: string
  schemaName: string
  dayOfMonth: number
  timezone: string
  prebillEnabled: boolean
  userId: string
}

interface GenerateInvoiceOptions {
  billingScheduleId: string
  schemaName: string
  period: string
  userId: string
}

export async function createBillingSchedule(options: CreateBillingScheduleOptions): Promise<string> {
  const { orderId, schemaName, dayOfMonth, timezone, prebillEnabled, userId } = options
  const scheduleId = uuidv4()

  try {
    // Get order details
    const { data: orders } = await safeQuerySchema(schemaName, async (schema) => {
      return await prisma.$queryRawUnsafe(`
        SELECT 
          o.*,
          c."startDate",
          c."endDate",
          a."paymentTerms",
          a."creditLimit"
        FROM "${schema}"."Order" o
        JOIN "${schema}"."Campaign" c ON o."campaignId" = c.id
        LEFT JOIN "${schema}"."Advertiser" a ON o."advertiserId" = a.id
        WHERE o.id = $1
      `, orderId)
    })

    if (!orders || orders.length === 0) {
      throw new Error('Order not found')
    }

    const order = orders[0]
    
    // Determine if pre-billing is needed
    const requiresPrebill = prebillEnabled && (!order.paymentTerms || order.paymentTerms === 'prepay')
    
    // Calculate billing periods
    const startDate = new Date(order.startDate)
    const endDate = new Date(order.endDate)
    const periods = calculateBillingPeriods(startDate, endDate, dayOfMonth, timezone)

    // Create billing schedule
    await safeQuerySchema(schemaName, async (schema) => {
      return await prisma.$executeRawUnsafe(`
        INSERT INTO "${schema}"."BillingSchedule" (
          id, "orderId", "dayOfMonth", timezone,
          "requiresPrebill", periods, status,
          "createdAt", "updatedAt", "createdBy"
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6, 'active',
          NOW(), NOW(), $7
        )
      `, scheduleId, orderId, dayOfMonth, timezone,
         requiresPrebill, JSON.stringify(periods), userId
      )
    })

    // If pre-billing is required, generate first invoice immediately
    if (requiresPrebill) {
      const prebillInvoiceId = await generatePrebillInvoice({
        scheduleId,
        orderId,
        schemaName,
        amount: order.totalAmount,
        userId,
      })

      console.log(`Generated pre-bill invoice ${prebillInvoiceId}`)
    }

    // Schedule future invoice generation jobs
    for (const period of periods) {
      await scheduleInvoiceGeneration({
        scheduleId,
        period: period.period,
        generateDate: period.invoiceDate,
        schemaName,
      })
    }

    console.log(`Created billing schedule ${scheduleId} for order ${orderId}`)
    return scheduleId

  } catch (error) {
    console.error('Error creating billing schedule:', error)
    throw error
  }
}

async function generatePrebillInvoice(options: {
  scheduleId: string
  orderId: string
  schemaName: string
  amount: number
  userId: string
}): Promise<string> {
  const { scheduleId, orderId, schemaName, amount, userId } = options
  const invoiceId = uuidv4()

  try {
    // Get order details for invoice
    const { data: orders } = await safeQuerySchema(schemaName, async (schema) => {
      return await prisma.$queryRawUnsafe(`
        SELECT 
          o.*,
          c."name" as "campaignName",
          a."name" as "advertiserName",
          a."billingAddress",
          a."billingContact"
        FROM "${schema}"."Order" o
        JOIN "${schema}"."Campaign" c ON o."campaignId" = c.id
        LEFT JOIN "${schema}"."Advertiser" a ON o."advertiserId" = a.id
        WHERE o.id = $1
      `, orderId)
    })

    const order = orders?.[0]
    if (!order) throw new Error('Order not found')

    // Create invoice
    await safeQuerySchema(schemaName, async (schema) => {
      return await prisma.$executeRawUnsafe(`
        INSERT INTO "${schema}"."Invoice" (
          id, "orderId", "billingScheduleId", "invoiceNumber",
          "invoiceDate", "dueDate", "amount", status,
          "isPrebill", metadata,
          "createdAt", "updatedAt", "createdBy"
        ) VALUES (
          $1, $2, $3, $4,
          NOW(), NOW() + INTERVAL '30 days', $5, 'pending',
          true, $6,
          NOW(), NOW(), $7
        )
      `, invoiceId, orderId, scheduleId,
         generateInvoiceNumber(),
         amount,
         JSON.stringify({
           advertiserName: order.advertiserName,
           campaignName: order.campaignName,
           billingAddress: order.billingAddress,
           billingContact: order.billingContact,
         }),
         userId
      )
    })

    // Send notification
    await createNotification({
      type: 'prebill_generated',
      title: 'Pre-Bill Invoice Generated',
      message: `Pre-bill invoice for ${order.campaignName} has been generated`,
      organizationId: order.organizationId,
      data: {
        invoiceId,
        orderId,
        amount,
      },
    })

    return invoiceId

  } catch (error) {
    console.error('Error generating pre-bill invoice:', error)
    throw error
  }
}

export async function generateMonthlyInvoice(options: GenerateInvoiceOptions): Promise<string> {
  const { billingScheduleId, schemaName, period, userId } = options
  const invoiceId = uuidv4()

  try {
    // Get billing schedule and order details
    const { data: schedules } = await safeQuerySchema(schemaName, async (schema) => {
      return await prisma.$queryRawUnsafe(`
        SELECT 
          bs.*,
          o.*,
          c."name" as "campaignName",
          a."name" as "advertiserName",
          a."billingAddress",
          a."billingContact"
        FROM "${schema}"."BillingSchedule" bs
        JOIN "${schema}"."Order" o ON bs."orderId" = o.id
        JOIN "${schema}"."Campaign" c ON o."campaignId" = c.id
        LEFT JOIN "${schema}"."Advertiser" a ON o."advertiserId" = a.id
        WHERE bs.id = $1
      `, billingScheduleId)
    })

    const schedule = schedules?.[0]
    if (!schedule) throw new Error('Billing schedule not found')

    // Calculate amount for this period
    const { data: spots } = await safeQuerySchema(schemaName, async (schema) => {
      return await prisma.$queryRawUnsafe(`
        SELECT 
          COUNT(*) as "spotCount",
          SUM(ss.rate) as "totalAmount"
        FROM "${schema}"."ScheduledSpot" ss
        WHERE ss."campaignId" = (SELECT "campaignId" FROM "${schema}"."Order" WHERE id = $1)
        AND DATE_TRUNC('month', ss."airDate") = DATE_TRUNC('month', $2::date)
      `, schedule.orderId, period)
    })

    const amount = spots?.[0]?.totalAmount || 0

    // Create invoice
    await safeQuerySchema(schemaName, async (schema) => {
      return await prisma.$executeRawUnsafe(`
        INSERT INTO "${schema}"."Invoice" (
          id, "orderId", "billingScheduleId", "invoiceNumber",
          "invoiceDate", "dueDate", "amount", status,
          "billingPeriod", metadata,
          "createdAt", "updatedAt", "createdBy"
        ) VALUES (
          $1, $2, $3, $4,
          NOW(), NOW() + INTERVAL '30 days', $5, 'pending',
          $6, $7,
          NOW(), NOW(), $8
        )
      `, invoiceId, schedule.orderId, billingScheduleId,
         generateInvoiceNumber(),
         amount,
         period,
         JSON.stringify({
           advertiserName: schedule.advertiserName,
           campaignName: schedule.campaignName,
           billingAddress: schedule.billingAddress,
           billingContact: schedule.billingContact,
           spotCount: spots?.[0]?.spotCount || 0,
         }),
         userId
      )
    })

    // Send notification
    await createNotification({
      type: 'invoice_generated',
      title: 'Monthly Invoice Generated',
      message: `Invoice for ${schedule.campaignName} (${period}) has been generated`,
      organizationId: schedule.organizationId,
      data: {
        invoiceId,
        orderId: schedule.orderId,
        amount,
        period,
      },
    })

    console.log(`Generated monthly invoice ${invoiceId} for period ${period}`)
    return invoiceId

  } catch (error) {
    console.error('Error generating monthly invoice:', error)
    throw error
  }
}

function calculateBillingPeriods(
  startDate: Date,
  endDate: Date,
  dayOfMonth: number,
  timezone: string
): Array<{ period: string; invoiceDate: Date }> {
  const periods: Array<{ period: string; invoiceDate: Date }> = []
  
  // Start from the first full month
  const currentDate = new Date(startDate)
  currentDate.setDate(1) // Go to first of month
  
  while (currentDate <= endDate) {
    const periodStr = currentDate.toISOString().slice(0, 7) // YYYY-MM format
    
    // Calculate invoice generation date
    const invoiceDate = new Date(currentDate)
    invoiceDate.setDate(Math.min(dayOfMonth, getDaysInMonth(invoiceDate)))
    
    periods.push({
      period: periodStr,
      invoiceDate,
    })
    
    // Move to next month
    currentDate.setMonth(currentDate.getMonth() + 1)
  }
  
  return periods
}

function getDaysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
}

function generateInvoiceNumber(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  return `INV-${year}${month}-${random}`
}

async function scheduleInvoiceGeneration(options: {
  scheduleId: string
  period: string
  generateDate: Date
  schemaName: string
}): Promise<void> {
  const { scheduleId, period, generateDate, schemaName } = options

  // In production, this would create a scheduled job (e.g., using a queue system)
  // For now, we'll just log the schedule
  console.log(`Scheduled invoice generation for ${period} on ${generateDate.toISOString()}`)
  
  // Store scheduled job in database
  await safeQuerySchema(schemaName, async (schema) => {
    return await prisma.$executeRawUnsafe(`
      INSERT INTO "${schema}"."ScheduledJob" (
        id, type, "targetId", "scheduledFor",
        payload, status,
        "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), 'generate_invoice', $1, $2,
        $3, 'pending',
        NOW(), NOW()
      )
    `, scheduleId, generateDate,
       JSON.stringify({ period, scheduleId })
    )
  })
}