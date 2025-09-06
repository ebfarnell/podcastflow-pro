import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { safeQuerySchema } from '@/lib/db/schema-db'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; preBillId: string } }
) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    if (!['sales', 'admin', 'master'].includes(session.role)) {
      return NextResponse.json(
        { error: 'You do not have permission to send pre-bills' },
        { status: 403 }
      )
    }

    const { id: campaignId, preBillId } = params

    // Update the pre-bill status to 'sent' and set sentAt timestamp
    const { data: preBill, error } = await safeQuerySchema(
      session.organizationSlug,
      async (prisma) => {
        return prisma.preBill.update({
          where: {
            id: preBillId,
            campaignId,
            organizationId: session.organizationId,
          },
          data: {
            status: 'sent',
            sentAt: new Date(),
          },
        })
      }
    )

    if (error || !preBill) {
      return NextResponse.json(
        { error: 'Pre-bill not found' },
        { status: 404 }
      )
    }

    // Fetch campaign details for the email
    const { data: campaign } = await safeQuerySchema(
      session.organizationSlug,
      async (prisma) => {
        return prisma.campaign.findUnique({
          where: {
            id: campaignId,
          },
          include: {
            advertiser: true,
          },
        })
      }
    )

    // Log the activity
    await safeQuerySchema(
      session.organizationSlug,
      async (prisma) => {
        return prisma.activity.create({
          data: {
            type: 'pre_bill_sent',
            userId: session.userId,
            organizationId: session.organizationId,
            metadata: {
              campaignId,
              preBillId,
              campaignName: campaign?.name,
              advertiserName: campaign?.advertiser?.name,
              amount: preBill.amount,
            },
          },
        })
      }
    )

    // In a production environment, you would integrate with an email service here
    // For now, we'll just mark it as sent
    console.log(`Pre-bill ${preBillId} marked as sent for campaign ${campaignId}`)

    return NextResponse.json({
      message: 'Pre-bill sent successfully',
      preBill,
    })
  } catch (error) {
    console.error('Error sending pre-bill:', error)
    return NextResponse.json(
      { error: 'Failed to send pre-bill' },
      { status: 500 }
    )
  }
}