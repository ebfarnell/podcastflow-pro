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
    if (!user || !['master', 'admin', 'sales'].includes(user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { updates } = body

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ error: 'Updates array is required and must not be empty' }, { status: 400 })
    }

    if (updates.length > 100) {
      return NextResponse.json({ error: 'Maximum 100 updates allowed per batch' }, { status: 400 })
    }

    // Get organization slug
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Validate all budget IDs exist and user has permission
    const budgetIds = updates.map(update => update.id).filter(Boolean)
    if (budgetIds.length === 0) {
      return NextResponse.json({ error: 'At least one valid budget ID is required' }, { status: 400 })
    }

    // Query HierarchicalBudget table in organization schema
    const existingQuery = `
      SELECT id, "sellerId" FROM "HierarchicalBudget"
      WHERE id = ANY($1::text[]) 
        AND "isActive" = true
    `
    
    const { data: existing, error: existingError } = await safeQuerySchema(
      orgSlug, 
      existingQuery, 
      [budgetIds]
    )

    if (existingError) {
      console.error('Error validating budget entries:', existingError)
      return NextResponse.json({ error: 'Failed to validate budget entries' }, { status: 500 })
    }

    if (!existing || existing.length !== budgetIds.length) {
      console.error('Budget validation failed. Found:', existing?.length, 'Expected:', budgetIds.length)
      return NextResponse.json({ 
        error: 'One or more budget entries not found',
        debug: {
          found: existing?.length || 0,
          expected: budgetIds.length,
          missingIds: budgetIds.filter(id => !existing?.find(e => e.id === id))
        }
      }, { status: 404 })
    }

    // For sales users, verify all entries belong to them
    if (user.role === 'sales') {
      const unauthorized = existing.find(budget => budget.sellerId !== user.id)
      if (unauthorized) {
        return NextResponse.json({ 
          error: 'Can only update your own assigned entities' 
        }, { status: 403 })
      }
    }

    // Perform batch updates
    const results = []
    const errors = []

    for (const update of updates) {
      if (!update.id) {
        errors.push({ id: null, error: 'Budget ID is required' })
        continue
      }

      try {
        // Build update query for this entry
        const updateFields: string[] = []
        const updateParams: any[] = []
        let paramIndex = 1

        if (update.budgetAmount !== undefined) {
          if (typeof update.budgetAmount !== 'number' || update.budgetAmount < 0) {
            errors.push({ id: update.id, error: 'Budget amount must be a non-negative number' })
            continue
          }
          updateFields.push(`"budgetAmount" = $${paramIndex++}`)
          updateParams.push(update.budgetAmount)
        }

        // Actual amount editing is disabled - only budget amounts can be edited
        // if (update.actualAmount !== undefined) {
        //   if (typeof update.actualAmount !== 'number' || update.actualAmount < 0) {
        //     errors.push({ id: update.id, error: 'Actual amount must be a non-negative number' })
        //     continue
        //   }
        //   updateFields.push(`"actualAmount" = $${paramIndex++}`)
        //   updateParams.push(update.actualAmount)
        // }

        if (update.notes !== undefined) {
          updateFields.push(`"notes" = $${paramIndex++}`)
          updateParams.push(update.notes)
        }

        if (updateFields.length === 0) {
          errors.push({ id: update.id, error: 'No valid fields to update' })
          continue
        }

        // Add standard update fields
        updateFields.push(`"updatedAt" = CURRENT_TIMESTAMP`)
        updateFields.push(`"updatedBy" = $${paramIndex++}`)
        updateParams.push(user.id)

        // Add WHERE clause parameters
        updateParams.push(update.id)

        const updateQuery = `
          UPDATE "HierarchicalBudget" 
          SET ${updateFields.join(', ')}
          WHERE id = $${paramIndex}
          RETURNING *
        `

        const { data: updated, error: updateError } = await safeQuerySchema(
          orgSlug, 
          updateQuery, 
          updateParams
        )

        if (updateError || !updated || updated.length === 0) {
          console.error(`Error updating budget ${update.id}:`, updateError)
          errors.push({ id: update.id, error: 'Failed to update budget entry' })
        } else {
          results.push(updated[0])
        }

      } catch (error) {
        console.error(`Error processing update for budget ${update.id}:`, error)
        errors.push({ id: update.id, error: 'Internal error processing update' })
      }
    }

    // Return results with success/error breakdown
    return NextResponse.json({
      success: results.length,
      errors: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined
    })

  } catch (error) {
    console.error('Error in batch budget update:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Get session and verify authentication
    const authToken = request.cookies.get('auth-token')?.value
    if (!authToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken)
    if (!user || !['master', 'admin', 'sales'].includes(user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { budgetIds } = body

    if (!Array.isArray(budgetIds) || budgetIds.length === 0) {
      return NextResponse.json({ error: 'Budget IDs array is required and must not be empty' }, { status: 400 })
    }

    if (budgetIds.length > 100) {
      return NextResponse.json({ error: 'Maximum 100 deletions allowed per batch' }, { status: 400 })
    }

    // Get organization slug
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Validate all budget IDs exist and user has permission
    const existingQuery = `
      SELECT id, "sellerId", "entityType", notes FROM "HierarchicalBudget"
      WHERE id = ANY($1::text[]) 
        AND "isActive" = true
    `
    
    const { data: existing, error: existingError } = await safeQuerySchema(
      orgSlug, 
      existingQuery, 
      [budgetIds]
    )

    if (existingError) {
      console.error('Error validating budget entries:', existingError)
      return NextResponse.json({ error: 'Failed to validate budget entries' }, { status: 500 })
    }

    if (!existing || existing.length === 0) {
      return NextResponse.json({ error: 'No valid budget entries found for deletion' }, { status: 404 })
    }

    // For sales users, verify all entries belong to them
    if (user.role === 'sales') {
      const unauthorized = existing.find(budget => budget.sellerId !== user.id)
      if (unauthorized) {
        return NextResponse.json({ 
          error: 'Can only delete your own assigned entities' 
        }, { status: 403 })
      }
    }

    // Only allow deletion of developmental goals (seller entities with developmental notes)
    const nonDevelopmentalGoals = existing.filter(budget => 
      budget.entityType !== 'seller' || 
      !budget.notes?.toLowerCase().includes('developmental business')
    )

    if (nonDevelopmentalGoals.length > 0) {
      return NextResponse.json({ 
        error: 'Can only delete developmental business goals',
        invalidIds: nonDevelopmentalGoals.map(b => b.id)
      }, { status: 400 })
    }

    // Perform batch deletion
    const validIds = existing.map(b => b.id)
    const deleteQuery = `
      UPDATE "HierarchicalBudget" 
      SET "isActive" = false, "updatedAt" = CURRENT_TIMESTAMP, "updatedBy" = $2
      WHERE id = ANY($1::text[])
      RETURNING id
    `

    const { data: deleted, error: deleteError } = await safeQuerySchema(
      orgSlug, 
      deleteQuery, 
      [validIds, user.id]
    )

    if (deleteError) {
      console.error('Error deleting budget entries:', deleteError)
      return NextResponse.json({ error: 'Failed to delete budget entries' }, { status: 500 })
    }

    return NextResponse.json({
      deletedCount: deleted?.length || 0,
      deletedIds: deleted?.map(d => d.id) || []
    })

  } catch (error) {
    console.error('Error in batch budget deletion:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}