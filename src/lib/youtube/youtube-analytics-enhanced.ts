/**
 * Enhanced YouTube Analytics Service with Retention and Real-time Metrics
 */

import { google } from 'googleapis'
import { safeQuerySchema } from '@/lib/db/schema-db'
import { v4 as uuidv4 } from 'uuid'

const youtube = google.youtube('v3')
const youtubeAnalytics = google.youtubeAnalytics('v2')

interface RetentionData {
  elapsedVideoTimeRatio: number[]
  audienceWatchRatio: number[]
}

interface RealTimeMetrics {
  concurrentViewers?: number
  views: number
  likes: number
  comments: number
  chatMessages?: number
  isLive: boolean
}

interface TrafficSourceData {
  source: string
  sourceDetail?: string
  views: number
  watchTimeMinutes: number
  averageViewDuration: number
}

export class YouTubeAnalyticsEnhanced {
  private auth: any
  private orgSlug: string
  private organizationId: string

  constructor(auth: any, orgSlug: string, organizationId: string) {
    this.auth = auth
    this.orgSlug = orgSlug
    this.organizationId = organizationId
  }

  /**
   * Fetch and store audience retention data
   */
  async fetchRetentionData(videoId: string, startDate: string, endDate: string) {
    try {
      console.log(`Fetching retention data for video ${videoId}`)
      
      // Get audience retention curve
      const retentionResponse = await youtubeAnalytics.reports.query({
        auth: this.auth,
        ids: 'channel==MINE',
        startDate,
        endDate,
        metrics: 'audienceWatchRatio',
        dimensions: 'elapsedVideoTimeRatio',
        filters: `video==${videoId}`,
        sort: 'elapsedVideoTimeRatio'
      })

      if (!retentionResponse.data.rows || retentionResponse.data.rows.length === 0) {
        console.log('No retention data available')
        return null
      }

      // Process retention curve data
      const retentionCurve = retentionResponse.data.rows.map((row: any[]) => ({
        timeRatio: parseFloat(row[0]),
        watchRatio: parseFloat(row[1])
      }))

      // Get relative retention performance
      const relativeRetentionResponse = await youtubeAnalytics.reports.query({
        auth: this.auth,
        ids: 'channel==MINE',
        startDate,
        endDate,
        metrics: 'relativeRetentionPerformance',
        filters: `video==${videoId}`,
        dimensions: 'elapsedVideoTimeRatio',
        sort: 'elapsedVideoTimeRatio'
      })

      let relativeRetention = []
      if (relativeRetentionResponse.data.rows) {
        relativeRetention = relativeRetentionResponse.data.rows.map((row: any[]) => ({
          timeRatio: parseFloat(row[0]),
          performance: parseFloat(row[1])
        }))
      }

      // Identify key moments (significant drops or gains)
      const keyMoments = this.identifyKeyMoments(retentionCurve)

      // Store retention data
      const insertQuery = `
        INSERT INTO "YouTubeRetentionData" (
          "organizationId", "videoId", "date",
          "retentionCurve", "relativeRetention", "keyMoments",
          "createdAt", "updatedAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        ON CONFLICT ("videoId", "date") 
        DO UPDATE SET
          "retentionCurve" = EXCLUDED."retentionCurve",
          "relativeRetention" = EXCLUDED."relativeRetention",
          "keyMoments" = EXCLUDED."keyMoments",
          "updatedAt" = NOW()
      `

      await safeQuerySchema(this.orgSlug, insertQuery, [
        this.organizationId,
        videoId,
        endDate,
        JSON.stringify(retentionCurve),
        JSON.stringify(relativeRetention),
        JSON.stringify(keyMoments)
      ])

      // Update YouTubeAnalytics table with average retention metrics
      const avgWatchRatio = retentionCurve.reduce((sum, point) => sum + point.watchRatio, 0) / retentionCurve.length
      const avgRelativePerformance = relativeRetention.length > 0
        ? relativeRetention.reduce((sum, point) => sum + point.performance, 0) / relativeRetention.length
        : 0

      const updateAnalyticsQuery = `
        UPDATE "YouTubeAnalytics"
        SET 
          "audienceRetention" = $1,
          "audienceWatchRatio" = $2,
          "relativeRetentionPerformance" = $3,
          "updatedAt" = NOW()
        WHERE "videoId" = $4 AND "date" = $5
      `

      await safeQuerySchema(this.orgSlug, updateAnalyticsQuery, [
        JSON.stringify(retentionCurve),
        avgWatchRatio * 100,
        avgRelativePerformance,
        videoId,
        endDate
      ])

      return {
        retentionCurve,
        relativeRetention,
        keyMoments,
        avgWatchRatio,
        avgRelativePerformance
      }

    } catch (error) {
      console.error('Error fetching retention data:', error)
      return null
    }
  }

