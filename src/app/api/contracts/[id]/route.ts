import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { safeQuerySchema, getUserOrgSlug } from '@/lib/db/schema-db'
import { ContractService } from '@/lib/workflow/contract-service'
import { notificationService } from '@/services/notifications/notification-service'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgSlug = await getUserOrgSlug(session.userId)
    if (!orgSlug) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }

    const { data: contract, error } = await safeQuerySchema(orgSlug, async (db) => {
      return db.contract.findUnique({
        where: { id: params.id },
        include: {
          advertiser: true,
          agency: true,
          campaign: true,
          order: {
            include: {
              lineItems: {
                include: {
                  episode: {
                    include: {
                      show: true
                    }
                  }
                }
              }
            }
          },
          executedBy: {
            select: { id: true, name: true, email: true }
          },
          signatures: true,
          contractTemplate: true
        }
      })
    })

    if (error) {
      console.error('Error fetching contract:', error)
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    }

    return NextResponse.json(contract)
  } catch (error) {
    console.error('Error in GET /api/contracts/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin and master can update contracts
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const orgSlug = await getUserOrgSlug(session.userId)
    if (!orgSlug) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }

    const body = await request.json()
    const { action, ...data } = body

    if (action === 'send') {
      // Send contract for signature
      const contractService = new ContractService()
      const result = await contractService.sendContractForSignature(
        orgSlug,
        params.id,
        data.recipientEmail
      )

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }

      // Get contract details for notification
      const { data: contract } = await safeQuerySchema(orgSlug, async (db) => {
        return db.contract.findUnique({
          where: { id: params.id },
          include: {
            advertiser: { select: { name: true } },
            order: { select: { totalValue: true } }
          }
        })
      })

      // Notify relevant users about contract being sent
      if (contract) {
        const notificationUserIds = []
        
        // Add contract creator
        if (contract.createdById && contract.createdById !== session.userId) {
          notificationUserIds.push(contract.createdById)
        }

        // Add admin users
        const adminUsers = await safeQuerySchema('public', async (db) => {
          return db.user.findMany({
            where: {
              organizationId: session.organizationId,
              role: { in: ['admin', 'master'] },
              id: { not: session.userId }
            },
            select: { id: true }
          })
        })

        if (adminUsers.data?.length > 0) {
          notificationUserIds.push(...adminUsers.data.map((u: any) => u.id))
        }

        if (notificationUserIds.length > 0) {
          await notificationService.sendBulkNotification({
            title: `Contract Sent for Signature`,
            message: `Contract for ${contract.advertiser?.name} has been sent to ${data.recipientEmail} for signature`,
            type: 'contract_status_update',
            userIds: [...new Set(notificationUserIds)],
            actionUrl: `/contracts/${params.id}`,
            sendEmail: false,
            emailData: {
              contractTitle: contract.title || 'Contract',
              advertiserName: contract.advertiser?.name,
              recipientEmail: data.recipientEmail,
              sentDate: new Date().toLocaleDateString(),
              contractLink: `${process.env.NEXT_PUBLIC_APP_URL}/contracts/${params.id}`
            }
          })
        }
      }

      return NextResponse.json({ success: true })
    } else if (action === 'execute') {
      // Get contract details before execution
      const { data: preExecutionContract } = await safeQuerySchema(orgSlug, async (db) => {
        return db.contract.findUnique({
          where: { id: params.id },
          include: {
            advertiser: { select: { name: true } },
            campaign: { select: { name: true } },
            order: { select: { totalValue: true } }
          }
        })
      })

      // Mark contract as executed
      const contractService = new ContractService()
      const result = await contractService.markContractExecuted(
        orgSlug,
        params.id,
        session.userId
      )

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }

      // Notify relevant users about contract execution
      if (preExecutionContract) {
        const notificationUserIds = []
        
        // Add contract creator
        if (preExecutionContract.createdById && preExecutionContract.createdById !== session.userId) {
          notificationUserIds.push(preExecutionContract.createdById)
        }

        // Add admin and sales users
        const relevantUsers = await safeQuerySchema('public', async (db) => {
          return db.user.findMany({
            where: {
              organizationId: session.organizationId,
              role: { in: ['admin', 'master', 'sales'] },
              id: { not: session.userId }
            },
            select: { id: true }
          })
        })

        if (relevantUsers.data?.length > 0) {
          notificationUserIds.push(...relevantUsers.data.map((u: any) => u.id))
        }

        if (notificationUserIds.length > 0) {
          await notificationService.notifyContractStatusChange(
            [...new Set(notificationUserIds)],
            {
              ...preExecutionContract,
              name: preExecutionContract.title,
              advertiserName: preExecutionContract.advertiser?.name,
              campaignName: preExecutionContract.campaign?.name
            },
            'signed',
            'executed',
            session.userId,
            'Contract has been fully executed and is now active',
            true
          )
        }
      }

      return NextResponse.json({ success: true })
    } else {
      // Update contract fields
      const { error } = await safeQuerySchema(orgSlug, async (db) => {
        await db.contract.update({
          where: { id: params.id },
          data: {
            ...data,
            updatedAt: new Date(),
            updatedById: session.userId
          }
        })
      })

      if (error) {
        console.error('Error updating contract:', error)
        return NextResponse.json({ error: 'Failed to update contract' }, { status: 400 })
      }

      return NextResponse.json({ success: true })
    }
  } catch (error) {
    console.error('Error in PUT /api/contracts/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only master can delete contracts
    if (session.role !== 'master') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const orgSlug = await getUserOrgSlug(session.userId)
    if (!orgSlug) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }

    // Check if contract is executed
    const { data: contract } = await safeQuerySchema(orgSlug, async (db) => {
      return db.contract.findUnique({
        where: { id: params.id },
        select: { isExecuted: true }
      })
    })

    if (contract?.isExecuted) {
      return NextResponse.json({ error: 'Cannot delete executed contract' }, { status: 400 })
    }

    // Delete contract
    const { error } = await safeQuerySchema(orgSlug, async (db) => {
      await db.contract.delete({
        where: { id: params.id }
      })
    })

    if (error) {
      console.error('Error deleting contract:', error)
      return NextResponse.json({ error: 'Failed to delete contract' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/contracts/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}