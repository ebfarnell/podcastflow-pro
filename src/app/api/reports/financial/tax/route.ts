import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { safeQuerySchema } from '@/lib/db/schema-db'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import ExcelJS from 'exceljs'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { year, format = 'pdf' } = await request.json()
    
    const taxYear = year || new Date().getFullYear() - 1 // Default to previous year
    const startDate = new Date(taxYear, 0, 1)
    const endDate = new Date(taxYear, 11, 31, 23, 59, 59)

    const orgSlug = session.organizationSlug || 'org_podcastflow_pro'
    
    // Fetch all financial data for tax year
    const { data: revenueData } = await safeQuerySchema(orgSlug, async (prisma) => {
      // Get all campaigns in tax year
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
              payments: true,
              invoices: true
            }
          }
        }
      })

      // Get all payments received
      const payments = await prisma.payment.findMany({
        where: {
          organizationId: session.organizationId,
          paymentDate: {
            gte: startDate,
            lte: endDate
          }
        },
        include: {
          invoice: {
            include: {
              advertiser: true
            }
          }
        }
      })

      // Calculate gross revenue (cash basis - actual payments received)
      const grossRevenue = payments.reduce((sum, p) => sum + p.amount, 0)
      
      // Calculate revenue by source
      const revenueBySource = payments.reduce((acc, p) => {
        const source = p.invoice?.advertiser?.name || 'Unknown'
        acc[source] = (acc[source] || 0) + p.amount
        return acc
      }, {} as Record<string, number>)

      // Monthly revenue breakdown
      const monthlyRevenue = Array.from({ length: 12 }, (_, i) => {
        const monthStart = new Date(taxYear, i, 1)
        const monthEnd = new Date(taxYear, i + 1, 0)
        
        const monthPayments = payments.filter(p => {
          const payDate = new Date(p.paymentDate)
          return payDate >= monthStart && payDate <= monthEnd
        })
        
        return {
          month: monthStart.toLocaleString('default', { month: 'long' }),
          revenue: monthPayments.reduce((sum, p) => sum + p.amount, 0)
        }
      })

      return {
        grossRevenue,
        revenueBySource,
        monthlyRevenue,
        payments
      }
    }, { grossRevenue: 0, revenueBySource: {}, monthlyRevenue: [], payments: [] })

    // Fetch all deductible expenses
    const { data: expenseData } = await safeQuerySchema(orgSlug, async (prisma) => {
      const expenses = await prisma.expense.findMany({
        where: {
          organizationId: session.organizationId,
          date: {
            gte: startDate,
            lte: endDate
          },
          status: 'paid' // Only include paid expenses for tax purposes
        },
        orderBy: { date: 'asc' }
      })

      // Calculate total expenses by category
      const byCategory = expenses.reduce((acc, e) => {
        acc[e.category] = (acc[e.category] || 0) + e.amount
        return acc
      }, {} as Record<string, number>)

      // Separate deductible categories
      const deductibleCategories = {
        advertising: byCategory['marketing'] || 0,
        officeExpenses: byCategory['office'] || 0,
        equipment: byCategory['equipment'] || 0,
        software: byCategory['software'] || 0,
        travel: byCategory['travel'] || 0,
        utilities: byCategory['utilities'] || 0,
        payroll: byCategory['payroll'] || 0,
        professionalFees: byCategory['professional'] || 0,
        insurance: byCategory['insurance'] || 0,
        other: byCategory['other'] || 0
      }

      const totalExpenses = Object.values(deductibleCategories).reduce((sum, amt) => sum + amt, 0)

      // Monthly expense breakdown
      const monthlyExpenses = Array.from({ length: 12 }, (_, i) => {
        const monthStart = new Date(taxYear, i, 1)
        const monthEnd = new Date(taxYear, i + 1, 0)
        
        const monthExpenses = expenses.filter(e => {
          const expDate = new Date(e.date)
          return expDate >= monthStart && expDate <= monthEnd
        })
        
        return {
          month: monthStart.toLocaleString('default', { month: 'long' }),
          amount: monthExpenses.reduce((sum, e) => sum + e.amount, 0)
        }
      })

      return {
        totalExpenses,
        deductibleCategories,
        monthlyExpenses,
        expenses
      }
    }, { totalExpenses: 0, deductibleCategories: {}, monthlyExpenses: [], expenses: [] })

    // Calculate tax summary
    const taxSummary = {
      year: taxYear,
      grossRevenue: revenueData?.grossRevenue || 0,
      totalDeductions: expenseData?.totalExpenses || 0,
      netIncome: (revenueData?.grossRevenue || 0) - (expenseData?.totalExpenses || 0),
      estimatedTax: calculateEstimatedTax((revenueData?.grossRevenue || 0) - (expenseData?.totalExpenses || 0))
    }

    // Compile complete tax report data
    const reportData = {
      taxYear,
      organizationName: session.organizationName || 'Organization',
      ein: '00-0000000', // Placeholder - should come from organization settings
      reportDate: new Date().toISOString(),
      summary: taxSummary,
      revenue: {
        gross: revenueData?.grossRevenue || 0,
        bySource: revenueData?.revenueBySource || {},
        monthly: revenueData?.monthlyRevenue || []
      },
      expenses: {
        total: expenseData?.totalExpenses || 0,
        byCategory: expenseData?.deductibleCategories || {},
        monthly: expenseData?.monthlyExpenses || []
      },
      quarterlyBreakdown: calculateQuarterlyBreakdown(
        revenueData?.monthlyRevenue || [],
        expenseData?.monthlyExpenses || []
      )
    }

    // Generate report in requested format
    switch (format) {
      case 'pdf':
        return await generateTaxPDFReport(reportData)
      case 'excel':
        return await generateTaxExcelReport(reportData)
      case 'csv':
        return await generateTaxCSVReport(reportData)
      case 'json':
        return NextResponse.json(reportData)
      default:
        return NextResponse.json({ error: 'Unsupported format' }, { status: 400 })
    }
  } catch (error) {
    console.error('Tax report generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate tax report', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

function calculateEstimatedTax(netIncome: number): number {
  // Simplified federal tax calculation (2023 corporate tax rate)
  const corporateTaxRate = 0.21
  return netIncome > 0 ? netIncome * corporateTaxRate : 0
}

function calculateQuarterlyBreakdown(monthlyRevenue: any[], monthlyExpenses: any[]) {
  const quarters = []
  for (let q = 0; q < 4; q++) {
    const startMonth = q * 3
    const qRevenue = monthlyRevenue.slice(startMonth, startMonth + 3)
      .reduce((sum, m) => sum + m.revenue, 0)
    const qExpenses = monthlyExpenses.slice(startMonth, startMonth + 3)
      .reduce((sum, m) => sum + m.amount, 0)
    
    quarters.push({
      quarter: `Q${q + 1}`,
      revenue: qRevenue,
      expenses: qExpenses,
      netIncome: qRevenue - qExpenses
    })
  }
  return quarters
}

async function generateTaxPDFReport(data: any) {
  const pdfDoc = await PDFDocument.create()
  let page = pdfDoc.addPage([612, 792]) // Letter size
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  
  const { width, height } = page.getSize()
  let yPosition = height - 50

  // Header with warning
  page.drawRectangle({
    x: 40,
    y: yPosition - 30,
    width: width - 80,
    height: 60,
    color: rgb(0.95, 0.95, 0.95)
  })

  page.drawText(`TAX PREPARATION REPORT - ${data.taxYear}`, {
    x: 50,
    y: yPosition,
    size: 18,
    font: boldFont
  })
  yPosition -= 25

  page.drawText('FOR TAX PREPARATION PURPOSES ONLY', {
    x: 50,
    y: yPosition,
    size: 10,
    font,
    color: rgb(0.5, 0, 0)
  })
  yPosition -= 40

  // Organization Info
  page.drawText(data.organizationName, {
    x: 50,
    y: yPosition,
    size: 14,
    font: boldFont
  })
  yPosition -= 18

  page.drawText(`EIN: ${data.ein}`, {
    x: 50,
    y: yPosition,
    size: 11,
    font
  })
  yPosition -= 18

  page.drawText(`Tax Year: January 1 - December 31, ${data.taxYear}`, {
    x: 50,
    y: yPosition,
    size: 11,
    font
  })
  yPosition -= 30

  // Tax Summary Section
  page.drawText('TAX SUMMARY', {
    x: 50,
    y: yPosition,
    size: 14,
    font: boldFont
  })
  yPosition -= 20

  const summaryItems = [
    ['Gross Revenue (Cash Basis)', `$${data.summary.grossRevenue.toLocaleString()}`],
    ['Total Deductible Expenses', `$${data.summary.totalDeductions.toLocaleString()}`],
    ['', ''],
    ['Net Taxable Income', `$${data.summary.netIncome.toLocaleString()}`],
    ['Estimated Federal Tax (21%)', `$${data.summary.estimatedTax.toLocaleString()}`]
  ]

  for (const [label, value] of summaryItems) {
    if (label === '') {
      page.drawLine({
        start: { x: 50, y: yPosition + 5 },
        end: { x: 300, y: yPosition + 5 },
        thickness: 1
      })
    } else {
      page.drawText(label, {
        x: 50,
        y: yPosition,
        size: 11,
        font: label.includes('Net') || label.includes('Estimated') ? boldFont : font
      })
      page.drawText(value, {
        x: 350,
        y: yPosition,
        size: 11,
        font: label.includes('Net') || label.includes('Estimated') ? boldFont : font
      })
    }
    yPosition -= 18
  }

  // Quarterly Breakdown
  yPosition -= 20
  page.drawText('QUARTERLY BREAKDOWN', {
    x: 50,
    y: yPosition,
    size: 14,
    font: boldFont
  })
  yPosition -= 20

  page.drawText('Quarter', { x: 50, y: yPosition, size: 10, font: boldFont })
  page.drawText('Revenue', { x: 150, y: yPosition, size: 10, font: boldFont })
  page.drawText('Expenses', { x: 250, y: yPosition, size: 10, font: boldFont })
  page.drawText('Net Income', { x: 350, y: yPosition, size: 10, font: boldFont })
  yPosition -= 15

  for (const quarter of data.quarterlyBreakdown) {
    page.drawText(quarter.quarter, { x: 50, y: yPosition, size: 10, font })
    page.drawText(`$${quarter.revenue.toLocaleString()}`, { x: 150, y: yPosition, size: 10, font })
    page.drawText(`$${quarter.expenses.toLocaleString()}`, { x: 250, y: yPosition, size: 10, font })
    page.drawText(`$${quarter.netIncome.toLocaleString()}`, { x: 350, y: yPosition, size: 10, font })
    yPosition -= 15
  }

  // Deductible Expenses by Category
  if (yPosition < 300) {
    page = pdfDoc.addPage([612, 792])
    yPosition = height - 50
  }

  yPosition -= 20
  page.drawText('DEDUCTIBLE EXPENSES BY CATEGORY', {
    x: 50,
    y: yPosition,
    size: 14,
    font: boldFont
  })
  yPosition -= 20

  for (const [category, amount] of Object.entries(data.expenses.byCategory)) {
    if (amount > 0) {
      const categoryLabel = category.charAt(0).toUpperCase() + category.slice(1).replace(/([A-Z])/g, ' $1')
      page.drawText(categoryLabel, {
        x: 50,
        y: yPosition,
        size: 10,
        font
      })
      page.drawText(`$${(amount as number).toLocaleString()}`, {
        x: 350,
        y: yPosition,
        size: 10,
        font
      })
      yPosition -= 15
    }
  }

  // Footer disclaimer
  const disclaimer = 'This report is for tax preparation purposes only. Please consult with a qualified tax professional.'
  page.drawText(disclaimer, {
    x: 50,
    y: 50,
    size: 9,
    font,
    color: rgb(0.5, 0.5, 0.5)
  })

  const pdfBytes = await pdfDoc.save()
  
  return new NextResponse(pdfBytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="tax-report-${data.taxYear}.pdf"`
    }
  })
}

async function generateTaxExcelReport(data: any) {
  const workbook = new ExcelJS.Workbook()
  
  // Summary Sheet
  const summarySheet = workbook.addWorksheet('Tax Summary')
  summarySheet.columns = [
    { header: 'Tax Summary', key: 'label', width: 40 },
    { header: `${data.taxYear}`, key: 'value', width: 20 }
  ]
  
  summarySheet.addRows([
    { label: 'Organization', value: data.organizationName },
    { label: 'EIN', value: data.ein },
    { label: 'Tax Year', value: data.taxYear },
    { label: '', value: '' },
    { label: 'Gross Revenue (Cash Basis)', value: `$${data.summary.grossRevenue.toLocaleString()}` },
    { label: 'Total Deductible Expenses', value: `$${data.summary.totalDeductions.toLocaleString()}` },
    { label: 'Net Taxable Income', value: `$${data.summary.netIncome.toLocaleString()}` },
    { label: 'Estimated Federal Tax (21%)', value: `$${data.summary.estimatedTax.toLocaleString()}` }
  ])

  // Monthly Revenue Sheet
  const revenueSheet = workbook.addWorksheet('Monthly Revenue')
  revenueSheet.columns = [
    { header: 'Month', key: 'month', width: 20 },
    { header: 'Revenue', key: 'revenue', width: 20 }
  ]
  
  data.revenue.monthly.forEach((month: any) => {
    revenueSheet.addRow({
      month: month.month,
      revenue: `$${month.revenue.toLocaleString()}`
    })
  })
  
  revenueSheet.addRow({ month: 'TOTAL', revenue: `$${data.revenue.gross.toLocaleString()}` })

  // Monthly Expenses Sheet
  const expensesSheet = workbook.addWorksheet('Monthly Expenses')
  expensesSheet.columns = [
    { header: 'Month', key: 'month', width: 20 },
    { header: 'Expenses', key: 'expenses', width: 20 }
  ]
  
  data.expenses.monthly.forEach((month: any) => {
    expensesSheet.addRow({
      month: month.month,
      expenses: `$${month.amount.toLocaleString()}`
    })
  })
  
  expensesSheet.addRow({ month: 'TOTAL', expenses: `$${data.expenses.total.toLocaleString()}` })

  // Expense Categories Sheet
  const categoriesSheet = workbook.addWorksheet('Expense Categories')
  categoriesSheet.columns = [
    { header: 'Category', key: 'category', width: 30 },
    { header: 'Amount', key: 'amount', width: 20 }
  ]
  
  for (const [category, amount] of Object.entries(data.expenses.byCategory)) {
    const categoryLabel = category.charAt(0).toUpperCase() + category.slice(1).replace(/([A-Z])/g, ' $1')
    categoriesSheet.addRow({
      category: categoryLabel,
      amount: `$${(amount as number).toLocaleString()}`
    })
  }

  // Quarterly Summary Sheet
  const quarterlySheet = workbook.addWorksheet('Quarterly Summary')
  quarterlySheet.columns = [
    { header: 'Quarter', key: 'quarter', width: 15 },
    { header: 'Revenue', key: 'revenue', width: 20 },
    { header: 'Expenses', key: 'expenses', width: 20 },
    { header: 'Net Income', key: 'netIncome', width: 20 }
  ]
  
  data.quarterlyBreakdown.forEach((q: any) => {
    quarterlySheet.addRow({
      quarter: q.quarter,
      revenue: `$${q.revenue.toLocaleString()}`,
      expenses: `$${q.expenses.toLocaleString()}`,
      netIncome: `$${q.netIncome.toLocaleString()}`
    })
  })

  const buffer = await workbook.xlsx.writeBuffer()
  
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="tax-report-${data.taxYear}.xlsx"`
    }
  })
}

