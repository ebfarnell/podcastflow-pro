import { NextRequest, NextResponse } from 'next/server'

// This endpoint is called by a cron job to process notifications
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const cronSecret = request.headers.get('x-cron-secret')
    if (cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Call the process endpoint internally
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/notifications/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': process.env.CRON_SECRET || ''
      },
      body: JSON.stringify({ batchSize: 20 })
    })
    
    const result = await response.json()
    
    if (result.processed > 0) {
      console.log(`📬 Cron: Processed ${result.processed} notifications (${result.successful} successful, ${result.failed} failed)`)
    }
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result
    })
  } catch (error) {
    console.error('❌ Cron notification processing error:', error)
    return NextResponse.json(
      { error: 'Failed to process notifications' },
      { status: 500 }
    )
  }
}