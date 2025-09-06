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
    const body = await request.json()

    switch (platform) {
      case 'quickbooks':
        // Redirect to QuickBooks OAuth
        return NextResponse.json({ 
          redirectUrl: `/api/quickbooks/auth?action=connect`,
          message: 'Redirecting to QuickBooks authorization...'
        })

      case 'megaphone':
        // Handle Megaphone connection
        if (!body.apiToken) {
          return NextResponse.json({ error: 'API token required for Megaphone' }, { status: 400 })
        }
        
        const megaphoneResponse = await fetch(`${request.nextUrl.origin}/api/megaphone/integration`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': request.headers.get('cookie') || ''
          },
          body: JSON.stringify({
            apiToken: body.apiToken,
            settings: body.settings || {}
          })
        })
        
        if (!megaphoneResponse.ok) {
          const error = await megaphoneResponse.json()
          return NextResponse.json(error, { status: megaphoneResponse.status })
        }
        
        return NextResponse.json({
          message: 'Megaphone connected successfully',
          connected: true
        })

      case 'youtube':
        // Handle YouTube connection
        if (body.apiKey) {
          // Save API key and sync settings
          const youtubeResponse = await fetch(`${request.nextUrl.origin}/api/youtube/config`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Cookie': request.headers.get('cookie') || ''
            },
            body: JSON.stringify({
              apiKey: body.apiKey,
              quotaLimit: body.quotaLimit || 10000,
              syncFrequency: body.syncFrequency || 'daily'
            })
          })
          
          if (!youtubeResponse.ok) {
            const error = await youtubeResponse.json()
            return NextResponse.json(error, { status: youtubeResponse.status })
          }
        }
        
        // For OAuth, redirect to YouTube auth
        if (body.useOAuth) {
          return NextResponse.json({ 
            redirectUrl: `/api/youtube/auth/connect`,
            message: 'Redirecting to YouTube authorization...'
          })
        }
        
        return NextResponse.json({
          message: 'YouTube configured successfully',
          connected: true
        })

      case 'hubspot':
      case 'airtable':
      case 'stripe':
      case 'google':
      case 'slack':
        // For other integrations, return a placeholder
        return NextResponse.json({
          message: `${platform} integration is coming soon`,
          connected: false
        })

      default:
        return NextResponse.json({ error: 'Unknown platform' }, { status: 400 })
    }
  } catch (error) {
    console.error(`Error connecting ${params.platform}:`, error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
