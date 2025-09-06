// Test email configuration endpoint

import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { emailService } from '@/services/email'

// POST /api/master/email-settings/test
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only master accounts can test email configuration
    if (session.role !== 'master') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { testEmail } = await request.json()

    if (!testEmail || !testEmail.includes('@')) {
      return NextResponse.json(
        { error: 'Valid email address required' },
        { status: 400 }
      )
    }

    // Send test email
    try {
      const result = await emailService.sendEmail({
        to: testEmail,
        subject: 'PodcastFlow Pro - Email Configuration Test',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1976d2;">Email Configuration Test Successful!</h2>
            <p>Hi there,</p>
            <p>This is a test email from PodcastFlow Pro to verify that your email configuration is working correctly.</p>
            <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0;">Configuration Details:</h3>
              <ul style="list-style: none; padding: 0;">
                <li>✅ Email provider is configured</li>
                <li>✅ Authentication is working</li>
                <li>✅ Email delivery is functional</li>
              </ul>
            </div>
            <p>You can now start sending emails through your PodcastFlow Pro platform!</p>
            <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
            <p style="font-size: 12px; color: #666;">
              This test email was sent from PodcastFlow Pro.<br>
              Timestamp: ${new Date().toISOString()}
            </p>
          </div>
        `,
        text: `
Email Configuration Test Successful!

Hi there,

This is a test email from PodcastFlow Pro to verify that your email configuration is working correctly.

Configuration Details:
✅ Email provider is configured
✅ Authentication is working
✅ Email delivery is functional

You can now start sending emails through your PodcastFlow Pro platform!

---
This test email was sent from PodcastFlow Pro.
Timestamp: ${new Date().toISOString()}
        `,
        tags: {
          type: 'test',
          source: 'master-settings'
        }
      })

      return NextResponse.json({
        success: true,
        message: 'Test email sent successfully!',
        messageId: result.messageId
      })
    } catch (error: any) {
      console.error('Failed to send test email:', error)
      
      // Check if it's a configuration error
      if (error.message?.includes('not configured')) {
        return NextResponse.json({
          success: false,
          error: 'Email system not configured. Please save settings first.'
        })
      }
      
      return NextResponse.json({
        success: false,
        error: error.message || 'Failed to send test email'
      })
    }
  } catch (error: any) {
    console.error('Failed to send test email:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to send test email'
    })
  }
}