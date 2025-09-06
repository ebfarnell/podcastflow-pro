import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { getUserOrgSlug, safeQuerySchema, getSchemaName } from '@/lib/db/schema-db'

export const dynamic = 'force-dynamic'

interface CalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  type: 'episode' | 'campaign' | 'deadline' | 'task'
  entityId?: string
  entityType?: string
  description?: string
  show?: string
  campaign?: string
  status?: string
  color?: string
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgSlug = await getUserOrgSlug(session.userId)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }
    
    // Get the proper schema name for database queries
    const schemaName = getSchemaName(orgSlug)

    const { searchParams } = new URL(request.url)
    // Extend date range to be more inclusive - look back 30 days and forward 120 days
    const defaultStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
    const defaultEnd = new Date(Date.now() + 120 * 24 * 60 * 60 * 1000) // 120 days ahead
    
    const startDate = searchParams.get('start') || defaultStart.toISOString()
    const endDate = searchParams.get('end') || defaultEnd.toISOString()

    const events: CalendarEvent[] = []

    // Fetch episode events (both recording and air dates)
    const episodesQuery = `
      SELECT 
        e.id,
        e.title,
        COALESCE(e."recordingDate", e."airDate", e."createdAt") as start_date,
        COALESCE(e."recordingDate", e."airDate", e."createdAt") as end_date,
        e.status,
        s.name as show_name,
        e."producerNotes" as description,
        CASE 
          WHEN e."recordingDate" IS NOT NULL THEN 'recording'
          WHEN e."airDate" IS NOT NULL THEN 'airing'
          ELSE 'scheduled'
        END as event_type
      FROM "${schemaName}"."Episode" e
      INNER JOIN "${schemaName}"."Show" s ON e."showId" = s.id
      WHERE (
        e."recordingDate" IS NOT NULL 
        OR e."airDate" IS NOT NULL
        OR (e."createdAt" IS NOT NULL AND e.status IN ('scheduled', 'published'))
      )
      AND (
        COALESCE(e."recordingDate", e."airDate", e."createdAt") >= $1::timestamp
        AND COALESCE(e."recordingDate", e."airDate", e."createdAt") <= $2::timestamp
      )
      ORDER BY COALESCE(e."recordingDate", e."airDate", e."createdAt") ASC
    `

    console.log('Fetching episodes with query:', episodesQuery)
    console.log('Query params:', [startDate, endDate])
    
    const { data: episodes, error: episodesError } = await safeQuerySchema<any>(
      orgSlug, 
      episodesQuery, 
      [startDate, endDate]
    )

    console.log('Episodes query result:', { 
      error: episodesError, 
      dataReceived: !!episodes, 
      isArray: Array.isArray(episodes),
      count: episodes?.length || 0 
    })

    if (!episodesError && episodes && Array.isArray(episodes)) {
      console.log(`Processing ${episodes.length} episodes`)
      episodes.forEach((episode: any) => {
        try {
          const startTime = new Date(episode.start_date)
          const endTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000) // 2 hour recording session
          
          const title = episode.event_type === 'recording' 
            ? `${episode.show_name} - Recording`
            : episode.event_type === 'airing'
            ? `${episode.show_name} - Air Date`
            : `${episode.show_name} - Episode`

          events.push({
            id: `episode-${episode.id}`,
            title: title,
            start: startTime,
            end: endTime,
            type: 'episode',
            entityId: episode.id,
            entityType: 'episode',
            description: episode.description || `${episode.event_type} for ${episode.title}`,
            show: episode.show_name,
            status: episode.status,
            color: episode.event_type === 'recording' ? '#4CAF50' : '#8BC34A' // Green for recording, light green for airing
          })
        } catch (err) {
          console.warn('Error processing episode event:', episode.id, err)
        }
      })
    } else if (episodesError) {
      console.warn('Episodes query failed:', episodesError)
    }

    // Fetch campaign events (launches and deadlines)
    const campaignsQuery = `
      SELECT 
        c.id,
        c.name,
        c."startDate",
        c."endDate",
        c.status,
        a.name as advertiser_name,
        c.budget,
        c.description
      FROM "${schemaName}"."Campaign" c
      LEFT JOIN "${schemaName}"."Advertiser" a ON c."advertiserId" = a.id
      WHERE (
        (c."startDate" IS NOT NULL AND c."startDate" >= $1::timestamp AND c."startDate" <= $2::timestamp)
        OR (c."endDate" IS NOT NULL AND c."endDate" >= $1::timestamp AND c."endDate" <= $2::timestamp)
        OR (c."startDate" IS NOT NULL AND c."startDate" <= $2::timestamp AND (c."endDate" IS NULL OR c."endDate" >= $1::timestamp))
      )
      ORDER BY COALESCE(c."startDate", c."endDate") ASC
    `

    const { data: campaigns, error: campaignsError } = await safeQuerySchema<any>(
      orgSlug,
      campaignsQuery,
      [startDate, endDate]
    )

    if (!campaignsError && campaigns && Array.isArray(campaigns)) {
      campaigns.forEach((campaign: any) => {
        try {
          // Campaign launch event
          if (campaign.startDate) {
            events.push({
              id: `campaign-start-${campaign.id}`,
              title: `Campaign Launch - ${campaign.name}`,
              start: new Date(campaign.startDate),
              end: new Date(new Date(campaign.startDate).getTime() + 60 * 60 * 1000), // 1 hour event
              type: 'campaign',
              entityId: campaign.id,
              entityType: 'campaign',
              description: campaign.description || `Launch of ${campaign.advertiser_name} campaign`,
              campaign: campaign.name,
              status: campaign.status,
              color: '#2196F3' // Blue for campaigns
            })
          }

          // Campaign end/deadline event
          if (campaign.endDate) {
            events.push({
              id: `campaign-end-${campaign.id}`,
              title: `Campaign Deadline - ${campaign.name}`,
              start: new Date(campaign.endDate),
              end: new Date(new Date(campaign.endDate).getTime() + 30 * 60 * 1000), // 30 min event
              type: 'deadline',
              entityId: campaign.id,
              entityType: 'campaign',
              description: `End date for ${campaign.advertiser_name} campaign`,
              campaign: campaign.name,
              status: campaign.status,
              color: '#FF9800' // Orange for deadlines
            })
          }
        } catch (err) {
          console.warn('Error processing campaign event:', campaign.id, err)
        }
      })
    } else if (campaignsError) {
      console.warn('Campaigns query failed:', campaignsError)
    }

    // Fetch ad approval deadlines
    const approvalsQuery = `
      SELECT 
        aa.id,
        aa."campaignId",
        c.name as campaign_name,
        aa.deadline,
        aa.status,
        aa.type
      FROM "${schemaName}"."AdApproval" aa
      INNER JOIN "${schemaName}"."Campaign" c ON aa."campaignId" = c.id
      WHERE aa.deadline IS NOT NULL
      AND aa.deadline >= $1::timestamp
      AND aa.deadline <= $2::timestamp
      AND aa.status IN ('pending', 'revision_requested')
      ORDER BY aa.deadline ASC
    `

    const { data: approvals, error: approvalsError } = await safeQuerySchema<any>(
      orgSlug,
      approvalsQuery,
      [startDate, endDate]
    )

    if (!approvalsError && approvals && Array.isArray(approvals)) {
      approvals.forEach((approval: any) => {
        try {
          events.push({
            id: `approval-${approval.id}`,
            title: `Ad Copy Deadline - ${approval.campaign_name}`,
            start: new Date(approval.deadline),
            end: new Date(new Date(approval.deadline).getTime() + 30 * 60 * 1000), // 30 min event
            type: 'deadline',
            entityId: approval.id,
            entityType: 'approval',
            description: `${approval.type} approval needed`,
            campaign: approval.campaign_name,
            status: approval.status,
            color: '#F44336' // Red for urgent deadlines
          })
        } catch (err) {
          console.warn('Error processing approval event:', approval.id, err)
        }
      })
    } else if (approvalsError) {
      console.warn('Approvals query failed:', approvalsError)
    }

    // Tasks feature not yet implemented - Task table doesn't exist in schema
    // Commenting out to prevent errors
    /*
    // Fetch tasks with due dates
    const tasksQuery = `
      SELECT 
        t.id,
        t.title,
        t."dueDate",
        t.status,
        t.priority,
        t.description,
        u.name as assigned_to
      FROM "${schemaName}"."Task" t
      LEFT JOIN public."User" u ON t."assignedTo" = u.id
      WHERE t."dueDate" IS NOT NULL
      AND t."dueDate" >= $1::timestamp
      AND t."dueDate" <= $2::timestamp
      AND t.status != 'completed'
      ORDER BY t."dueDate" ASC
    `

    const { data: tasks, error: tasksError } = await safeQuerySchema<any>(
      orgSlug,
      tasksQuery,
      [startDate, endDate]
    )

    if (!tasksError && tasks && Array.isArray(tasks)) {
      tasks.forEach((task: any) => {
        try {
          events.push({
            id: `task-${task.id}`,
            title: task.title,
            start: new Date(task.dueDate),
            end: new Date(new Date(task.dueDate).getTime() + 60 * 60 * 1000), // 1 hour task
            type: 'task',
            entityId: task.id,
            entityType: 'task',
            description: task.description || `Assigned to ${task.assigned_to || 'Unassigned'}`,
            status: task.status,
            color: task.priority === 'high' ? '#E91E63' : '#9C27B0' // Pink for high priority, purple for others
          })
        } catch (err) {
          console.warn('Error processing task event:', task.id, err)
        }
      })
    } else if (tasksError) {
      console.warn('Tasks query failed:', tasksError)
    }
    */

    console.log(`Calendar API: Found ${events.length} events for org ${orgSlug}`)
    console.log(`Date range: ${startDate} to ${endDate}`)
    
    return NextResponse.json({ 
      events,
      count: events.length,
      dateRange: {
        start: startDate,
        end: endDate
      },
      debug: {
        orgSlug,
        episodesFound: episodes?.length || 0,
        campaignsFound: campaigns?.length || 0,
        approvalsFound: approvals?.length || 0,
        // tasksFound: tasks?.length || 0, // Tasks not implemented yet
        errors: {
          episodes: episodesError,
          campaigns: campaignsError,
          approvals: approvalsError,
          // tasks: tasksError // Tasks not implemented yet
        }
      }
    })

  } catch (error) {
    console.error('Error fetching calendar events:', error)
    return NextResponse.json(
      { error: 'Failed to fetch calendar events', events: [] },
      { status: 500 }
    )
  }
}