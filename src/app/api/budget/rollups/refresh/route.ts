import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug, safeQuerySchema } from '@/lib/db/schema-db'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // Get session and verify authentication
    const authToken = request.cookies.get('auth-token')?.value
    if (!authToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken)
    if (!user || !['master', 'admin'].includes(user.role)) {
      return NextResponse.json({ 
        error: 'Unauthorized - admin access required for cache management' 
      }, { status: 401 })
    }

    const body = await request.json()
    const { year, month, sellerId } = body

    if (!year) {
      return NextResponse.json({ error: 'Year is required' }, { status: 400 })
    }

    // Get organization slug
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    let refreshCount = 0
    const errors = []

    try {
      if (sellerId && month) {
        // Refresh specific seller and month
        const refreshQuery = `
          SELECT update_budget_rollup_cache($1, $2, $3, $4) as result
        `
        const { data, error } = await safeQuerySchema(
          orgSlug, 
          refreshQuery, 
          [user.organizationId, sellerId, year, month]
        )

        if (error) {
          errors.push(`Failed to refresh cache for seller ${sellerId}, ${year}-${month}: ${error}`)
        } else {
          refreshCount = 1
        }
      } else if (sellerId) {
        // Refresh all months for specific seller
        const monthsQuery = `
          SELECT DISTINCT month FROM "HierarchicalBudget"
          WHERE "organizationId" = $1 
            AND "sellerId" = $2 
            AND "year" = $3 
            AND "isActive" = true
          ORDER BY month
        `
        const { data: months = [], error: monthsError } = await safeQuerySchema(
          orgSlug, 
          monthsQuery, 
          [user.organizationId, sellerId, year]
        )

        if (monthsError) {
          errors.push(`Failed to get months for seller ${sellerId}: ${monthsError}`)
        } else {
          for (const monthData of months) {
            try {
              const refreshQuery = `
                SELECT update_budget_rollup_cache($1, $2, $3, $4) as result
              `
              const { error: refreshError } = await safeQuerySchema(
                orgSlug, 
                refreshQuery, 
                [user.organizationId, sellerId, year, monthData.month]
              )

              if (refreshError) {
                errors.push(`Failed to refresh cache for seller ${sellerId}, ${year}-${monthData.month}: ${refreshError}`)
              } else {
                refreshCount++
              }
            } catch (error) {
              errors.push(`Error refreshing seller ${sellerId}, month ${monthData.month}: ${error}`)
            }
          }
        }
      } else if (month) {
        // Refresh specific month for all sellers
        const sellersQuery = `
          SELECT DISTINCT "sellerId" FROM "HierarchicalBudget"
          WHERE "organizationId" = $1 
            AND "year" = $2 
            AND "month" = $3 
            AND "isActive" = true
            AND "sellerId" IS NOT NULL
          ORDER BY "sellerId"
        `
        const { data: sellers = [], error: sellersError } = await safeQuerySchema(
          orgSlug, 
          sellersQuery, 
          [user.organizationId, year, month]
        )

        if (sellersError) {
          errors.push(`Failed to get sellers for ${year}-${month}: ${sellersError}`)
        } else {
          for (const sellerData of sellers) {
            try {
              const refreshQuery = `
                SELECT update_budget_rollup_cache($1, $2, $3, $4) as result
              `
              const { error: refreshError } = await safeQuerySchema(
                orgSlug, 
                refreshQuery, 
                [user.organizationId, sellerData.sellerId, year, month]
              )

              if (refreshError) {
                errors.push(`Failed to refresh cache for seller ${sellerData.sellerId}, ${year}-${month}: ${refreshError}`)
              } else {
                refreshCount++
              }
            } catch (error) {
              errors.push(`Error refreshing seller ${sellerData.sellerId}: ${error}`)
            }
          }
        }
      } else {
        // Refresh entire year for all sellers
        const periodsQuery = `
          SELECT DISTINCT "sellerId", "month" FROM "HierarchicalBudget"
          WHERE "organizationId" = $1 
            AND "year" = $2 
            AND "isActive" = true
            AND "sellerId" IS NOT NULL
          ORDER BY "sellerId", "month"
        `
        const { data: periods = [], error: periodsError } = await safeQuerySchema(
          orgSlug, 
          periodsQuery, 
          [user.organizationId, year]
        )

        if (periodsError) {
          errors.push(`Failed to get periods for ${year}: ${periodsError}`)
        } else {
          for (const period of periods) {
            try {
              const refreshQuery = `
                SELECT update_budget_rollup_cache($1, $2, $3, $4) as result
              `
              const { error: refreshError } = await safeQuerySchema(
                orgSlug, 
                refreshQuery, 
                [user.organizationId, period.sellerId, year, period.month]
              )

              if (refreshError) {
                errors.push(`Failed to refresh cache for seller ${period.sellerId}, ${year}-${period.month}: ${refreshError}`)
              } else {
                refreshCount++
              }
            } catch (error) {
              errors.push(`Error refreshing seller ${period.sellerId}, month ${period.month}: ${error}`)
            }
          }
        }
      }

      return NextResponse.json({
        success: true,
        refreshedCount: refreshCount,
        errors: errors.length > 0 ? errors : undefined,
        message: `Successfully refreshed ${refreshCount} rollup cache entries${errors.length > 0 ? ` with ${errors.length} errors` : ''}`
      })

    } catch (error) {
      console.error('Error refreshing rollup cache:', error)
      return NextResponse.json({ 
        error: 'Failed to refresh rollup cache',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Error in rollup cache refresh:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}