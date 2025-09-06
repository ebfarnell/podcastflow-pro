import { api } from './api'

export interface AnalyticsKPIs {
  totalRevenue: number
  revenueGrowth: number
  activeCampaigns: number
  campaignGrowth: number
  totalImpressions: number
  impressionGrowth: number
  uniqueListeners: number
  listenerGrowth: number
  averageCTR: number
  conversionRate: number
}

export interface RevenueData {
  month: string
  revenue: number
  target: number
}

export interface PerformanceData {
  date: string
  impressions: number
  clicks: number
  ctr: number
  conversions?: number
  cvr?: number
}

export interface AudienceData {
  name: string
  value: number
}

export interface CampaignPerformance {
  name: string
  revenue: number
  impressions: number
  clicks?: number
  ctr?: number
  roi?: number
}

export interface AnalyticsResponse {
  kpis: AnalyticsKPIs
  revenueData: RevenueData[]
  performanceData: PerformanceData[]
  audienceData: AudienceData[]
  campaignPerformance: CampaignPerformance[]
  insights?: {
    topPerformingCampaign?: string
    bestAudienceSegment?: string
    peakPerformanceMonth?: string
    recommendedActions?: string[]
  }
}

class AnalyticsApi {
  async getAnalytics(params?: {
    timeRange?: string
    startDate?: string
    endDate?: string
    campaignFilter?: string
  }): Promise<AnalyticsResponse> {
    try {
      const response = await api.get<any>('/analytics', { params })
      
      // Transform response to match our interface
      return this.transformAnalyticsData(response)
    } catch (error) {
      console.error('Error fetching analytics:', error)
      // Return empty structure on error
      return this.getEmptyAnalyticsData()
    }
  }

  async getKPIs(timeRange?: string, startDate?: string, endDate?: string): Promise<AnalyticsKPIs> {
    try {
      const params: any = {}
      if (startDate && endDate) {
        params.startDate = startDate
        params.endDate = endDate
      } else {
        params.timeRange = timeRange || '30d'
      }
      
      const response = await api.get<any>('/analytics/kpis', { params })
      
      return {
        totalRevenue: response.totalRevenue || 0,
        revenueGrowth: response.revenueGrowth || 0,
        activeCampaigns: response.activeCampaigns || 0,
        campaignGrowth: response.campaignGrowth || 0,
        totalImpressions: response.totalImpressions || 0,
        impressionGrowth: response.impressionGrowth || 0,
        uniqueListeners: response.uniqueListeners || 0,
        listenerGrowth: response.listenerGrowth || 0,
        averageCTR: response.averageCTR || 0,
        conversionRate: response.conversionRate || 0
      }
    } catch (error) {
      console.error('Error fetching KPIs:', error)
      return this.getEmptyKPIs()
    }
  }

  async getRevenueData(params?: {
    timeRange?: string
    startDate?: string
    endDate?: string
    granularity?: 'daily' | 'weekly' | 'monthly'
  }): Promise<RevenueData[]> {
    try {
      const response = await api.get<any>('/analytics/revenue', { params })
      
      return (response.data || []).map((item: any) => ({
        month: item.month || item.period || item.date,
        revenue: item.revenue || 0,
        target: item.target || Math.round(item.revenue * 0.9) // Default target to 90% of revenue
      }))
    } catch (error) {
      console.error('Error fetching revenue data:', error)
      return []
    }
  }

  async getPerformanceData(params?: {
    timeRange?: string
    startDate?: string
    endDate?: string
    metrics?: string[]
  }): Promise<PerformanceData[]> {
    try {
      const response = await api.get<any>('/analytics/performance', { params })
      
      return (response.data || []).map((item: any) => ({
        date: item.date,
        impressions: item.impressions || 0,
        clicks: item.clicks || 0,
        ctr: item.ctr || (item.clicks && item.impressions ? (item.clicks / item.impressions * 100) : 0),
        conversions: item.conversions || 0,
        cvr: item.cvr || (item.conversions && item.clicks ? (item.conversions / item.clicks * 100) : 0)
      }))
    } catch (error) {
      console.error('Error fetching performance data:', error)
      return []
    }
  }

  async getAudienceData(params?: {
    type?: 'age' | 'gender' | 'location' | 'device'
  }): Promise<AudienceData[]> {
    try {
      const response = await api.get<any>('/analytics/audience', { params })
      
      return (response.data || []).map((item: any) => ({
        name: item.name || item.segment || item.category,
        value: item.value || item.percentage || item.count || 0
      }))
    } catch (error) {
      console.error('Error fetching audience data:', error)
      return []
    }
  }

  async getCampaignPerformance(params?: {
    timeRange?: string
    startDate?: string
    endDate?: string
    limit?: number
    sort?: string
  }): Promise<CampaignPerformance[]> {
    try {
      const response = await api.get<any>('/analytics/campaigns', { params })
      
      return (response.data || []).map((item: any) => ({
        name: item.name || item.campaignName,
        revenue: item.revenue || 0,
        impressions: item.impressions || 0,
        clicks: item.clicks || 0,
        ctr: item.ctr || (item.clicks && item.impressions ? (item.clicks / item.impressions * 100) : 0),
        roi: item.roi || 0
      }))
    } catch (error) {
      console.error('Error fetching campaign performance:', error)
      return []
    }
  }

  async getAudienceInsights(params?: {
    timeRange?: string
    startDate?: string
    endDate?: string
  }): Promise<any> {
    try {
      const response = await api.get<any>('/analytics/audience/insights', { params })
      return response
    } catch (error) {
      console.error('Error fetching audience insights:', error)
      return null
    }
  }

  private transformAnalyticsData(data: any): AnalyticsResponse {
    return {
      kpis: {
        totalRevenue: data.kpis?.totalRevenue || 0,
        revenueGrowth: data.kpis?.revenueGrowth || 0,
        activeCampaigns: data.kpis?.activeCampaigns || 0,
        campaignGrowth: data.kpis?.campaignGrowth || 0,
        totalImpressions: data.kpis?.totalImpressions || 0,
        impressionGrowth: data.kpis?.impressionGrowth || 0,
        uniqueListeners: data.kpis?.uniqueListeners || 0,
        listenerGrowth: data.kpis?.listenerGrowth || 0,
        averageCTR: data.kpis?.averageCTR || 0,
        conversionRate: data.kpis?.conversionRate || 0
      },
      revenueData: data.revenueData || [],
      performanceData: data.performanceData || [],
      audienceData: data.audienceData || [],
      campaignPerformance: data.campaignPerformance || [],
      insights: data.insights
    }
  }

  private getEmptyAnalyticsData(): AnalyticsResponse {
    return {
      kpis: this.getEmptyKPIs(),
      revenueData: [],
      performanceData: [],
      audienceData: [],
      campaignPerformance: [],
      insights: {}
    }
  }

  private getEmptyKPIs(): AnalyticsKPIs {
    return {
      totalRevenue: 0,
      revenueGrowth: 0,
      activeCampaigns: 0,
      campaignGrowth: 0,
      totalImpressions: 0,
      impressionGrowth: 0,
      uniqueListeners: 0,
      listenerGrowth: 0,
      averageCTR: 0,
      conversionRate: 0
    }
  }
}

export const analyticsApi = new AnalyticsApi()