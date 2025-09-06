import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import prisma from '@/lib/db/prisma'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


export async function GET(request: NextRequest) {
  try {
    // Get session and verify authentication
    const authToken = request.cookies.get('auth-token')?.value
    if (!authToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const organizationId = user.organizationId

    // Check status of all integrations
    const integrationStatus: any = {}

    // QuickBooks
    try {
      const quickBooks = await prisma.quickBooksIntegration.findFirst({
        where: { organizationId },
        select: { 
          isActive: true, 
          companyName: true,
          lastSyncAt: true,
          updatedAt: true
        }
      })
      integrationStatus.quickbooks = {
        connected: !!quickBooks?.isActive,
        companyName: quickBooks?.companyName || null,
        lastSync: quickBooks?.lastSyncAt || quickBooks?.updatedAt || null
      }
    } catch (error) {
      integrationStatus.quickbooks = { connected: false }
    }

    // Megaphone
    try {
      const megaphone = await prisma.megaphoneIntegration.findFirst({
        where: { organizationId },
        select: { 
          isActive: true,
          lastSyncAt: true,
          updatedAt: true
        }
      })
      integrationStatus.megaphone = {
        connected: !!megaphone?.isActive,
        lastSync: megaphone?.lastSyncAt || megaphone?.updatedAt || null
      }
    } catch (error) {
      integrationStatus.megaphone = { connected: false }
    }

    // YouTube
    try {
      const youtube = await prisma.youTubeApiConfig.findFirst({
        where: { organizationId },
        select: {
          isActive: true,
          apiKey: true,
          updatedAt: true
        }
      })
      
      // Check for any connected channels
      let channelCount = 0
      try {
        // Check if YouTubeChannel table exists in org schema
        const schemaSlug = await prisma.user.findUnique({
          where: { id: user.id },
          include: { organization: true }
        })
        
        if (schemaSlug?.organization?.slug) {
          const schema = `org_${schemaSlug.organization.slug.replace(/-/g, '_')}`
          const result = await prisma.$queryRawUnsafe<any[]>(
            `SELECT COUNT(*) as count FROM "${schema}"."YouTubeChannel" WHERE "isActive" = true`
          )
          channelCount = parseInt(result[0]?.count || '0')
        }
      } catch (e) {
        // Table might not exist yet
      }

      integrationStatus.youtube = {
        connected: !!youtube?.isActive || channelCount > 0,
        hasApiKey: !!youtube?.apiKey,
        connectedChannels: channelCount,
        lastSync: youtube?.updatedAt || null,
        syncFrequency: youtube?.syncFrequency || 'daily'
      }
    } catch (error) {
      integrationStatus.youtube = { connected: false, connectedChannels: 0 }
    }

    return NextResponse.json({
      integrations: integrationStatus,
      organizationId
    })
  } catch (error) {
    console.error('Error checking integration status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
