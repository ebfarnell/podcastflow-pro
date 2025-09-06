import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { safeQuerySchema } from '@/lib/db/schema-db'

interface TimelineEvent {
  id: string
  type: string
  title: string
  description: string
  timestamp: string
  dueDate?: string
  status: 'completed' | 'pending' | 'overdue' | 'upcoming'
  priority: 'low' | 'medium' | 'high' | 'critical'
  actor?: string
  actorId?: string
  assigneeId?: string
  assigneeName?: string
  metadata?: any
  source: string
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Validate session
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: campaignId } = await params
    const searchParams = request.nextUrl.searchParams
    
    // Query parameters
    const types = searchParams.get('types')?.split(',').filter(Boolean)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const cursor = searchParams.get('cursor')
    const limit = parseInt(searchParams.get('limit') || '20')

    const events: TimelineEvent[] = []
    const now = new Date()

    // Get campaign details for context
    const { data: campaignData } = await safeQuerySchema(
      session.organizationSlug,
      `SELECT 
        c."id", 
        c."name", 
        c."advertiserId",
        c."agencyId",
        c."startDate",
        c."endDate",
        c."status",
        c."createdAt",
        c."updatedAt"
      FROM "Campaign" c 
      WHERE c."id" = $1`,
      [campaignId]
    )

    const campaign = campaignData?.[0]
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Check for the most recent schedule and use its dates if available
    const { data: scheduleData } = await safeQuerySchema(
      session.organizationSlug,
      `SELECT 
        sb."id",
        sb."startDate",
        sb."endDate"
      FROM "ScheduleBuilder" sb
      WHERE sb."campaignId" = $1
        AND sb."status" = 'approved'
      ORDER BY sb."createdAt" DESC
      LIMIT 1`,
      [campaignId]
    )

    // Use schedule dates if available, otherwise fall back to campaign dates
    const timelineStartDate = scheduleData?.[0]?.startDate || campaign.startDate
    const timelineEndDate = scheduleData?.[0]?.endDate || campaign.endDate

    // Helper function to determine status based on dates
    const getTaskStatus = (dueDate: string, completedDate?: string): 'completed' | 'pending' | 'overdue' | 'upcoming' => {
      if (completedDate) return 'completed'
      const due = new Date(dueDate)
      const daysDiff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      
      if (daysDiff < 0) return 'overdue'
      if (daysDiff <= 3) return 'pending' // Due within 3 days
      return 'upcoming'
    }

    // 1. CONTRACT DEADLINES - Contracts that need to be executed
    if (!types || types.includes('contract')) {
      const { data: contracts } = await safeQuerySchema(
        session.organizationSlug,
        `SELECT 
          c."id",
          c."contractNumber",
          c."title",
          c."startDate",
          c."status",
          c."executedAt",
          c."signedAt",
          c."sentAt",
          c."createdById",
          u."name" as "createdByName"
        FROM "Contract" c
        LEFT JOIN public."User" u ON u."id" = c."createdById"
        WHERE c."campaignId" = $1
        ORDER BY c."startDate" ASC`,
        [campaignId]
      )

      if (contracts) {
        contracts.forEach((contract: any) => {
          // Contract execution deadline
          if (!contract.executedAt && !contract.signedAt) {
            const dueDate = new Date(timelineStartDate)
            dueDate.setDate(dueDate.getDate() - 14) // Contract due 14 days before campaign start
            
            events.push({
              id: `contract_execution_${contract.id}`,
              type: 'contract_execution',
              title: 'Contract Execution Required',
              description: `Contract "${contract.title}" must be executed before campaign launch`,
              timestamp: dueDate.toISOString(),
              dueDate: dueDate.toISOString(),
              status: getTaskStatus(dueDate.toISOString(), contract.executedAt || contract.signedAt),
              priority: getTaskStatus(dueDate.toISOString(), contract.executedAt || contract.signedAt) === 'overdue' ? 'critical' : 'high',
              assigneeId: contract.createdById,
              assigneeName: contract.createdByName,
              metadata: { 
                contractId: contract.id,
                contractNumber: contract.contractNumber,
                contractTitle: contract.title
              },
              source: 'contract'
            })
          }
        })
      }
    }

    // 2. AD APPROVAL DEADLINES - Creative assets that need approval
    if (!types || types.includes('approval')) {
      const { data: approvals } = await safeQuerySchema(
        session.organizationSlug,
        `SELECT 
          aa."id",
          aa."title",
          aa."deadline",
          aa."status",
          aa."approvedAt",
          aa."rejectedAt",
          aa."priority",
          aa."submittedBy",
          aa."workflowStage",
          aa."showName",
          u."name" as "submittedByName"
        FROM "AdApproval" aa
        LEFT JOIN public."User" u ON u."id" = aa."submittedBy"
        WHERE aa."campaignId" = $1
          AND aa."status" IN ('pending', 'in_review', 'needs_revision')
        ORDER BY aa."deadline" ASC NULLS LAST`,
        [campaignId]
      )

      if (approvals) {
        approvals.forEach((approval: any) => {
          const dueDate = approval.deadline || (() => {
            // If no deadline set, default to 7 days before campaign start
            const defaultDue = new Date(timelineStartDate)
            defaultDue.setDate(defaultDue.getDate() - 7)
            return defaultDue.toISOString()
          })()
          
          events.push({
            id: `ad_approval_${approval.id}`,
            type: 'ad_approval',
            title: `${approval.title} - ${approval.workflowStage.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}`,
            description: `Creative approval needed for "${approval.title}" on ${approval.showName}`,
            timestamp: dueDate,
            dueDate: dueDate,
            status: getTaskStatus(dueDate, approval.approvedAt),
            priority: approval.priority as 'low' | 'medium' | 'high' | 'critical',
            assigneeId: approval.submittedBy,
            assigneeName: approval.submittedByName,
            metadata: {
              approvalId: approval.id,
              showName: approval.showName,
              workflowStage: approval.workflowStage
            },
            source: 'approval'
          })
        })
      }
    }

    // 3. SCHEDULE FINALIZATION DEADLINE
    if (!types || types.includes('schedule')) {
      const { data: schedules } = await safeQuerySchema(
        session.organizationSlug,
        `SELECT 
          sb."id",
          sb."name",
          sb."status",
          sb."approvedAt",
          sb."startDate",
          sb."createdBy",
          u."name" as "createdByName"
        FROM "ScheduleBuilder" sb
        LEFT JOIN public."User" u ON u."id" = sb."createdBy"
        WHERE sb."campaignId" = $1
        ORDER BY sb."startDate" ASC`,
        [campaignId]
      )

      if (schedules) {
        schedules.forEach((schedule: any) => {
          if (!schedule.approvedAt) {
            const dueDate = new Date(timelineStartDate)
            dueDate.setDate(dueDate.getDate() - 5) // Schedule approval due 5 days before start
            
            events.push({
              id: `schedule_approval_${schedule.id}`,
              type: 'schedule_approval',
              title: 'Schedule Approval Required',
              description: `Campaign schedule "${schedule.name}" needs final approval before launch`,
              timestamp: dueDate.toISOString(),
              dueDate: dueDate.toISOString(),
              status: getTaskStatus(dueDate.toISOString(), schedule.approvedAt),
              priority: getTaskStatus(dueDate.toISOString(), schedule.approvedAt) === 'overdue' ? 'critical' : 'high',
              assigneeId: schedule.createdBy,
              assigneeName: schedule.createdByName,
              metadata: {
                scheduleId: schedule.id,
                scheduleName: schedule.name
              },
              source: 'schedule'
            })
          }
        })
      }
    }

    // 4. CAMPAIGN LAUNCH MILESTONES - Key dates in campaign lifecycle
    if (!types || types.includes('milestone')) {
      const campaignStart = new Date(timelineStartDate)
      const campaignEnd = new Date(timelineEndDate)
      
      // Pre-launch milestone (3 days before campaign start)
      const preLaunchDate = new Date(campaignStart)
      preLaunchDate.setDate(preLaunchDate.getDate() - 3)
      
      events.push({
        id: `prelaunch_${campaign.id}`,
        type: 'prelaunch_milestone',
        title: 'Pre-Launch Checklist Due',
        description: 'Final review and verification of all campaign elements before go-live',
        timestamp: preLaunchDate.toISOString(),
        dueDate: preLaunchDate.toISOString(),
        status: getTaskStatus(preLaunchDate.toISOString(), campaign.status === 'active' ? campaign.updatedAt : undefined),
        priority: 'critical',
        metadata: {
          campaignId: campaign.id,
          checklist: [
            'All contracts executed',
            'Creative assets approved',
            'Schedule finalized',
            'Tracking setup complete'
          ]
        },
        source: 'milestone'
      })

      // Campaign launch milestone
      events.push({
        id: `launch_${campaign.id}`,
        type: 'campaign_launch',
        title: 'Campaign Launch',
        description: `Campaign "${campaign.name}" goes live`,
        timestamp: campaignStart.toISOString(),
        dueDate: campaignStart.toISOString(),
        status: now >= campaignStart ? 'completed' : 'upcoming',
        priority: 'critical',
        metadata: {
          campaignId: campaign.id,
          campaignName: campaign.name
        },
        source: 'milestone'
      })

      // Mid-campaign performance review (if campaign is longer than 30 days)
      const campaignDuration = Math.ceil((campaignEnd.getTime() - campaignStart.getTime()) / (1000 * 60 * 60 * 24))
      if (campaignDuration > 30) {
        const midCampaignDate = new Date(campaignStart)
        midCampaignDate.setDate(midCampaignDate.getDate() + Math.floor(campaignDuration / 2))
        
        events.push({
          id: `midcampaign_review_${campaign.id}`,
          type: 'performance_review',
          title: 'Mid-Campaign Performance Review',
          description: 'Review campaign performance and make optimization adjustments',
          timestamp: midCampaignDate.toISOString(),
          dueDate: midCampaignDate.toISOString(),
          status: now >= midCampaignDate ? 'completed' : 'upcoming',
          priority: 'medium',
          metadata: {
            campaignId: campaign.id,
            reviewType: 'mid-campaign'
          },
          source: 'milestone'
        })
      }

      // Campaign end milestone
      events.push({
        id: `campaign_end_${campaign.id}`,
        type: 'campaign_end',
        title: 'Campaign Ends',
        description: `Campaign "${campaign.name}" completion`,
        timestamp: campaignEnd.toISOString(),
        dueDate: campaignEnd.toISOString(),
        status: now >= campaignEnd ? 'completed' : 'upcoming',
        priority: 'medium',
        metadata: {
          campaignId: campaign.id,
          campaignName: campaign.name
        },
        source: 'milestone'
      })

      // Post-campaign reporting deadline (7 days after campaign end)
      const reportingDeadline = new Date(campaignEnd)
      reportingDeadline.setDate(reportingDeadline.getDate() + 7)
      
      events.push({
        id: `final_report_${campaign.id}`,
        type: 'final_reporting',
        title: 'Final Campaign Report Due',
        description: 'Compile and deliver final campaign performance report to client',
        timestamp: reportingDeadline.toISOString(),
        dueDate: reportingDeadline.toISOString(),
        status: getTaskStatus(reportingDeadline.toISOString()),
        priority: 'high',
        metadata: {
          campaignId: campaign.id,
          reportType: 'final-performance'
        },
        source: 'milestone'
      })
    }

    // Sort all events by due date/timestamp (upcoming first, then overdue, then completed)
    events.sort((a, b) => {
      // Priority: overdue > pending > upcoming > completed
      const statusPriority = { overdue: 4, pending: 3, upcoming: 2, completed: 1 }
      const statusDiff = (statusPriority[b.status] || 0) - (statusPriority[a.status] || 0)
      if (statusDiff !== 0) return statusDiff
      
      // Within same status, sort by due date/timestamp
      const aDate = new Date(a.dueDate || a.timestamp).getTime()
      const bDate = new Date(b.dueDate || b.timestamp).getTime()
      return aDate - bDate // Earliest dates first
    })

    // Apply cursor-based pagination if cursor provided
    let paginatedEvents = events
    let nextCursor = null

    if (cursor) {
      const cursorDate = new Date(cursor)
      const startIndex = events.findIndex(e => new Date(e.timestamp) < cursorDate)
      if (startIndex > -1) {
        paginatedEvents = events.slice(startIndex, startIndex + limit)
      } else {
        paginatedEvents = []
      }
    } else {
      paginatedEvents = events.slice(0, limit)
    }

    // Set next cursor if there are more events
    if (paginatedEvents.length === limit && events.length > paginatedEvents.length) {
      const lastEvent = paginatedEvents[paginatedEvents.length - 1]
      nextCursor = lastEvent.timestamp
    }

    return NextResponse.json({
      events: paginatedEvents,
      nextCursor,
      hasMore: nextCursor !== null,
      totalEvents: events.length
    })
  } catch (error) {
    console.error('Error in campaign timeline API:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      events: [],
      nextCursor: null,
      hasMore: false,
      totalEvents: 0
    }, { status: 500 })
  }
}