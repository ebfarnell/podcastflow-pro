import { api } from './api'

export interface DashboardMetrics {
  activeCampaigns: number
  pendingCampaigns: number
  scheduledCampaigns: number
  monthlyRevenue: number
  totalRevenue: number
  totalImpressions: string
  totalClicks: string
  conversionRate: number
  revenueGrowth: number
  campaignStatusData: Array<{
    status: string
    count: number
    percentage: number
  }>
  topShows: Array<{
    id: string
    name: string
    host: string
    category: string
    revenue: string
    impressions: string
    trend: 'up' | 'down' | 'stable'
    change: number
  }>
  revenueByMonth: Array<{
    month: string
    revenue: number
  }>
  recentActivity: Array<{
    id: string
    type: string
    action: string
    title: string
    description: string
    timestamp: string
    icon: string
    color: string
  }>
  upcomingDeadlines: Array<{
    id: string
    title: string
    description: string
    dueDate: string
    daysUntilDue: number
    priority: string
    type: string
    campaignId?: string
    campaignName?: string
    assignedTo?: string
    status: string
  }>
  quickStats: {
    totalCampaigns: number
    activeCampaigns: number
    totalShows: number
    activeShows: number
    recentEpisodes: number
    totalAdvertisers: number
    activeAdvertisers: number
    avgCampaignBudget: number
    totalAdSlots: number
    utilizationRate: number
  }
}

class DashboardApi {
  async getDashboardData(dateRange: string = 'thisMonth'): Promise<DashboardMetrics> {
    try {
      const response = await api.get<any>('/dashboard', {
        params: { dateRange }
      })
      
      
      // The API already returns the data directly, no need to extract from response.data
      // Transform the response to match our interface
      const transformed = this.transformDashboardData(response)
      
      return transformed
    } catch (error) {
      console.error('❌ Dashboard API: Error fetching dashboard data:', error)
      // Return empty data structure on error
      const emptyData = this.getEmptyDashboardData()
      return emptyData
    }
  }

  async getKPIs(dateRange: string = 'thisMonth') {
    return api.get('/dashboard/kpis', {
      params: { dateRange }
    })
  }

  async getRevenueChart(period: string = 'monthly', months: number = 12) {
    return api.get('/dashboard/revenue-chart', {
      params: { period, months }
    })
  }

  async getCampaignStatus() {
    return api.get('/dashboard/campaign-status')
  }

  async getTopShows(limit: number = 5, dateRange: string = 'thisMonth') {
    return api.get('/dashboard/top-shows', {
      params: { limit, dateRange }
    })
  }

  async getRecentActivity(limit: number = 10) {
    return api.get('/dashboard/recent-activity', {
      params: { limit }
    })
  }

  async getUpcomingDeadlines(limit: number = 5, days: number = 7) {
    return api.get('/dashboard/upcoming-deadlines', {
      params: { limit, days }
    })
  }

  async getQuickStats(dateRange: string = 'thisWeek') {
    return api.get('/dashboard/quick-stats', {
      params: { dateRange }
    })
  }

  private transformDashboardData(data: any): DashboardMetrics {
    
    // Transform revenue by month data for chart
    const revenueByMonth = data.revenueByMonth || []
    const currentYear = new Date().getFullYear()
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    
    // Ensure we have data for all months
    const revenueMap = new Map(revenueByMonth.map((item: any) => [item.month, item.revenue]))
    const completeRevenueData = months.map(month => ({
      month,
      revenue: revenueMap.get(month) || 0
    }))

    const activeCampaigns = data.activeCampaigns || 0

    return {
      activeCampaigns: activeCampaigns,
      pendingCampaigns: data.pendingCampaigns || 0,
      scheduledCampaigns: data.scheduledCampaigns || 0,
      monthlyRevenue: data.monthlyRevenue || 0,
      totalRevenue: data.totalRevenue || 0,
      totalImpressions: data.totalImpressions || '0',
      totalClicks: data.totalClicks?.toString() || '0',
      conversionRate: parseFloat(data.conversionRate) || 0,
      revenueGrowth: data.revenueGrowth || 0,
      campaignStatusData: data.campaignStatusData || [],
      topShows: (data.topShows || []).map((show: any) => ({
        ...show,
        revenue: typeof show.revenue === 'number' ? `$${show.revenue.toLocaleString()}` : (show.revenue || '$0')
      })),
      revenueByMonth: data.revenueByMonth || completeRevenueData,
      recentActivity: data.recentActivity || [],
      upcomingDeadlines: data.upcomingDeadlines || [],
      quickStats: {
        totalCampaigns: data.totalCampaigns || 0,
        activeCampaigns: data.activeCampaigns || 0,
        totalShows: data.totalShows || 0,
        activeShows: data.activeShows || 0,
        recentEpisodes: data.recentEpisodes || 0,
        totalAdvertisers: data.totalAdvertisers || 0,
        activeAdvertisers: data.activeAdvertisers || 0,
        avgCampaignBudget: data.avgBudget || 0,
        totalAdSlots: data.totalAdSlots || 0,
        utilizationRate: data.utilizationRate || 0
      }
    }
  }

  private getEmptyDashboardData(): DashboardMetrics {
    // Return completely empty data structure on error
    return {
      activeCampaigns: 0,
      pendingCampaigns: 0,
      scheduledCampaigns: 0,
      monthlyRevenue: 0,
      totalRevenue: 0,
      totalImpressions: '0',
      totalClicks: '0',
      conversionRate: 0,
      revenueGrowth: 0,
      campaignStatusData: [],
      topShows: [],
      revenueByMonth: [],
      recentActivity: [],
      upcomingDeadlines: [],
      quickStats: {
        totalCampaigns: 0,
        activeCampaigns: 0,
        totalShows: 0,
        activeShows: 0,
        recentEpisodes: 0,
        totalAdvertisers: 0,
        activeAdvertisers: 0,
        avgCampaignBudget: 0,
        totalAdSlots: 0,
        utilizationRate: 0
      }
    }
  }
}

export const dashboardApi = new DashboardApi()