  /**
   * Fetch and store real-time metrics for recent/live videos
   */
  async fetchRealTimeMetrics(videoId: string) {
    try {
      console.log(`Fetching real-time metrics for video ${videoId}`)
      
      // Get current video details and statistics
      const videoResponse = await youtube.videos.list({
        auth: this.auth,
        part: ['statistics', 'liveStreamingDetails', 'snippet'],
        id: [videoId]
      })

      if (!videoResponse.data.items || videoResponse.data.items.length === 0) {
        return null
      }

      const video = videoResponse.data.items[0]
      const isLive = video.snippet?.liveBroadcastContent === 'live'
      
      const realTimeData: RealTimeMetrics = {
        views: parseInt(video.statistics?.viewCount || '0'),
        likes: parseInt(video.statistics?.likeCount || '0'),
        comments: parseInt(video.statistics?.commentCount || '0'),
        isLive
      }

      // If live, get concurrent viewers
      if (isLive && video.liveStreamingDetails) {
        realTimeData.concurrentViewers = parseInt(video.liveStreamingDetails.concurrentViewers || '0')
        
        // Get chat message count if available
        if (video.liveStreamingDetails.activeLiveChatId) {
          try {
            const chatResponse = await youtube.liveChatMessages.list({
              auth: this.auth,
              liveChatId: video.liveStreamingDetails.activeLiveChatId,
              part: ['snippet'],
              maxResults: 1
            })
            // This is just to check if chat is active, actual count would need aggregation
            realTimeData.chatMessages = chatResponse.data.pageInfo?.totalResults || 0
          } catch (error) {
            console.log('Could not fetch chat data:', error)
          }
        }
      }

      // Store real-time metrics
      const insertQuery = `
        INSERT INTO "YouTubeRealTimeMetrics" (
          "organizationId", "videoId", "timestamp",
          "concurrentViewers", "views", "likes", "comments",
          "chatMessages", "isLive", "createdAt"
        ) VALUES ($1, $2, NOW(), $3, $4, $5, $6, $7, $8, NOW())
        ON CONFLICT ("videoId", "timestamp") 
        DO UPDATE SET
          "concurrentViewers" = EXCLUDED."concurrentViewers",
          "views" = EXCLUDED."views",
          "likes" = EXCLUDED."likes",
          "comments" = EXCLUDED."comments",
          "chatMessages" = EXCLUDED."chatMessages",
          "isLive" = EXCLUDED."isLive"
      `

      await safeQuerySchema(this.orgSlug, insertQuery, [
        this.organizationId,
        videoId,
        realTimeData.concurrentViewers || 0,
        realTimeData.views,
        realTimeData.likes,
        realTimeData.comments,
        realTimeData.chatMessages || 0,
        realTimeData.isLive
      ])

      return realTimeData

    } catch (error) {
      console.error('Error fetching real-time metrics:', error)
      return null
    }
  }

