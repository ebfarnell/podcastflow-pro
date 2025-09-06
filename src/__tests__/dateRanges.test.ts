import { describe, it, expect, beforeEach } from '@jest/globals'
import { getUTCDateRange, formatDateRangeForAPI, getQuarterBoundaries, validateQTD } from '../shared/dateRanges'

describe('Date Range Utilities', () => {
  // Mock current date for consistent testing
  const mockDate = new Date('2025-08-24T12:00:00Z')
  const originalDate = Date

  beforeEach(() => {
    // Mock Date constructor
    global.Date = class extends originalDate {
      constructor(...args: any[]) {
        if (args.length === 0) {
          return mockDate
        }
        return new originalDate(...args)
      }
      static now() {
        return mockDate.getTime()
      }
    } as any
  })

  afterEach(() => {
    global.Date = originalDate
  })

  describe('getUTCDateRange', () => {
    it('should calculate last 7 days correctly', () => {
      const range = getUTCDateRange('7D')
      expect(range.start.toISOString()).toBe('2025-08-17T00:00:00.000Z')
      expect(range.end.toISOString()).toBe('2025-08-23T00:00:00.000Z')
    })

    it('should calculate last 30 days correctly', () => {
      const range = getUTCDateRange('30D')
      expect(range.start.toISOString()).toBe('2025-07-25T00:00:00.000Z')
      expect(range.end.toISOString()).toBe('2025-08-23T00:00:00.000Z')
    })

    it('should calculate MTD (Month to Date) correctly', () => {
      const range = getUTCDateRange('MTD')
      expect(range.start.toISOString()).toBe('2025-08-01T00:00:00.000Z')
      expect(range.end.toISOString()).toBe('2025-08-23T00:00:00.000Z')
    })

    it('should calculate QTD (Quarter to Date) correctly for Q3', () => {
      const range = getUTCDateRange('QTD')
      // Q3 starts July 1st
      expect(range.start.toISOString()).toBe('2025-07-01T00:00:00.000Z')
      expect(range.end.toISOString()).toBe('2025-08-23T00:00:00.000Z')
    })

    it('should calculate YTD (Year to Date) correctly', () => {
      const range = getUTCDateRange('YTD')
      expect(range.start.toISOString()).toBe('2025-01-01T00:00:00.000Z')
      expect(range.end.toISOString()).toBe('2025-08-23T00:00:00.000Z')
    })

    it('should handle custom date range', () => {
      const customStart = new Date('2025-06-01')
      const customEnd = new Date('2025-07-31')
      const range = getUTCDateRange('custom', customStart, customEnd)
      expect(range.start.toISOString()).toBe('2025-06-01T00:00:00.000Z')
      expect(range.end.toISOString()).toBe('2025-07-31T00:00:00.000Z')
    })

    it('should cap custom end date to yesterday if in future', () => {
      const customStart = new Date('2025-08-01')
      const customEnd = new Date('2025-08-30') // Future date
      const range = getUTCDateRange('custom', customStart, customEnd)
      expect(range.start.toISOString()).toBe('2025-08-01T00:00:00.000Z')
      expect(range.end.toISOString()).toBe('2025-08-23T00:00:00.000Z') // Capped to yesterday
    })

    it('should default to last 30 days for unknown range type', () => {
      const range = getUTCDateRange('unknown')
      expect(range.start.toISOString()).toBe('2025-07-25T00:00:00.000Z')
      expect(range.end.toISOString()).toBe('2025-08-23T00:00:00.000Z')
    })
  })

  describe('formatDateRangeForAPI', () => {
    it('should format dates as YYYY-MM-DD', () => {
      const result = formatDateRangeForAPI('7D')
      expect(result.startDate).toBe('2025-08-17')
      expect(result.endDate).toBe('2025-08-23')
    })

    it('should handle custom dates correctly', () => {
      const customStart = new Date('2025-06-15')
      const customEnd = new Date('2025-07-20')
      const result = formatDateRangeForAPI('custom', customStart, customEnd)
      expect(result.startDate).toBe('2025-06-15')
      expect(result.endDate).toBe('2025-07-20')
    })
  })

  describe('getQuarterBoundaries', () => {
    it('should calculate Q1 boundaries correctly', () => {
      const date = new Date('2025-02-15')
      const result = getQuarterBoundaries(date)
      expect(result.quarter).toBe(1)
      expect(result.start.toISOString()).toBe('2025-01-01T00:00:00.000Z')
      expect(result.end.toISOString()).toBe('2025-03-31T00:00:00.000Z')
    })

    it('should calculate Q2 boundaries correctly', () => {
      const date = new Date('2025-05-10')
      const result = getQuarterBoundaries(date)
      expect(result.quarter).toBe(2)
      expect(result.start.toISOString()).toBe('2025-04-01T00:00:00.000Z')
      expect(result.end.toISOString()).toBe('2025-06-30T00:00:00.000Z')
    })

    it('should calculate Q3 boundaries correctly', () => {
      const date = new Date('2025-08-24')
      const result = getQuarterBoundaries(date)
      expect(result.quarter).toBe(3)
      expect(result.start.toISOString()).toBe('2025-07-01T00:00:00.000Z')
      expect(result.end.toISOString()).toBe('2025-09-30T00:00:00.000Z')
    })

    it('should calculate Q4 boundaries correctly', () => {
      const date = new Date('2025-11-15')
      const result = getQuarterBoundaries(date)
      expect(result.quarter).toBe(4)
      expect(result.start.toISOString()).toBe('2025-10-01T00:00:00.000Z')
      expect(result.end.toISOString()).toBe('2025-12-31T00:00:00.000Z')
    })
  })

  describe('validateQTD', () => {
    it('should validate QTD calculation is correct', () => {
      const isValid = validateQTD()
      expect(isValid).toBe(true)
    })
  })

  describe('Quarter Edge Cases', () => {
    it('should handle quarter boundaries at month edges', () => {
      // Test Q1/Q2 boundary
      const q1End = new Date('2025-03-31')
      const q1Result = getQuarterBoundaries(q1End)
      expect(q1Result.quarter).toBe(1)
      
      const q2Start = new Date('2025-04-01')
      const q2Result = getQuarterBoundaries(q2Start)
      expect(q2Result.quarter).toBe(2)
    })

    it('should handle year boundaries correctly', () => {
      const lastDayOfYear = new Date('2024-12-31')
      const result = getQuarterBoundaries(lastDayOfYear)
      expect(result.quarter).toBe(4)
      expect(result.start.toISOString()).toBe('2024-10-01T00:00:00.000Z')
      expect(result.end.toISOString()).toBe('2024-12-31T00:00:00.000Z')
    })
  })
})