import { NextRequest, NextResponse } from 'next/server'
import { withMasterProtection } from '@/lib/auth/api-protection'
import prisma from '@/lib/db/prisma'

// PUT /api/master/billing/plans/[planId] - Update a billing plan
export const PUT = await withMasterProtection(async (
  request: NextRequest,
  { params }: { params: { planId: string } }
) => {
  try {
    const body = await request.json()
    const { monthlyPrice, yearlyPrice, usersLimit, campaignsLimit, showsLimit, storageLimit, features } = body

    // Check if plan exists
    const existingPlan = await prisma.billingPlan.findUnique({
      where: { id: params.planId }
    })

    if (!existingPlan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      )
    }

    // Don't allow updating custom plans from this endpoint
    if (existingPlan.name.includes('_custom_')) {
      return NextResponse.json(
        { error: 'Cannot modify custom organization plans from this endpoint' },
        { status: 400 }
      )
    }

    // Update the plan
    const updatedPlan = await prisma.billingPlan.update({
      where: { id: params.planId },
      data: {
        monthlyPrice: monthlyPrice || existingPlan.monthlyPrice,
        yearlyPrice: yearlyPrice !== undefined ? yearlyPrice : existingPlan.yearlyPrice,
        usersLimit: usersLimit !== undefined ? usersLimit : existingPlan.usersLimit,
        campaignsLimit: campaignsLimit !== undefined ? campaignsLimit : existingPlan.campaignsLimit,
        showsLimit: showsLimit !== undefined ? showsLimit : existingPlan.showsLimit,
        storageLimit: storageLimit !== undefined ? storageLimit : existingPlan.storageLimit,
        features: features || existingPlan.features
      }
    })

    console.log(`✅ Updated billing plan ${existingPlan.name} (${params.planId})`)

    return NextResponse.json({
      success: true,
      plan: {
        id: updatedPlan.id,
        name: updatedPlan.name,
        monthlyPrice: updatedPlan.monthlyPrice,
        yearlyPrice: updatedPlan.yearlyPrice,
        usersLimit: updatedPlan.usersLimit,
        campaignsLimit: updatedPlan.campaignsLimit,
        showsLimit: updatedPlan.showsLimit,
        storageLimit: updatedPlan.storageLimit,
        features: Array.isArray(updatedPlan.features) ? updatedPlan.features : [],
        isActive: updatedPlan.isActive
      }
    })
  } catch (error) {
    console.error('Error updating billing plan:', error)
    return NextResponse.json(
      { error: 'Failed to update billing plan' },
      { status: 500 }
    )
  }
})