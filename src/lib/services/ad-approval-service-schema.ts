import { getUserOrgSlug, querySchema, safeQuerySchema } from '@/lib/db/schema-db'
import { ApprovalStatus, Priority } from '@prisma/client'
import { emailService } from '@/lib/email/email-service'
import prisma from '@/lib/db/prisma'

export class AdApprovalServiceSchema {
  // List ad approvals with filters using schema-aware queries
  static async list(userId: string, filters?: {
    status?: ApprovalStatus
    organizationId?: string
    showId?: string
    campaignId?: string
    salesRepId?: string
  }) {
    // Get user's organization schema
    const orgSlug = await getUserOrgSlug(userId)
    if (!orgSlug) {
      throw new Error('Organization not found')
    }

    // Build where conditions
    const whereConditions: string[] = ['1=1']
    const queryParams: any[] = []
    let paramIndex = 1

    if (filters?.status) {
      whereConditions.push(`aa.status = $${paramIndex++}`)
      queryParams.push(filters.status)
    }
    if (filters?.showId) {
      whereConditions.push(`aa."showId" = $${paramIndex++}`)
      queryParams.push(filters.showId)
    }
    if (filters?.campaignId) {
      whereConditions.push(`aa."campaignId" = $${paramIndex++}`)
      queryParams.push(filters.campaignId)
    }
    if (filters?.salesRepId) {
      whereConditions.push(`aa."salesRepId" = $${paramIndex++}`)
      queryParams.push(filters.salesRepId)
    }

    const whereClause = whereConditions.join(' AND ')

    // Query ad approvals with related data
    const approvalsQuery = `
      SELECT 
        aa.*,
        c.id as campaign_id,
        c.name as campaign_name,
        c."advertiserId" as campaign_advertiser_id,
        a.id as advertiser_id,
        a.name as advertiser_name,
        s.id as show_id,
        s.name as show_name,
        submitter.id as submitter_id,
        submitter.name as submitter_name,
        submitter.email as submitter_email,
        sales.id as sales_rep_id,
        sales.name as sales_rep_name,
        sales.email as sales_rep_email,
        (
          SELECT json_agg(
            json_build_object(
              'id', com.id,
              'message', com.message,
              'createdAt', com."createdAt",
              'user', json_build_object(
                'id', u.id,
                'name', u.name,
                'email', u.email
              )
            ) ORDER BY com."createdAt" DESC
          )
          FROM "Comment" com
          LEFT JOIN public."User" u ON u.id = com."userId"
          WHERE com."adApprovalId" = aa.id
        ) as comments,
        (
          SELECT json_agg(
            json_build_object(
              'id', ss.id,
              'audioUrl', ss."audioUrl",
              's3Key', ss."s3Key",
              'fileName', ss."fileName",
              'fileSize', ss."fileSize",
              'fileType', ss."fileType",
              'audioDuration', ss."audioDuration",
              'notes', ss.notes,
              'createdAt', ss."createdAt",
              'submitter', json_build_object(
                'id', sub.id,
                'name', sub.name,
                'email', sub.email
              )
            ) ORDER BY ss."createdAt" DESC
          )
          FROM "SpotSubmission" ss
          LEFT JOIN public."User" sub ON sub.id = ss."submittedBy"
          WHERE ss."adApprovalId" = aa.id
          LIMIT 1
        ) as spot_submissions,
        (
          SELECT json_agg(
            json_build_object(
              'id', u.id,
              'name', u.name,
              'email', u.email,
              'role', u.role
            )
          )
          FROM public."User" u
          WHERE u.id IN (
            SELECT "B" FROM "_ShowToUser" WHERE "A" = aa."showId"
          )
          AND u.role = 'producer'
        ) as assigned_producers,
        (
          SELECT json_agg(
            json_build_object(
              'id', u.id,
              'name', u.name,
              'email', u.email,
              'role', u.role
            )
          )
          FROM public."User" u
          WHERE u.id IN (
            SELECT "B" FROM "_ShowToUser" WHERE "A" = aa."showId"
          )
          AND u.role = 'talent'
        ) as assigned_talent
      FROM "AdApproval" aa
      LEFT JOIN "Campaign" c ON c.id = aa."campaignId"
      LEFT JOIN "Advertiser" a ON a.id = aa."advertiserId"
      LEFT JOIN "Show" s ON s.id = aa."showId"
      LEFT JOIN public."User" submitter ON submitter.id = aa."submittedBy"
      LEFT JOIN public."User" sales ON sales.id = aa."salesRepId"
      WHERE ${whereClause}
      ORDER BY aa.deadline ASC NULLS LAST, aa.priority DESC, aa."createdAt" DESC
    `

    const { data: approvalsRaw = [], error } = await safeQuerySchema(orgSlug, approvalsQuery, queryParams)
    if (error) {
      console.error('Error fetching ad approvals:', error)
    }

    // Add computed fields
    return approvalsRaw.map((approval: any) => {
      let responsibleUser = ''
      let responsibleRole = ''
      
      if (approval.status === 'pending') {
        responsibleRole = 'Producer/Talent'
        const producers = (approval.assigned_producers || []).map((p: any) => p.name).join(', ')
        const talent = (approval.assigned_talent || []).map((t: any) => t.name).join(', ')
        responsibleUser = [producers, talent].filter(Boolean).join(', ') || 'Unassigned'
      } else if (approval.status === 'submitted') {
        responsibleRole = 'Sales/Admin'
        responsibleUser = approval.sales_rep_name || 'Sales/Admin'
      } else if (approval.status === 'revision') {
        responsibleRole = 'Producer/Talent'
        const producers = (approval.assigned_producers || []).map((p: any) => p.name).join(', ')
        const talent = (approval.assigned_talent || []).map((t: any) => t.name).join(', ')
        responsibleUser = [producers, talent].filter(Boolean).join(', ') || 'Unassigned'
      } else if (approval.status === 'approved') {
        responsibleRole = 'Complete'
        responsibleUser = 'Approved'
      } else if (approval.status === 'rejected') {
        responsibleRole = 'Complete'
        responsibleUser = 'Rejected'
      }

      const latestSubmission = approval.spot_submissions?.[0]

      return {
        ...approval,
        campaign: approval.campaign_id ? {
          id: approval.campaign_id,
          name: approval.campaign_name,
          advertiserId: approval.campaign_advertiser_id,
          advertiser: {
            id: approval.advertiser_id,
            name: approval.advertiser_name
          }
        } : null,
        show: {
          id: approval.show_id,
          name: approval.show_name,
          assignedProducers: approval.assigned_producers || [],
          assignedTalent: approval.assigned_talent || []
        },
        submitter: approval.submitter_id ? {
          id: approval.submitter_id,
          name: approval.submitter_name,
          email: approval.submitter_email
        } : null,
        salesRep: approval.sales_rep_id ? {
          id: approval.sales_rep_id,
          name: approval.sales_rep_name,
          email: approval.sales_rep_email
        } : null,
        comments: approval.comments || [],
        spotSubmissions: approval.spot_submissions || [],
        responsibleUser,
        responsibleRole,
        spotAudioUrl: latestSubmission?.audioUrl,
        spotAudioFileInfo: latestSubmission ? {
          fileName: latestSubmission.fileName,
          fileSize: latestSubmission.fileSize,
          fileType: latestSubmission.fileType,
          duration: latestSubmission.audioDuration,
        } : undefined,
        spotSubmittedAt: latestSubmission?.createdAt,
        spotSubmittedBy: latestSubmission?.submitter?.name,
      }
    })
  }