  /**
   * Fetch and store traffic source breakdown
   */
  async fetchTrafficSources(videoId: string, startDate: string, endDate: string) {
    try {
      console.log(`Fetching traffic sources for video ${videoId}`)
      
      // Get traffic source breakdown
      const trafficResponse = await youtubeAnalytics.reports.query({
        auth: this.auth,
        ids: 'channel==MINE',
        startDate,
        endDate,
        metrics: 'views,estimatedMinutesWatched,averageViewDuration',
        dimensions: 'insightTrafficSourceType,insightTrafficSourceDetail',
        filters: `video==${videoId}`,
        sort: '-views',
        maxResults: 25
      })

      if (!trafficResponse.data.rows) {
        return []
      }

      const trafficSources: TrafficSourceData[] = trafficResponse.data.rows.map((row: any[]) => ({
        source: row[0],
        sourceDetail: row[1] || null,
        views: parseInt(row[2]) || 0,
        watchTimeMinutes: Math.round(parseInt(row[3]) || 0),
        averageViewDuration: parseInt(row[4]) || 0
      }))

      // Store traffic source data
      for (const source of trafficSources) {
        const insertQuery = `
          INSERT INTO "YouTubeTrafficSource" (
            "organizationId", "videoId", "date",
            "source", "sourceDetail", "views",
            "watchTimeMinutes", "averageViewDuration",
            "createdAt"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
          ON CONFLICT ("videoId", "date", "source", "sourceDetail")
          DO UPDATE SET
            "views" = EXCLUDED."views",
            "watchTimeMinutes" = EXCLUDED."watchTimeMinutes",
            "averageViewDuration" = EXCLUDED."averageViewDuration"
        `

        await safeQuerySchema(this.orgSlug, insertQuery, [
          this.organizationId,
          videoId,
          endDate,
          source.source,
          source.sourceDetail,
          source.views,
          source.watchTimeMinutes,
          source.averageViewDuration
        ])
      }

      // Get search terms if available
      const searchTermsResponse = await youtubeAnalytics.reports.query({
        auth: this.auth,
        ids: 'channel==MINE',
        startDate,
        endDate,
        metrics: 'views',
        dimensions: 'insightTrafficSourceDetail',
        filters: `video==${videoId};insightTrafficSourceType==YT_SEARCH`,
        sort: '-views',
        maxResults: 20
      })

      let searchTerms = []
      if (searchTermsResponse.data.rows) {
        searchTerms = searchTermsResponse.data.rows.map((row: any[]) => ({
          term: row[0],
          views: parseInt(row[1]) || 0
        }))
      }

      return {
        trafficSources,
        searchTerms
      }

    } catch (error) {
      console.error('Error fetching traffic sources:', error)
      return { trafficSources: [], searchTerms: [] }
    }
  }

