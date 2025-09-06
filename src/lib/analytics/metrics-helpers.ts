/**
 * Helper functions for metrics calculations
 */

export interface OutlierPoint {
  date: string
  value: number
  zscore?: number
}

/**
 * Detect outliers in a time series using z-score method
 * @param series Array of values with dates
 * @param threshold Z-score threshold (default 2.0)
 * @returns Array of outlier points
 */
export function detectOutliers(
  series: { date: string; value: number }[],
  threshold: number = 2.0
): OutlierPoint[] {
  if (series.length < 3) return []
  
  const values = series.map(p => p.value).filter(v => v !== null && !isNaN(v))
  if (values.length === 0) return []
  
  // Calculate mean and standard deviation
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
  const stdDev = Math.sqrt(variance)
  
  if (stdDev === 0) return [] // All values are the same
  
  // Find outliers
  const outliers: OutlierPoint[] = []
  series.forEach(point => {
    if (point.value === null || isNaN(point.value)) return
    
    const zscore = Math.abs((point.value - mean) / stdDev)
    if (zscore > threshold) {
      outliers.push({
        date: point.date,
        value: point.value,
        zscore: parseFloat(zscore.toFixed(2))
      })
    }
  })
  
  return outliers
}

/**
 * Calculate completion rate from average duration and total duration
 * @param avgDuration Average view/listen duration in seconds
 * @param totalDuration Total content duration in seconds
 * @returns Completion rate as percentage (0-100)
 */
export function calculateCompletionRate(
  avgDuration: number,
  totalDuration: number
): number {
  if (!totalDuration || totalDuration === 0) return 0
  if (!avgDuration || avgDuration === 0) return 0
  
  const rate = (avgDuration / totalDuration) * 100
  return Math.min(100, Math.max(0, rate)) // Clamp between 0 and 100
}

/**
 * Group daily metrics by date and calculate averages
 * @param data Raw data with dates and values
 * @returns Grouped data by date with averages
 */
export function groupByDateWithAverages(
  data: any[],
  dateField: string,
  valueFields: string[]
): Map<string, any> {
  const grouped = new Map<string, any[]>()
  
  // Group by date
  data.forEach(row => {
    const date = row[dateField]?.split('T')[0] // Ensure YYYY-MM-DD format
    if (!date) return
    
    if (!grouped.has(date)) {
      grouped.set(date, [])
    }
    grouped.get(date)!.push(row)
  })
  
  // Calculate averages for each date
  const result = new Map<string, any>()
  grouped.forEach((rows, date) => {
    const averages: any = { date }
    
    valueFields.forEach(field => {
      const values = rows.map(r => r[field]).filter(v => v !== null && !isNaN(v))
      if (values.length > 0) {
        averages[field] = values.reduce((sum, v) => sum + v, 0) / values.length
      } else {
        averages[field] = null
      }
    })
    
    result.set(date, averages)
  })
  
  return result
}

/**
 * Calculate source composition percentages
 * @param sources Object with source names as keys and values as numbers
 * @returns Object with source names as keys and percentages as values
 */
export function calculateSourceComposition(sources: Record<string, number>): Record<string, number> {
  const total = Object.values(sources).reduce((sum, v) => sum + v, 0)
  if (total === 0) return sources
  
  const composition: Record<string, number> = {}
  Object.entries(sources).forEach(([key, value]) => {
    composition[key] = parseFloat(((value / total) * 100).toFixed(1))
  })
  
  return composition
}