import { safeQuerySchema } from '@/lib/db/schema-db'

export interface BudgetData {
  entityType: string
  entityId: string
  year: number
  month: number
  budget: number
  actual: number
  percentToGoal: number
}

export async function fetchBudgets(
  orgSlug: string,
  agencyId: string,
  advertiserIds: string[],
  startDate: Date,
  endDate: Date
): Promise<{ data: BudgetData[]; error: string | null }> {
  try {
    const result = await safeQuerySchema<BudgetData>(
      orgSlug,
      `
        SELECT 
          "entityType",
          "entityId",
          year,
          month,
          "budgetAmount" as budget,
          "actualAmount" as actual,
          CASE 
            WHEN "budgetAmount" > 0 THEN ROUND(("actualAmount" / "budgetAmount" * 100)::numeric, 2)
            ELSE 0
          END as "percentToGoal"
        FROM "HierarchicalBudget"
        WHERE (
          ("entityType" = 'agency' AND "entityId" = $1) OR
          ("entityType" = 'advertiser' AND "entityId" = ANY($2::text[]))
        )
        AND (year * 12 + month) >= ($3 * 12 + $4)
        AND (year * 12 + month) <= ($5 * 12 + $6)
        ORDER BY year, month
      `,
      [
        agencyId,
        advertiserIds.length > 0 ? advertiserIds : ['00000000-0000-0000-0000-000000000000'], // Dummy UUID if no advertisers
        startDate.getFullYear(),
        startDate.getMonth() + 1,
        endDate.getFullYear(),
        endDate.getMonth() + 1
      ]
    )

    if (result.error) {
      console.error('[fetchBudgets] Query error:', result.error)
      return { data: [], error: result.error }
    }

    return { data: result.data || [], error: null }
  } catch (error) {
    console.error('[fetchBudgets] Error:', error)
    return { data: [], error: 'Failed to fetch budgets' }
  }
}