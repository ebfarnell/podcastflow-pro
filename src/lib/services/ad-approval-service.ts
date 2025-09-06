import prisma from '@/lib/db/prisma'
import { ApprovalStatus, Priority, Prisma } from '@prisma/client'
import { emailService } from '@/lib/email/email-service'

export class AdApprovalService {
  // List ad approvals with filters
  static async list(filters?: {
    status?: ApprovalStatus
    organizationId?: string
    showId?: string
    campaignId?: string
    salesRepId?: string
  }) {
    const where: Prisma.AdApprovalWhereInput = {}
    
    if (filters?.status) {
      where.status = filters.status
    }
    if (filters?.organizationId) {
      where.organizationId = filters.organizationId
    }
    if (filters?.showId) {
      where.showId = filters.showId
    }
    if (filters?.campaignId) {
      where.campaignId = filters.campaignId
    }
    if (filters?.salesRepId) {
      where.salesRepId = filters.salesRepId
    }

    const approvals = await prisma.adApproval.findMany({
      where,
      include: {
        campaign: {
          include: { advertiser: true }
        },
        show: {
          include: {
            assignedProducers: true,
            assignedTalent: true,
          }
        },
        submitter: true,
        salesRep: true,
        comments: {
          include: { user: true },
          orderBy: { createdAt: 'desc' }
        },
        spotSubmissions: {
          include: { submitter: true },
          orderBy: { createdAt: 'desc' },
          take: 1
        },
      },
      orderBy: [
        { deadline: 'asc' },
        { priority: 'desc' },
        { createdAt: 'desc' }
      ]
    })

    // Add computed fields
    return approvals.map(approval => {
      let responsibleUser = ''
      let responsibleRole = ''
      
      if (approval.status === 'pending') {
        responsibleRole = 'Producer/Talent'
        const producers = approval.show.assignedProducers.map(p => p.name).join(', ')
        const talent = approval.show.assignedTalent.map(t => t.name).join(', ')
        responsibleUser = [producers, talent].filter(Boolean).join(', ') || 'Unassigned'
      } else if (approval.status === 'submitted') {
        responsibleRole = 'Sales/Admin'
        responsibleUser = approval.salesRep?.name || 'Sales/Admin'
      } else if (approval.status === 'revision') {
        responsibleRole = 'Producer/Talent'
        const producers = approval.show.assignedProducers.map(p => p.name).join(', ')
        const talent = approval.show.assignedTalent.map(t => t.name).join(', ')
        responsibleUser = [producers, talent].filter(Boolean).join(', ') || 'Unassigned'
      } else if (approval.status === 'approved') {
        responsibleRole = 'Complete'
        responsibleUser = 'Approved'
      } else if (approval.status === 'rejected') {
        responsibleRole = 'Complete'
        responsibleUser = 'Rejected'
      }

      const latestSubmission = approval.spotSubmissions[0]

      return {
        ...approval,
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
        spotSubmittedBy: latestSubmission?.submitter.name,
      }
    })
  }

