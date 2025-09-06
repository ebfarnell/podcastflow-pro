import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import prisma from '@/lib/db/prisma'
import { AuthenticatedRequest } from '@/lib/auth/api-protection'

// Force this route to be dynamic
export const dynamic = 'force-dynamic'

// GET /api/admin/email-monitoring - Get email delivery statistics
export const GET = async (request: NextRequest) => {
  const authToken = request.cookies.get('auth-token')
  if (!authToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // Validate session and get user
  const user = await UserService.validateSession(authToken.value)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // Check if user is admin or master
  if (!['admin', 'master'].includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  
  const authenticatedRequest = request as AuthenticatedRequest
  authenticatedRequest.user = user
  
  return getHandler(authenticatedRequest)
}

async function getHandler(request: AuthenticatedRequest) {
  try {
    const user = request.user!
    const searchParams = request.nextUrl.searchParams
    const days = parseInt(searchParams.get('days') || '7')
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    
    // Get email logs from audit trail
    const emailAuditLogs = await prisma.auditLog.findMany({
      where: {
        organizationId: user.role === 'master' ? undefined : user.organizationId,
        action: {
          contains: 'invitation'
        },
        createdAt: {
          gte: startDate
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 100
    })
    
    // Calculate email statistics
    const totalEmails = emailAuditLogs.length
    const successfulEmails = emailAuditLogs.filter(log => 
      log.details && typeof log.details === 'object' && 
      'invitationEmailSent' in log.details && 
      log.details.invitationEmailSent === true
    ).length
    const failedEmails = totalEmails - successfulEmails
    
    // Group by date for chart data
    const emailsByDate = emailAuditLogs.reduce((acc, log) => {
      const date = log.createdAt.toISOString().split('T')[0]
      if (!acc[date]) {
        acc[date] = { sent: 0, failed: 0 }
      }
      const wasSuccessful = log.details && 
        typeof log.details === 'object' && 
        'invitationEmailSent' in log.details && 
        log.details.invitationEmailSent === true
      
      if (wasSuccessful) {
        acc[date].sent++
      } else {
        acc[date].failed++
      }
      return acc
    }, {} as Record<string, { sent: number, failed: number }>)
    
    // Convert to array format for charts
    const chartData = Object.entries(emailsByDate).map(([date, data]) => ({
      date,
      sent: data.sent,
      failed: data.failed,
      total: data.sent + data.failed
    })).sort((a, b) => a.date.localeCompare(b.date))
    
    // Get recent email details
    const recentEmails = emailAuditLogs.slice(0, 20).map(log => {
      const details = log.details as any || {}
      return {
        id: log.id,
        recipient: details.targetUserEmail || details.newUserEmail || 'Unknown',
        type: log.action.includes('Resent') ? 'resend' : 'invitation',
        status: details.invitationEmailSent ? 'sent' : 'failed',
        messageId: details.emailMessageId || null,
        sentBy: details.createdBy || details.resentBy || log.userId,
        sentAt: log.createdAt.toISOString(),
        error: details.invitationEmailSent === false ? (details.error || 'Unknown error') : null
      }
    })
    
    return NextResponse.json({
      statistics: {
        totalEmails,
        successfulEmails,
        failedEmails,
        deliveryRate: totalEmails > 0 ? Math.round((successfulEmails / totalEmails) * 100) : 0,
        period: `Last ${days} days`
      },
      chartData,
      recentEmails,
      providers: {
        primary: 'AWS SES',
        region: 'us-east-1',
        dailyQuota: 200,
        sendRate: '1/second'
      }
    })
    
  } catch (error) {
    console.error('Email monitoring error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch email monitoring data' },
      { status: 500 }
    )
  }
}