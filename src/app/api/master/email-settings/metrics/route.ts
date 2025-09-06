// Email metrics endpoint

import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import prisma from '@/lib/db/prisma'
import { emailService } from '@/services/email'

// GET /api/master/email-settings/metrics
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only master accounts can view platform metrics
    if (session.role !== 'master') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check if email system is configured
    const settings = await prisma.platformEmailSettings.findFirst()
    if (!settings || !settings.isConfigured) {
      return NextResponse.json({
        hasData: false,
        message: 'Email system not configured'
      })
    }

    // Get email metrics from the last 30 days
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // Get aggregated metrics
    const [totalEmails, metrics, recentEmails] = await Promise.all([
      // Total emails
      prisma.email.count({
        where: {
          createdAt: { gte: thirtyDaysAgo }
        }
      }),
      
      // Status breakdown
      prisma.email.groupBy({
        by: ['status'],
        where: {
          createdAt: { gte: thirtyDaysAgo }
        },
        _count: true
      }),
      
      // Recent emails
      prisma.email.findMany({
        take: 20,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          to: true,
          subject: true,
          status: true,
          sentAt: true,
          createdAt: true,
          errorMessage: true
        }
      })
    ])

    // Get quota information from provider
    let quota = null
    let providerStats = null
    try {
      quota = await emailService.getQuota()
      providerStats = await emailService.getStatistics()
    } catch (error) {
      console.error('Failed to get provider statistics:', error)
    }

    // Calculate metrics
    const statusCounts = {
      sent: 0,
      delivered: 0,
      bounced: 0,
      complained: 0,
      opened: 0,
      clicked: 0,
      failed: 0,
      pending: 0,
      queued: 0
    }

    metrics.forEach(m => {
      switch (m.status) {
        case 'sent':
        case 'delivered':
          statusCounts.delivered += m._count
          statusCounts.sent += m._count
          break
        case 'bounced':
          statusCounts.bounced += m._count
          break
        case 'complained':
          statusCounts.complained += m._count
          break
        case 'opened':
          statusCounts.opened += m._count
          break
        case 'clicked':
          statusCounts.clicked += m._count
          break
        case 'failed':
          statusCounts.failed += m._count
          break
        case 'pending':
          statusCounts.pending += m._count
          break
        case 'queued':
          statusCounts.queued += m._count
          break
      }
    })

    // Calculate rates
    const deliveryRate = totalEmails > 0 ? ((statusCounts.delivered / totalEmails) * 100) : 0
    const errorRate = totalEmails > 0 ? ((statusCounts.failed / totalEmails) * 100) : 0

    // Format recent emails
    const formattedRecentEmails = recentEmails.map(email => ({
      id: email.id,
      recipient: Array.isArray(email.to) ? email.to[0] : email.to,
      subject: email.subject,
      status: email.status,
      sentAt: email.sentAt?.toISOString(),
      errorMessage: email.errorMessage
    }))

    return NextResponse.json({
      hasData: totalEmails > 0,
      metrics: statusCounts,
      recentEmails: formattedRecentEmails,
      deliveryRate,
      errorRate,
      quota: quota ? {
        dailyQuota: quota.max24HourSend,
        usedToday: quota.sentLast24Hours,
        remainingToday: Math.max(0, quota.max24HourSend - quota.sentLast24Hours),
        percentUsed: quota.max24HourSend > 0 
          ? ((quota.sentLast24Hours / quota.max24HourSend) * 100)
          : 0
      } : null
    })
  } catch (error) {
    console.error('Failed to get email metrics:', error)
    return NextResponse.json(
      { error: 'Failed to get email metrics' },
      { status: 500 }
    )
  }
}