import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { querySchema } from '@/lib/db/schema-db'
import prisma from '@/lib/db/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get organization data
    const org = await prisma.organization.findUnique({
      where: { id: session.user.organizationId }
    })

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    try {
      // Check if Megaphone integration exists in organization schema
      const result = await querySchema<any[]>(
        org.slug,
        async (client) => {
          const res = await client.query(`
            SELECT * FROM "MegaphoneIntegration" 
            WHERE "organizationId" = $1
            LIMIT 1
          `, [session.user.organizationId])
          return res.rows
        }
      )

      if (result && result.length > 0) {
        const integration = result[0]
        // Don't expose sensitive data
        delete integration.apiToken
        return NextResponse.json(integration)
      }
    } catch (dbError) {
      // Table doesn't exist yet - this is normal for organizations that haven't set up Megaphone
      console.log('Megaphone integration not configured for this organization')
    }

    // Return empty state when no integration exists
    return NextResponse.json({
      isActive: false,
      syncStatus: 'not_configured'
    }, { status: 200 })
  } catch (error) {
    console.error('Error fetching Megaphone integration:', error)
    return NextResponse.json(
      { error: 'Failed to fetch integration' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check user permissions
    if (!['admin', 'master'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const { apiToken, settings } = body

    if (!apiToken) {
      return NextResponse.json({ error: 'API token is required' }, { status: 400 })
    }

    // Get organization data
    const org = await prisma.organization.findUnique({
      where: { id: session.user.organizationId }
    })

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    try {
      // First, test the API token with Megaphone
      const testResponse = await fetch('https://api.megaphone.fm/api/networks', {
        headers: {
          'Authorization': `Token ${apiToken}`,
          'Accept': 'application/json'
        }
      })

      if (!testResponse.ok) {
        return NextResponse.json({ 
          error: 'Invalid API token. Please check your Megaphone API token and try again.' 
        }, { status: 400 })
      }

      // Create the MegaphoneIntegration table if it doesn't exist and store the integration
      const result = await querySchema<any[]>(
        org.slug,
        async (client) => {
          // Create table if not exists
          await client.query(`
            CREATE TABLE IF NOT EXISTS "MegaphoneIntegration" (
              "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
              "organizationId" TEXT NOT NULL,
              "apiToken" TEXT NOT NULL,
              "isActive" BOOLEAN NOT NULL DEFAULT true,
              "syncStatus" TEXT NOT NULL DEFAULT 'idle',
              "syncFrequency" TEXT NOT NULL DEFAULT 'daily',
              "lastSyncAt" TIMESTAMP(3),
              "lastError" TEXT,
              "settings" JSONB NOT NULL DEFAULT '{}',
              "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
              "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
              PRIMARY KEY ("id")
            )
          `)

          // Insert or update the integration
          const res = await client.query(`
            INSERT INTO "MegaphoneIntegration" 
            ("organizationId", "apiToken", "isActive", "syncStatus", "syncFrequency", "settings")
            VALUES ($1, $2, true, 'idle', $3, $4::jsonb)
            ON CONFLICT ("organizationId") DO UPDATE
            SET "apiToken" = $2,
                "isActive" = true,
                "settings" = $4::jsonb,
                "updatedAt" = CURRENT_TIMESTAMP
            RETURNING *
          `, [
            session.user.organizationId,
            apiToken,
            settings?.syncFrequency || 'daily',
            JSON.stringify(settings || {})
          ])
          
          return res.rows
        }
      )

      if (result && result.length > 0) {
        const integration = result[0]
        // Don't expose sensitive data
        delete integration.apiToken
        return NextResponse.json(integration)
      }

      throw new Error('Failed to save integration')
    } catch (dbError: any) {
      console.error('Database error setting up Megaphone integration:', dbError)
      return NextResponse.json({ 
        error: 'Failed to save integration settings' 
      }, { status: 500 })
    }
  } catch (error) {
    console.error('Error setting up Megaphone integration:', error)
    return NextResponse.json(
      { error: 'Failed to setup integration' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check user permissions
    if (!['admin', 'master'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Get organization data
    const org = await prisma.organization.findUnique({
      where: { id: session.user.organizationId }
    })

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    try {
      // Delete the integration
      await querySchema(
        org.slug,
        async (client) => {
          await client.query(`
            DELETE FROM "MegaphoneIntegration" 
            WHERE "organizationId" = $1
          `, [session.user.organizationId])
        }
      )

      return NextResponse.json({ 
        success: true,
        message: 'Megaphone integration disconnected successfully' 
      })
    } catch (dbError) {
      // If table doesn't exist, consider it already deleted
      console.log('Megaphone integration table not found - considering as already disconnected')
      return NextResponse.json({ 
        success: true,
        message: 'Megaphone integration disconnected' 
      })
    }
  } catch (error) {
    console.error('Error deleting Megaphone integration:', error)
    return NextResponse.json(
      { error: 'Failed to delete integration' },
      { status: 500 }
    )
  }
}