import { format, endOfWeek } from 'date-fns'
import { WeeklySpotData } from './fetch-weekly-spots'
import { CampaignData } from './fetch-campaigns'

export interface WeeklyDataEntry {
  weekStart: string
  weekEnd: string
  spots: number
  revenue: number
  campaigns: number
}

export function processWeeklyData(
  weeklySpots: WeeklySpotData[],
  campaigns: CampaignData[]
): WeeklyDataEntry[] {
  const weeklyData: WeeklyDataEntry[] = []

  weeklySpots.forEach(function(week) {
    const weekStartDate = new Date(week.week)
    const weekEndDate = endOfWeek(weekStartDate)
    
    // Count campaigns active during this week
    let activeCampaigns = 0
    campaigns.forEach(function(campaign) {
      const campaignStart = new Date(campaign.startDate)
      const campaignEnd = new Date(campaign.endDate)
      if (campaignStart <= weekEndDate && campaignEnd >= weekStartDate) {
        activeCampaigns = activeCampaigns + 1
      }
    })
    
    weeklyData.push({
      weekStart: format(weekStartDate, 'yyyy-MM-dd'),
      weekEnd: format(weekEndDate, 'yyyy-MM-dd'),
      spots: week.spots,
      revenue: week.revenue || 0,
      campaigns: activeCampaigns
    })
  })

  return weeklyData
}