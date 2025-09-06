/**
 * Format currency values with proper precision and localization
 */
export function formatCurrency(
  amount: number | string | null | undefined,
  options: Intl.NumberFormatOptions = {}
): string {
  // Handle null, undefined, or empty values
  if (amount === null || amount === undefined || amount === '') {
    return '$0.00'
  }

  // Convert string to number if needed
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount

  // Handle NaN values
  if (isNaN(numAmount)) {
    return '$0.00'
  }

  const defaultOptions: Intl.NumberFormatOptions = {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options
  }

  return new Intl.NumberFormat('en-US', defaultOptions).format(numAmount)
}

/**
 * Format currency for display in tables/compact spaces (no decimals if whole number)
 */
export function formatCompactCurrency(amount: number | string | null | undefined): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : (amount ?? 0)
  
  if (isNaN(numAmount)) {
    return '$0'
  }

  // If it's a whole number, don't show decimals
  if (numAmount % 1 === 0) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(numAmount)
  }

  // Otherwise show 2 decimal places
  return formatCurrency(numAmount)
}

/**
 * Format large currency amounts with abbreviations (K, M, B)
 */
export function formatLargeCurrency(amount: number | string | null | undefined): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : (amount ?? 0)
  
  if (isNaN(numAmount)) {
    return '$0.00'
  }

  const abs = Math.abs(numAmount)
  
  if (abs >= 1e9) {
    return `$${(numAmount / 1e9).toFixed(2)}B`
  } else if (abs >= 1e6) {
    return `$${(numAmount / 1e6).toFixed(2)}M`
  } else if (abs >= 1e3) {
    return `$${(numAmount / 1e3).toFixed(2)}K`
  } else {
    return formatCurrency(numAmount)
  }
}

/**
 * Parse currency string back to number
 */
export function parseCurrency(currencyString: string): number {
  if (!currencyString) return 0
  
  // Remove currency symbols, commas, and spaces
  const cleaned = currencyString.replace(/[$,\s]/g, '')
  const number = parseFloat(cleaned)
  
  return isNaN(number) ? 0 : number
}