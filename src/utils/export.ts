import { format } from 'date-fns'

/**
 * Export data as CSV file
 */
export function exportToCSV(
  data: any[],
  filename: string,
  options: {
    headers?: string[]
    dateFormat?: string
    includeTimestamp?: boolean
  } = {}
) {
  if (!data || data.length === 0) {
    console.warn('No data to export')
    return
  }

  // Get headers from first object if not provided
  const headers = options.headers || Object.keys(data[0])
  
  // Create CSV content
  const csvContent = [
    // Headers
    headers.join(','),
    // Data rows
    ...data.map(row => {
      return headers.map(header => {
        const value = row[header]
        
        // Handle different value types
        if (value === null || value === undefined) {
          return ''
        }
        
        if (value instanceof Date) {
          return format(value, options.dateFormat || 'yyyy-MM-dd HH:mm:ss')
        }
        
        if (typeof value === 'object') {
          return JSON.stringify(value).replace(/"/g, '""')
        }
        
        // Escape quotes and wrap in quotes if contains comma, newline, or quotes
        const stringValue = String(value)
        if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
          return `"${stringValue.replace(/"/g, '""')}"`
        }
        
        return stringValue
      }).join(',')
    })
  ].join('\n')
  
  // Add BOM for proper UTF-8 encoding in Excel
  const bom = '\uFEFF'
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' })
  
  // Generate filename with timestamp if requested
  const finalFilename = options.includeTimestamp
    ? `${filename}-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`
    : `${filename}.csv`
  
  // Download file
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', finalFilename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Export data as JSON file
 */
export function exportToJSON(
  data: any,
  filename: string,
  options: {
    pretty?: boolean
    includeTimestamp?: boolean
  } = {}
) {
  // Stringify with optional pretty printing
  const jsonContent = options.pretty
    ? JSON.stringify(data, null, 2)
    : JSON.stringify(data)
  
  const blob = new Blob([jsonContent], { type: 'application/json' })
  
  // Generate filename with timestamp if requested
  const finalFilename = options.includeTimestamp
    ? `${filename}-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.json`
    : `${filename}.json`
  
  // Download file
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', finalFilename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Convert table data to CSV format for specific report types
 */
export function convertTableToCSV(
  headers: string[],
  rows: any[][],
  options: {
    title?: string
    metadata?: Record<string, any>
  } = {}
): string {
  const lines: string[] = []
  
  // Add title if provided
  if (options.title) {
    lines.push(options.title)
    lines.push('') // Empty line
  }
  
  // Add metadata if provided
  if (options.metadata) {
    Object.entries(options.metadata).forEach(([key, value]) => {
      lines.push(`${key},${value}`)
    })
    lines.push('') // Empty line
  }
  
  // Add headers
  lines.push(headers.map(h => `"${h}"`).join(','))
  
  // Add data rows
  rows.forEach(row => {
    const csvRow = row.map(cell => {
      if (cell === null || cell === undefined) return ''
      const stringValue = String(cell)
      // Escape quotes and wrap in quotes if necessary
      if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
        return `"${stringValue.replace(/"/g, '""')}"`
      }
      return stringValue
    }).join(',')
    lines.push(csvRow)
  })
  
  return lines.join('\n')
}

/**
 * Helper to format currency values consistently
 */
export function formatCurrency(value: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value)
}

/**
 * Helper to format percentages consistently
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${(value * 100).toFixed(decimals)}%`
}

/**
 * Helper to format large numbers with abbreviations
 */
export function formatLargeNumber(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`
  }
  return value.toString()
}