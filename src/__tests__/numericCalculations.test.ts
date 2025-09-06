import { describe, it, expect } from '@jest/globals'

// Helper functions that should be used throughout the app
export function safeNumeric(value: any): number {
  const num = Number(value)
  return isNaN(num) ? 0 : num
}

export function safeDivide(numerator: any, denominator: any, defaultValue: number = 0): number {
  const num = safeNumeric(numerator)
  const denom = safeNumeric(denominator)
  if (denom === 0) return defaultValue
  return num / denom
}

export function safePercentage(value: any, total: any, decimals: number = 2): number {
  const percentage = safeDivide(value, total, 0) * 100
  return Math.round(percentage * Math.pow(10, decimals)) / Math.pow(10, decimals)
}

export function formatCurrency(amount: any, currency: string = 'USD'): string {
  const num = safeNumeric(amount)
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num)
}

export function calculateWeightedValue(amount: any, probability: any): number {
  const amt = safeNumeric(amount)
  const prob = safeNumeric(probability)
  return amt * (prob / 100)
}

describe('Numeric Calculations', () => {
  describe('safeNumeric', () => {
    it('should convert valid numbers', () => {
      expect(safeNumeric(42)).toBe(42)
      expect(safeNumeric('42')).toBe(42)
      expect(safeNumeric('42.5')).toBe(42.5)
      expect(safeNumeric(0)).toBe(0)
    })

    it('should handle invalid inputs', () => {
      expect(safeNumeric(null)).toBe(0)
      expect(safeNumeric(undefined)).toBe(0)
      expect(safeNumeric('')).toBe(0)
      expect(safeNumeric('abc')).toBe(0)
      expect(safeNumeric(NaN)).toBe(0)
      expect(safeNumeric({})).toBe(0)
      expect(safeNumeric([])).toBe(0)
    })
  })

  describe('safeDivide', () => {
    it('should perform normal division', () => {
      expect(safeDivide(10, 2)).toBe(5)
      expect(safeDivide(100, 4)).toBe(25)
      expect(safeDivide(7, 2)).toBe(3.5)
    })

    it('should handle division by zero', () => {
      expect(safeDivide(10, 0)).toBe(0)
      expect(safeDivide(10, 0, -1)).toBe(-1) // with custom default
    })

    it('should handle invalid inputs', () => {
      expect(safeDivide(null, 10)).toBe(0)
      expect(safeDivide(10, null)).toBe(0)
      expect(safeDivide(undefined, undefined)).toBe(0)
      expect(safeDivide('abc', 'def')).toBe(0)
    })
  })

  describe('safePercentage', () => {
    it('should calculate percentages correctly', () => {
      expect(safePercentage(25, 100)).toBe(25)
      expect(safePercentage(50, 200)).toBe(25)
      expect(safePercentage(1, 3)).toBe(33.33)
      expect(safePercentage(1, 3, 1)).toBe(33.3)
      expect(safePercentage(1, 3, 0)).toBe(33)
    })

    it('should handle edge cases', () => {
      expect(safePercentage(0, 100)).toBe(0)
      expect(safePercentage(100, 0)).toBe(0)
      expect(safePercentage(null, 100)).toBe(0)
      expect(safePercentage(50, null)).toBe(0)
    })
  })

  describe('formatCurrency', () => {
    it('should format currency correctly', () => {
      expect(formatCurrency(1000)).toBe('$1,000')
      expect(formatCurrency(1234567)).toBe('$1,234,567')
      expect(formatCurrency(0)).toBe('$0')
      expect(formatCurrency(-500)).toBe('-$500')
    })

    it('should handle invalid inputs', () => {
      expect(formatCurrency(null)).toBe('$0')
      expect(formatCurrency(undefined)).toBe('$0')
      expect(formatCurrency('invalid')).toBe('$0')
      expect(formatCurrency(NaN)).toBe('$0')
    })
  })

  describe('calculateWeightedValue', () => {
    it('should calculate weighted values correctly', () => {
      expect(calculateWeightedValue(1000, 10)).toBe(100)
      expect(calculateWeightedValue(1000, 35)).toBe(350)
      expect(calculateWeightedValue(1000, 65)).toBe(650)
      expect(calculateWeightedValue(1000, 90)).toBe(900)
      expect(calculateWeightedValue(1000, 100)).toBe(1000)
    })

    it('should handle edge cases', () => {
      expect(calculateWeightedValue(0, 50)).toBe(0)
      expect(calculateWeightedValue(1000, 0)).toBe(0)
      expect(calculateWeightedValue(null, 50)).toBe(0)
      expect(calculateWeightedValue(1000, null)).toBe(0)
    })
  })

  describe('Pipeline Forecast Calculations', () => {
    it('should never produce NaN for forecast values', () => {
      const testCases = [
        { projection: 0, saved: null },
        { projection: null, saved: 0 },
        { projection: undefined, saved: undefined },
        { projection: 'invalid', saved: 'invalid' },
        { projection: NaN, saved: NaN },
      ]

      testCases.forEach(({ projection, saved }) => {
        const monthlyProjection = safeNumeric(projection)
        const savedForecast = safeNumeric(saved)
        const forecastTarget = monthlyProjection + savedForecast
        
        expect(isNaN(forecastTarget)).toBe(false)
        expect(typeof forecastTarget).toBe('number')
      })
    })

    it('should calculate forecast gap correctly', () => {
      const forecastTarget = 100000
      const actualRevenue = 75000
      const weightedPipeline = 15000
      
      const gap = forecastTarget - (actualRevenue + weightedPipeline)
      expect(gap).toBe(10000)
    })

    it('should handle missing data gracefully', () => {
      const forecastTarget = safeNumeric(undefined)
      const actualRevenue = safeNumeric(null)
      const weightedPipeline = safeNumeric('')
      
      const gap = forecastTarget - (actualRevenue + weightedPipeline)
      expect(gap).toBe(0)
      expect(isNaN(gap)).toBe(false)
    })
  })

  describe('Budget Actual Calculations', () => {
    it('should aggregate actual amounts correctly', () => {
      const orders = [
        { totalAmount: 10000 },
        { totalAmount: 15000 },
        { totalAmount: null },
        { totalAmount: 5000 },
      ]

      const totalActual = orders.reduce((sum, order) => {
        return sum + safeNumeric(order.totalAmount)
      }, 0)

      expect(totalActual).toBe(30000)
    })

    it('should handle empty order lists', () => {
      const orders: any[] = []
      const totalActual = orders.reduce((sum, order) => {
        return sum + safeNumeric(order.totalAmount)
      }, 0)

      expect(totalActual).toBe(0)
    })

    it('should calculate variance correctly', () => {
      const budget = 50000
      const actual = 45000
      const variance = actual - budget
      const variancePercent = safePercentage(variance, budget)

      expect(variance).toBe(-5000)
      expect(variancePercent).toBe(-10)
    })
  })
})