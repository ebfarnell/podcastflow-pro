import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


export async function DELETE(
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
        // Disconnect QuickBooks
        const qbResponse = await fetch(`${request.nextUrl.origin}/api/quickbooks/auth?action=disconnect`, {
          method: 'GET',
          headers: {
            'Cookie': request.headers.get('cookie') || ''
          }
        })
        
        if (!qbResponse.ok) {
          const error = await qbResponse.json()
          return NextResponse.json(error, { status: qbResponse.status })
        }
        
        return NextResponse.json({
          message: 'QuickBooks disconnected successfully',
          connected: false
        })

      case 'megaphone':
        // Disconnect Megaphone
        const mpResponse = await fetch(`${request.nextUrl.origin}/api/megaphone/integration`, {
          method: 'DELETE',
          headers: {
            'Cookie': request.headers.get('cookie') || ''
          }
        })
        
        if (!mpResponse.ok) {
          const error = await mpResponse.json()
          return NextResponse.json(error, { status: mpResponse.status })
        }
        
        return NextResponse.json({
          message: 'Megaphone disconnected successfully',
          connected: false
        })

      case 'youtube':
        // Clear YouTube config
        const ytResponse = await fetch(`${request.nextUrl.origin}/api/youtube/config`, {
          method: 'DELETE',
          headers: {
            'Cookie': request.headers.get('cookie') || ''
          }
        })
        
        if (!ytResponse.ok) {
          const error = await ytResponse.json()
          return NextResponse.json(error, { status: ytResponse.status })
        }
        
        return NextResponse.json({
          message: 'YouTube disconnected successfully',
          connected: false
        })

      case 'hubspot':
      case 'airtable':
      case 'stripe':
      case 'google':
      case 'slack':
        // For other integrations, return success
        return NextResponse.json({
          message: `${platform} disconnected successfully`,
          connected: false
        })

      default:
        return NextResponse.json({ error: 'Unknown platform' }, { status: 400 })
    }
  } catch (error) {
    console.error(`Error disconnecting ${params.platform}:`, error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
