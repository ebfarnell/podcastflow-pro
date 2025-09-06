/**
 * Shared date range utilities for consistent date handling across the application
 * All dates are in UTC to ensure consistency between client and server
 */

export interface DateRange {
  start: Date
  end: Date
}

/**
 * Get the start and end dates for various date range types
 * @param rangeType - The type of date range (7D, 30D, MTD, QTD, YTD, etc.)
 * @param customStart - Custom start date (for 'custom' range type)
 * @param customEnd - Custom end date (for 'custom' range type)
 * @returns DateRange object with start and end dates in UTC
 */
export function getUTCDateRange(
  rangeType: string, 
  customStart?: Date | string | null, 
  customEnd?: Date | string | null
): DateRange {
  const now = new Date()
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const yesterdayUTC = new Date(todayUTC.getTime() - 24 * 60 * 60 * 1000)

  switch (rangeType) {
    case '7D':
    case 'last7Days': {
      const start = new Date(yesterdayUTC.getTime() - 6 * 24 * 60 * 60 * 1000)
      return { start, end: yesterdayUTC }
    }

    case '30D':
    case 'last30Days': {
      const start = new Date(yesterdayUTC.getTime() - 29 * 24 * 60 * 60 * 1000)
      return { start, end: yesterdayUTC }
    }

    case '90D':
    case 'last90Days': {
      const start = new Date(yesterdayUTC.getTime() - 89 * 24 * 60 * 60 * 1000)
      return { start, end: yesterdayUTC }
    }

    case 'MTD':
    case 'thisMonth': {
      const start = new Date(Date.UTC(todayUTC.getUTCFullYear(), todayUTC.getUTCMonth(), 1))
      return { start, end: yesterdayUTC }
    }

    case 'QTD':
    case 'thisQuarter': {
      const currentMonth = todayUTC.getUTCMonth()
      const currentQuarter = Math.floor(currentMonth / 3)
      const quarterStartMonth = currentQuarter * 3
      const start = new Date(Date.UTC(todayUTC.getUTCFullYear(), quarterStartMonth, 1))
      return { start, end: yesterdayUTC }
    }

    case 'YTD':
    case 'thisYear': {
      const start = new Date(Date.UTC(todayUTC.getUTCFullYear(), 0, 1))
      return { start, end: yesterdayUTC }
    }

    case 'custom': {
      if (customStart && customEnd) {
        const start = typeof customStart === 'string' ? new Date(customStart) : customStart
        const end = typeof customEnd === 'string' ? new Date(customEnd) : customEnd
        // Ensure end date is not in the future
        const maxEnd = end > yesterdayUTC ? yesterdayUTC : end
        return { start, end: maxEnd }
      }
      // Fallback to last 30 days
      return getUTCDateRange('30D')
    }

    default:
      // Default to last 30 days
      return getUTCDateRange('30D')
  }
}

/**
 * Format date range for API parameters
 * @param rangeType - The type of date range
 * @param customStart - Custom start date
 * @param customEnd - Custom end date
 * @returns Object with startDate and endDate in YYYY-MM-DD format
 */
export function formatDateRangeForAPI(
  rangeType: string,
  customStart?: Date | string | null,
  customEnd?: Date | string | null
): { startDate: string; endDate: string } {
  const range = getUTCDateRange(rangeType, customStart, customEnd)
  
  // Format as YYYY-MM-DD
  const formatDate = (date: Date): string => {
    const year = date.getUTCFullYear()
    const month = String(date.getUTCMonth() + 1).padStart(2, '0')
    const day = String(date.getUTCDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  return {
    startDate: formatDate(range.start),
    endDate: formatDate(range.end)
  }
}

/**
 * Get quarter boundaries for a given date
 * @param date - The date to get quarter boundaries for
 * @returns Object with quarter number, start date, and end date
 */
export function getQuarterBoundaries(date: Date = new Date()): {
  quarter: number
  start: Date
  end: Date
} {
  const month = date.getUTCMonth()
  const year = date.getUTCFullYear()
  const quarter = Math.floor(month / 3) + 1
  
  const quarterStartMonth = (quarter - 1) * 3
  const quarterEndMonth = quarterStartMonth + 2
  
  const start = new Date(Date.UTC(year, quarterStartMonth, 1))
  const end = new Date(Date.UTC(year, quarterEndMonth + 1, 0)) // Last day of quarter
  
  return { quarter, start, end }
}

/**
 * Validate that QTD calculations are correct
 * @returns boolean indicating if the current implementation is correct
 */
export function validateQTD(): boolean {
  const now = new Date()
  const qtdRange = getUTCDateRange('QTD')
  const quarterInfo = getQuarterBoundaries(now)
  
  // QTD should start at the beginning of the current quarter
  const startMatches = qtdRange.start.getTime() === quarterInfo.start.getTime()
  
  // QTD should end at yesterday (or last day of quarter if quarter has ended)
  const yesterday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1))
  const expectedEnd = yesterday < quarterInfo.end ? yesterday : quarterInfo.end
  const endMatches = qtdRange.end.getTime() === expectedEnd.getTime()
  
  return startMatches && endMatches
}