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

    const { quarter, year, format = 'pdf' } = await request.json()
    
    // Determine quarter dates
    const currentYear = year || new Date().getFullYear()
    const currentQuarter = quarter || Math.floor((new Date().getMonth() + 3) / 3)
    
    const startMonth = (currentQuarter - 1) * 3
    const startDate = new Date(currentYear, startMonth, 1)
    const endDate = new Date(currentYear, startMonth + 3, 0)

    const orgSlug = session.organizationSlug || 'org_podcastflow_pro'
    
    // Fetch quarterly performance data
    const { data: performanceData } = await safeQuerySchema(orgSlug, async (prisma) => {
      // Get campaigns data
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

      // Get shows and episodes data
      const shows = await prisma.show.findMany({
        where: {
          organizationId: session.organizationId
        },
        include: {
          episodes: {
            where: {
              airDate: {
                gte: startDate,
                lte: endDate
              }
            }
          }
        }
      })

      // Calculate quarterly metrics
      const totalRevenue = campaigns.reduce((sum, c) => sum + (c.budget || 0), 0)
      const totalCampaigns = campaigns.length
      const totalEpisodes = shows.reduce((sum, s) => sum + s.episodes.length, 0)
      const activeShows = shows.filter(s => s.episodes.length > 0).length

      // Calculate monthly breakdown
      const monthlyBreakdown = []
      for (let i = 0; i < 3; i++) {
        const monthStart = new Date(currentYear, startMonth + i, 1)
        const monthEnd = new Date(currentYear, startMonth + i + 1, 0)
        
        const monthCampaigns = campaigns.filter(c => 
          new Date(c.startDate) <= monthEnd && new Date(c.endDate) >= monthStart
        )
        
        const monthRevenue = monthCampaigns.reduce((sum, c) => {
          // Prorate revenue based on days in month
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

        monthlyBreakdown.push({
          month: monthStart.toLocaleString('default', { month: 'long', year: 'numeric' }),
          revenue: monthRevenue,
          campaigns: monthCampaigns.length
        })
      }

      // Top performing advertisers
      const advertiserPerformance = campaigns.reduce((acc, c) => {
        const name = c.advertiser?.name || 'Unknown'
        if (!acc[name]) {
          acc[name] = { revenue: 0, campaigns: 0 }
        }
        acc[name].revenue += c.budget || 0
        acc[name].campaigns += 1
        return acc
      }, {} as Record<string, { revenue: number; campaigns: number }>)

      const topAdvertisers = Object.entries(advertiserPerformance)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10)

      return {
        totalRevenue,
        totalCampaigns,
        totalEpisodes,
        activeShows,
        monthlyBreakdown,
        topAdvertisers,
        campaigns
      }
    }, {})

    // Get expense trends
    const { data: expenseData } = await safeQuerySchema(orgSlug, async (prisma) => {
      const expenses = await prisma.expense.findMany({
        where: {
          organizationId: session.organizationId,
          date: {
            gte: startDate,
            lte: endDate
          }
        }
      })

      const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)
      
      // Monthly expense breakdown
      const monthlyExpenses = []
      for (let i = 0; i < 3; i++) {
        const monthStart = new Date(currentYear, startMonth + i, 1)
        const monthEnd = new Date(currentYear, startMonth + i + 1, 0)
        
        const monthExpenses = expenses.filter(e => {
          const expDate = new Date(e.date)
          return expDate >= monthStart && expDate <= monthEnd
        })
        
        monthlyExpenses.push({
          month: monthStart.toLocaleString('default', { month: 'long' }),
          amount: monthExpenses.reduce((sum, e) => sum + e.amount, 0)
        })
      }

      // Category breakdown
      const byCategory = expenses.reduce((acc, e) => {
        acc[e.category] = (acc[e.category] || 0) + e.amount
        return acc
      }, {} as Record<string, number>)

      return {
        totalExpenses,
        monthlyExpenses,
        byCategory
      }
    }, { totalExpenses: 0, monthlyExpenses: [], byCategory: {} })

    // Calculate KPIs and trends
    const reportData = {
      period: {
        quarter: currentQuarter,
        year: currentYear,
        label: `Q${currentQuarter} ${currentYear}`,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      },
      summary: {
        totalRevenue: performanceData?.totalRevenue || 0,
        totalExpenses: expenseData?.totalExpenses || 0,
        netProfit: (performanceData?.totalRevenue || 0) - (expenseData?.totalExpenses || 0),
        profitMargin: performanceData?.totalRevenue ? 
          (((performanceData.totalRevenue - (expenseData?.totalExpenses || 0)) / performanceData.totalRevenue) * 100) : 0,
        totalCampaigns: performanceData?.totalCampaigns || 0,
        totalEpisodes: performanceData?.totalEpisodes || 0,
        activeShows: performanceData?.activeShows || 0,
        averageRevenuePerCampaign: performanceData?.totalCampaigns ? 
          (performanceData.totalRevenue / performanceData.totalCampaigns) : 0
      },
      performance: {
        monthlyBreakdown: performanceData?.monthlyBreakdown || [],
        topAdvertisers: performanceData?.topAdvertisers || []
      },
      expenses: {
        monthlyBreakdown: expenseData?.monthlyExpenses || [],
        byCategory: expenseData?.byCategory || {}
      },
      trends: {
        revenueGrowth: calculateGrowthRate(performanceData?.monthlyBreakdown || []),
        expenseGrowth: calculateGrowthRate(expenseData?.monthlyExpenses || [])
      }
    }

    // Generate report in requested format
    switch (format) {
      case 'pdf':
        return await generateQuarterlyPDFReport(reportData, session.organizationName || 'Organization')
      case 'excel':
        return await generateQuarterlyExcelReport(reportData, session.organizationName || 'Organization')
      case 'csv':
        return await generateQuarterlyCSVReport(reportData)
      case 'json':
        return NextResponse.json(reportData)
      default:
        return NextResponse.json({ error: 'Unsupported format' }, { status: 400 })
    }
  } catch (error) {
    console.error('Quarterly report generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate quarterly report', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

function calculateGrowthRate(data: any[]): number {
  if (data.length < 2) return 0
  const firstValue = data[0]?.revenue || data[0]?.amount || 0
  const lastValue = data[data.length - 1]?.revenue || data[data.length - 1]?.amount || 0
  if (firstValue === 0) return 0
  return ((lastValue - firstValue) / firstValue) * 100
}

async function generateQuarterlyPDFReport(data: any, orgName: string) {
  const pdfDoc = await PDFDocument.create()
  let page = pdfDoc.addPage()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  
  const { width, height } = page.getSize()
  let yPosition = height - 50

  // Title
  page.drawText(`Quarterly Performance Report`, {
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

  // Executive Summary
  page.drawText('Executive Summary', {
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
    ['Total Campaigns', data.summary.totalCampaigns.toString()],
    ['Active Shows', data.summary.activeShows.toString()],
    ['Total Episodes', data.summary.totalEpisodes.toString()],
    ['Avg Revenue/Campaign', `$${data.summary.averageRevenuePerCampaign.toLocaleString()}`]
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

  // Monthly Performance
  yPosition -= 20
  page.drawText('Monthly Performance', {
    x: 50,
    y: yPosition,
    size: 14,
    font: boldFont
  })
  yPosition -= 20

  for (const month of data.performance.monthlyBreakdown) {
    if (yPosition < 100) {
      page = pdfDoc.addPage()
      yPosition = height - 50
    }
    page.drawText(`${month.month}:`, {
      x: 50,
      y: yPosition,
      size: 10,
      font
    })
    page.drawText(`Revenue: $${month.revenue.toLocaleString()} | Campaigns: ${month.campaigns}`, {
      x: 150,
      y: yPosition,
      size: 10,
      font
    })
    yPosition -= 18
  }

  // Top Advertisers
  if (data.performance.topAdvertisers.length > 0) {
    yPosition -= 20
    if (yPosition < 200) {
      page = pdfDoc.addPage()
      yPosition = height - 50
    }
    page.drawText('Top Performing Advertisers', {
      x: 50,
      y: yPosition,
      size: 14,
      font: boldFont
    })
    yPosition -= 20

    for (const advertiser of data.performance.topAdvertisers.slice(0, 5)) {
      if (yPosition < 100) {
        page = pdfDoc.addPage()
        yPosition = height - 50
      }
      page.drawText(`${advertiser.name}:`, {
        x: 50,
        y: yPosition,
        size: 10,
        font
      })
      page.drawText(`$${advertiser.revenue.toLocaleString()} (${advertiser.campaigns} campaigns)`, {
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
      'Content-Disposition': `attachment; filename="quarterly-report-${data.period.label.replace(/\s/g, '-')}.pdf"`
    }
  })
}

async function generateQuarterlyExcelReport(data: any, orgName: string) {
  const workbook = new ExcelJS.Workbook()
  
  // Summary Sheet
  const summarySheet = workbook.addWorksheet('Executive Summary')
  summarySheet.columns = [
    { header: 'Metric', key: 'metric', width: 35 },
    { header: 'Value', key: 'value', width: 25 }
  ]
  
  summarySheet.addRows([
    { metric: 'Organization', value: orgName },
    { metric: 'Report Period', value: data.period.label },
    { metric: 'Total Revenue', value: `$${data.summary.totalRevenue.toLocaleString()}` },
    { metric: 'Total Expenses', value: `$${data.summary.totalExpenses.toLocaleString()}` },
    { metric: 'Net Profit', value: `$${data.summary.netProfit.toLocaleString()}` },
    { metric: 'Profit Margin', value: `${data.summary.profitMargin.toFixed(1)}%` },
    { metric: 'Total Campaigns', value: data.summary.totalCampaigns },
    { metric: 'Active Shows', value: data.summary.activeShows },
    { metric: 'Total Episodes Aired', value: data.summary.totalEpisodes },
    { metric: 'Average Revenue per Campaign', value: `$${data.summary.averageRevenuePerCampaign.toLocaleString()}` },
    { metric: 'Revenue Growth Rate', value: `${data.trends.revenueGrowth.toFixed(1)}%` },
    { metric: 'Expense Growth Rate', value: `${data.trends.expenseGrowth.toFixed(1)}%` }
  ])

  // Monthly Breakdown Sheet
  const monthlySheet = workbook.addWorksheet('Monthly Breakdown')
  monthlySheet.columns = [
    { header: 'Month', key: 'month', width: 20 },
    { header: 'Revenue', key: 'revenue', width: 20 },
    { header: 'Expenses', key: 'expenses', width: 20 },
    { header: 'Net Profit', key: 'netProfit', width: 20 },
    { header: 'Campaigns', key: 'campaigns', width: 15 }
  ]
  
  for (let i = 0; i < data.performance.monthlyBreakdown.length; i++) {
    const month = data.performance.monthlyBreakdown[i]
    const expense = data.expenses.monthlyBreakdown[i]
    monthlySheet.addRow({
      month: month.month,
      revenue: `$${month.revenue.toLocaleString()}`,
      expenses: `$${expense.amount.toLocaleString()}`,
      netProfit: `$${(month.revenue - expense.amount).toLocaleString()}`,
      campaigns: month.campaigns
    })
  }

  // Top Advertisers Sheet
  const advertisersSheet = workbook.addWorksheet('Top Advertisers')
  advertisersSheet.columns = [
    { header: 'Rank', key: 'rank', width: 10 },
    { header: 'Advertiser', key: 'name', width: 30 },
    { header: 'Revenue', key: 'revenue', width: 20 },
    { header: 'Campaigns', key: 'campaigns', width: 15 },
    { header: 'Avg per Campaign', key: 'average', width: 20 }
  ]
  
  data.performance.topAdvertisers.forEach((advertiser: any, index: number) => {
    advertisersSheet.addRow({
      rank: index + 1,
      name: advertiser.name,
      revenue: `$${advertiser.revenue.toLocaleString()}`,
      campaigns: advertiser.campaigns,
      average: `$${(advertiser.revenue / advertiser.campaigns).toLocaleString()}`
    })
  })

  // Expense Categories Sheet
  const expenseSheet = workbook.addWorksheet('Expense Analysis')
  expenseSheet.columns = [
    { header: 'Category', key: 'category', width: 25 },
    { header: 'Amount', key: 'amount', width: 20 },
    { header: 'Percentage', key: 'percentage', width: 15 }
  ]
  
  const totalExpenses = data.summary.totalExpenses
  for (const [category, amount] of Object.entries(data.expenses.byCategory)) {
    expenseSheet.addRow({
      category,
      amount: `$${(amount as number).toLocaleString()}`,
      percentage: `${((amount as number / totalExpenses) * 100).toFixed(1)}%`
    })
  }

  const buffer = await workbook.xlsx.writeBuffer()
  
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="quarterly-report-${data.period.label.replace(/\s/g, '-')}.xlsx"`
    }
  })
}

async function generateQuarterlyCSVReport(data: any) {
  let csv = 'Quarterly Performance Report\n'
  csv += `Period: ${data.period.label}\n\n`
  
  // Executive Summary
  csv += 'Executive Summary\n'
  csv += 'Metric,Value\n'
  csv += `Total Revenue,"$${data.summary.totalRevenue.toLocaleString()}"\n`
  csv += `Total Expenses,"$${data.summary.totalExpenses.toLocaleString()}"\n`
  csv += `Net Profit,"$${data.summary.netProfit.toLocaleString()}"\n`
  csv += `Profit Margin,"${data.summary.profitMargin.toFixed(1)}%"\n`
  csv += `Total Campaigns,${data.summary.totalCampaigns}\n`
  csv += `Active Shows,${data.summary.activeShows}\n`
  csv += `Total Episodes,${data.summary.totalEpisodes}\n`
  csv += `Average Revenue per Campaign,"$${data.summary.averageRevenuePerCampaign.toLocaleString()}"\n\n`
  
  // Monthly Breakdown
  csv += 'Monthly Performance\n'
  csv += 'Month,Revenue,Campaigns\n'
  for (const month of data.performance.monthlyBreakdown) {
    csv += `"${month.month}","$${month.revenue.toLocaleString()}",${month.campaigns}\n`
  }
  csv += '\n'
  
  // Top Advertisers
  csv += 'Top Performing Advertisers\n'
  csv += 'Advertiser,Revenue,Campaigns\n'
  for (const advertiser of data.performance.topAdvertisers) {
    csv += `"${advertiser.name}","$${advertiser.revenue.toLocaleString()}",${advertiser.campaigns}\n`
  }
  
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="quarterly-report-${data.period.label.replace(/\s/g, '-')}.csv"`
    }
  })
}