/**
 * Centralized formatting utilities for consistent display across the app
 */

import { formatCurrency, formatCompactCurrency, formatLargeCurrency } from './currency'

// Re-export currency formatters for convenience
export { formatCurrency, formatCompactCurrency, formatLargeCurrency }

/**
 * Format a number as currency - ALWAYS use this for dollar amounts
 * This ensures consistent 2 decimal places across the entire app
 */
export const formatDollars = (amount: number | string | null | undefined): string => {
  return formatCurrency(amount)
}

/**
 * Format percentage with specified decimal places
 */
export const formatPercentage = (
  value: number | string | null | undefined,
  decimals: number = 2
): string => {
  if (value === null || value === undefined || value === '') {
    return '0.00%'
  }
  
  const numValue = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(numValue)) {
    return '0.00%'
  }
  
  return `${numValue.toFixed(decimals)}%`
}

/**
 * Format number with commas (for non-currency numbers)
 */
export const formatNumber = (
  value: number | string | null | undefined,
  decimals: number = 0
): string => {
  if (value === null || value === undefined || value === '') {
    return '0'
  }
  
  const numValue = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(numValue)) {
    return '0'
  }
  
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(numValue)
}

/**
 * Format date consistently across the app
 */
export const formatDate = (date: Date | string | null | undefined): string => {
  if (!date) return ''
  
  const dateObj = typeof date === 'string' ? new Date(date) : date
  if (isNaN(dateObj.getTime())) return ''
  
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(dateObj)
}

/**
 * Format date and time
 */
export const formatDateTime = (date: Date | string | null | undefined): string => {
  if (!date) return ''
  
  const dateObj = typeof date === 'string' ? new Date(date) : date
  if (isNaN(dateObj.getTime())) return ''
  
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(dateObj)
}

/**
 * Format duration from seconds to human-readable format
 * @param seconds - Duration in seconds
 * @returns Formatted duration string (e.g., "45:30", "1:23:45")
 */
export const formatDuration = (seconds: number | null | undefined): string => {
  if (!seconds || seconds <= 0) return 'N/A'
  
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

/**
 * Format large numbers with K, M, B suffixes for compact display
 * @param num - Number to format
 * @returns Formatted string (e.g., "1.2M", "823K")
 */
export const formatCompactNumber = (num: number | null | undefined): string => {
  if (!num || num === 0) return '0'
  
  if (num >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(1)}B`
  }
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`
  }
  
  return num.toString()
}

// IMPORTANT: Always use these formatters instead of toFixed() or toLocaleString()
// This ensures consistent formatting across the entire application