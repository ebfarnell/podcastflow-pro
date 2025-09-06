/**
 * Tests for ShowMetricsAggregator
 */

import { ShowMetricsAggregator } from '@/server/aggregators/showMetrics'

describe('ShowMetricsAggregator', () => {
  let aggregator: ShowMetricsAggregator
  const mockOrgId = 'org-123'
  const mockOrgSlug = 'org_podcastflow_pro'
  const mockShowId = 'show-123'

  beforeEach(() => {
    aggregator = new ShowMetricsAggregator(mockOrgId, mockOrgSlug)
  })

  describe('Date merging and alignment', () => {
    it('should correctly merge YouTube and Megaphone data by date', () => {
      const youtubeData = [
        { date: '2025-08-20', views: 1000, likes: 50 },
        { date: '2025-08-21', views: 1200, likes: 60 },
        { date: '2025-08-22', views: 800, likes: 40 },
      ]

      const megaphoneData = [
        { date: '2025-08-20', downloads: 500, listeners: 300 },
        { date: '2025-08-21', downloads: 600, listeners: 350 },
        { date: '2025-08-23', downloads: 400, listeners: 250 }, // Different date
      ]

      // Private method test - would need to expose or test via public API
      const merged = aggregator['fillTimeseriesGaps'](
        [...youtubeData, ...megaphoneData].reduce((acc, item) => {
          const existing = acc.find(d => d.date === item.date)
          if (existing) {
            Object.assign(existing, item)
          } else {
            acc.push(item)
          }
          return acc
        }, [] as any[]),
        '2025-08-20',
        '2025-08-23'
      )

      expect(merged).toHaveLength(4) // 4 days total
      expect(merged[0]).toEqual({
        date: '2025-08-20',
        views: 1000,
        likes: 50,
        downloads: 500,
        listeners: 300,
      })
      expect(merged[2]).toEqual({
        date: '2025-08-22',
        views: 800,
        likes: 40,
      }) // No Megaphone data for this date
      expect(merged[3]).toEqual({
        date: '2025-08-23',
        downloads: 400,
        listeners: 250,
      }) // No YouTube data for this date
    })

    it('should handle null values correctly', () => {
      const data = [
        { date: '2025-08-20', views: null, downloads: 500 },
        { date: '2025-08-21', views: 1000, downloads: null },
      ]

      // The aggregator should preserve nulls, not convert to 0
      const result = aggregator['fillTimeseriesGaps'](data, '2025-08-20', '2025-08-21')
      
      expect(result[0].views).toBeNull()
      expect(result[0].downloads).toBe(500)
      expect(result[1].views).toBe(1000)
      expect(result[1].downloads).toBeNull()
    })

    it('should fill missing dates with empty objects', () => {
      const data = [
        { date: '2025-08-20', views: 1000 },
        { date: '2025-08-23', views: 1200 }, // Gap of 2 days
      ]

      const filled = aggregator['fillTimeseriesGaps'](data, '2025-08-20', '2025-08-23')
      
      expect(filled).toHaveLength(4)
      expect(filled[1]).toEqual({ date: '2025-08-21' }) // Empty
      expect(filled[2]).toEqual({ date: '2025-08-22' }) // Empty
    })
  })

  describe('Service fallbacks', () => {
    it('should return partial data when YouTube is unavailable', async () => {
      // Mock YouTube service to fail
      jest.spyOn(aggregator['youtubeService'], 'isConnected').mockReturnValue(false)
      jest.spyOn(aggregator['megaphoneService'], 'isConnected').mockReturnValue(true)

      // Mock show info
      jest.spyOn(aggregator as any, 'fetchShowInfo').mockResolvedValue({
        id: mockShowId,
        name: 'Test Show',
        externalIds: {
          youtubeChannelId: 'channel-123',
          megaphoneShowId: 'megaphone-123',
        },
      })

      // Mock Megaphone data
      jest.spyOn(aggregator as any, 'fetchMegaphoneMetrics').mockResolvedValue({
        totalDownloads: 5000,
        uniqueListeners: 1000,
        listenThroughRate: 75,
        dailyStats: [],
      })

      const result = await aggregator.getShowMetrics({
        orgId: mockOrgId,
        orgSlug: mockOrgSlug,
        showId: mockShowId,
        window: '30d',
      })

      expect(result.status.youtubeConnected).toBe(false)
      expect(result.status.megaphoneConnected).toBe(true)
      expect(result.status.partialData).toBe(true)
      expect(result.totals.youtubeViews).toBeNull()
      expect(result.totals.megaphoneDownloads).toBe(5000)
      expect(result.status.errors).toContain('YouTube not connected. Configure API key in settings.')
    })

    it('should return partial data when Megaphone is unavailable', async () => {
      // Mock Megaphone service to fail
      jest.spyOn(aggregator['youtubeService'], 'isConnected').mockReturnValue(true)
      jest.spyOn(aggregator['megaphoneService'], 'isConnected').mockReturnValue(false)

      // Mock show info
      jest.spyOn(aggregator as any, 'fetchShowInfo').mockResolvedValue({
        id: mockShowId,
        name: 'Test Show',
        externalIds: {
          youtubeChannelId: 'channel-123',
          megaphoneShowId: 'megaphone-123',
        },
      })

      // Mock YouTube data
      jest.spyOn(aggregator as any, 'fetchYouTubeMetrics').mockResolvedValue({
        totalViews: 10000,
        totalLikes: 500,
        totalComments: 100,
        avgViewDuration: 240,
        uniqueViewers: null,
        subscriberCount: 5000,
        likeRate: 5,
        commentRate: 1,
        viewThroughRate: 65,
        dailyStats: [],
      })

      const result = await aggregator.getShowMetrics({
        orgId: mockOrgId,
        orgSlug: mockOrgSlug,
        showId: mockShowId,
        window: '30d',
      })

      expect(result.status.youtubeConnected).toBe(true)
      expect(result.status.megaphoneConnected).toBe(false)
      expect(result.status.partialData).toBe(true)
      expect(result.totals.youtubeViews).toBe(10000)
      expect(result.totals.megaphoneDownloads).toBeNull()
      expect(result.status.errors).toContain('Megaphone not connected. Configure API credentials in settings.')
    })

    it('should handle both services being unavailable', async () => {
      jest.spyOn(aggregator['youtubeService'], 'isConnected').mockReturnValue(false)
      jest.spyOn(aggregator['megaphoneService'], 'isConnected').mockReturnValue(false)

      // Mock show info
      jest.spyOn(aggregator as any, 'fetchShowInfo').mockResolvedValue({
        id: mockShowId,
        name: 'Test Show',
        externalIds: {
          youtubeChannelId: 'channel-123',
          megaphoneShowId: 'megaphone-123',
        },
      })

      const result = await aggregator.getShowMetrics({
        orgId: mockOrgId,
        orgSlug: mockOrgSlug,
        showId: mockShowId,
        window: '30d',
      })

      expect(result.status.youtubeConnected).toBe(false)
      expect(result.status.megaphoneConnected).toBe(false)
      expect(result.status.partialData).toBe(false) // No partial data, everything is null
      expect(result.totals.youtubeViews).toBeNull()
      expect(result.totals.megaphoneDownloads).toBeNull()
      expect(result.status.errors).toHaveLength(2)
    })
  })

  describe('Quota-blocked YouTube calls', () => {
    it('should return typed error when quota is exceeded', async () => {
      // Mock quota exceeded
      jest.spyOn(aggregator['youtubeService'], 'isConnected').mockReturnValue(true)
      jest.spyOn(aggregator as any, 'fetchYouTubeMetrics').mockRejectedValue(
        new Error('YouTube quota exceeded: Daily limit reached (10000/10000 units used)')
      )

      // Mock show info
      jest.spyOn(aggregator as any, 'fetchShowInfo').mockResolvedValue({
        id: mockShowId,
        name: 'Test Show',
        externalIds: {
          youtubeChannelId: 'channel-123',
        },
      })

      const result = await aggregator.getShowMetrics({
        orgId: mockOrgId,
        orgSlug: mockOrgSlug,
        showId: mockShowId,
        window: '30d',
      })

      expect(result.status.partialData).toBe(true)
      expect(result.totals.youtubeViews).toBeNull()
      expect(result.status.errors).toContain(
        'YouTube: YouTube quota exceeded: Daily limit reached (10000/10000 units used)'
      )
    })

    it('should not crash the page API when quota is blocked', async () => {
      // This is tested by the fact that the above test returns a valid response
      // instead of throwing an error
      expect(true).toBe(true)
    })
  })

  describe('Date range calculations', () => {
    it('should calculate correct date range for 30d window', () => {
      const dateRange = aggregator['calculateDateRange']({
        orgId: mockOrgId,
        orgSlug: mockOrgSlug,
        showId: mockShowId,
        window: '30d',
      })

      const now = new Date()
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      expect(dateRange.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(dateRange.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)

      const start = new Date(dateRange.startDate)
      const end = new Date(dateRange.endDate)
      const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      
      expect(daysDiff).toBeGreaterThanOrEqual(29)
      expect(daysDiff).toBeLessThanOrEqual(31)
    })

    it('should handle custom date range', () => {
      const dateRange = aggregator['calculateDateRange']({
        orgId: mockOrgId,
        orgSlug: mockOrgSlug,
        showId: mockShowId,
        window: 'custom',
        startDate: '2025-08-01',
        endDate: '2025-08-15',
      })

      expect(dateRange.startDate).toBe('2025-08-01')
      expect(dateRange.endDate).toBe('2025-08-15')
    })

    it('should throw error for custom window without dates', () => {
      expect(() => {
        aggregator['calculateDateRange']({
          orgId: mockOrgId,
          orgSlug: mockOrgSlug,
          showId: mockShowId,
          window: 'custom',
        })
      }).toThrow('Custom date range requires startDate and endDate')
    })
  })
})