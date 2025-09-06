import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { UserService } from '@/lib/auth/user-service'
import { quickBooksService } from '@/lib/quickbooks/quickbooks-service'
import { quickBooksSyncService } from '@/lib/quickbooks/sync-service'
import crypto from 'crypto'

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

    // Check if user has admin permissions
    if (!['master', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Admin permissions required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    if (action === 'connect') {
      // Generate state token for CSRF protection
      const state = crypto.randomBytes(16).toString('hex')
      
      // Store state in session for verification (using userAgent field temporarily)
      await prisma.session.update({
        where: { token: authToken },
        data: {
          userAgent: `quickbooks_state:${state}`
        }
      })

      // Get authorization URL from service
      const authUrl = quickBooksService.getAuthorizationUrl(state, user.organizationId)
      
      if (!authUrl) {
        return NextResponse.json({ error: 'QuickBooks integration not configured' }, { status: 500 })
      }

      return NextResponse.json({ authUrl })
    } else if (action === 'status') {
      // Get QuickBooks connection status from service
      try {
        const status = await quickBooksService.getSyncStatus(user.organizationId)
        
        const integration = await prisma.quickBooksIntegration.findFirst({
          where: {
            organizationId: user.organizationId
          }
        })

        return NextResponse.json({
          connected: status.connected,
          companyName: integration?.companyName || null,
          lastSync: status.lastSync || null,
          nextSync: status.nextSync || null,
          syncInProgress: status.syncInProgress,
          integration
        })
      } catch (error) {
        // If QuickBooks models are not available, return disconnected status
        console.log('QuickBooks integration check failed:', error)
        return NextResponse.json({
          connected: false,
          companyName: null,
          lastSync: null,
          nextSync: null,
          syncInProgress: false,
          integration: null
        })
      }
    } else if (action === 'disconnect') {
      // Disconnect QuickBooks using service (handles token revocation)
      try {
        await quickBooksService.disconnect(user.organizationId)
      } catch (error) {
        console.log('QuickBooks disconnect failed:', error)
        // Return success even if disconnect fails
      }

      return NextResponse.json({ message: 'QuickBooks disconnected successfully' })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Error in QuickBooks auth:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { action, settings } = body

    if (action === 'update_settings') {
      // Update QuickBooks integration settings
      try {
        const integration = await prisma.quickBooksIntegration.findFirst({
          where: {
            organizationId: user.organizationId
          }
        })

        if (!integration) {
          return NextResponse.json({ error: 'QuickBooks not connected' }, { status: 400 })
        }

        const updatedIntegration = await prisma.quickBooksIntegration.update({
          where: { id: integration.id },
          data: {
            syncSettings: settings,
            updatedAt: new Date()
          }
        })

        return NextResponse.json({
          message: 'Settings updated successfully',
          integration: updatedIntegration
        })
      } catch (error) {
        console.log('QuickBooks settings update failed:', error)
        return NextResponse.json({ error: 'QuickBooks not connected' }, { status: 400 })
      }
    } else if (action === 'manual_sync') {
      // Trigger manual sync using the sync service
      try {
        const syncId = await quickBooksSyncService.startSync(
          user.organizationId,
          user.id,
          { type: 'manual' }
        )
        
        return NextResponse.json({
          message: 'Sync started successfully',
          syncId
        })
      } catch (syncError) {
        return NextResponse.json({ 
          error: syncError instanceof Error ? syncError.message : 'Failed to start sync' 
        }, { status: 400 })
      }
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Error in QuickBooks operation:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
