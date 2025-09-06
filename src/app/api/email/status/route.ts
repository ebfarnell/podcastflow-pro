import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import prisma from '@/lib/db/prisma'
import { SESProvider } from '@/services/email/providers/ses-provider'
import { EmailProviderConfig } from '@/services/email/providers/types'

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin and master can view email status
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get organization settings
    const organization = await prisma.organization.findUnique({
      where: { id: session.organizationId! },
      select: {
        id: true,
        name: true,
        settings: true
      }
    })

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const settings = organization.settings as any || {}
    const emailSettings = settings.emailSettings || {}

    // Initialize SES provider to get live status
    const sesConfig: EmailProviderConfig = {
      provider: 'ses',
      sesConfig: {
        region: process.env.AWS_SES_REGION || process.env.AWS_REGION || 'us-east-1',
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        fromEmail: emailSettings.fromEmail || process.env.EMAIL_FROM || 'notifications@app.podcastflow.pro',
        fromName: emailSettings.fromName || organization.name || 'PodcastFlow Pro',
        replyTo: emailSettings.replyToAddress || process.env.REPLY_TO_EMAIL || 'support@podcastflow.pro',
        useIAMRole: false
      }
    }

    let sesStatus = {
      connected: false,
      region: sesConfig.sesConfig?.region,
      mode: 'unknown' as 'production' | 'sandbox' | 'unknown',
      quota: null as any,
      stats: null as any,
      verifiedEmails: [] as string[],
      verifiedDomains: [] as string[],
      configurationSet: process.env.SES_CONFIGURATION_SET || null
    }

    try {
      const sesProvider = new SESProvider()
      await sesProvider.initialize(sesConfig)

      const [quota, stats, verifiedEmails] = await Promise.all([
        sesProvider.getQuota(),
        sesProvider.getSendStatistics(),
        sesProvider.listVerifiedEmails()
      ])

      sesStatus = {
        connected: true,
        region: sesConfig.sesConfig?.region || 'us-east-1',
        mode: quota.max24HourSend > 200 ? 'production' : 'sandbox',
        quota,
        stats,
        verifiedEmails: verifiedEmails.filter(e => e.includes('@')),
        verifiedDomains: verifiedEmails.filter(e => !e.includes('@')),
        configurationSet: process.env.SES_CONFIGURATION_SET || null
      }
    } catch (error) {
      console.error('Failed to get SES status:', error)
    }

    // Get recent email activity
    const recentEmails = await prisma.emailLog.findMany({
      where: {
        organizationId: organization.id
      },
      orderBy: {
        sentAt: 'desc'
      },
      take: 10,
      select: {
        id: true,
        toEmail: true,
        subject: true,
        status: true,
        sentAt: true,
        deliveredAt: true,
        bouncedAt: true,
        complainedAt: true,
        bounceType: true,
        messageId: true
      }
    })

    // Get suppression list count
    const suppressionCount = await prisma.emailSuppressionList.count()

    // Get email statistics for the last 30 days
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const emailStats = await prisma.emailLog.groupBy({
      by: ['status'],
      where: {
        organizationId: organization.id,
        sentAt: {
          gte: thirtyDaysAgo
        }
      },
      _count: {
        status: true
      }
    })

    const statsMap = emailStats.reduce((acc, stat) => {
      acc[stat.status] = stat._count.status
      return acc
    }, {} as Record<string, number>)

    return NextResponse.json({
      sesStatus,
      emailSettings: {
        ...emailSettings,
        configured: sesStatus.connected,
        fromEmail: sesConfig.sesConfig?.fromEmail,
        fromName: sesConfig.sesConfig?.fromName,
        replyTo: sesConfig.sesConfig?.replyTo
      },
      recentActivity: recentEmails,
      statistics: {
        last30Days: {
          sent: statsMap.sent || 0,
          delivered: statsMap.delivered || 0,
          bounced: statsMap.bounced || 0,
          complained: statsMap.complained || 0,
          failed: statsMap.failed || 0,
          pending: statsMap.pending || 0
        },
        suppressionListSize: suppressionCount
      }
    })
  } catch (error) {
    console.error('Failed to get email status:', error)
    return NextResponse.json(
      { error: 'Failed to get email status' },
      { status: 500 }
    )
  }
}