import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/auth-middleware'
import { megaphoneSetup, MegaphoneIntegrationConfig } from '@/lib/integrations/megaphone-setup'
import prisma from '@/lib/db/prisma'

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to set up integrations
    if (!['master', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Get organization details
    const organization = await prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { id: true, slug: true, name: true }
    })

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Parse request body
    const body = await request.json()
    const { apiKey, apiSecret, networkId, webhookUrl, syncFrequency, enableAnalytics, enableRevenue } = body

    // Validate required fields
    if (!apiKey || !apiSecret) {
      return NextResponse.json({ 
        error: 'Missing required fields: apiKey and apiSecret are required' 
      }, { status: 400 })
    }

    // Prepare integration configuration
    const config: MegaphoneIntegrationConfig = {
      organizationId: organization.id,
      organizationSlug: organization.slug,
      apiKey,
      apiSecret,
      networkId,
      webhookUrl,
      syncFrequency: syncFrequency || 'daily',
      enableAnalytics: enableAnalytics ?? true,
      enableRevenue: enableRevenue ?? true
    }

    // Initialize Megaphone integration
    await megaphoneSetup.initializeIntegration(config)

    // Return success response
    return NextResponse.json({
      success: true,
      message: 'Megaphone integration initialized successfully',
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug
      },
      integration: {
        syncFrequency: config.syncFrequency,
        enableAnalytics: config.enableAnalytics,
        enableRevenue: config.enableRevenue,
        setupComplete: true
      }
    })

  } catch (error) {
    console.error('Megaphone setup error:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to set up Megaphone integration',
      details: process.env.NODE_ENV === 'development' ? error : undefined
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get organization details
    const organization = await prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { id: true, slug: true, name: true }
    })

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Check integration health
    const health = await megaphoneSetup.checkIntegrationHealth(organization.id)

    // Get integration details
    const integration = await prisma.megaphoneIntegration.findUnique({
      where: { organizationId: organization.id },
      select: {
        id: true,
        status: true,
        syncFrequency: true,
        enableAnalytics: true,
        enableRevenue: true,
        lastSyncAt: true,
        createdAt: true,
        networkId: true,
        webhookUrl: true
      }
    })

    return NextResponse.json({
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug
      },
      integration,
      health,
      isConfigured: !!integration,
      schemaName: `org_${organization.slug}`
    })

  } catch (error) {
    console.error('Megaphone status check error:', error)
    return NextResponse.json({ 
      error: 'Failed to check Megaphone integration status',
      details: process.env.NODE_ENV === 'development' ? error : undefined
    }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to remove integrations
    if (!['master', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Get organization details
    const organization = await prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { id: true, slug: true, name: true }
    })

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Remove Megaphone integration
    await megaphoneSetup.removeIntegration(organization.id, organization.slug)

    return NextResponse.json({
      success: true,
      message: 'Megaphone integration removed successfully',
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug
      }
    })

  } catch (error) {
    console.error('Megaphone removal error:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to remove Megaphone integration',
      details: process.env.NODE_ENV === 'development' ? error : undefined
    }, { status: 500 })
  }
}