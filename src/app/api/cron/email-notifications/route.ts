import { NextRequest, NextResponse } from 'next/server'
import { notificationService } from '@/services/notifications/notification-service'
import prisma from '@/lib/db/prisma'
import { queryAllOrganizations, safeQuerySchema } from '@/lib/db/schema-db'

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Verify cron authentication
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || 'podcastflow-cron-2025'
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      console.log('🚫 Unauthorized cron request to email-notifications')
      return NextResponse.json(
        { error: 'Unauthorized - Invalid cron secret' },
        { status: 401 }
      )
    }

    console.log('🔔 Starting email notifications cron job...')

    // SECURITY NOTE: This cron job accesses data across all organizations
    // This is intentional for system-wide notification processing
    // but access is restricted to cron secret authentication

    // Check for payment reminders (invoices due in 3 days or overdue)
    const threeDaysFromNow = new Date()
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3)
    
    // CRITICAL: This cron job needs to access data across all organizations
    // We'll query each organization's schema separately
    const organizations = await prisma.organization.findMany({
      where: { isActive: true },
      select: { id: true, slug: true }
    })
    
    // Batch fetch all organizations with their admin users
    const orgsWithUsers = await prisma.organization.findMany({
      where: {
        id: { in: organizations.map(org => org.id) }
      },
      include: {
        users: {
          where: {
            role: { in: ['admin', 'master'] }
          }
        }
      }
    })
    
    const orgsMap = new Map(orgsWithUsers.map(org => [org.id, org]))
    const upcomingInvoices: any[] = []
    
    // Query invoices from each organization's schema (can't batch across schemas)
    for (const org of organizations) {
      try {
        const invoicesQuery = `
          SELECT * FROM "Invoice" 
          WHERE status = 'pending' AND "dueDate" <= $1
        `
        const { data: orgInvoices = [] } = await safeQuerySchema(org.slug, invoicesQuery, [threeDaysFromNow])
        
        // Get organization data from map
        const orgWithUsers = orgsMap.get(org.id)
        
        // Add organization data to each invoice
        orgInvoices.forEach(invoice => {
          upcomingInvoices.push({
            ...invoice,
            organization: orgWithUsers
          })
        })
      } catch (error) {
        console.error(`Error querying invoices for org ${org.slug}:`, error)
      }
    }

    console.log(`📧 Found ${upcomingInvoices.length} invoices requiring payment reminders`)

    let emailsSent = 0
    for (const invoice of upcomingInvoices) {
      for (const user of invoice.organization.users) {
        const success = await notificationService.notifyPaymentDue(
          user.id,
          invoice,
          true // Send email
        )
        if (success) {
          emailsSent++
        }
      }
    }

    // Check for upcoming campaign deadlines
    const oneDayFromNow = new Date()
    oneDayFromNow.setDate(oneDayFromNow.getDate() + 1)

    const upcomingCampaigns: any[] = []
    
    for (const org of organizations) {
      try {
        // Query campaigns in each organization's schema
        const campaignsQuery = `
          SELECT * FROM "Campaign" 
          WHERE "endDate" >= $1 AND "endDate" <= $2 AND status = 'active'
        `
        const { data: orgCampaigns = [] } = await safeQuerySchema(org.slug, campaignsQuery, [new Date(), oneDayFromNow])
        
        // Get organization users
        const orgWithUsers = await prisma.organization.findUnique({
          where: { id: org.id },
          include: {
            users: {
              where: {
                role: { in: ['admin', 'sales', 'producer'] }
              }
            }
          }
        })
        
        // Add organization data to each campaign
        orgCampaigns.forEach(campaign => {
          upcomingCampaigns.push({
            ...campaign,
            organization: orgWithUsers
          })
        })
      } catch (error) {
        console.error(`Error querying campaigns for org ${org.slug}:`, error)
      }
    }

    console.log(`📧 Found ${upcomingCampaigns.length} campaigns with upcoming deadlines`)

    for (const campaign of upcomingCampaigns) {
      const hoursUntilDeadline = Math.round(
        (new Date(campaign.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60)
      )

      if (hoursUntilDeadline <= 24) {
        const userIds = campaign.organization.users.map(u => u.id)
        const success = await notificationService.notifyDeadlineReminder(
          userIds,
          campaign,
          'campaign',
          hoursUntilDeadline,
          true // Send email
        )
        if (success) {
          emailsSent += userIds.length
        }
      }
    }

    // Check for overdue tasks
    const overdueTasks: any[] = []
    
    for (const org of organizations) {
      try {
        // Query overdue tasks in each organization's schema
        const tasksQuery = `
          SELECT 
            ett.*,
            e.id as episode_id, e.title as episode_title,
            s.id as show_id, s.name as show_name
          FROM "EpisodeTalentTask" ett
          INNER JOIN "Episode" e ON e.id = ett."episodeId"
          INNER JOIN "Show" s ON s.id = e."showId"
          WHERE ett."dueDate" < $1 AND ett.status != 'completed'
        `
        const { data: orgTasks = [] } = await safeQuerySchema(org.slug, tasksQuery, [new Date()])
        
        // Batch fetch all users to avoid N+1 queries
        const userIds = new Set<string>()
        orgTasks.forEach(task => {
          if (task.assigneeId) userIds.add(task.assigneeId)
          if (task.creatorId) userIds.add(task.creatorId)
        })
        
        const usersMap = new Map()
        if (userIds.size > 0) {
          const users = await prisma.user.findMany({
            where: { id: { in: Array.from(userIds) } },
            select: { id: true, name: true, email: true }
          })
          users.forEach(user => usersMap.set(user.id, user))
        }
        
        // Assign users from map
        for (const task of orgTasks) {
          if (task.assigneeId) {
            task.assignee = usersMap.get(task.assigneeId)
          }
          
          if (task.creatorId) {
            task.creator = usersMap.get(task.creatorId)
          }
          
          task.episode = {
            id: task.episode_id,
            title: task.episode_title,
            show: {
              id: task.show_id,
              name: task.show_name
            }
          }
          
          overdueTasks.push(task)
        }
      } catch (error) {
        console.error(`Error querying tasks for org ${org.slug}:`, error)
      }
    }

    console.log(`📧 Found ${overdueTasks.length} overdue tasks`)

    for (const task of overdueTasks) {
      if (task.assignee) {
        const success = await notificationService.notifyTaskAssignment(
          task.assignee.id,
          {
            id: task.id,
            title: `OVERDUE: ${task.title}`,
            description: `This task is overdue and needs immediate attention. Original due date: ${task.dueDate?.toLocaleDateString()}`,
            priority: 'high'
          },
          task.creator.name,
          true // Send email
        )
        if (success) {
          emailsSent++
        }
      }
    }

    console.log(`✅ Email notifications cron job completed. Sent ${emailsSent} emails.`)

    return NextResponse.json({
      success: true,
      message: `Email notifications cron job completed`,
      emailsSent,
      checks: {
        upcomingInvoices: upcomingInvoices.length,
        upcomingCampaigns: upcomingCampaigns.length,
        overdueTasks: overdueTasks.length
      }
    })
  } catch (error) {
    console.error('❌ Email notifications cron job failed:', error)
    return NextResponse.json(
      { 
        error: 'Email notifications cron job failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Allow GET requests for monitoring
export async function GET() {
  return NextResponse.json({
    message: 'Email notifications cron job endpoint',
    usage: 'POST to this endpoint to trigger email notifications check',
    checks: [
      'Payment reminders for invoices due in 3 days',
      'Campaign deadline reminders',
      'Overdue task notifications'
    ]
  })
}