import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { safeQuerySchema } from '@/lib/db/schema-db'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import ExcelJS from 'exceljs'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { dateRange, format = 'pdf', includeDetails = true } = await request.json()
    
    // Determine date parameters
    const now = new Date()
    let startDate: Date
    let endDate: Date
    
    if (dateRange === 'thisMonth') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    } else if (dateRange === 'lastMonth') {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      endDate = new Date(now.getFullYear(), now.getMonth(), 0)
    } else if (dateRange === 'custom' && request.body) {
      const body = await request.json()
      startDate = new Date(body.startDate)
      endDate = new Date(body.endDate)
    } else {
      // Default to current month
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    }

    // Fetch financial data from organization schema
    const orgSlug = session.organizationSlug || 'org_podcastflow_pro'
    
    // Get revenue data
    const { data: revenueData } = await safeQuerySchema(orgSlug, async (prisma) => {
      // Get campaigns in the date range
      const campaigns = await prisma.campaign.findMany({
        where: {
          organizationId: session.organizationId,
          startDate: { lte: endDate },
          endDate: { gte: startDate }
        },
        include: {
          advertiser: true,
          orders: {
            include: {
              payments: true
            }
          }
        }
      })

      // Calculate revenue metrics
      const totalRevenue = campaigns.reduce((sum, campaign) => sum + (campaign.budget || 0), 0)
      const receivedPayments = campaigns.reduce((sum, campaign) => {
        const payments = campaign.orders.flatMap(o => o.payments)
        return sum + payments.reduce((pSum, p) => pSum + p.amount, 0)
      }, 0)

      return {
        campaigns,
        totalRevenue,
        receivedPayments,
        outstandingAmount: totalRevenue - receivedPayments
      }
    }, {})

    // Get expense data
    const { data: expenseData } = await safeQuerySchema(orgSlug, async (prisma) => {
      const expenses = await prisma.expense.findMany({
        where: {
          organizationId: session.organizationId,
          date: {
            gte: startDate,
            lte: endDate
          }
        },
        orderBy: { date: 'desc' }
      })

      const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0)
      const byCategory = expenses.reduce((acc, exp) => {
        acc[exp.category] = (acc[exp.category] || 0) + exp.amount
        return acc
      }, {} as Record<string, number>)

      return {
        expenses,
        totalExpenses,
        byCategory
      }
    }, { expenses: [], totalExpenses: 0, byCategory: {} })

    // Get invoice data
    const { data: invoiceData } = await safeQuerySchema(orgSlug, async (prisma) => {
      const invoices = await prisma.invoice.findMany({
        where: {
          organizationId: session.organizationId,
          issueDate: {
            gte: startDate,
            lte: endDate
          }
        },
        include: {
          advertiser: true,
          payments: true
        },
        orderBy: { issueDate: 'desc' }
      })

      const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.amount, 0)
      const totalPaid = invoices.reduce((sum, inv) => {
        return sum + inv.payments.reduce((pSum, p) => pSum + p.amount, 0)
      }, 0)

      return {
        invoices,
        totalInvoiced,
        totalPaid,
        totalOutstanding: totalInvoiced - totalPaid
      }
    }, { invoices: [], totalInvoiced: 0, totalPaid: 0, totalOutstanding: 0 })

    // Calculate summary metrics
    const reportData = {
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        label: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`
      },
      summary: {
        totalRevenue: revenueData?.totalRevenue || 0,
        totalExpenses: expenseData?.totalExpenses || 0,
        netProfit: (revenueData?.totalRevenue || 0) - (expenseData?.totalExpenses || 0),
        profitMargin: revenueData?.totalRevenue ? 
          (((revenueData.totalRevenue - (expenseData?.totalExpenses || 0)) / revenueData.totalRevenue) * 100) : 0,
        outstandingInvoices: invoiceData?.totalOutstanding || 0,
        receivedPayments: revenueData?.receivedPayments || 0
      },
      revenue: {
        campaigns: revenueData?.campaigns || [],
        byAdvertiser: {}
      },
      expenses: {
        items: expenseData?.expenses || [],
        byCategory: expenseData?.byCategory || {}
      },
      invoices: {
        items: invoiceData?.invoices || [],
        totalInvoiced: invoiceData?.totalInvoiced || 0,
        totalPaid: invoiceData?.totalPaid || 0
      }
    }

    // Group revenue by advertiser
    if (revenueData?.campaigns) {
      reportData.revenue.byAdvertiser = revenueData.campaigns.reduce((acc, campaign) => {
        const advertiserName = campaign.advertiser?.name || 'Unknown'
        acc[advertiserName] = (acc[advertiserName] || 0) + (campaign.budget || 0)
        return acc
      }, {} as Record<string, number>)
    }

    // Generate report in requested format
    switch (format) {
      case 'pdf':
        return await generatePDFReport(reportData, session.organizationName || 'Organization')
      case 'excel':
        return await generateExcelReport(reportData, session.organizationName || 'Organization')
      case 'csv':
        return await generateCSVReport(reportData)
      case 'json':
        return NextResponse.json(reportData)
      default:
        return NextResponse.json({ error: 'Unsupported format' }, { status: 400 })
    }
  } catch (error) {
    console.error('Monthly report generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate monthly report', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

async function generatePDFReport(data: any, orgName: string) {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  
  const { width, height } = page.getSize()
  let yPosition = height - 50

  // Title
  page.drawText(`Monthly Financial Report`, {
    x: 50,
    y: yPosition,
    size: 20,
    font: boldFont
  })
  yPosition -= 25

  // Organization and period
  page.drawText(`${orgName}`, {
    x: 50,
    y: yPosition,
    size: 14,
    font
  })
  yPosition -= 20

  page.drawText(`Period: ${data.period.label}`, {
    x: 50,
    y: yPosition,
    size: 12,
    font
  })
  yPosition -= 30

  // Summary section
  page.drawText('Financial Summary', {
    x: 50,
    y: yPosition,
    size: 16,
    font: boldFont
  })
  yPosition -= 25

  const summaryItems = [
    ['Total Revenue', `$${data.summary.totalRevenue.toLocaleString()}`],
    ['Total Expenses', `$${data.summary.totalExpenses.toLocaleString()}`],
    ['Net Profit', `$${data.summary.netProfit.toLocaleString()}`],
    ['Profit Margin', `${data.summary.profitMargin.toFixed(1)}%`],
    ['Outstanding Invoices', `$${data.summary.outstandingInvoices.toLocaleString()}`],
    ['Received Payments', `$${data.summary.receivedPayments.toLocaleString()}`]
  ]

  for (const [label, value] of summaryItems) {
    page.drawText(`${label}:`, {
      x: 50,
      y: yPosition,
      size: 11,
      font
    })
    page.drawText(value, {
      x: 200,
      y: yPosition,
      size: 11,
      font: boldFont
    })
    yPosition -= 20
  }

  // Revenue by Advertiser
  if (Object.keys(data.revenue.byAdvertiser).length > 0) {
    yPosition -= 20
    page.drawText('Revenue by Advertiser', {
      x: 50,
      y: yPosition,
      size: 14,
      font: boldFont
    })
    yPosition -= 20

    for (const [advertiser, amount] of Object.entries(data.revenue.byAdvertiser)) {
      if (yPosition < 100) {
        const newPage = pdfDoc.addPage()
        yPosition = height - 50
      }
      page.drawText(`${advertiser}:`, {
        x: 50,
        y: yPosition,
        size: 10,
        font
      })
      page.drawText(`$${(amount as number).toLocaleString()}`, {
        x: 200,
        y: yPosition,
        size: 10,
        font
      })
      yPosition -= 18
    }
  }

  // Expense Categories
  if (Object.keys(data.expenses.byCategory).length > 0) {
    yPosition -= 20
    page.drawText('Expenses by Category', {
      x: 50,
      y: yPosition,
      size: 14,
      font: boldFont
    })
    yPosition -= 20

    for (const [category, amount] of Object.entries(data.expenses.byCategory)) {
      if (yPosition < 100) {
        const newPage = pdfDoc.addPage()
        yPosition = height - 50
      }
      page.drawText(`${category}:`, {
        x: 50,
        y: yPosition,
        size: 10,
        font
      })
      page.drawText(`$${(amount as number).toLocaleString()}`, {
        x: 200,
        y: yPosition,
        size: 10,
        font
      })
      yPosition -= 18
    }
  }

  const pdfBytes = await pdfDoc.save()
  
  return new NextResponse(pdfBytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="monthly-report-${new Date().toISOString().split('T')[0]}.pdf"`
    }
  })
}

