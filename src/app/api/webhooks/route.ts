import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import prisma from '@/lib/db/prisma'
import crypto from 'crypto'

// Generate a webhook secret
function generateWebhookSecret(): string {
  return 'whsec_' + crypto.randomBytes(24).toString('hex')
}

// GET /api/webhooks - List all webhooks for the organization
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const webhooks = await prisma.webhook.findMany({
      where: {
        organizationId: session.organizationId,
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            logs: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Format webhooks for display
    const formattedWebhooks = webhooks.map(webhook => ({
      id: webhook.id,
      name: webhook.name,
      url: webhook.url,
      events: webhook.events,
      isActive: webhook.isActive,
      secret: webhook.secret ? `whsec_${'*'.repeat(40)}${webhook.secret.slice(-4)}` : null,
      lastTriggered: webhook.lastTriggered?.toISOString(),
      failureCount: webhook.failureCount,
      consecutiveFailures: webhook.consecutiveFailures,
      createdAt: webhook.createdAt.toISOString(),
      createdBy: webhook.user.name || webhook.user.email,
      totalDeliveries: webhook._count.logs,
    }))

    return NextResponse.json({ webhooks: formattedWebhooks })
  } catch (error) {
    console.error('Error fetching webhooks:', error)
    return NextResponse.json(
      { error: 'Failed to fetch webhooks' },
      { status: 500 }
    )
  }
}

// POST /api/webhooks - Create a new webhook
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admins and master users can create webhooks
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { name, url, events = [], headers = {} } = body

    if (!name || !url) {
      return NextResponse.json(
        { error: 'Name and URL are required' },
        { status: 400 }
      )
    }

    // Validate URL
    try {
      new URL(url)
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      )
    }

    // Generate webhook secret
    const secret = generateWebhookSecret()

    // Create the webhook
    const webhook = await prisma.webhook.create({
      data: {
        organizationId: session.organizationId,
        userId: session.userId,
        name,
        url,
        events,
        headers,
        secret,
      },
      select: {
        id: true,
        name: true,
        url: true,
        events: true,
        secret: true,
        isActive: true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      webhook: {
        id: webhook.id,
        name: webhook.name,
        url: webhook.url,
        events: webhook.events,
        secret: webhook.secret, // Return full secret only on creation
        isActive: webhook.isActive,
        createdAt: webhook.createdAt.toISOString(),
      },
      message: 'Webhook created successfully. Please save the secret as it will not be shown again.',
    })
  } catch (error) {
    console.error('Error creating webhook:', error)
    return NextResponse.json(
      { error: 'Failed to create webhook' },
      { status: 500 }
    )
  }
}

// PUT /api/webhooks - Update a webhook
export async function PUT(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, name, url, events, isActive, regenerateSecret } = body

    if (!id) {
      return NextResponse.json({ error: 'Webhook ID is required' }, { status: 400 })
    }

    // Check if webhook belongs to the organization
    const webhook = await prisma.webhook.findFirst({
      where: {
        id,
        organizationId: session.organizationId,
      },
    })

    if (!webhook) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 })
    }

    // Only admins and the webhook creator can update it
    if (webhook.userId !== session.userId && !['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Prepare update data
    const updateData: any = {
      updatedAt: new Date(),
    }

    if (name !== undefined) updateData.name = name
    if (url !== undefined) {
      try {
        new URL(url)
        updateData.url = url
      } catch {
        return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 })
      }
    }
    if (events !== undefined) updateData.events = events
    if (isActive !== undefined) updateData.isActive = isActive
    
    // Regenerate secret if requested
    let newSecret = null
    if (regenerateSecret) {
      newSecret = generateWebhookSecret()
      updateData.secret = newSecret
    }

    // Update the webhook
    const updatedWebhook = await prisma.webhook.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        url: true,
        events: true,
        isActive: true,
        updatedAt: true,
      },
    })

    const response: any = {
      webhook: updatedWebhook,
      message: 'Webhook updated successfully',
    }

    if (newSecret) {
      response.newSecret = newSecret
      response.message += '. New secret generated - please save it as it will not be shown again.'
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error updating webhook:', error)
    return NextResponse.json(
      { error: 'Failed to update webhook' },
      { status: 500 }
    )
  }
}

// DELETE /api/webhooks - Delete a webhook
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const webhookId = searchParams.get('id')

    if (!webhookId) {
      return NextResponse.json({ error: 'Webhook ID is required' }, { status: 400 })
    }

    // Check if webhook belongs to the organization
    const webhook = await prisma.webhook.findFirst({
      where: {
        id: webhookId,
        organizationId: session.organizationId,
      },
    })

    if (!webhook) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 })
    }

    // Only admins and the webhook creator can delete it
    if (webhook.userId !== session.userId && !['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Delete the webhook (cascade deletes logs)
    await prisma.webhook.delete({
      where: { id: webhookId },
    })

    return NextResponse.json({ message: 'Webhook deleted successfully' })
  } catch (error) {
    console.error('Error deleting webhook:', error)
    return NextResponse.json(
      { error: 'Failed to delete webhook' },
      { status: 500 }
    )
  }
}