  // Create new ad approval
  static async create(data: {
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
    const approvals = []

    // Get show details
    const shows = await prisma.show.findMany({
      where: { id: { in: data.showIds } },
      include: {
        assignedProducers: true,
        assignedTalent: true,
      }
    })

    // Create approval for each show × duration combination
    for (const show of shows) {
      for (const duration of data.durations) {
        const approval = await prisma.adApproval.create({
          data: {
            title: data.title,
            advertiserId: data.advertiserId,
            advertiserName: data.advertiserName,
            campaignId: data.campaignId,
            showId: show.id,
            showName: show.name,
            type: data.type,
            duration,
            script: data.script,
            talkingPoints: data.talkingPoints || [],
            priority: data.priority || Priority.medium,
            deadline: data.deadline,
            status: ApprovalStatus.pending,
            salesRepId: data.salesRepId,
            salesRepName: data.salesRepName,
            submittedBy: data.submittedBy,
            organizationId: data.organizationId,
          },
          include: {
            show: {
              include: {
                assignedProducers: true,
                assignedTalent: true,
              }
            }
          }
        })

        approvals.push(approval)

        // Create notifications and send emails
        const notifications = []

        // Notify producers
        for (const producer of show.assignedProducers) {
          notifications.push(
            prisma.notification.create({
              data: {
                userId: producer.id,
                type: 'ad_approval_assigned',
                title: 'New Ad Production Assignment',
                message: `You have been assigned to produce a ${duration}s ${data.type} spot for ${data.advertiserName}`,
                adApprovalId: approval.id,
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
        for (const talent of show.assignedTalent) {
          notifications.push(
            prisma.notification.create({
              data: {
                userId: talent.id,
                type: 'ad_approval_assigned',
                title: 'New Ad Recording Assignment',
                message: `You have been assigned to record a ${duration}s ${data.type} spot for ${data.advertiserName}`,
                adApprovalId: approval.id,
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

  // Submit a completed spot
  static async submitSpot(
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
    // Create spot submission
    const submission = await prisma.spotSubmission.create({
      data: {
        adApprovalId,
        ...data,
      }
    })

    // Update approval status
    const approval = await prisma.adApproval.update({
      where: { id: adApprovalId },
      data: {
        status: ApprovalStatus.submitted,
        workflowStage: 'pending_approval',
      },
      include: {
        salesRep: true,
        campaign: {
          include: { advertiser: true }
        },
        show: true,
        submitter: true,
      }
    })

    // Add comment if notes provided
    if (data.notes) {
      await prisma.comment.create({
        data: {
          adApprovalId,
          userId: data.submittedBy,
          message: `Spot submitted: ${data.notes}`,
        }
      })
    }

    // Create notifications
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

  // Approve ad
  static async approve(
    adApprovalId: string,
    approvedBy: string,
    feedback?: string
  ) {
    const approval = await prisma.adApproval.update({
      where: { id: adApprovalId },
      data: {
        status: ApprovalStatus.approved,
        approvedAt: new Date(),
        workflowStage: 'approved',
      },
      include: {
        show: {
          include: {
            assignedProducers: true,
            assignedTalent: true,
          }
        },
        salesRep: true,
        campaign: {
          include: { advertiser: true }
        }
      }
    })

    // Add comment if feedback provided
    if (feedback) {
      await prisma.comment.create({
        data: {
          adApprovalId,
          userId: approvedBy,
          message: `Approved: ${feedback}`,
        }
      })
    }

    // Notify all stakeholders
    const notifications = []
    const usersToNotify = [
      ...approval.show.assignedProducers,
      ...approval.show.assignedTalent,
      ...(approval.salesRep ? [approval.salesRep] : [])
    ]

    for (const user of usersToNotify) {
      notifications.push(
        prisma.notification.create({
          data: {
            userId: user.id,
            type: 'spot_approved',
            title: 'Spot Approved!',
            message: `The ${approval.duration}s spot for ${approval.advertiserName} has been approved`,
            adApprovalId: approval.id,
          }
        })
      )

      // Send email
      emailService.sendApprovalNotification(
        user.email,
        user.name,
        approval,
        approvedBy
      ).catch(console.error)
    }

    await Promise.all(notifications)

    return approval
  }

  // Reject ad
  static async reject(
    adApprovalId: string,
    rejectedBy: string,
    reason: string
  ) {
    const approval = await prisma.adApproval.update({
      where: { id: adApprovalId },
      data: {
        status: ApprovalStatus.rejected,
        rejectedAt: new Date(),
        workflowStage: 'rejected',
      },
      include: {
        show: {
          include: {
            assignedProducers: true,
            assignedTalent: true,
          }
        },
        salesRep: true,
        campaign: {
          include: { advertiser: true }
        }
      }
    })

    // Add comment
    await prisma.comment.create({
      data: {
        adApprovalId,
        userId: rejectedBy,
        message: `Rejected: ${reason}`,
      }
    })

    // Notify all stakeholders
    const notifications = []
    const usersToNotify = [
      ...approval.show.assignedProducers,
      ...approval.show.assignedTalent,
      ...(approval.salesRep ? [approval.salesRep] : [])
    ]

    // Also notify admins
    const admins = await prisma.user.findMany({
      where: {
        role: 'admin',
        organizationId: approval.organizationId,
        isActive: true,
      }
    })
    usersToNotify.push(...admins)

    for (const user of usersToNotify) {
      notifications.push(
        prisma.notification.create({
          data: {
            userId: user.id,
            type: 'spot_rejected',
            title: 'Spot Rejected',
            message: `The ${approval.duration}s spot for ${approval.advertiserName} has been rejected`,
            adApprovalId: approval.id,
          }
        })
      )

      // Send email
      emailService.sendRejectionNotification(
        user.email,
        user.name,
        approval,
        rejectedBy,
        reason
      ).catch(console.error)
    }

    await Promise.all(notifications)

    return approval
  }

  // Request revision
  static async requestRevision(
    adApprovalId: string,
    requestedBy: string,
    feedback: string
  ) {
    const approval = await prisma.adApproval.update({
      where: { id: adApprovalId },
      data: {
        status: ApprovalStatus.revision,
        revisionCount: { increment: 1 },
        workflowStage: 'revision_requested',
      },
      include: {
        show: {
          include: {
            assignedProducers: true,
            assignedTalent: true,
          }
        },
        campaign: {
          include: { advertiser: true }
        }
      }
    })

    // Add comment
    await prisma.comment.create({
      data: {
        adApprovalId,
        userId: requestedBy,
        message: `Revision requested: ${feedback}`,
      }
    })

    // Notify producers and talent
    const notifications = []
    const usersToNotify = [
      ...approval.show.assignedProducers,
      ...approval.show.assignedTalent,
    ]

    for (const user of usersToNotify) {
      notifications.push(
        prisma.notification.create({
          data: {
            userId: user.id,
            type: 'revision_requested',
            title: 'Revision Requested',
            message: `A revision has been requested for the ${approval.duration}s spot for ${approval.advertiserName}`,
            adApprovalId: approval.id,
          }
        })
      )

      // Send email
      emailService.sendRevisionRequestNotification(
        user.email,
        user.name,
        approval,
        requestedBy,
        feedback
      ).catch(console.error)
    }

    await Promise.all(notifications)

    return approval
  }
}