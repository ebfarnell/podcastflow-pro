import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { safeQuerySchema } from '@/lib/db/schema-db'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const campaignId = params.id

    // Query pre-bills from the organization schema
    const { data: preBills, error } = await safeQuerySchema(
      session.organizationSlug,
      async (prisma) => {
        return prisma.preBill.findMany({
          where: {
            campaignId: campaignId,
            organizationId: session.organizationId,
          },
          orderBy: {
            createdAt: 'desc',
          },
        })
      }
    )

    if (error) {
      // Pre-bills table might not exist yet, return empty array
      console.log('Pre-bills query failed (table may not exist):', error)
      return NextResponse.json({ preBills: [] })
    }

    return NextResponse.json({ preBills: preBills || [] })
  } catch (error) {
    console.error('Error fetching pre-bills:', error)
    return NextResponse.json({ preBills: [] })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions - only sales, admin, and master can generate pre-bills
    if (!['sales', 'admin', 'master'].includes(session.role)) {
      return NextResponse.json(
        { error: 'You do not have permission to generate pre-bills' },
        { status: 403 }
      )
    }

    const campaignId = params.id
    const body = await request.json()
    const { type, month, amount, notes } = body

    // Validate input
    if (!type || !['campaign', 'monthly'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid pre-bill type' },
        { status: 400 }
      )
    }

    if (type === 'monthly' && !month) {
      return NextResponse.json(
        { error: 'Month is required for monthly pre-bills' },
        { status: 400 }
      )
    }

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      )
    }

    // First, check if the campaign exists and is eligible
    const { data: campaign, error: campaignError } = await safeQuerySchema(
      session.organizationSlug,
      async (prisma) => {
        return prisma.campaign.findUnique({
          where: {
            id: campaignId,
            organizationId: session.organizationId,
          },
        })
      }
    )

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }

    // Check eligibility: 90% probability and approved
    if (campaign.probability < 90) {
      return NextResponse.json(
        { error: 'Campaign must be at 90% probability or higher to generate pre-bills' },
        { status: 400 }
      )
    }

    if (campaign.approvalStatus !== 'approved') {
      return NextResponse.json(
        { error: 'Campaign must be approved to generate pre-bills' },
        { status: 400 }
      )
    }

    // Create the pre-bill
    const { data: preBill, error: createError } = await safeQuerySchema(
      session.organizationSlug,
      async (prisma) => {
        // First ensure the PreBill table exists by trying to create it
        // This is a temporary solution until we add proper migrations
        try {
          await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "${session.organizationSlug}"."PreBill" (
              id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
              "campaignId" TEXT NOT NULL,
              "organizationId" TEXT NOT NULL,
              type TEXT NOT NULL,
              month TEXT,
              amount DOUBLE PRECISION NOT NULL,
              status TEXT NOT NULL DEFAULT 'draft',
              "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
              "sentAt" TIMESTAMP(3),
              "paidAt" TIMESTAMP(3),
              "createdBy" TEXT NOT NULL,
              notes TEXT,
              CONSTRAINT "PreBill_campaignId_fkey" 
                FOREIGN KEY ("campaignId") 
                REFERENCES "${session.organizationSlug}"."Campaign"(id) 
                ON DELETE CASCADE ON UPDATE CASCADE
            )
          `)

          // Create index if it doesn't exist
          await prisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "PreBill_campaignId_idx" 
            ON "${session.organizationSlug}"."PreBill"("campaignId")
          `)
        } catch (tableError) {
          // Table might already exist, ignore error
          console.log('PreBill table creation:', tableError)
        }

        return prisma.preBill.create({
          data: {
            campaignId,
            organizationId: session.organizationId,
            type,
            month: type === 'monthly' ? month : null,
            amount,
            status: 'draft',
            createdBy: session.userId,
            notes,
          },
        })
      }
    )

    if (createError) {
      console.error('Error creating pre-bill:', createError)
      return NextResponse.json(
        { error: 'Failed to create pre-bill' },
        { status: 500 }
      )
    }

    // Log the activity
    await safeQuerySchema(
      session.organizationSlug,
      async (prisma) => {
        return prisma.activity.create({
          data: {
            type: 'pre_bill_generated',
            userId: session.userId,
            organizationId: session.organizationId,
            metadata: {
              campaignId,
              preBillId: preBill.id,
              type,
              amount,
              campaignName: campaign.name,
            },
          },
        })
      }
    )

    return NextResponse.json({
      message: 'Pre-bill generated successfully',
      preBill,
    })
  } catch (error) {
    console.error('Error generating pre-bill:', error)
    return NextResponse.json(
      { error: 'Failed to generate pre-bill' },
      { status: 500 }
    )
  }
}