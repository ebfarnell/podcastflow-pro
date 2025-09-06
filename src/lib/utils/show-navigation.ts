/**
 * Utility for consistent show metrics navigation
 */

/**
 * Build a consistent href for show metrics/analytics
 * @param showId - The show ID or slug
 * @param queryParams - Optional query parameters (dateRange, customStart, customEnd, etc.)
 * @returns The full URL path with query string
 */
export function buildShowMetricsHref(
  showId: string,
  queryParams?: Record<string, string>
): string {
  const base = `/shows/${showId}/metrics`
  
  if (!queryParams || Object.keys(queryParams).length === 0) {
    return base
  }
  
  // Filter out undefined/null values
  const cleanParams = Object.entries(queryParams)
    .filter(([_, value]) => value != null && value !== '')
    .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {})
  
  const qs = new URLSearchParams(cleanParams).toString()
  return qs ? `${base}?${qs}` : base
}

/**
 * Extract current date range params from URL search params
 * @param searchParams - URLSearchParams or string
 * @returns Object with dateRange, customStart, customEnd
 */
export function extractDateRangeParams(
  searchParams: URLSearchParams | string
): Record<string, string> {
  const params = typeof searchParams === 'string' 
    ? new URLSearchParams(searchParams)
    : searchParams
  
  const result: Record<string, string> = {}
  
  if (params.has('dateRange')) {
    result.dateRange = params.get('dateRange')!
  }
  if (params.has('customStart')) {
    result.customStart = params.get('customStart')!
  }
  if (params.has('customEnd')) {
    result.customEnd = params.get('customEnd')!
  }
  
  return result
}