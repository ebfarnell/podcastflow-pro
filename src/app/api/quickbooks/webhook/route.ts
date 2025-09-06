import { NextRequest, NextResponse } from 'next/server'
import { comprehensiveQuickBooksService } from '@/lib/quickbooks/comprehensive-service'
import prisma from '@/lib/db/prisma'

// POST /api/quickbooks/webhook - Handle QuickBooks webhook notifications
export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get('intuit-signature')
    const payload = await request.text()

    // Verify webhook signature
    if (!signature) {
      console.error('Missing webhook signature')
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 401 }
      )
    }

    // Verify the webhook signature
    const isValid = comprehensiveQuickBooksService.verifyWebhookSignature(payload, signature)
    
    if (!isValid) {
      console.error('Invalid webhook signature')
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }

    // Parse the webhook payload
    const webhookEvent = JSON.parse(payload)
    
    console.log('QuickBooks webhook received:', JSON.stringify(webhookEvent, null, 2))

    // Process each event notification
    for (const notification of webhookEvent.eventNotifications || []) {
      const realmId = notification.realmId
      
      if (!realmId) {
        console.warn('Webhook notification missing realmId')
        continue
      }

      // Find the organization for this realmId
      const integration = await prisma.quickBooksIntegration.findFirst({
        where: { realmId }
      })

      if (!integration) {
        console.warn(`No integration found for realmId: ${realmId}`)
        continue
      }

      // Process data change events
      if (notification.dataChangeEvent?.entities) {
        const entities = notification.dataChangeEvent.entities
        const changedEntityTypes = new Set(entities.map((e: any) => e.name))
        
        console.log(`Processing webhook for organization ${integration.organizationId}, entities: ${Array.from(changedEntityTypes).join(', ')}`)

        // Create an incremental sync job for the changed entities
        const syncJob = await prisma.quickBooksSync.create({
          data: {
            organizationId: integration.organizationId,
            integrationId: integration.id,
            syncType: 'incremental',
            status: 'pending',
            startedAt: new Date(),
            createdBy: 'webhook'
          }
        })

        // Store the changed entities in the sync job errors field (as metadata)
        await prisma.quickBooksSync.update({
          where: { id: syncJob.id },
          data: {
            errors: {
              changedEntities: entities,
              webhookTimestamp: new Date().toISOString(),
              realmId
            }
          }
        })

        // Process the webhook event using the service
        await comprehensiveQuickBooksService.processWebhookEvent(
          integration.organizationId,
          webhookEvent
        )

        // Update the sync job status
        await prisma.quickBooksSync.update({
          where: { id: syncJob.id },
          data: {
            status: 'completed',
            completedAt: new Date(),
            recordsProcessed: entities.length
          }
        })
      }
    }

    // Return success response
    return NextResponse.json({
      success: true,
      message: 'Webhook processed successfully',
      processedCount: webhookEvent.eventNotifications?.length || 0
    })

  } catch (error) {
    console.error('Webhook processing error:', error)
    
    // Log the error but still return 200 to prevent webhook retries
    // QuickBooks will retry failed webhooks, which could cause issues
    return NextResponse.json({
      success: false,
      message: 'Webhook processing failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 200 }) // Return 200 to prevent retries
  }
}

// GET /api/quickbooks/webhook - Get webhook configuration info
export async function GET(request: NextRequest) {
  try {
    // This endpoint can be used to verify webhook configuration
    const url = new URL(request.url)
    const challenge = url.searchParams.get('challenge')
    
    // If this is a webhook verification request, return the challenge
    if (challenge) {
      return new Response(challenge, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain'
        }
      })
    }

    // Otherwise return webhook status
    return NextResponse.json({
      success: true,
      message: 'Webhook endpoint is active',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Webhook GET error:', error)
    
    return NextResponse.json(
      { error: 'Failed to process webhook request' },
      { status: 500 }
    )
  }
}