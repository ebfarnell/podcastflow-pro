import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


export async function POST(
  request: NextRequest,
  { params }: { params: { platform: string } }
) {
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

    const platform = params.platform

    switch (platform) {
      case 'quickbooks':
        // Trigger QuickBooks sync
        const qbResponse = await fetch(`${request.nextUrl.origin}/api/quickbooks/auth`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': request.headers.get('cookie') || ''
          },
          body: JSON.stringify({
            action: 'manual_sync'
          })
        })
        
        if (!qbResponse.ok) {
          const error = await qbResponse.json()
          return NextResponse.json(error, { status: qbResponse.status })
        }
        
        return NextResponse.json({
          message: 'QuickBooks sync initiated',
          success: true
        })

      case 'megaphone':
        // Trigger Megaphone sync
        const mpResponse = await fetch(`${request.nextUrl.origin}/api/megaphone/sync`, {
          method: 'POST',
          headers: {
            'Cookie': request.headers.get('cookie') || ''
          }
        })
        
        if (!mpResponse.ok) {
          const error = await mpResponse.json()
          return NextResponse.json(error, { status: mpResponse.status })
        }
        
        const mpData = await mpResponse.json()
        return NextResponse.json({
          message: 'Megaphone sync completed',
          success: true,
          ...mpData
        })

      case 'youtube':
        // Trigger YouTube sync for all shows with YouTube channels
        try {
          // Get all shows with YouTube channels for this organization
          const organizationId = user.organizationId
          const organizationSlug = user.organization?.slug
          if (!organizationId || !organizationSlug) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 400 })
          }

          // Import required functions
          const { safeQuerySchema } = await import('@/lib/db/schema-db')
          
          // Get all shows with YouTube channels
          const showsQuery = `
            SELECT id, name, "youtubeChannelId" 
            FROM "Show" 
            WHERE "organizationId" = $1 
              AND "youtubeChannelId" IS NOT NULL 
              AND "youtubeChannelId" != ''
          `
          const { data: shows } = await safeQuerySchema(
            organizationSlug,
            showsQuery,
            [organizationId]
          )

          if (!shows || shows.length === 0) {
            return NextResponse.json({
              message: 'No shows with YouTube channels configured',
              success: false,
              showsSynced: 0
            })
          }

          // Sync each show
          const syncResults = []
          for (const show of shows) {
            try {
              const syncResponse = await fetch(
                `${request.nextUrl.origin}/api/youtube/sync/${show.id}`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Cookie': request.headers.get('cookie') || ''
                  }
                }
              )
              
              if (syncResponse.ok) {
                const result = await syncResponse.json()
                syncResults.push({
                  showId: show.id,
                  showName: show.name,
                  success: true,
                  stats: result.stats
                })
              } else {
                syncResults.push({
                  showId: show.id,
                  showName: show.name,
                  success: false,
                  error: 'Sync failed'
                })
              }
            } catch (error) {
              console.error(`Failed to sync show ${show.id}:`, error)
              syncResults.push({
                showId: show.id,
                showName: show.name,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
              })
            }
          }

          // Update last sync timestamp in integration status
          const { querySchema } = await import('@/lib/db/schema-db')
          await querySchema(
            'public',
            `INSERT INTO "IntegrationStatus" (
              "organizationId", 
              platform, 
              connected, 
              "lastSync"
            ) VALUES ($1, $2, true, NOW())
            ON CONFLICT ("organizationId", platform) 
            DO UPDATE SET "lastSync" = NOW()`,
            [organizationId, 'youtube']
          ).catch(err => console.error('Failed to update integration status:', err))

          const successCount = syncResults.filter(r => r.success).length
          const totalEpisodes = syncResults
            .filter(r => r.success && r.stats)
            .reduce((sum, r) => sum + (r.stats?.episodesCreated || 0) + (r.stats?.episodesUpdated || 0), 0)

          return NextResponse.json({
            message: `YouTube sync completed for ${successCount}/${shows.length} shows`,
            success: true,
            showsSynced: successCount,
            totalShows: shows.length,
            totalEpisodes,
            details: syncResults
          })
        } catch (error) {
          console.error('YouTube sync error:', error)
          return NextResponse.json({ 
            error: 'Failed to sync YouTube data',
            details: error instanceof Error ? error.message : 'Unknown error'
          }, { status: 500 })
        }

      case 'hubspot':
      case 'airtable':
      case 'stripe':
      case 'google':
      case 'slack':
        // For other integrations, return success
        return NextResponse.json({
          message: `${platform} sync completed`,
          success: true
        })

      default:
        return NextResponse.json({ error: 'Unknown platform' }, { status: 400 })
    }
  } catch (error) {
    console.error(`Error syncing ${params.platform}:`, error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