  // Create new ad approval using schema-aware queries
  static async create(userId: string, data: {
    title: string
    advertiserId: string
    advertiserName: string
    campaignId: string
    showIds: string[]
    durations: number[]
    type: string
    script?: string
    talkingPoints?: string[]
    priority?: Priority
    deadline?: Date
    salesRepId: string
    salesRepName: string
    submittedBy: string
    organizationId: string
  }) {
    // Get organization schema
    const orgSlug = await getUserOrgSlug(userId)
    if (!orgSlug) {
      throw new Error('Organization not found')
    }

    const approvals = []

    // Get show details from organization schema
    const showsQuery = `
      SELECT 
        s.*,
        (
          SELECT json_agg(
            json_build_object(
              'id', u.id,
              'name', u.name,
              'email', u.email,
              'role', u.role
            )
          )
          FROM public."User" u
          WHERE u.id IN (
            SELECT "B" FROM "_ShowToUser" WHERE "A" = s.id
          )
          AND u.role = 'producer'
        ) as assigned_producers,
        (
          SELECT json_agg(
            json_build_object(
              'id', u.id,
              'name', u.name,
              'email', u.email,
              'role', u.role
            )
          )
          FROM public."User" u
          WHERE u.id IN (
            SELECT "B" FROM "_ShowToUser" WHERE "A" = s.id
          )
          AND u.role = 'talent'
        ) as assigned_talent
      FROM "Show" s
      WHERE s.id = ANY($1::text[])
    `
    
    const { data: shows = [] } = await safeQuerySchema(orgSlug, showsQuery, [data.showIds])

    // Create approval for each show × duration combination
    for (const show of shows) {
      for (const duration of data.durations) {
        const approvalId = `adap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        
        const createApprovalQuery = `
          INSERT INTO "AdApproval" (
            id, title, "advertiserId", "advertiserName", "campaignId", 
            "showId", "showName", type, duration, script, "talkingPoints",
            priority, deadline, status, "salesRepId", "salesRepName", 
            "submittedBy", "createdAt", "updatedAt"
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW()
          )
          RETURNING *
        `
        
        const approvalParams = [
          approvalId,
          data.title,
          data.advertiserId,
          data.advertiserName,
          data.campaignId,
          show.id,
          show.name,
          data.type,
          duration,
          data.script || null,
          data.talkingPoints || [],
          data.priority || 'medium',
          data.deadline ? new Date(data.deadline).toISOString() : null,
          'pending',
          data.salesRepId,
          data.salesRepName,
          data.submittedBy
        ]
        
        const { data: approvalResult } = await safeQuerySchema(orgSlug, createApprovalQuery, approvalParams)
        const approval = approvalResult?.[0]

        // Add computed fields for consistency
        approval.show = {
          id: show.id,
          name: show.name,
          assignedProducers: show.assigned_producers || [],
          assignedTalent: show.assigned_talent || []
        }

        approvals.push(approval)

        // Create notifications in public schema and send emails
        const notifications = []

        // Notify producers
        for (const producer of (show.assigned_producers || [])) {
          notifications.push(
            prisma.notification.create({
              data: {
                userId: producer.id,
                type: 'ad_approval_assigned',
                title: 'New Ad Production Assignment',
                message: `You have been assigned to produce a ${duration}s ${data.type} spot for ${data.advertiserName}`,
                adApprovalId: approvalId,
              }
            })
          )

          // Send email
          emailService.sendAdApprovalAssignment(
            producer.email,
            producer.name,
            approval
          ).catch(console.error)
        }

        // Notify talent
        for (const talent of (show.assigned_talent || [])) {
          notifications.push(
            prisma.notification.create({
              data: {
                userId: talent.id,
                type: 'ad_approval_assigned',
                title: 'New Ad Recording Assignment',
                message: `You have been assigned to record a ${duration}s ${data.type} spot for ${data.advertiserName}`,
                adApprovalId: approvalId,
              }
            })
          )

          // Send email
          emailService.sendAdApprovalAssignment(
            talent.email,
            talent.name,
            approval
          ).catch(console.error)
        }

        // Execute notifications
        await Promise.all(notifications)
      }
    }

    return approvals
  }

  // Get single ad approval by ID
  static async getById(userId: string, adApprovalId: string) {
    const orgSlug = await getUserOrgSlug(userId)
    if (!orgSlug) {
      throw new Error('Organization not found')
    }

    const approvals = await this.list(userId, { status: undefined })
    return approvals.find(a => a.id === adApprovalId)
  }

  // Submit a completed spot using schema-aware queries
  static async submitSpot(
    userId: string,
    adApprovalId: string,
    data: {
      audioUrl?: string
      s3Key?: string
      fileName?: string
      fileSize?: number
      fileType?: string
      audioDuration?: number
      notes?: string
      submittedBy: string
      submitterRole: string
    }
  ) {
    const orgSlug = await getUserOrgSlug(userId)
    if (!orgSlug) {
      throw new Error('Organization not found')
    }

    // Create spot submission
    const submissionId = `spot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const createSubmissionQuery = `
      INSERT INTO "SpotSubmission" (
        id, "adApprovalId", "audioUrl", "s3Key", "fileName", "fileSize",
        "fileType", "audioDuration", notes, "submittedBy", "submitterRole",
        "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW()
      )
      RETURNING *
    `
    
    const submissionParams = [
      submissionId,
      adApprovalId,
      data.audioUrl || null,
      data.s3Key || null,
      data.fileName || null,
      data.fileSize || null,
      data.fileType || null,
      data.audioDuration || null,
      data.notes || null,
      data.submittedBy,
      data.submitterRole
    ]
    
    const { data: submissionResult } = await safeQuerySchema(orgSlug, createSubmissionQuery, submissionParams)
    const submission = submissionResult?.[0]

    // Update approval status
    const updateApprovalQuery = `
      UPDATE "AdApproval"
      SET status = $1, "workflowStage" = $2, "updatedAt" = NOW()
      WHERE id = $3
      RETURNING *
    `
    
    await safeQuerySchema(orgSlug, updateApprovalQuery, ['submitted', 'pending_approval', adApprovalId])

    // Add comment if notes provided
    if (data.notes) {
      const commentId = `com_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      await safeQuerySchema(orgSlug, `
        INSERT INTO "Comment" (
          id, "adApprovalId", "userId", message, "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, $3, $4, NOW(), NOW()
        )
      `, [commentId, adApprovalId, data.submittedBy, `Spot submitted: ${data.notes}`])
    }

    // Get full approval details for notifications
    const approval = await this.getById(userId, adApprovalId)
    if (!approval) {
      throw new Error('Ad approval not found')
    }

    // Create notifications in public schema
    const notifications = []

    // Notify sales rep
    if (approval.salesRep) {
      notifications.push(
        prisma.notification.create({
          data: {
            userId: approval.salesRep.id,
            type: 'spot_submitted',
            title: 'Spot Submitted for Review',
            message: `A ${approval.duration}s spot has been submitted for ${approval.advertiserName}`,
            adApprovalId: approval.id,
          }
        })
      )

      // Send email
      emailService.sendSpotSubmittedNotification(
        approval.salesRep.email,
        approval.salesRep.name,
        approval,
        data.submittedBy
      ).catch(console.error)
    }

    // Notify admin users
    const admins = await prisma.user.findMany({
      where: {
        role: 'admin',
        organizationId: approval.organizationId,
        isActive: true,
      }
    })

    for (const admin of admins) {
      notifications.push(
        prisma.notification.create({
          data: {
            userId: admin.id,
            type: 'spot_submitted',
            title: 'Spot Submitted for Review',
            message: `A ${approval.duration}s spot has been submitted for ${approval.advertiserName}`,
            adApprovalId: approval.id,
          }
        })
      )

      // Send email
      emailService.sendSpotSubmittedNotification(
        admin.email,
        admin.name,
        approval,
        data.submittedBy
      ).catch(console.error)
    }

    await Promise.all(notifications)

    return { submission, approval }
  }

  static async approve(
    adApprovalId: string,
    approvedBy: string,
    feedback?: string
  ) {
    const orgSlug = await getUserOrgSlug(approvedBy)
    if (!orgSlug) {
      throw new Error('Organization not found')
    }
    
    // Update approval status
    const updateQuery = `
      UPDATE "AdApproval"
      SET 
        status = 'approved',
        "approvedAt" = NOW(),
        "workflowStage" = 'approved',
        "updatedAt" = NOW()
      WHERE id = $1
      RETURNING *
    `
    
    const { data: updated } = await safeQuerySchema(orgSlug, updateQuery, [adApprovalId])
    if (!updated || updated.length === 0) {
      throw new Error('Ad approval not found')
    }
    
    // If feedback provided, add to workflow history
    if (feedback) {
      const historyQuery = `
        INSERT INTO "WorkflowHistory" (
          id, "entityType", "entityId", action, "performedBy", 
          notes, "createdAt", "updatedAt"
        ) VALUES (
          $1, 'AdApproval', $2, 'approved', $3, $4, NOW(), NOW()
        )
      `
      const historyId = `wh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      await safeQuerySchema(orgSlug, historyQuery, [
        historyId,
        adApprovalId,
        approvedBy,
        feedback
      ])
    }
    
    // Get updated approval with related data
    const getQuery = `
      SELECT 
        aa.*,
        c.name as campaign_name,
        a.name as advertiser_name,
        ag.name as agency_name
      FROM "AdApproval" aa
      LEFT JOIN "Campaign" c ON c.id = aa."campaignId"
      LEFT JOIN "Advertiser" a ON a.id = c."advertiserId"
      LEFT JOIN "Agency" ag ON ag.id = a."agencyId"
      WHERE aa.id = $1
    `
    
    const { data: result = [] } = await safeQuerySchema(orgSlug, getQuery, [adApprovalId])
    return result[0]
  }
  
  static async reject(
    adApprovalId: string,
    rejectedBy: string,
    reason: string
  ) {
    const orgSlug = await getUserOrgSlug(rejectedBy)
    if (!orgSlug) {
      throw new Error('Organization not found')
    }
    
    // Update approval status
    const updateQuery = `
      UPDATE "AdApproval"
      SET 
        status = 'rejected',
        "rejectedAt" = NOW(),
        "rejectionReason" = $2,
        "workflowStage" = 'rejected',
        "updatedAt" = NOW()
      WHERE id = $1
      RETURNING *
    `
    
    const { data: updated } = await safeQuerySchema(orgSlug, updateQuery, [adApprovalId, reason])
    if (!updated || updated.length === 0) {
      throw new Error('Ad approval not found')
    }
    
    // Add to workflow history
    const historyQuery = `
      INSERT INTO "WorkflowHistory" (
        id, "entityType", "entityId", action, "performedBy", 
        notes, "createdAt", "updatedAt"
      ) VALUES (
        $1, 'AdApproval', $2, 'rejected', $3, $4, NOW(), NOW()
      )
    `
    const historyId = `wh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    await querySchema(orgSlug, historyQuery, [
      historyId,
      adApprovalId,
      rejectedBy,
      reason
    ])
    
    // Get updated approval with related data
    const getQuery = `
      SELECT 
        aa.*,
        c.name as campaign_name,
        a.name as advertiser_name,
        ag.name as agency_name
      FROM "AdApproval" aa
      LEFT JOIN "Campaign" c ON c.id = aa."campaignId"
      LEFT JOIN "Advertiser" a ON a.id = c."advertiserId"
      LEFT JOIN "Agency" ag ON ag.id = a."agencyId"
      WHERE aa.id = $1
    `
    
    const { data: result = [] } = await safeQuerySchema(orgSlug, getQuery, [adApprovalId])
    return result[0]
  }
  
  static async requestRevision(
    adApprovalId: string,
    requestedBy: string,
    revisionRequest: string
  ) {
    const orgSlug = await getUserOrgSlug(requestedBy)
    if (!orgSlug) {
      throw new Error('Organization not found')
    }
    
    // Update approval status
    const updateQuery = `
      UPDATE "AdApproval"
      SET 
        status = 'revision_requested',
        "workflowStage" = 'revision_requested',
        "revisionRequestCount" = COALESCE("revisionRequestCount", 0) + 1,
        "updatedAt" = NOW()
      WHERE id = $1
      RETURNING *
    `
    
    const { data: updated } = await safeQuerySchema(orgSlug, updateQuery, [adApprovalId])
    if (!updated || updated.length === 0) {
      throw new Error('Ad approval not found')
    }
    
    // Add revision request
    const revisionQuery = `
      INSERT INTO "RevisionRequest" (
        id, "adApprovalId", "requestedBy", "requestDate", 
        "requestDetails", "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, NOW(), $4, NOW(), NOW()
      )
    `
    const revisionId = `rr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    await safeQuerySchema(orgSlug, revisionQuery, [
      revisionId,
      adApprovalId,
      requestedBy,
      revisionRequest
    ])
    
    // Add to workflow history
    const historyQuery = `
      INSERT INTO "WorkflowHistory" (
        id, "entityType", "entityId", action, "performedBy", 
        notes, "createdAt", "updatedAt"
      ) VALUES (
        $1, 'AdApproval', $2, 'revision_requested', $3, $4, NOW(), NOW()
      )
    `
    const historyId = `wh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    await querySchema(orgSlug, historyQuery, [
      historyId,
      adApprovalId,
      requestedBy,
      revisionRequest
    ])
    
    // Get updated approval with related data
    const getQuery = `
      SELECT 
        aa.*,
        c.name as campaign_name,
        a.name as advertiser_name,
        ag.name as agency_name
      FROM "AdApproval" aa
      LEFT JOIN "Campaign" c ON c.id = aa."campaignId"
      LEFT JOIN "Advertiser" a ON a.id = c."advertiserId"
      LEFT JOIN "Agency" ag ON ag.id = a."agencyId"
      WHERE aa.id = $1
    `
    
    const { data: result = [] } = await safeQuerySchema(orgSlug, getQuery, [adApprovalId])
    return result[0]
  }
  
  static async submitRevision(
    adApprovalId: string,
    submittedBy: string,
    script: string,
    notes?: string
  ) {
    const orgSlug = await getUserOrgSlug(submittedBy)
    if (!orgSlug) {
      throw new Error('Organization not found')
    }
    
    // Create spot submission
    const submissionQuery = `
      INSERT INTO "SpotSubmission" (
        id, "adApprovalId", "submittedBy", "submittedAt", 
        script, notes, version, "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, NOW(), $4, $5,
        (SELECT COALESCE(MAX(version), 0) + 1 FROM "SpotSubmission" WHERE "adApprovalId" = $2),
        NOW(), NOW()
      )
    `
    const submissionId = `ss_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    await safeQuerySchema(orgSlug, submissionQuery, [
      submissionId,
      adApprovalId,
      submittedBy,
      script,
      notes
    ])
    
    // Update approval status
    const updateQuery = `
      UPDATE "AdApproval"
      SET 
        status = 'pending_approval',
        "workflowStage" = 'review',
        "currentScript" = $2,
        "updatedAt" = NOW()
      WHERE id = $1
      RETURNING *
    `
    
    const { data: updated } = await safeQuerySchema(orgSlug, updateQuery, [adApprovalId, script])
    if (!updated || updated.length === 0) {
      throw new Error('Ad approval not found')
    }
    
    // Add to workflow history
    const historyQuery = `
      INSERT INTO "WorkflowHistory" (
        id, "entityType", "entityId", action, "performedBy", 
        notes, "createdAt", "updatedAt"
      ) VALUES (
        $1, 'AdApproval', $2, 'submitted_revision', $3, $4, NOW(), NOW()
      )
    `
    const historyId = `wh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    await querySchema(orgSlug, historyQuery, [
      historyId,
      adApprovalId,
      submittedBy,
      notes || 'Revision submitted'
    ])
    
    // Get updated approval with related data
    const getQuery = `
      SELECT 
        aa.*,
        c.name as campaign_name,
        a.name as advertiser_name,
        ag.name as agency_name
      FROM "AdApproval" aa
      LEFT JOIN "Campaign" c ON c.id = aa."campaignId"
      LEFT JOIN "Advertiser" a ON a.id = c."advertiserId"
      LEFT JOIN "Agency" ag ON ag.id = a."agencyId"
      WHERE aa.id = $1
    `
    
    const { data: result = [] } = await safeQuerySchema(orgSlug, getQuery, [adApprovalId])
    return result[0]
  }
}