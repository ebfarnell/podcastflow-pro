import { NextRequest, NextResponse } from 'next/server'
import { withMasterProtection } from '@/lib/auth/api-protection'
import prisma from '@/lib/db/prisma'

// GET /api/master/billing/plans - Get all billing plans
export const GET = await withMasterProtection(async (request: NextRequest) => {
  try {
    const plans = await prisma.billingPlan.findMany({
      where: {
        isActive: true
      },
      orderBy: {
        monthlyPrice: 'asc'
      }
    })

    // Convert features from JSONB to array and ensure proper format
    const transformedPlans = plans.map(plan => ({
      id: plan.id,
      name: plan.name,
      monthlyPrice: plan.monthlyPrice,
      yearlyPrice: plan.yearlyPrice,
      usersLimit: plan.usersLimit || 0,
      campaignsLimit: plan.campaignsLimit || 0,
      showsLimit: plan.showsLimit || 0,
      storageLimit: plan.storageLimit || 0,
      features: Array.isArray(plan.features) ? plan.features : [],
      isActive: plan.isActive
    }))

    return NextResponse.json(transformedPlans)
  } catch (error) {
    console.error('Error fetching billing plans:', error)
    return NextResponse.json(
      { error: 'Failed to fetch billing plans' },
      { status: 500 }
    )
  }
})