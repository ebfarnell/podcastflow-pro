/**
 * Date utility functions for timezone-safe date handling
 * 
 * These utilities ensure consistent date handling across different timezones
 * by creating dates at noon local time to avoid day shifting issues.
 */

/**
 * Creates a Date object from a YYYY-MM-DD string at noon local time
 * This prevents timezone shifts that can occur when parsing dates at midnight
 * 
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns Date object at noon local time
 */
export function createLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number)
  // Create date at noon (12:00) to avoid timezone shift issues
  return new Date(year, month - 1, day, 12, 0, 0)
}

/**
 * Formats a Date object to YYYY-MM-DD string in local time
 * This is the inverse of createLocalDate and ensures consistent formatting
 * 
 * @param date - Date object to format
 * @returns Date string in YYYY-MM-DD format
 */
export function formatDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Checks if two dates represent the same calendar day
 * Handles timezone differences by comparing local date components
 * 
 * @param date1 - First date to compare
 * @param date2 - Second date to compare
 * @returns True if dates are on the same calendar day
 */
export function isSameCalendarDay(date1: Date, date2: Date): boolean {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate()
}

/**
 * Creates a date range for API queries
 * Ensures start is at beginning of day and end is at end of day
 * 
 * @param start - Start date string in YYYY-MM-DD format
 * @param end - End date string in YYYY-MM-DD format
 * @returns Object with start and end Date objects
 */
export function createDateRange(start: string, end: string): { start: Date; end: Date } {
  const startDate = createLocalDate(start)
  const endDate = createLocalDate(end)
  
  // Set to beginning and end of day for inclusive queries
  startDate.setHours(0, 0, 0, 0)
  endDate.setHours(23, 59, 59, 999)
  
  return { start: startDate, end: endDate }
}

/**
 * Normalizes a date to noon local time
 * Useful for ensuring consistent date comparisons
 * 
 * @param date - Date to normalize
 * @returns New Date object at noon local time
 */
export function normalizeToNoon(date: Date): Date {
  const normalized = new Date(date)
  normalized.setHours(12, 0, 0, 0)
  return normalized
}

/**
 * Gets today's date at noon local time
 * 
 * @returns Today's date at noon
 */
export function getToday(): Date {
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  return today
}

/**
 * Parses a date string safely, handling both YYYY-MM-DD and ISO formats
 * Always returns a date at noon local time for consistency
 * 
 * @param dateString - Date string to parse
 * @returns Date object at noon local time
 */
export function parseDate(dateString: string): Date {
  // If it's already in YYYY-MM-DD format, use our safe parser
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return createLocalDate(dateString)
  }
  
  // For ISO strings or other formats, parse and normalize
  const date = new Date(dateString)
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date string: ${dateString}`)
  }
  
  // Convert to local date at noon
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    12, 0, 0
  )
}

/**
 * Adds days to a date while maintaining noon time
 * 
 * @param date - Base date
 * @param days - Number of days to add (can be negative)
 * @returns New date with days added
 */
export function addDaysNoon(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  result.setHours(12, 0, 0, 0)
  return result
}

/**
 * Gets the first day of the month at noon
 * 
 * @param date - Any date in the month
 * @returns First day of the month at noon
 */
export function getFirstDayOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12, 0, 0)
}

/**
 * Gets the last day of the month at noon
 * 
 * @param date - Any date in the month
 * @returns Last day of the month at noon
 */
export function getLastDayOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 12, 0, 0)
}