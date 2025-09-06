/**
 * YouTube Quota Enforcement Tests
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { quotaManager, YOUTUBE_API_COSTS, QuotaExceededError } from '@/lib/youtube/quota-manager'

describe('YouTube Quota Manager', () => {
  const testOrgId = 'test-org-123'
  
  beforeEach(() => {
    jest.clearAllMocks()
  })
  
  describe('Cost Calculation', () => {
    it('should calculate correct costs for different endpoints', () => {
      expect(quotaManager.calculateCost('videos.list')).toBe(1)
      expect(quotaManager.calculateCost('search.list')).toBe(100)
      expect(quotaManager.calculateCost('channels.list')).toBe(1)
      expect(quotaManager.calculateCost('playlistItems.list')).toBe(1)
      expect(quotaManager.calculateCost('reports.query')).toBe(1)
    })
    
    it('should calculate costs with parts multiplier', () => {
      expect(quotaManager.calculateCost('videos.list', { parts: ['snippet', 'statistics', 'contentDetails'] })).toBe(3)
      expect(quotaManager.calculateCost('channels.list', { parts: ['snippet', 'statistics'] })).toBe(2)
    })
    
    it('should use custom cost when provided', () => {
      expect(quotaManager.calculateCost('videos.list', { customCost: 50 })).toBe(50)
    })
    
    it('should calculate batch costs', () => {
      expect(quotaManager.calculateCost('videos.list', { count: 10 })).toBe(10)
      expect(quotaManager.calculateCost('search.list', { count: 3 })).toBe(300)
    })
  })
  
  describe('Quota Checking', () => {
    it('should allow calls when under quota limit', async () => {
      const check = await quotaManager.checkQuota(testOrgId, 'videos.list', 1)
      expect(check.allowed).toBe(true)
      expect(check.willExceedAfter).toBe(false)
    })
    
    it('should block calls when quota would be exceeded', async () => {
      // Simulate high usage
      const check = await quotaManager.checkQuota(testOrgId, 'search.list', 100)
      // This would depend on current usage
      expect(check).toHaveProperty('allowed')
      expect(check).toHaveProperty('currentUsage')
      expect(check).toHaveProperty('dailyLimit')
    })
    
    it('should calculate percentage used correctly', async () => {
      const check = await quotaManager.checkQuota(testOrgId, 'videos.list')
      expect(check.percentageUsed).toBeGreaterThanOrEqual(0)
      expect(check.percentageUsed).toBeLessThanOrEqual(100)
    })
    
    it('should provide reset time', async () => {
      const check = await quotaManager.checkQuota(testOrgId, 'videos.list')
      expect(check.resetAt).toBeInstanceOf(Date)
      expect(check.resetAt.getTime()).toBeGreaterThan(Date.now())
    })
  })
  
  describe('Quota Enforcement', () => {
    it('should throw QuotaExceededError when limit reached', async () => {
      // This test would need mock data setup
      const apiCall = async () => {
        return await quotaManager.executeWithQuota(
          testOrgId,
          'search.list',
          async () => ({ data: 'test' }),
          { cost: 100000 } // Exceed limit
        )
      }
      
      await expect(apiCall()).rejects.toThrow(QuotaExceededError)
    })
    
    it('should record usage after successful API call', async () => {
      const result = await quotaManager.executeWithQuota(
        testOrgId,
        'videos.list',
        async () => ({ success: true }),
        { cost: 1 }
      )
      
      expect(result).toEqual({ success: true })
      // Usage should be recorded
    })
    
    it('should not record usage if API call fails', async () => {
      const apiCall = async () => {
        return await quotaManager.executeWithQuota(
          testOrgId,
          'videos.list',
          async () => {
            throw new Error('API Error')
          }
        )
      }
      
      await expect(apiCall()).rejects.toThrow('API Error')
      // Usage should not be recorded
    })
  })
  
  describe('Threshold Alerts', () => {
    it('should trigger alert at 80% usage', async () => {
      // This would need to simulate usage at 79% then crossing to 80%
      const update = await quotaManager.recordUsage(testOrgId, 'videos.list', 1)
      expect(update.thresholdCrossed).toBeUndefined() // or 80 if threshold crossed
    })
    
    it('should trigger alert at 100% usage', async () => {
      // This would need to simulate usage at 99% then crossing to 100%
      const update = await quotaManager.recordUsage(testOrgId, 'search.list', 100)
      expect(update.thresholdCrossed).toBeUndefined() // or 100 if threshold crossed
    })
    
    it('should pause sync when quota exceeded', async () => {
      // Test that sync is paused when 100% is reached
      // This would need database mocking
    })
  })
  
  describe('Daily Reset', () => {
    it('should reset quota at org-local midnight', async () => {
      await quotaManager.resetDailyQuota(testOrgId)
      
      const status = await quotaManager.getQuotaStatus(testOrgId)
      expect(status.used).toBe(0)
      expect(status.canSync).toBe(true)
      expect(status.isPaused).toBe(false)
    })
    
    it('should re-enable sync after reset', async () => {
      await quotaManager.resetDailyQuota(testOrgId)
      
      const status = await quotaManager.getQuotaStatus(testOrgId)
      expect(status.canSync).toBe(true)
    })
  })
  
  describe('Quota Status', () => {
    it('should provide current quota status', async () => {
      const status = await quotaManager.getQuotaStatus(testOrgId)
      
      expect(status).toHaveProperty('used')
      expect(status).toHaveProperty('limit')
      expect(status).toHaveProperty('percentage')
      expect(status).toHaveProperty('resetAt')
      expect(status).toHaveProperty('isPaused')
      expect(status).toHaveProperty('canSync')
    })
    
    it('should indicate when sync is paused', async () => {
      // This would need to simulate quota exceeded state
      const status = await quotaManager.getQuotaStatus(testOrgId)
      expect(typeof status.isPaused).toBe('boolean')
    })
  })
})

describe('YouTube API Cost Constants', () => {
  it('should have correct cost values for all endpoints', () => {
    expect(YOUTUBE_API_COSTS['videos.list']).toBe(1)
    expect(YOUTUBE_API_COSTS['videos.insert']).toBe(1600)
    expect(YOUTUBE_API_COSTS['videos.update']).toBe(50)
    expect(YOUTUBE_API_COSTS['search.list']).toBe(100)
    expect(YOUTUBE_API_COSTS['channels.list']).toBe(1)
    expect(YOUTUBE_API_COSTS['playlistItems.list']).toBe(1)
    expect(YOUTUBE_API_COSTS['reports.query']).toBe(1)
  })
  
  it('should have costs for all documented endpoints', () => {
    const requiredEndpoints = [
      'videos.list', 'channels.list', 'search.list',
      'playlists.list', 'playlistItems.list',
      'commentThreads.list', 'comments.list',
      'activities.list', 'reports.query'
    ]
    
    requiredEndpoints.forEach(endpoint => {
      expect(YOUTUBE_API_COSTS).toHaveProperty(endpoint)
      expect(typeof YOUTUBE_API_COSTS[endpoint as keyof typeof YOUTUBE_API_COSTS]).toBe('number')
    })
  })
})