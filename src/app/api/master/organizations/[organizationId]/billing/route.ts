import { NextRequest, NextResponse } from 'next/server'
import { withMasterProtection } from '@/lib/auth/api-protection'
import prisma from '@/lib/db/prisma'

// PUT /api/master/organizations/[organizationId]/billing - Update organization billing amount
export const PUT = await withMasterProtection(async (
  request: NextRequest,
  { params }: { params: { organizationId: string } }
) => {
  try {
    const body = await request.json()
    const { billingAmount } = body
    
    if (typeof billingAmount !== 'number' || billingAmount < 0) {
      return NextResponse.json(
        { error: 'Invalid billing amount' },
        { status: 400 }
      )
    }
    
    // Check if organization exists
    const organization = await prisma.organization.findUnique({
      where: {
        id: params.organizationId
      }
    })
    
    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }
    
    // Update the billing amount
    const updatedOrg = await prisma.organization.update({
      where: {
        id: params.organizationId
      },
      data: {
        billingAmount: billingAmount
      }
    })
    
    console.log(`✅ Updated billing amount for ${organization.name} to $${billingAmount}`)
    
    return NextResponse.json({
      success: true,
      organization: {
        id: updatedOrg.id,
        name: updatedOrg.name,
        billingAmount: updatedOrg.billingAmount
      }
    })
    
  } catch (error) {
    console.error('Error updating organization billing:', error)
    return NextResponse.json(
      { error: 'Failed to update billing amount' },
      { status: 500 }
    )
  }
})