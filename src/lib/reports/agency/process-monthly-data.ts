import { BudgetData } from './fetch-budgets'

export interface MonthlyDataEntry {
  month: string
  year: number
  monthNumber: number
  goal: number
  actual: number
  advertiserCount: number
  variance: number
  percentToGoal: number
}

export function processMonthlyData(budgets: BudgetData[]): MonthlyDataEntry[] {
  const monthlyMap = new Map<string, {
    month: string
    year: number
    monthNumber: number
    goal: number
    actual: number
    advertiserCount: number
  }>()

  // Process each budget entry
  budgets.forEach(function(budget) {
    const monthString = String(budget.month).padStart(2, '0')
    const key = `${budget.year}-${monthString}`
    
    if (!monthlyMap.has(key)) {
      monthlyMap.set(key, {
        month: key,
        year: budget.year,
        monthNumber: budget.month,
        goal: 0,
        actual: 0,
        advertiserCount: 0
      })
    }

    const entry = monthlyMap.get(key)
    if (!entry) return
    
    if (budget.entityType === 'agency') {
      // Direct agency budget (if any)
      entry.goal = entry.goal + (budget.budget || 0)
      entry.actual = entry.actual + (budget.actual || 0)
    } else if (budget.entityType === 'advertiser') {
      // Sum advertiser budgets for agency rollup
      entry.goal = entry.goal + (budget.budget || 0)
      entry.actual = entry.actual + (budget.actual || 0)
      entry.advertiserCount = entry.advertiserCount + 1
    }
  })

  // Convert map to array and calculate derived fields
  const monthlyData: MonthlyDataEntry[] = []
  
  monthlyMap.forEach(function(value) {
    const variance = value.actual - value.goal
    const percentToGoal = value.goal > 0 ? Math.round((value.actual / value.goal) * 100) : 0
    
    monthlyData.push({
      month: value.month,
      year: value.year,
      monthNumber: value.monthNumber,
      goal: value.goal,
      actual: value.actual,
      advertiserCount: value.advertiserCount,
      variance: variance,
      percentToGoal: percentToGoal
    })
  })

  // Sort by date
  monthlyData.sort(function(a, b) {
    if (a.year !== b.year) return a.year - b.year
    return a.monthNumber - b.monthNumber
  })

  return monthlyData
}