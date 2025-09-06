import { NextRequest, NextResponse } from 'next/server'
import { EmailTracker } from '@/services/email/tracking'

export async function GET(
  request: NextRequest,
  { params }: { params: { trackingId: string } }
) {
  try {
    const trackingId = params.trackingId
    const searchParams = request.nextUrl.searchParams
    const targetUrl = searchParams.get('url')
    
    if (!targetUrl) {
      return NextResponse.json({ error: 'Missing target URL' }, { status: 400 })
    }
    
    const decodedUrl = decodeURIComponent(targetUrl)
    const userAgent = request.headers.get('user-agent') || undefined
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined
    
    // Record the click event asynchronously
    EmailTracker.recordClick(trackingId, decodedUrl, userAgent, ipAddress).catch(error => {
      console.error('Failed to record email click:', error)
    })
    
    // Redirect to the target URL
    return NextResponse.redirect(decodedUrl, {
      status: 302,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  } catch (error) {
    console.error('Click tracking error:', error)
    // Redirect to home page on error
    return NextResponse.redirect(process.env.NEXT_PUBLIC_APP_URL || 'https://app.podcastflow.pro')
  }
}