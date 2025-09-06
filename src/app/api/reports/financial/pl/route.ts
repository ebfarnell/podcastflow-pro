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

    const { 
      year, 
      startMonth = 1, 
      endMonth = 12, 
      format = 'pdf',
      includeComparison = false 
    } = await request.json()
    
    const reportYear = year || new Date().getFullYear()
    const startDate = new Date(reportYear, startMonth - 1, 1)
    const endDate = new Date(reportYear, endMonth, 0, 23, 59, 59)

    const orgSlug = session.organizationSlug || 'org_podcastflow_pro'
    
    // Fetch revenue data
    const { data: revenueData } = await safeQuerySchema(orgSlug, async (prisma) => {
      // Get campaigns
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

      // Calculate revenue streams
      const advertisingRevenue = campaigns.reduce((sum, c) => {
        // Prorate revenue based on period overlap
        const campaignStart = new Date(c.startDate)
        const campaignEnd = new Date(c.endDate)
        const effectiveStart = campaignStart > startDate ? campaignStart : startDate
        const effectiveEnd = campaignEnd < endDate ? campaignEnd : endDate
        
        if (effectiveEnd >= effectiveStart) {
          const totalDays = Math.ceil((campaignEnd.getTime() - campaignStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
          const periodDays = Math.ceil((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
          const proratedAmount = (c.budget || 0) * (periodDays / totalDays)
          return sum + proratedAmount
        }
        return sum
      }, 0)

      // Get other revenue (sponsorships, etc.)
      const otherRevenue = 0 // Placeholder - would fetch from other sources

      return {
        advertising: advertisingRevenue,
        other: otherRevenue,
        total: advertisingRevenue + otherRevenue
      }
    }, { advertising: 0, other: 0, total: 0 })

    // Fetch cost of goods sold (COGS)
    const { data: cogsData } = await safeQuerySchema(orgSlug, async (prisma) => {
      const expenses = await prisma.expense.findMany({
        where: {
          organizationId: session.organizationId,
          date: {
            gte: startDate,
            lte: endDate
          },
          category: {
            in: ['production', 'talent', 'hosting', 'distribution']
          }
        }
      })

      const productionCosts = expenses
        .filter(e => e.category === 'production')
        .reduce((sum, e) => sum + e.amount, 0)
      
      const talentCosts = expenses
        .filter(e => e.category === 'talent')
        .reduce((sum, e) => sum + e.amount, 0)
      
      const hostingCosts = expenses
        .filter(e => e.category === 'hosting')
        .reduce((sum, e) => sum + e.amount, 0)

      return {
        production: productionCosts,
        talent: talentCosts,
        hosting: hostingCosts,
        total: productionCosts + talentCosts + hostingCosts
      }
    }, { production: 0, talent: 0, hosting: 0, total: 0 })

    // Fetch operating expenses
    const { data: opexData } = await safeQuerySchema(orgSlug, async (prisma) => {
      const expenses = await prisma.expense.findMany({
        where: {
          organizationId: session.organizationId,
          date: {
            gte: startDate,
            lte: endDate
          },
          category: {
            notIn: ['production', 'talent', 'hosting', 'distribution']
          }
        }
      })

      const byCategory = expenses.reduce((acc, e) => {
        acc[e.category] = (acc[e.category] || 0) + e.amount
        return acc
      }, {} as Record<string, number>)

      const salesMarketing = (byCategory['marketing'] || 0) + (byCategory['advertising'] || 0)
      const generalAdmin = (byCategory['office'] || 0) + (byCategory['utilities'] || 0) + 
                          (byCategory['insurance'] || 0) + (byCategory['professional'] || 0)
      const technology = (byCategory['software'] || 0) + (byCategory['equipment'] || 0)
      const other = Object.entries(byCategory)
        .filter(([cat]) => !['marketing', 'advertising', 'office', 'utilities', 
                            'insurance', 'professional', 'software', 'equipment'].includes(cat))
        .reduce((sum, [_, amount]) => sum + amount, 0)

      return {
        salesMarketing,
        generalAdmin,
        technology,
        other,
        total: salesMarketing + generalAdmin + technology + other
      }
    }, { salesMarketing: 0, generalAdmin: 0, technology: 0, other: 0, total: 0 })

    // Calculate monthly P&L breakdown
    const monthlyPL = []
    for (let month = startMonth; month <= endMonth; month++) {
      const monthStart = new Date(reportYear, month - 1, 1)
      const monthEnd = new Date(reportYear, month, 0)
      
      // Fetch month-specific data
      const { data: monthData } = await safeQuerySchema(orgSlug, async (prisma) => {
        // Get monthly revenue
        const monthCampaigns = await prisma.campaign.findMany({
          where: {
            organizationId: session.organizationId,
            startDate: { lte: monthEnd },
            endDate: { gte: monthStart }
          }
        })

        const monthRevenue = monthCampaigns.reduce((sum, c) => {
          const campaignStart = new Date(c.startDate)
          const campaignEnd = new Date(c.endDate)
          const effectiveStart = campaignStart > monthStart ? campaignStart : monthStart
          const effectiveEnd = campaignEnd < monthEnd ? campaignEnd : monthEnd
          
          if (effectiveEnd >= effectiveStart) {
            const totalDays = Math.ceil((campaignEnd.getTime() - campaignStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
            const monthDays = Math.ceil((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
            const proratedAmount = (c.budget || 0) * (monthDays / totalDays)
            return sum + proratedAmount
          }
          return sum
        }, 0)

        // Get monthly expenses
        const monthExpenses = await prisma.expense.findMany({
          where: {
            organizationId: session.organizationId,
            date: {
              gte: monthStart,
              lte: monthEnd
            }
          }
        })

        const monthCogs = monthExpenses
          .filter(e => ['production', 'talent', 'hosting', 'distribution'].includes(e.category))
          .reduce((sum, e) => sum + e.amount, 0)
        
        const monthOpex = monthExpenses
          .filter(e => !['production', 'talent', 'hosting', 'distribution'].includes(e.category))
          .reduce((sum, e) => sum + e.amount, 0)

        return {
          revenue: { advertising: monthRevenue, other: 0, total: monthRevenue },
          cogs: monthCogs,
          opex: monthOpex,
          netIncome: monthRevenue - monthCogs - monthOpex
        }
      }, { revenue: { advertising: 0, other: 0, total: 0 }, cogs: 0, opex: 0, netIncome: 0 })

      monthlyPL.push({
        number: month,
        name: monthStart.toLocaleString('default', { month: 'long' }),
        ...monthData
      })
    }

    // Calculate totals and metrics
    const grossProfit = (revenueData?.total || 0) - (cogsData?.total || 0)
    const operatingIncome = grossProfit - (opexData?.total || 0)
    const ebitda = operatingIncome // Simplified - would add back D&A
    const netIncome = operatingIncome // Simplified - would subtract interest & taxes

    const reportData = {
      period: {
        year: reportYear,
        startMonth,
        endMonth,
        label: `${new Date(reportYear, startMonth - 1).toLocaleString('default', { month: 'long' })} - ${new Date(reportYear, endMonth - 1).toLocaleString('default', { month: 'long' })} ${reportYear}`,
        months: monthlyPL.map(m => ({ number: m.number, name: m.name }))
      },
      revenue: revenueData || { advertising: 0, other: 0, total: 0 },
      cogs: cogsData || { production: 0, talent: 0, hosting: 0, total: 0 },
      opex: opexData || { salesMarketing: 0, generalAdmin: 0, technology: 0, other: 0, total: 0 },
      totals: {
        revenue: revenueData || { advertising: 0, other: 0, total: 0 },
        cogs: cogsData?.total || 0,
        grossProfit,
        opex: opexData?.total || 0,
        ebitda,
        netIncome
      },
      metrics: {
        grossMargin: revenueData?.total ? (grossProfit / revenueData.total) * 100 : 0,
        operatingMargin: revenueData?.total ? (operatingIncome / revenueData.total) * 100 : 0,
        ebitdaMargin: revenueData?.total ? (ebitda / revenueData.total) * 100 : 0,
        netMargin: revenueData?.total ? (netIncome / revenueData.total) * 100 : 0
      },
      monthlyPL
    }

    // Add comparison data if requested
    if (includeComparison) {
      // Fetch previous year data for comparison
      const prevYearStart = new Date(reportYear - 1, startMonth - 1, 1)
      const prevYearEnd = new Date(reportYear - 1, endMonth, 0)
      
      const { data: prevYearData } = await safeQuerySchema(orgSlug, async (prisma) => {
        const prevCampaigns = await prisma.campaign.findMany({
          where: {
            organizationId: session.organizationId,
            startDate: { lte: prevYearEnd },
            endDate: { gte: prevYearStart }
          }
        })
        
        const prevRevenue = prevCampaigns.reduce((sum, c) => sum + (c.budget || 0), 0)
        
        const prevExpenses = await prisma.expense.findMany({
          where: {
            organizationId: session.organizationId,
            date: {
              gte: prevYearStart,
              lte: prevYearEnd
            }
          }
        })
        
        const prevTotalExpenses = prevExpenses.reduce((sum, e) => sum + e.amount, 0)
        
        return {
          revenue: prevRevenue,
          expenses: prevTotalExpenses,
          netIncome: prevRevenue - prevTotalExpenses
        }
      }, { revenue: 0, expenses: 0, netIncome: 0 })
      
      reportData['comparison'] = {
        previousYear: reportYear - 1,
        revenue: prevYearData?.revenue || 0,
        expenses: prevYearData?.expenses || 0,
        netIncome: prevYearData?.netIncome || 0,
        changes: {
          revenue: revenueData?.total ? ((revenueData.total - (prevYearData?.revenue || 0)) / (prevYearData?.revenue || 1)) * 100 : 0,
          expenses: (((cogsData?.total || 0) + (opexData?.total || 0) - (prevYearData?.expenses || 0)) / (prevYearData?.expenses || 1)) * 100,
          netIncome: ((netIncome - (prevYearData?.netIncome || 0)) / Math.abs(prevYearData?.netIncome || 1)) * 100
        }
      }
    }

    // Generate report in requested format
    switch (format) {
      case 'pdf':
        return await generatePLPDFReport(reportData, session.organizationName || 'Organization')
      case 'excel':
        return await generatePLExcelReport(reportData, session.organizationName || 'Organization')
      case 'csv':
        return await generatePLCSVReport(reportData)
      case 'json':
        return NextResponse.json(reportData)
      default:
        return NextResponse.json({ error: 'Unsupported format' }, { status: 400 })
    }
  } catch (error) {
    console.error('P&L report generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate P&L report', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

async function generatePLPDFReport(data: any, orgName: string) {
  const pdfDoc = await PDFDocument.create()
  let page = pdfDoc.addPage([792, 612]) // Landscape
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  
  const { width, height } = page.getSize()
  let yPosition = height - 50

  // Title
  page.drawText(`Profit & Loss Statement`, {
    x: 50,
    y: yPosition,
    size: 20,
    font: boldFont
  })
  yPosition -= 25

  page.drawText(orgName, {
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
  const drawSummaryRow = (label: string, value: number, isTotal = false, indent = 0) => {
    page.drawText(label, {
      x: 50 + indent,
      y: yPosition,
      size: 11,
      font: isTotal ? boldFont : font
    })
    
    const formattedValue = value < 0 ? 
      `($${Math.abs(value).toLocaleString()})` : 
      `$${value.toLocaleString()}`
    
    page.drawText(formattedValue, {
      x: 400,
      y: yPosition,
      size: 11,
      font: isTotal ? boldFont : font,
      color: value < 0 ? rgb(0.8, 0, 0) : rgb(0, 0, 0)
    })
    yPosition -= 18
  }

  // Revenue section
  page.drawText('REVENUE', {
    x: 50,
    y: yPosition,
    size: 12,
    font: boldFont
  })
  yPosition -= 18

  drawSummaryRow('Advertising Revenue', data.revenue.advertising, false, 20)
  drawSummaryRow('Other Revenue', data.revenue.other, false, 20)
  drawSummaryRow('Total Revenue', data.revenue.total, true)
  
  yPosition -= 10

  // COGS section
  page.drawText('COST OF GOODS SOLD', {
    x: 50,
    y: yPosition,
    size: 12,
    font: boldFont
  })
  yPosition -= 18

  drawSummaryRow('Production Costs', data.cogs.production, false, 20)
  drawSummaryRow('Talent Costs', data.cogs.talent, false, 20)
  drawSummaryRow('Hosting & Distribution', data.cogs.hosting, false, 20)
  drawSummaryRow('Total COGS', data.cogs.total, true)
  
  yPosition -= 10
  drawSummaryRow('GROSS PROFIT', data.totals.grossProfit, true)
  
  yPosition -= 10

  // Operating Expenses section
  page.drawText('OPERATING EXPENSES', {
    x: 50,
    y: yPosition,
    size: 12,
    font: boldFont
  })
  yPosition -= 18

  drawSummaryRow('Sales & Marketing', data.opex.salesMarketing, false, 20)
  drawSummaryRow('General & Administrative', data.opex.generalAdmin, false, 20)
  drawSummaryRow('Technology', data.opex.technology, false, 20)
  drawSummaryRow('Other Operating Expenses', data.opex.other, false, 20)
  drawSummaryRow('Total Operating Expenses', data.opex.total, true)
  
  yPosition -= 10
  drawSummaryRow('OPERATING INCOME', data.totals.ebitda, true)
  
  yPosition -= 10
  drawSummaryRow('NET INCOME', data.totals.netIncome, true)

  // Metrics section
  if (yPosition > 150) {
    yPosition -= 30
    page.drawText('KEY METRICS', {
      x: 50,
      y: yPosition,
      size: 12,
      font: boldFont
    })
    yPosition -= 18

    page.drawText(`Gross Margin: ${data.metrics.grossMargin.toFixed(1)}%`, {
      x: 50,
      y: yPosition,
      size: 10,
      font
    })
    yPosition -= 15

    page.drawText(`Operating Margin: ${data.metrics.operatingMargin.toFixed(1)}%`, {
      x: 50,
      y: yPosition,
      size: 10,
      font
    })
    yPosition -= 15

    page.drawText(`Net Margin: ${data.metrics.netMargin.toFixed(1)}%`, {
      x: 50,
      y: yPosition,
      size: 10,
      font
    })
  }

  const pdfBytes = await pdfDoc.save()
  
  return new NextResponse(pdfBytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="pl-statement-${data.period.year}.pdf"`
    }
  })
}

async function generatePLExcelReport(data: any, orgName: string) {
  const workbook = new ExcelJS.Workbook()
  
  // P&L Statement Sheet
  const plSheet = workbook.addWorksheet('P&L Statement')
  
  // Set up columns for monthly breakdown
  const columns = [
    { header: 'Line Item', key: 'item', width: 30 }
  ]
  
  data.period.months.forEach((month: any) => {
    columns.push({
      header: month.name,
      key: `month_${month.number}`,
      width: 15
    })
  })
  
  columns.push({ header: 'Total', key: 'total', width: 15 })
  
  plSheet.columns = columns
  
  // Add revenue rows
  plSheet.addRow({ item: 'REVENUE' })
  
  const advertisingRow = { item: '  Advertising Revenue' }
  const otherRow = { item: '  Other Revenue' }
  const totalRevenueRow = { item: 'Total Revenue' }
  
  data.monthlyPL.forEach((month: any) => {
    advertisingRow[`month_${month.number}`] = `$${(month.revenue?.advertising || 0).toLocaleString()}`
    otherRow[`month_${month.number}`] = `$${(month.revenue?.other || 0).toLocaleString()}`
    totalRevenueRow[`month_${month.number}`] = `$${(month.revenue?.total || 0).toLocaleString()}`
  })
  
  advertisingRow['total'] = `$${(data.revenue?.advertising || 0).toLocaleString()}`
  otherRow['total'] = `$${(data.revenue?.other || 0).toLocaleString()}`
  totalRevenueRow['total'] = `$${(data.revenue?.total || 0).toLocaleString()}`
  
  plSheet.addRow(advertisingRow)
  plSheet.addRow(otherRow)
  plSheet.addRow(totalRevenueRow)
  plSheet.addRow({}) // Empty row
  
  // Add COGS rows
  plSheet.addRow({ item: 'COST OF GOODS SOLD' })
  
  const cogsRow = { item: 'Total COGS' }
  data.monthlyPL.forEach((month: any) => {
    cogsRow[`month_${month.number}`] = `$${(month.cogs || 0).toLocaleString()}`
  })
  cogsRow['total'] = `$${(data.cogs?.total || 0).toLocaleString()}`
  plSheet.addRow(cogsRow)
  plSheet.addRow({}) // Empty row
  
  // Add Gross Profit
  const grossProfitRow = { item: 'GROSS PROFIT' }
  data.monthlyPL.forEach((month: any) => {
    const gp = (month.revenue?.total || 0) - (month.cogs || 0)
    grossProfitRow[`month_${month.number}`] = `$${gp.toLocaleString()}`
  })
  grossProfitRow['total'] = `$${(data.totals?.grossProfit || 0).toLocaleString()}`
  plSheet.addRow(grossProfitRow)
  plSheet.addRow({}) // Empty row
  
  // Add Operating Expenses
  plSheet.addRow({ item: 'OPERATING EXPENSES' })
  
  const opexRow = { item: 'Total Operating Expenses' }
  data.monthlyPL.forEach((month: any) => {
    opexRow[`month_${month.number}`] = `$${(month.opex || 0).toLocaleString()}`
  })
  opexRow['total'] = `$${(data.opex?.total || 0).toLocaleString()}`
  plSheet.addRow(opexRow)
  plSheet.addRow({}) // Empty row
  
  // Add Net Income
  const netIncomeRow = { item: 'NET INCOME' }
  data.monthlyPL.forEach((month: any) => {
    netIncomeRow[`month_${month.number}`] = `$${(month.netIncome || 0).toLocaleString()}`
  })
  netIncomeRow['total'] = `$${(data.totals?.netIncome || 0).toLocaleString()}`
  plSheet.addRow(netIncomeRow)
  
  // Metrics Sheet
  const metricsSheet = workbook.addWorksheet('Metrics')
  metricsSheet.columns = [
    { header: 'Metric', key: 'metric', width: 30 },
    { header: 'Value', key: 'value', width: 20 }
  ]
  
  metricsSheet.addRows([
    { metric: 'Gross Margin', value: `${data.metrics.grossMargin.toFixed(1)}%` },
    { metric: 'Operating Margin', value: `${data.metrics.operatingMargin.toFixed(1)}%` },
    { metric: 'EBITDA Margin', value: `${data.metrics.ebitdaMargin.toFixed(1)}%` },
    { metric: 'Net Margin', value: `${data.metrics.netMargin.toFixed(1)}%` }
  ])
  
  const buffer = await workbook.xlsx.writeBuffer()
  
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="pl-statement-${data.period.year}.xlsx"`
    }
  })
}

async function generatePLCSVReport(data: any) {
  let csv = 'Profit & Loss Statement\n'
  csv += `Period: ${data.period.label}\n\n`
  
  // Header row
  csv += 'Line Item,'
  data.period.months.forEach((month: any) => {
    csv += `"${month.name}",`
  })
  csv += 'Total\n'
  
  // Revenue section
  csv += 'REVENUE\n'
  csv += '  Advertising Revenue,'
  data.monthlyPL.forEach((month: any) => {
    csv += `"$${(month.revenue?.advertising || 0).toLocaleString()}",`
  })
  csv += `"$${(data.revenue?.advertising || 0).toLocaleString()}"\n`
  
  csv += 'Total Revenue,'
  data.monthlyPL.forEach((month: any) => {
    csv += `"$${(month.revenue?.total || 0).toLocaleString()}",`
  })
  csv += `"$${(data.revenue?.total || 0).toLocaleString()}"\n\n`
  
  // COGS
  csv += 'Total COGS,'
  data.monthlyPL.forEach((month: any) => {
    csv += `"$${(month.cogs || 0).toLocaleString()}",`
  })
  csv += `"$${(data.cogs?.total || 0).toLocaleString()}"\n\n`
  
  // Gross Profit
  csv += 'GROSS PROFIT,'
  data.monthlyPL.forEach((month: any) => {
    const gp = (month.revenue?.total || 0) - (month.cogs || 0)
    csv += `"$${gp.toLocaleString()}",`
  })
  csv += `"$${(data.totals?.grossProfit || 0).toLocaleString()}"\n\n`
  
  // Operating Expenses
  csv += 'Total Operating Expenses,'
  data.monthlyPL.forEach((month: any) => {
    csv += `"$${(month.opex || 0).toLocaleString()}",`
  })
  csv += `"$${(data.opex?.total || 0).toLocaleString()}"\n\n`
  
  // Net Income
  csv += 'NET INCOME,'
  data.monthlyPL.forEach((month: any) => {
    csv += `"$${(month.netIncome || 0).toLocaleString()}",`
  })
  csv += `"$${(data.totals?.netIncome || 0).toLocaleString()}"\n`
  
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="pl-statement-${data.period.year}.csv"`
    }
  })
}