import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import prisma from '@/lib/db/prisma'
import crypto from 'crypto'

// Generate webhook signature
function generateSignature(payload: string, secret: string): string {
  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(payload)
  return hmac.digest('hex')
}

// POST /api/webhooks/test - Test a webhook
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { webhookId, event = 'test.ping' } = body

    if (!webhookId) {
      return NextResponse.json({ error: 'Webhook ID is required' }, { status: 400 })
    }

    // Fetch the webhook
    const webhook = await prisma.webhook.findFirst({
      where: {
        id: webhookId,
        organizationId: session.organizationId,
      },
    })

    if (!webhook) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 })
    }

    // Prepare test payload
    const testPayload = {
      id: crypto.randomBytes(16).toString('hex'),
      event,
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test webhook delivery',
        webhookId: webhook.id,
        webhookName: webhook.name,
        organization: session.organizationId,
      },
    }

    const payloadString = JSON.stringify(testPayload)

    // Prepare headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Webhook-Event': event,
      'X-Webhook-ID': testPayload.id,
      'X-Webhook-Timestamp': testPayload.timestamp,
    }

    // Add signature if secret exists
    if (webhook.secret) {
      const signature = generateSignature(payloadString, webhook.secret)
      headers['X-Webhook-Signature'] = `sha256=${signature}`
    }

    // Add custom headers if any
    if (webhook.headers && typeof webhook.headers === 'object') {
      Object.assign(headers, webhook.headers)
    }

    // Send the test webhook
    let statusCode: number | null = null
    let responseText: string | null = null
    let error: string | null = null
    let deliveredAt: Date | null = null

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body: payloadString,
        signal: AbortSignal.timeout(10000), // 10 second timeout
      })

      statusCode = response.status
      responseText = await response.text()
      deliveredAt = new Date()

      if (!response.ok) {
        error = `HTTP ${statusCode}: ${responseText.substring(0, 500)}`
      }
    } catch (fetchError: any) {
      error = fetchError.message || 'Failed to deliver webhook'
      console.error('Webhook delivery error:', fetchError)
    }

    // Log the test delivery
    await prisma.webhookLog.create({
      data: {
        webhookId: webhook.id,
        event,
        payload: testPayload,
        statusCode,
        response: responseText?.substring(0, 1000), // Limit response size
        error,
        attemptNumber: 1,
        deliveredAt,
      },
    })

    // Update webhook last triggered time
    await prisma.webhook.update({
      where: { id: webhook.id },
      data: {
        lastTriggered: new Date(),
        failureCount: error ? webhook.failureCount + 1 : 0,
        consecutiveFailures: error ? webhook.consecutiveFailures + 1 : 0,
      },
    })

    if (error) {
      return NextResponse.json({
        success: false,
        error,
        statusCode,
        message: 'Webhook test failed',
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      statusCode,
      message: 'Webhook test successful',
      response: responseText?.substring(0, 500), // Return partial response
    })
  } catch (error) {
    console.error('Error testing webhook:', error)
    return NextResponse.json(
      { error: 'Failed to test webhook' },
      { status: 500 }
    )
  }
}