  /**
   * Fetch card and end screen performance
   */
  async fetchCardMetrics(videoId: string, startDate: string, endDate: string) {
    try {
      console.log(`Fetching card metrics for video ${videoId}`)
      
      const cardResponse = await youtubeAnalytics.reports.query({
        auth: this.auth,
        ids: 'channel==MINE',
        startDate,
        endDate,
        metrics: 'cardImpressions,cardClicks,cardClickRate,cardTeaserImpressions,cardTeaserClicks,cardTeaserClickRate',
        filters: `video==${videoId}`
      })

      if (!cardResponse.data.rows || cardResponse.data.rows.length === 0) {
        return null
      }

      const cardData = cardResponse.data.rows[0]
      
      // Update YouTubeAnalytics with card metrics
      const updateQuery = `
        UPDATE "YouTubeAnalytics"
        SET 
          "cardImpressions" = $1,
          "cardClickRate" = $2,
          "cardTeaserClickRate" = $3,
          "updatedAt" = NOW()
        WHERE "videoId" = $4 AND "date" = $5
      `

      await safeQuerySchema(this.orgSlug, updateQuery, [
        parseInt(cardData[0]) || 0,
        parseFloat(cardData[2]) || 0,
        parseFloat(cardData[5]) || 0,
        videoId,
        endDate
      ])

      // Get end screen metrics
      const endScreenResponse = await youtubeAnalytics.reports.query({
        auth: this.auth,
        ids: 'channel==MINE',
        startDate,
        endDate,
        metrics: 'endScreenImpressions,endScreenClicks,endScreenClickRate',
        filters: `video==${videoId}`
      })

      if (endScreenResponse.data.rows && endScreenResponse.data.rows.length > 0) {
        const endScreenData = endScreenResponse.data.rows[0]
        
        const updateEndScreenQuery = `
          UPDATE "YouTubeAnalytics"
          SET 
            "endScreenImpressions" = $1,
            "endScreenElementClickRate" = $2,
            "updatedAt" = NOW()
          WHERE "videoId" = $3 AND "date" = $4
        `

        await safeQuerySchema(this.orgSlug, updateEndScreenQuery, [
          parseInt(endScreenData[0]) || 0,
          parseFloat(endScreenData[2]) || 0,
          videoId,
          endDate
        ])
      }

      return {
        cardImpressions: parseInt(cardData[0]) || 0,
        cardClicks: parseInt(cardData[1]) || 0,
        cardClickRate: parseFloat(cardData[2]) || 0,
        endScreenImpressions: endScreenResponse.data.rows?.[0]?.[0] || 0,
        endScreenClickRate: endScreenResponse.data.rows?.[0]?.[2] || 0
      }

    } catch (error) {
      console.error('Error fetching card metrics:', error)
      return null
    }
  }

  /**
   * Identify key moments in retention curve (significant changes)
   */
  private identifyKeyMoments(retentionCurve: any[]): any[] {
    const keyMoments = []
    const threshold = 0.05 // 5% change threshold

    for (let i = 1; i < retentionCurve.length; i++) {
      const prevPoint = retentionCurve[i - 1]
      const currPoint = retentionCurve[i]
      const change = currPoint.watchRatio - prevPoint.watchRatio

      if (Math.abs(change) > threshold) {
        keyMoments.push({
          timeRatio: currPoint.timeRatio,
          watchRatio: currPoint.watchRatio,
          change: change,
          type: change > 0 ? 'gain' : 'drop',
          significance: Math.abs(change)
        })
      }
    }

    // Sort by significance
    keyMoments.sort((a, b) => b.significance - a.significance)
    
    // Return top 10 most significant moments
    return keyMoments.slice(0, 10)
  }

  /**
   * Comprehensive sync for all enhanced metrics
   */
  async syncAllMetrics(videoId: string, dateRange?: { start: string, end: string }) {
    const endDate = dateRange?.end || new Date().toISOString().split('T')[0]
    const startDate = dateRange?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    console.log(`Starting comprehensive sync for video ${videoId} from ${startDate} to ${endDate}`)

    const results = {
      retention: null as any,
      realTime: null as any,
      traffic: null as any,
      cards: null as any,
      errors: [] as string[]
    }

    // Fetch all metrics in parallel where possible
    const promises = [
      this.fetchRetentionData(videoId, startDate, endDate).catch(err => {
        results.errors.push(`Retention: ${err.message}`)
        return null
      }),
      this.fetchRealTimeMetrics(videoId).catch(err => {
        results.errors.push(`RealTime: ${err.message}`)
        return null
      }),
      this.fetchTrafficSources(videoId, startDate, endDate).catch(err => {
        results.errors.push(`Traffic: ${err.message}`)
        return null
      }),
      this.fetchCardMetrics(videoId, startDate, endDate).catch(err => {
        results.errors.push(`Cards: ${err.message}`)
        return null
      })
    ]

    const [retention, realTime, traffic, cards] = await Promise.all(promises)

    results.retention = retention
    results.realTime = realTime
    results.traffic = traffic
    results.cards = cards

    console.log(`Sync complete for video ${videoId}. Errors: ${results.errors.length}`)
    
    return results
  }
}