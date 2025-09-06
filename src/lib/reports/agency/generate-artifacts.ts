import { format } from 'date-fns'
import { AgencyData } from './fetch-agency-data'
import { AdvertiserData } from './fetch-advertisers'
import { CampaignData } from './fetch-campaigns'
import { LineItemData } from './fetch-line-items'
import { MonthlyDataEntry } from './process-monthly-data'
import { WeeklyDataEntry } from './process-weekly-data'

export interface ReportArtifacts {
  [key: string]: string
}

export function generateSummaryJson(
  correlationId: string,
  agencyData: AgencyData,
  advertisers: AdvertiserData[],
  campaigns: CampaignData[],
  monthlyData: MonthlyDataEntry[],
  startDate: Date,
  endDate: Date
): string {
  const totalGoal = monthlyData.reduce(function(sum, m) { return sum + m.goal }, 0)
  const totalActual = monthlyData.reduce(function(sum, m) { return sum + m.actual }, 0)
  const totalVariance = monthlyData.reduce(function(sum, m) { return sum + m.variance }, 0)
  
  let overallPercentToGoal = 0
  if (monthlyData.length > 0 && totalGoal > 0) {
    overallPercentToGoal = Math.round((totalActual / totalGoal) * 100)
  }
  
  const activeCampaigns = campaigns.filter(function(c) { return c.status === 'active' }).length
  const totalBudget = campaigns.reduce(function(sum, c) { return sum + (c.budget || 0) }, 0)

  return JSON.stringify({
    reportId: correlationId,
    generatedAt: new Date().toISOString(),
    agency: {
      id: agencyData.id,
      name: agencyData.name,
      status: agencyData.isActive ? 'active' : 'inactive',
      advertiserCount: advertisers.length,
      campaignCount: campaigns.length,
    },
    dateRange: {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    },
    totals: {
      totalGoal: totalGoal,
      totalActual: totalActual,
      totalVariance: totalVariance,
      overallPercentToGoal: overallPercentToGoal,
      activeCampaigns: activeCampaigns,
      totalBudget: totalBudget,
    }
  }, null, 2)
}

export function generateMonthlyCSV(monthlyData: MonthlyDataEntry[]): string {
  const headers = 'Month,Year,Goal,Actual,Variance,% to Goal,Advertiser Count'
  const rows = monthlyData.map(function(m) {
    return `${m.month},${m.year},${m.goal},${m.actual},${m.variance},${m.percentToGoal}%,${m.advertiserCount}`
  })
  return [headers].concat(rows).join('\n')
}

export function generateWeeklyCSV(weeklyData: WeeklyDataEntry[]): string {
  const headers = 'Week Start,Week End,Spots,Revenue,Active Campaigns'
  const rows = weeklyData.map(function(w) {
    return `${w.weekStart},${w.weekEnd},${w.spots},${w.revenue},${w.campaigns}`
  })
  return [headers].concat(rows).join('\n')
}

export function generateCampaignsCSV(campaigns: CampaignData[]): string {
  const headers = 'Campaign Name,Advertiser,Status,Budget,Start Date,End Date,Created'
  const rows = campaigns.map(function(c) {
    const startDateStr = format(new Date(c.startDate), 'yyyy-MM-dd')
    const endDateStr = format(new Date(c.endDate), 'yyyy-MM-dd')
    const createdStr = format(new Date(c.createdAt), 'yyyy-MM-dd')
    return `"${c.name}","${c.advertiserName}",${c.status},${c.budget || 0},${startDateStr},${endDateStr},${createdStr}`
  })
  return [headers].concat(rows).join('\n')
}

export function generateLineItemsCSV(lineItems: LineItemData[]): string {
  const headers = 'Campaign,Show,Episode,Placement Type,Air Date,Rate,Status'
  const rows = lineItems.map(function(item) {
    const airDateStr = format(new Date(item.airDate), 'yyyy-MM-dd')
    return `"${item.campaignName}","${item.showName}","${item.episodeTitle}",${item.placementType},${airDateStr},${item.rate},${item.status}`
  })
  return [headers].concat(rows).join('\n')
}