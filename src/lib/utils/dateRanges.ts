import dayjs, { Dayjs } from 'dayjs'

export interface DateRange {
  startDate: string // YYYY-MM-DD format
  endDate: string   // YYYY-MM-DD format
}

/**
 * Get date range based on preset options
 * IMPORTANT: "Today" is excluded - we can't pull same-day metrics
 * All ranges end at yesterday
 */
export function getDateRange(rangeType: string, customStart?: Dayjs | null, customEnd?: Dayjs | null): DateRange {
  const today = dayjs()
  const yesterday = today.subtract(1, 'day')
  
  switch (rangeType) {
    case '7D':
    case 'last7Days':
      return {
        startDate: yesterday.subtract(6, 'days').format('YYYY-MM-DD'),
        endDate: yesterday.format('YYYY-MM-DD')
      }
      
    case '30D':
    case 'last30Days':
      return {
        startDate: yesterday.subtract(29, 'days').format('YYYY-MM-DD'),
        endDate: yesterday.format('YYYY-MM-DD')
      }
      
    case '90D':
    case 'last90Days':
      return {
        startDate: yesterday.subtract(89, 'days').format('YYYY-MM-DD'),
        endDate: yesterday.format('YYYY-MM-DD')
      }
      
    case 'MTD':
    case 'thisMonth':
      return {
        startDate: today.startOf('month').format('YYYY-MM-DD'),
        endDate: yesterday.format('YYYY-MM-DD')
      }
      
    case 'lastMonth':
      const lastMonth = today.subtract(1, 'month')
      return {
        startDate: lastMonth.startOf('month').format('YYYY-MM-DD'),
        endDate: lastMonth.endOf('month').format('YYYY-MM-DD')
      }
      
    case 'QTD':
    case 'thisQuarter':
      return {
        startDate: today.startOf('quarter').format('YYYY-MM-DD'),
        endDate: yesterday.format('YYYY-MM-DD')
      }
      
    case 'YTD':
    case 'thisYear':
      return {
        startDate: today.startOf('year').format('YYYY-MM-DD'),
        endDate: yesterday.format('YYYY-MM-DD')
      }
      
    case 'allTime':
      return {
        startDate: '2020-01-01', // Reasonable start date for the platform
        endDate: yesterday.format('YYYY-MM-DD')
      }
      
    case 'custom':
      if (customStart && customEnd) {
        // Ensure custom end date is not today or future
        const maxEnd = customEnd.isAfter(yesterday) ? yesterday : customEnd
        return {
          startDate: customStart.format('YYYY-MM-DD'),
          endDate: maxEnd.format('YYYY-MM-DD')
        }
      }
      // Fallback to last 30 days if custom dates not provided
      return getDateRange('last30Days')
      
    default:
      // Default to last 30 days
      return getDateRange('last30Days')
  }
}

/**
 * Get date range label for display
 */
export function getDateRangeLabel(rangeType: string, customStart?: Dayjs | null, customEnd?: Dayjs | null): string {
  switch (rangeType) {
    case '7D':
    case 'last7Days':
      return 'Last 7 Days'
    case '30D':
    case 'last30Days':
      return 'Last 30 Days'
    case '90D':
    case 'last90Days':
      return 'Last 90 Days'
    case 'MTD':
    case 'thisMonth':
      return 'Month to Date'
    case 'lastMonth':
      return 'Last Month'
    case 'QTD':
    case 'thisQuarter':
      return 'Quarter to Date'
    case 'YTD':
    case 'thisYear':
      return 'Year to Date'
    case 'allTime':
      return 'All Time'
    case 'custom':
      if (customStart && customEnd) {
        const days = customEnd.diff(customStart, 'day') + 1
        return `Custom (${days} days)`
      }
      return 'Custom'
    default:
      return 'Last 30 Days'
  }
}

/**
 * Available date range options (excluding "Today")
 */
export const DATE_RANGE_OPTIONS = [
  { value: '7D', label: 'Last 7 Days' },
  { value: '30D', label: 'Last 30 Days' },
  { value: '90D', label: 'Last 90 Days' },
  { value: 'MTD', label: 'Month to Date' },
  { value: 'lastMonth', label: 'Last Month' },
  { value: 'QTD', label: 'Quarter to Date' },
  { value: 'YTD', label: 'Year to Date' },
  { value: 'allTime', label: 'All Time' },
  { value: 'custom', label: 'Custom Range' },
]