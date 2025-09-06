'use client'

import { useState, useMemo, useCallback } from 'react'
import dayjs, { Dayjs } from 'dayjs'
import quarterOfYear from 'dayjs/plugin/quarterOfYear'
import isoWeek from 'dayjs/plugin/isoWeek'

dayjs.extend(quarterOfYear)
dayjs.extend(isoWeek)

export type DateRangeKey = 
  | 'today' 
  | 'yesterday'
  | '7d' 
  | '30d' 
  | 'thisWeek'
  | 'lastWeek'
  | 'thisMonth' 
  | 'lastMonth' 
  | 'qtd' 
  | 'ytd' 
  | 'mtd' 
  | 'custom' 
  | 'allTime'
  | 'last30Days'
  | 'last90Days'
  | 'thisQuarter'
  | 'thisYear'

interface DateRangeState {
  rangeKey: DateRangeKey
  startDate: Dayjs
  endDate: Dayjs
  customStart?: Dayjs | null
  customEnd?: Dayjs | null
}

interface UseReportDateRangeReturn {
  rangeKey: DateRangeKey
  startDate: Dayjs
  endDate: Dayjs
  customStart?: Dayjs | null
  customEnd?: Dayjs | null
  setRange: (key: DateRangeKey, custom?: { start: Dayjs | null; end: Dayjs | null }) => void
  getLabel: () => string
  getQuery: () => { start: string; end: string }
  getApiParams: () => { timeRange?: string; startDate?: string; endDate?: string }
}

/**
 * Unified date range management hook for Reports Dashboard
 * Provides single source of truth for date filtering
 */
export function useReportDateRange(initialRange: DateRangeKey = '7d'): UseReportDateRangeReturn {
  const [state, setState] = useState<DateRangeState>(() => {
    const { start, end } = calculateDateRange(initialRange)
    return {
      rangeKey: initialRange,
      startDate: start,
      endDate: end,
      customStart: null,
      customEnd: null,
    }
  })

  const setRange = useCallback((key: DateRangeKey, custom?: { start: Dayjs | null; end: Dayjs | null }) => {
    if (key === 'custom' && custom?.start && custom?.end) {
      setState({
        rangeKey: 'custom',
        startDate: custom.start,
        endDate: custom.end,
        customStart: custom.start,
        customEnd: custom.end,
      })
    } else if (key !== 'custom') {
      const { start, end } = calculateDateRange(key)
      setState({
        rangeKey: key,
        startDate: start,
        endDate: end,
        customStart: null,
        customEnd: null,
      })
    }
  }, [])

  const getLabel = useCallback((): string => {
    switch (state.rangeKey) {
      case 'today':
        return 'Today'
      case 'yesterday':
        return 'Yesterday'
      case '7d':
        return 'Last 7 Days'
      case '30d':
        return 'Last 30 Days'
      case 'last30Days':
        return 'Last 30 Days'
      case 'last90Days':
        return 'Last 90 Days'
      case 'thisWeek':
        return 'This Week'
      case 'lastWeek':
        return 'Last Week'
      case 'thisMonth':
      case 'mtd':
        return 'Month to Date'
      case 'lastMonth':
        return 'Last Month'
      case 'thisQuarter':
      case 'qtd':
        return 'Quarter to Date'
      case 'thisYear':
      case 'ytd':
        return 'Year to Date'
      case 'allTime':
        return 'All Time'
      case 'custom':
        if (state.customStart && state.customEnd) {
          const sameYear = state.customStart.year() === state.customEnd.year()
          if (sameYear) {
            return `${state.customStart.format('MMM D')} – ${state.customEnd.format('MMM D, YYYY')}`
          } else {
            return `${state.customStart.format('MMM D, YYYY')} – ${state.customEnd.format('MMM D, YYYY')}`
          }
        }
        return 'Custom Range'
      default:
        return 'Last 7 Days'
    }
  }, [state])

  const getQuery = useCallback((): { start: string; end: string } => {
    return {
      start: state.startDate.format('YYYY-MM-DD'),
      end: state.endDate.format('YYYY-MM-DD'),
    }
  }, [state.startDate, state.endDate])

  const getApiParams = useCallback((): { timeRange?: string; startDate?: string; endDate?: string } => {
    if (state.rangeKey === 'custom' && state.customStart && state.customEnd) {
      return {
        startDate: state.customStart.format('YYYY-MM-DD'),
        endDate: state.customEnd.format('YYYY-MM-DD'),
      }
    }
    
    // Map UI values to API timeRange values
    const timeRangeMap: Record<string, string> = {
      'today': '1d',
      'yesterday': '1d',
      '7d': '7d',
      '30d': '30d',
      'last30Days': '30d',
      'last90Days': '90d',
      'thisWeek': '7d',
      'lastWeek': '7d',
      'lastMonth': '30d',
      'thisMonth': 'mtd',
      'mtd': 'mtd',
      'thisQuarter': 'qtd',
      'qtd': 'qtd',
      'thisYear': 'ytd',
      'ytd': 'ytd',
      'allTime': 'all',
    }
    
    return { timeRange: timeRangeMap[state.rangeKey] || '7d' }
  }, [state])

  return {
    rangeKey: state.rangeKey,
    startDate: state.startDate,
    endDate: state.endDate,
    customStart: state.customStart,
    customEnd: state.customEnd,
    setRange,
    getLabel,
    getQuery,
    getApiParams,
  }
}

/**
 * Calculate start and end dates based on range key
 */
function calculateDateRange(key: DateRangeKey): { start: Dayjs; end: Dayjs } {
  const now = dayjs()
  const today = now.startOf('day')
  
  switch (key) {
    case 'today':
      return { start: today, end: today.endOf('day') }
      
    case 'yesterday':
      return { 
        start: today.subtract(1, 'day'), 
        end: today.subtract(1, 'day').endOf('day')
      }
      
    case '7d':
      return { 
        start: today.subtract(6, 'day'), 
        end: today.endOf('day')
      }
      
    case '30d':
    case 'last30Days':
      return { 
        start: today.subtract(29, 'day'), 
        end: today.endOf('day')
      }
      
    case 'last90Days':
      return { 
        start: today.subtract(89, 'day'), 
        end: today.endOf('day')
      }
      
    case 'thisWeek':
      return { 
        start: now.startOf('isoWeek'), 
        end: now.endOf('isoWeek')
      }
      
    case 'lastWeek':
      return { 
        start: now.subtract(1, 'week').startOf('isoWeek'), 
        end: now.subtract(1, 'week').endOf('isoWeek')
      }
      
    case 'thisMonth':
    case 'mtd':
      return { 
        start: now.startOf('month'), 
        end: today.endOf('day')
      }
      
    case 'lastMonth':
      return { 
        start: now.subtract(1, 'month').startOf('month'), 
        end: now.subtract(1, 'month').endOf('month')
      }
      
    case 'thisQuarter':
    case 'qtd':
      return { 
        start: now.startOf('quarter'), 
        end: today.endOf('day')
      }
      
    case 'thisYear':
    case 'ytd':
      return { 
        start: now.startOf('year'), 
        end: today.endOf('day')
      }
      
    case 'allTime':
      // For "All Time", we use a reasonable early date
      // In production, you might want to query the actual min date from DB
      return { 
        start: dayjs('2000-01-01'), 
        end: today.endOf('day')
      }
      
    default:
      // Default to last 7 days
      return { 
        start: today.subtract(6, 'day'), 
        end: today.endOf('day')
      }
  }
}