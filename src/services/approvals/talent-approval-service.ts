import prisma from '@/lib/db/prisma'
import { safeQuerySchema } from '@/lib/db/schema-db'
import { v4 as uuidv4 } from 'uuid'
// We'll use existing notification system
const createNotification = async (data: any) => {
  // This is a placeholder - integrate with existing notification system  
  console.log('Notification:', data)
}

interface CreateTalentApprovalOptions {
  campaignId: string
  schemaName: string
  requestedBy: string
  spotTypes: string[]
}

interface UpdateApprovalOptions {
  approvalId: string
  schemaName: string
  status: 'approved' | 'rejected'
  respondedBy: string
  comments?: string
}

export async function createTalentApproval(options: CreateTalentApprovalOptions): Promise<string> {
  const { campaignId, schemaName, requestedBy, spotTypes } = options
  const approvalId = uuidv4()

  try {
    // Get campaign details
    const { data: campaigns } = await safeQuerySchema(schemaName, async (schema) => {
      return await prisma.$queryRawUnsafe(`
        SELECT c.*, a."name" as "advertiserName", ag."name" as "agencyName"
        FROM "${schema}"."Campaign" c
        LEFT JOIN "${schema}"."Advertiser" a ON c."advertiserId" = a.id
        LEFT JOIN "${schema}"."Agency" ag ON c."agencyId" = ag.id
        WHERE c.id = $1
      `, campaignId)
    })

    if (!campaigns || campaigns.length === 0) {
      throw new Error('Campaign not found')
    }

    const campaign = campaigns[0]

    // Get affected shows
    const { data: shows } = await safeQuerySchema(schemaName, async (schema) => {
      return await prisma.$queryRawUnsafe(`
        SELECT DISTINCT s.id, s."name", s."talentEmail", s."producerEmail"
        FROM "${schema}"."ScheduledSpot" ss
        JOIN "${schema}"."Show" s ON ss."showId" = s.id
        WHERE ss."campaignId" = $1
      `, campaignId)
    })

    // Create approval request
    await safeQuerySchema(schemaName, async (schema) => {
      return await prisma.$executeRawUnsafe(`
        INSERT INTO "${schema}"."TalentApproval" (
          id, "campaignId", "requestedBy", status,
          "spotTypes", "showIds", metadata,
          "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, $3, 'pending',
          $4, $5, $6,
          NOW(), NOW()
        )
      `, approvalId, campaignId, requestedBy,
         JSON.stringify(spotTypes),
         JSON.stringify(shows?.map((s: any) => s.id) || []),
         JSON.stringify({
           campaignName: campaign.name,
           advertiserName: campaign.advertiserName,
           agencyName: campaign.agencyName,
           totalBudget: campaign.totalBudget,
         })
      )
    })

    // Send notifications to talent and producers
    const recipients = new Set<string>()
    for (const show of shows || []) {
      if (show.talentEmail) recipients.add(show.talentEmail)
      if (show.producerEmail) recipients.add(show.producerEmail)
    }

    for (const email of recipients) {
      await createNotification({
        type: 'talent_approval_requested',
        title: 'Talent Approval Required',
        message: `Campaign "${campaign.name}" requires your approval for ${spotTypes.join(', ')} spots`,
        recipientEmail: email,
        organizationId: campaign.organizationId,
        data: {
          approvalId,
          campaignId,
          spotTypes,
        },
      })
    }

    console.log(`Created talent approval request ${approvalId} for campaign ${campaignId}`)
    return approvalId

  } catch (error) {
    console.error('Error creating talent approval:', error)
    throw error
  }
}

export async function updateTalentApproval(options: UpdateApprovalOptions): Promise<boolean> {
  const { approvalId, schemaName, status, respondedBy, comments } = options

  try {
    // Update approval status
    await safeQuerySchema(schemaName, async (schema) => {
      return await prisma.$executeRawUnsafe(`
        UPDATE "${schema}"."TalentApproval"
        SET 
          status = $1,
          "respondedBy" = $2,
          "respondedAt" = NOW(),
          comments = $3,
          "updatedAt" = NOW()
        WHERE id = $4
      `, status, respondedBy, comments, approvalId)
    })

    // Get approval details for notification
    const { data: approvals } = await safeQuerySchema(schemaName, async (schema) => {
      return await prisma.$queryRawUnsafe(`
        SELECT ta.*, c."name" as "campaignName", c."organizationId"
        FROM "${schema}"."TalentApproval" ta
        JOIN "${schema}"."Campaign" c ON ta."campaignId" = c.id
        WHERE ta.id = $1
      `, approvalId)
    })

    if (approvals && approvals.length > 0) {
      const approval = approvals[0]
      
      // Send notification about approval status
      await createNotification({
        type: status === 'approved' ? 'talent_approval_granted' : 'talent_approval_denied',
        title: `Talent Approval ${status === 'approved' ? 'Granted' : 'Denied'}`,
        message: `Campaign "${approval.campaignName}" talent approval was ${status}`,
        organizationId: approval.organizationId,
        data: {
          approvalId,
          campaignId: approval.campaignId,
          status,
          comments,
        },
      })
    }

    console.log(`Updated talent approval ${approvalId} to ${status}`)
    return true

  } catch (error) {
    console.error('Error updating talent approval:', error)
    return false
  }
}

export async function getTalentApprovals(schemaName: string, campaignId?: string) {
  try {
    let query = `
      SELECT 
        ta.*,
        c."name" as "campaignName",
        c."totalBudget",
        u1."name" as "requestedByName",
        u2."name" as "respondedByName"
      FROM "${schemaName}"."TalentApproval" ta
      JOIN "${schemaName}"."Campaign" c ON ta."campaignId" = c.id
      LEFT JOIN public."User" u1 ON ta."requestedBy" = u1.id
      LEFT JOIN public."User" u2 ON ta."respondedBy" = u2.id
    `

    if (campaignId) {
      query += ` WHERE ta."campaignId" = '${campaignId}'`
    }

    query += ` ORDER BY ta."createdAt" DESC`

    const { data: approvals } = await safeQuerySchema(schemaName, async () => {
      return await prisma.$queryRawUnsafe(query)
    })

    return approvals || []

  } catch (error) {
    console.error('Error fetching talent approvals:', error)
    return []
  }
}