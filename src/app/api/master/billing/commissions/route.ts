import { NextRequest, NextResponse } from 'next/server'
import { withMasterProtection } from '@/lib/auth/api-protection'

// GET /api/master/billing/commissions - Get agency commissions overview
export const GET = await withMasterProtection(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const organizationId = searchParams.get('organizationId')
    const agencyId = searchParams.get('agencyId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    console.log('💰 Getting agency commissions:', { organizationId, agencyId, startDate, endDate })

    const prisma = (await import('@/lib/db/prisma')).default

    // Build where clause
    const whereClause: any = {
      category: 'Commission'
    }

    if (organizationId) {
      whereClause.organizationId = organizationId
    }

    if (agencyId) {
      whereClause.vendorId = agencyId
    }

    if (startDate || endDate) {
      whereClause.createdAt = {}
      if (startDate) whereClause.createdAt.gte = new Date(startDate)
      if (endDate) whereClause.createdAt.lte = new Date(endDate)
    }

    // Get commission expenses
    const commissions = await prisma.expense.findMany({
      where: whereClause,
      include: {
        organization: true
      },
      orderBy: { createdAt: 'desc' }
    })

    // Calculate summary metrics
    const summary = {
      totalCommissions: commissions.length,
      totalAmount: commissions.reduce((sum, comm) => sum + comm.amount, 0),
      pendingAmount: commissions
        .filter(comm => comm.status === 'pending')
        .reduce((sum, comm) => sum + comm.amount, 0),
      paidAmount: commissions
        .filter(comm => comm.status === 'paid')
        .reduce((sum, comm) => sum + comm.amount, 0),
      agencies: new Set(commissions.map(comm => comm.vendorId).filter(Boolean)).size,
      organizations: new Set(commissions.map(comm => comm.organizationId)).size
    }

    // Group by agency
    const agencyCommissions = commissions.reduce((acc, commission) => {
      const agencyKey = commission.vendorId || 'unknown'
      if (!acc[agencyKey]) {
        acc[agencyKey] = {
          agencyId: commission.vendorId,
          agencyName: commission.vendor || 'Unknown Agency',
          totalAmount: 0,
          pendingAmount: 0,
          paidAmount: 0,
          commissionCount: 0,
          commissions: []
        }
      }

      acc[agencyKey].totalAmount += commission.amount
      acc[agencyKey].commissionCount += 1
      
      if (commission.status === 'pending') {
        acc[agencyKey].pendingAmount += commission.amount
      } else if (commission.status === 'paid') {
        acc[agencyKey].paidAmount += commission.amount
      }

      acc[agencyKey].commissions.push({
        id: commission.id,
        amount: commission.amount,
        status: commission.status,
        description: commission.description,
        dueDate: commission.dueDate,
        createdAt: commission.createdAt,
        organizationName: commission.organization.name,
        metadata: commission.metadata
      })

      return acc
    }, {} as any)

    return NextResponse.json({
      summary,
      agencyCommissions: Object.values(agencyCommissions),
      totalRecords: commissions.length,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Agency commissions error:', error)
    return NextResponse.json(
      { error: 'Failed to get agency commissions' },
      { status: 500 }
    )
  }
})

// POST /api/master/billing/commissions/[id]/pay - Mark commission as paid
export const POST = await withMasterProtection(async (request: NextRequest) => {
  try {
    const body = await request.json()
    const { expenseId, paymentDate, paymentMethod, notes } = body

    console.log('💸 Marking commission as paid:', expenseId)

    const prisma = (await import('@/lib/db/prisma')).default

    // Update expense to paid
    const updatedExpense = await prisma.expense.update({
      where: { id: expenseId },
      data: {
        status: 'paid',
        metadata: {
          ...((typeof body.metadata === 'object' && body.metadata) || {}),
          paidDate: paymentDate || new Date().toISOString(),
          paymentMethod: paymentMethod || 'manual',
          paymentNotes: notes
        }
      }
    })

    return NextResponse.json({
      success: true,
      expense: updatedExpense,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Commission payment error:', error)
    return NextResponse.json(
      { error: 'Failed to mark commission as paid' },
      { status: 500 }
    )
  }
})