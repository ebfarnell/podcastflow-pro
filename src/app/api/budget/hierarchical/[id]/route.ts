import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug, safeQuerySchema } from '@/lib/db/schema-db'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Get session and verify authentication
    const authToken = request.cookies.get('auth-token')?.value
    if (!authToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken)
    if (!user || !['master', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Unauthorized - only admin and master users can manage budgets' }, { status: 401 })
    }

    const budgetId = params.id
    const body = await request.json()
    const { budgetAmount, actualAmount, notes, updatedAt } = body

    // Get organization slug
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Verify budget entry exists and user has permission
    const existingQuery = `
      SELECT * FROM "HierarchicalBudget"
      WHERE id = $1 AND "isActive" = true
    `
    const { data: existing, error: existingError } = await safeQuerySchema(orgSlug, existingQuery, [budgetId])

    if (existingError || !existing || existing.length === 0) {
      return NextResponse.json({ error: 'Budget entry not found' }, { status: 404 })
    }

    const budget = existing[0]

    // Check for optimistic locking - if updatedAt is provided, verify it matches
    if (updatedAt && new Date(budget.updatedAt).getTime() !== new Date(updatedAt).getTime()) {
      return NextResponse.json({ 
        error: 'Budget has been modified by another user. Please refresh and try again.',
        currentVersion: budget.updatedAt 
      }, { status: 409 })
    }

    // Only allow updating advertiser budgets and developmental seller budgets
    if (budget.entityType === 'agency') {
      return NextResponse.json({ 
        error: 'Agency budgets are calculated automatically and cannot be edited.' 
      }, { status: 400 })
    }
    
    if (budget.entityType === 'seller' && (!budget.notes || !budget.notes.toLowerCase().includes('developmental'))) {
      return NextResponse.json({ 
        error: 'Only developmental seller budgets can be edited.' 
      }, { status: 400 })
    }

    // Build update query dynamically based on provided fields
    const updateFields: string[] = []
    const updateParams: any[] = []
    let paramIndex = 1

    if (budgetAmount !== undefined) {
      updateFields.push(`"budgetAmount" = $${paramIndex++}`)
      updateParams.push(budgetAmount)
    }

    if (actualAmount !== undefined) {
      updateFields.push(`"actualAmount" = $${paramIndex++}`)
      updateParams.push(actualAmount)
    }

    if (notes !== undefined) {
      updateFields.push(`"notes" = $${paramIndex++}`)
      updateParams.push(notes)
    }

    if (updateFields.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    // Add standard update fields
    updateFields.push(`"updatedAt" = CURRENT_TIMESTAMP`)
    updateFields.push(`"updatedBy" = $${paramIndex++}`)
    updateParams.push(user.id)

    // Add WHERE clause parameters
    updateParams.push(budgetId)

    const updateQuery = `
      UPDATE "HierarchicalBudget" 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `

    const { data: updated, error: updateError } = await safeQuerySchema(orgSlug, updateQuery, updateParams)

    if (updateError || !updated || updated.length === 0) {
      console.error('Error updating budget entry:', updateError)
      return NextResponse.json({ error: 'Failed to update budget entry' }, { status: 500 })
    }

    return NextResponse.json(updated[0])

  } catch (error) {
    console.error('Error updating hierarchical budget:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Get session and verify authentication
    const authToken = request.cookies.get('auth-token')?.value
    if (!authToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken)
    if (!user || !['master', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Unauthorized - admin access required' }, { status: 401 })
    }

    const budgetId = params.id

    // Get organization slug
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Verify budget entry exists
    const existingQuery = `
      SELECT * FROM "HierarchicalBudget"
      WHERE id = $1
    `
    const { data: existing, error: existingError } = await safeQuerySchema(orgSlug, existingQuery, [budgetId])

    if (existingError || !existing || existing.length === 0) {
      return NextResponse.json({ error: 'Budget entry not found' }, { status: 404 })
    }

    // Soft delete by setting isActive to false
    const deleteQuery = `
      UPDATE "HierarchicalBudget" 
      SET "isActive" = false, "updatedAt" = CURRENT_TIMESTAMP, "updatedBy" = $1
      WHERE id = $2
      RETURNING *
    `

    const { data: deleted, error: deleteError } = await safeQuerySchema(orgSlug, deleteQuery, [user.id, budgetId])

    if (deleteError || !deleted || deleted.length === 0) {
      console.error('Error deleting budget entry:', deleteError)
      return NextResponse.json({ error: 'Failed to delete budget entry' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Budget entry deleted successfully' })

  } catch (error) {
    console.error('Error deleting hierarchical budget:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}