async function generateTaxCSVReport(data: any) {
  let csv = `Tax Report ${data.taxYear}\n`
  csv += `${data.organizationName}\n`
  csv += `EIN: ${data.ein}\n\n`
  
  csv += 'TAX SUMMARY\n'
  csv += 'Item,Amount\n'
  csv += `Gross Revenue,"$${data.summary.grossRevenue.toLocaleString()}"\n`
  csv += `Total Deductible Expenses,"$${data.summary.totalDeductions.toLocaleString()}"\n`
  csv += `Net Taxable Income,"$${data.summary.netIncome.toLocaleString()}"\n`
  csv += `Estimated Federal Tax (21%),"$${data.summary.estimatedTax.toLocaleString()}"\n\n`
  
  csv += 'QUARTERLY BREAKDOWN\n'
  csv += 'Quarter,Revenue,Expenses,Net Income\n'
  for (const q of data.quarterlyBreakdown) {
    csv += `${q.quarter},"$${q.revenue.toLocaleString()}","$${q.expenses.toLocaleString()}","$${q.netIncome.toLocaleString()}"\n`
  }
  csv += '\n'
  
  csv += 'EXPENSE CATEGORIES\n'
  csv += 'Category,Amount\n'
  for (const [category, amount] of Object.entries(data.expenses.byCategory)) {
    const categoryLabel = category.charAt(0).toUpperCase() + category.slice(1).replace(/([A-Z])/g, ' $1')
    csv += `"${categoryLabel}","$${(amount as number).toLocaleString()}"\n`
  }
  
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="tax-report-${data.taxYear}.csv"`
    }
  })
}