async function generateExcelReport(data: any, orgName: string) {
  const workbook = new ExcelJS.Workbook()
  
  // Summary Sheet
  const summarySheet = workbook.addWorksheet('Summary')
  summarySheet.columns = [
    { header: 'Metric', key: 'metric', width: 30 },
    { header: 'Value', key: 'value', width: 20 }
  ]
  
  summarySheet.addRows([
    { metric: 'Organization', value: orgName },
    { metric: 'Report Period', value: data.period.label },
    { metric: 'Total Revenue', value: `$${data.summary.totalRevenue.toLocaleString()}` },
    { metric: 'Total Expenses', value: `$${data.summary.totalExpenses.toLocaleString()}` },
    { metric: 'Net Profit', value: `$${data.summary.netProfit.toLocaleString()}` },
    { metric: 'Profit Margin', value: `${data.summary.profitMargin.toFixed(1)}%` },
    { metric: 'Outstanding Invoices', value: `$${data.summary.outstandingInvoices.toLocaleString()}` },
    { metric: 'Received Payments', value: `$${data.summary.receivedPayments.toLocaleString()}` }
  ])

  // Revenue Sheet
  const revenueSheet = workbook.addWorksheet('Revenue')
  revenueSheet.columns = [
    { header: 'Campaign', key: 'campaign', width: 30 },
    { header: 'Advertiser', key: 'advertiser', width: 25 },
    { header: 'Budget', key: 'budget', width: 15 },
    { header: 'Start Date', key: 'startDate', width: 15 },
    { header: 'End Date', key: 'endDate', width: 15 }
  ]
  
  if (data.revenue.campaigns) {
    revenueSheet.addRows(data.revenue.campaigns.map((c: any) => ({
      campaign: c.name,
      advertiser: c.advertiser?.name || 'Unknown',
      budget: `$${c.budget.toLocaleString()}`,
      startDate: new Date(c.startDate).toLocaleDateString(),
      endDate: new Date(c.endDate).toLocaleDateString()
    })))
  }

  // Expenses Sheet
  const expensesSheet = workbook.addWorksheet('Expenses')
  expensesSheet.columns = [
    { header: 'Date', key: 'date', width: 15 },
    { header: 'Description', key: 'description', width: 30 },
    { header: 'Category', key: 'category', width: 20 },
    { header: 'Amount', key: 'amount', width: 15 },
    { header: 'Status', key: 'status', width: 15 }
  ]
  
  if (data.expenses.items) {
    expensesSheet.addRows(data.expenses.items.map((e: any) => ({
      date: new Date(e.date).toLocaleDateString(),
      description: e.description,
      category: e.category,
      amount: `$${e.amount.toLocaleString()}`,
      status: e.status
    })))
  }

  // Invoices Sheet
  const invoicesSheet = workbook.addWorksheet('Invoices')
  invoicesSheet.columns = [
    { header: 'Invoice #', key: 'number', width: 15 },
    { header: 'Advertiser', key: 'advertiser', width: 25 },
    { header: 'Issue Date', key: 'issueDate', width: 15 },
    { header: 'Due Date', key: 'dueDate', width: 15 },
    { header: 'Amount', key: 'amount', width: 15 },
    { header: 'Paid', key: 'paid', width: 15 },
    { header: 'Status', key: 'status', width: 15 }
  ]
  
  if (data.invoices.items) {
    invoicesSheet.addRows(data.invoices.items.map((i: any) => ({
      number: i.invoiceNumber || i.id,
      advertiser: i.advertiser?.name || 'Unknown',
      issueDate: new Date(i.issueDate).toLocaleDateString(),
      dueDate: new Date(i.dueDate).toLocaleDateString(),
      amount: `$${i.amount.toLocaleString()}`,
      paid: `$${i.payments.reduce((sum: number, p: any) => sum + p.amount, 0).toLocaleString()}`,
      status: i.status
    })))
  }

  const buffer = await workbook.xlsx.writeBuffer()
  
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="monthly-report-${new Date().toISOString().split('T')[0]}.xlsx"`
    }
  })
}

async function generateCSVReport(data: any) {
  let csv = 'Monthly Financial Report\n'
  csv += `Period: ${data.period.label}\n\n`
  
  // Summary
  csv += 'Financial Summary\n'
  csv += 'Metric,Value\n'
  csv += `Total Revenue,"$${data.summary.totalRevenue.toLocaleString()}"\n`
  csv += `Total Expenses,"$${data.summary.totalExpenses.toLocaleString()}"\n`
  csv += `Net Profit,"$${data.summary.netProfit.toLocaleString()}"\n`
  csv += `Profit Margin,"${data.summary.profitMargin.toFixed(1)}%"\n`
  csv += `Outstanding Invoices,"$${data.summary.outstandingInvoices.toLocaleString()}"\n`
  csv += `Received Payments,"$${data.summary.receivedPayments.toLocaleString()}"\n\n`
  
  // Revenue by Advertiser
  if (Object.keys(data.revenue.byAdvertiser).length > 0) {
    csv += 'Revenue by Advertiser\n'
    csv += 'Advertiser,Amount\n'
    for (const [advertiser, amount] of Object.entries(data.revenue.byAdvertiser)) {
      csv += `"${advertiser}","$${(amount as number).toLocaleString()}"\n`
    }
    csv += '\n'
  }
  
  // Expenses by Category
  if (Object.keys(data.expenses.byCategory).length > 0) {
    csv += 'Expenses by Category\n'
    csv += 'Category,Amount\n'
    for (const [category, amount] of Object.entries(data.expenses.byCategory)) {
      csv += `"${category}","$${(amount as number).toLocaleString()}"\n`
    }
  }
  
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="monthly-report-${new Date().toISOString().split('T')[0]}.csv"`
    }
  })
}