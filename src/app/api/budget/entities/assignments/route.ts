import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug, safeQuerySchema } from '@/lib/db/schema-db'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'

export async function PUT(request: NextRequest) {
  try {
    // Get session and verify authentication
    const authToken = request.cookies.get('auth-token')?.value
    if (!authToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken)
    if (!user || !['master', 'admin'].includes(user.role)) {
      return NextResponse.json({ 
        error: 'Unauthorized - admin access required for seller assignments' 
      }, { status: 401 })
    }

    const body = await request.json()
    const { assignments } = body

    if (!Array.isArray(assignments) || assignments.length === 0) {
      return NextResponse.json({ 
        error: 'Assignments array is required and must not be empty' 
      }, { status: 400 })
    }

    if (assignments.length > 50) {
      return NextResponse.json({ 
        error: 'Maximum 50 assignments allowed per batch' 
      }, { status: 400 })
    }

    // Get organization slug
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Validate assignments
    const results = []
    const errors = []

    for (const assignment of assignments) {
      const { entityType, entityId, sellerId } = assignment

      if (!entityType || !entityId || !sellerId) {
        errors.push({
          entityType,
          entityId,
          error: 'Entity type, entity ID, and seller ID are required'
        })
        continue
      }

      if (!['advertiser', 'agency'].includes(entityType)) {
        errors.push({
          entityType,
          entityId,
          error: 'Entity type must be "advertiser" or "agency"'
        })
        continue
      }

      try {
        // Verify seller exists and has sales role
        const sellerQuery = `
          SELECT id, name FROM public."User" 
          WHERE id = $1 
            AND role = 'sales' 
            AND "organizationId" = $2 
            AND "isActive" = true
        `
        const { data: seller, error: sellerError } = await safeQuerySchema(
          orgSlug, 
          sellerQuery, 
          [sellerId, user.organizationId]
        )

        if (sellerError || !seller || seller.length === 0) {
          errors.push({
            entityType,
            entityId,
            error: 'Seller not found or not active'
          })
          continue
        }

        // Update entity assignment
        let updateQuery = ''
        let entityName = ''

        if (entityType === 'advertiser') {
          // Verify advertiser exists
          const checkQuery = `
            SELECT name FROM "Advertiser" 
            WHERE id = $1 AND "organizationId" = $2 AND "isActive" = true
          `
          const { data: advertiser, error: checkError } = await safeQuerySchema(
            orgSlug, 
            checkQuery, 
            [entityId, user.organizationId]
          )

          if (checkError || !advertiser || advertiser.length === 0) {
            errors.push({
              entityType,
              entityId,
              error: 'Advertiser not found or not active'
            })
            continue
          }

          entityName = advertiser[0].name

          updateQuery = `
            UPDATE "Advertiser" 
            SET "sellerId" = $1, "updatedAt" = CURRENT_TIMESTAMP, "updatedBy" = $2
            WHERE id = $3 AND "organizationId" = $4
            RETURNING id, name, "sellerId"
          `
        } else if (entityType === 'agency') {
          // Verify agency exists
          const checkQuery = `
            SELECT name FROM "Agency" 
            WHERE id = $1 AND "organizationId" = $2 AND "isActive" = true
          `
          const { data: agency, error: checkError } = await safeQuerySchema(
            orgSlug, 
            checkQuery, 
            [entityId, user.organizationId]
          )

          if (checkError || !agency || agency.length === 0) {
            errors.push({
              entityType,
              entityId,
              error: 'Agency not found or not active'
            })
            continue
          }

          entityName = agency[0].name

          updateQuery = `
            UPDATE "Agency" 
            SET "sellerId" = $1, "updatedAt" = CURRENT_TIMESTAMP, "updatedBy" = $2
            WHERE id = $3 AND "organizationId" = $4
            RETURNING id, name, "sellerId"
          `
        }

        const { data: updated, error: updateError } = await safeQuerySchema(
          orgSlug, 
          updateQuery, 
          [sellerId, user.id, entityId, user.organizationId]
        )

        if (updateError || !updated || updated.length === 0) {
          console.error(`Error updating ${entityType} assignment:`, updateError)
          errors.push({
            entityType,
            entityId,
            error: `Failed to update ${entityType} assignment`
          })
        } else {
          results.push({
            entityType,
            entityId,
            entityName,
            sellerId,
            sellerName: seller[0].name,
            updated: true
          })

          // Update existing hierarchical budgets to reflect new seller assignment
          const budgetUpdateQuery = `
            UPDATE "HierarchicalBudget"
            SET "sellerId" = $1, "updatedAt" = CURRENT_TIMESTAMP, "updatedBy" = $2
            WHERE "entityType" = $3 
              AND "entityId" = $4 
              AND "organizationId" = $5
              AND "isActive" = true
          `
          
          await safeQuerySchema(orgSlug, budgetUpdateQuery, [
            sellerId, user.id, entityType, entityId, user.organizationId
          ])
        }

      } catch (error) {
        console.error(`Error processing assignment for ${entityType} ${entityId}:`, error)
        errors.push({
          entityType,
          entityId,
          error: 'Internal error processing assignment'
        })
      }
    }

    // Return results with success/error breakdown
    return NextResponse.json({
      success: results.length,
      errors: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined,
      message: `Successfully updated ${results.length} seller assignments${errors.length > 0 ? ` with ${errors.length} errors` : ''}`
    })

  } catch (error) {
    console.error('Error updating seller assignments:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}