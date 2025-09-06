import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import prisma from '@/lib/db/prisma'
import { startOfDay, subDays } from 'date-fns'

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const organizationId = searchParams.get('organizationId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const groupBy = searchParams.get('groupBy') || 'day' // day, week, month

    // Build date filter
    const dateFilter: any = {}
    if (startDate) {
      dateFilter.gte = new Date(startDate)
    }
    if (endDate) {
      dateFilter.lte = new Date(endDate)
    }

    // Build where clause based on user role
    const whereClause: any = {}
    if (dateFilter.gte || dateFilter.lte) {
      whereClause.date = dateFilter
    }

    // Non-master users can only see their organization's data
    if (session.role !== 'master') {
      whereClause.organizationId = session.organizationId
    } else if (organizationId) {
      whereClause.organizationId = organizationId
    }

    // Get email metrics
    const metrics = await prisma.emailMetrics.findMany({
      where: whereClause,
      orderBy: { date: 'asc' }
    })

    // Get email logs for detailed stats
    const emailLogs = await prisma.emailLog.findMany({
      where: {
        organizationId: whereClause.organizationId,
        createdAt: dateFilter
      },
      select: {
        id: true,
        status: true,
        sentAt: true,
        deliveredAt: true,
        openedAt: true,
        clickedAt: true,
        bouncedAt: true,
        complainedAt: true,
        toEmail: true,
        subject: true,
        templateKey: true,
        bounceType: true
      }
    })

    // Calculate aggregate stats
    const totalSent = emailLogs.filter(log => log.sentAt).length
    const totalDelivered = emailLogs.filter(log => log.deliveredAt).length
    const totalOpened = emailLogs.filter(log => log.openedAt).length
    const totalClicked = emailLogs.filter(log => log.clickedAt).length
    const totalBounced = emailLogs.filter(log => log.bouncedAt).length
    const totalComplained = emailLogs.filter(log => log.complainedAt).length
    const uniqueOpens = new Set(emailLogs.filter(log => log.openedAt).map(log => log.toEmail)).size
    const uniqueClicks = new Set(emailLogs.filter(log => log.clickedAt).map(log => log.toEmail)).size

    // Calculate rates
    const deliveryRate = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0
    const openRate = totalDelivered > 0 ? (totalOpened / totalDelivered) * 100 : 0
    const clickRate = totalOpened > 0 ? (totalClicked / totalOpened) * 100 : 0
    const bounceRate = totalSent > 0 ? (totalBounced / totalSent) * 100 : 0
    const complaintRate = totalDelivered > 0 ? (totalComplained / totalDelivered) * 100 : 0

    // Get template performance
    const templateStats = await getTemplateStats(whereClause.organizationId, dateFilter)
    
    // Get bounce details
    const bounceDetails = await getBounceDetails(whereClause.organizationId, dateFilter)
    
    // Get suppression stats
    const suppressionStats = await getSuppressionStats(whereClause.organizationId)

    // Group metrics by period
    const groupedMetrics = groupMetricsByPeriod(metrics, groupBy)

    return NextResponse.json({
      summary: {
        totalSent,
        totalDelivered,
        totalOpened,
        totalClicked,
        totalBounced,
        totalComplained,
        uniqueOpens,
        uniqueClicks,
        deliveryRate,
        openRate,
        clickRate,
        bounceRate,
        complaintRate
      },
      timeSeries: groupedMetrics,
      templates: templateStats,
      bounces: bounceDetails,
      suppression: suppressionStats,
      dateRange: {
        start: startDate || metrics[0]?.date,
        end: endDate || metrics[metrics.length - 1]?.date
      }
    })
  } catch (error) {
    console.error('Email analytics error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function groupMetricsByPeriod(metrics: any[], groupBy: string) {
  const grouped: Record<string, any> = {}

  metrics.forEach(metric => {
    const date = new Date(metric.date)
    let key: string

    switch (groupBy) {
      case 'week':
        const weekStart = new Date(date)
        weekStart.setDate(date.getDate() - date.getDay())
        key = weekStart.toISOString().split('T')[0]
        break
      case 'month':
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        break
      default: // day
        key = date.toISOString().split('T')[0]
    }

    if (!grouped[key]) {
      grouped[key] = {
        date: key,
        sent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        bounced: 0,
        complained: 0,
        failed: 0
      }
    }

    grouped[key].sent += metric.sent || 0
    grouped[key].delivered += metric.delivered || 0
    grouped[key].opened += metric.opened || 0
    grouped[key].clicked += metric.clicked || 0
    grouped[key].bounced += metric.bounced || 0
    grouped[key].complained += metric.complained || 0
    grouped[key].failed += metric.failed || 0
  })

  return Object.values(grouped).sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  )
}

async function getTemplateStats(organizationId: string | undefined, dateFilter: any) {
  const templateGroups = await prisma.emailLog.groupBy({
    by: ['templateKey'],
    where: {
      organizationId,
      templateKey: { not: null },
      createdAt: dateFilter
    },
    _count: {
      _all: true,
      sentAt: true,
      deliveredAt: true,
      openedAt: true,
      clickedAt: true,
      bouncedAt: true,
      complainedAt: true
    }
  })

  // Get template names
  const templateKeys = templateGroups.map(t => t.templateKey).filter(Boolean) as string[]
  const templates = await prisma.emailTemplate.findMany({
    where: {
      key: { in: templateKeys },
      OR: [
        { organizationId },
        { organizationId: null, isSystemDefault: true }
      ]
    },
    select: {
      key: true,
      name: true,
      category: true
    }
  })

  const templateMap = new Map(templates.map(t => [t.key, t]))

  return templateGroups.map(stat => {
    const template = templateMap.get(stat.templateKey!)
    const sent = stat._count.sentAt || 0
    const delivered = stat._count.deliveredAt || 0
    const opened = stat._count.openedAt || 0
    
    return {
      key: stat.templateKey,
      name: template?.name || stat.templateKey,
      category: template?.category || 'unknown',
      sent,
      delivered,
      opened,
      clicked: stat._count.clickedAt || 0,
      bounced: stat._count.bouncedAt || 0,
      complained: stat._count.complainedAt || 0,
      deliveryRate: sent > 0 ? (delivered / sent) * 100 : 0,
      openRate: delivered > 0 ? (opened / delivered) * 100 : 0
    }
  }).sort((a, b) => b.sent - a.sent)
}

async function getBounceDetails(organizationId: string | undefined, dateFilter: any) {
  const bounces = await prisma.emailLog.findMany({
    where: {
      organizationId,
      bouncedAt: { not: null },
      createdAt: dateFilter
    },
    select: {
      bounceType: true,
      bouncedAt: true
    }
  })

  const bounceTypes = bounces.reduce((acc, bounce) => {
    const type = bounce.bounceType || 'unknown'
    acc[type] = (acc[type] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return {
    total: bounces.length,
    byType: bounceTypes
  }
}

async function getSuppressionStats(organizationId?: string) {
  const suppression = await prisma.emailSuppressionList.groupBy({
    by: ['reason'],
    _count: { _all: true }
  })

  const total = await prisma.emailSuppressionList.count()

  return {
    total,
    byReason: suppression.reduce((acc, item) => {
      acc[item.reason] = item._count._all
      return acc
    }, {} as Record<string, number>)
  }
}