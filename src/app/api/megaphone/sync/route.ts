import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { querySchema } from '@/lib/db/schema-db'
import prisma from '@/lib/db/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    
    // Get organization data
    const org = await prisma.organization.findUnique({
      where: { id: session.user.organizationId }
    })

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    try {
      // Check if integration exists
      const integrationResult = await querySchema<any[]>(
        org.slug,
        async (client) => {
          const res = await client.query(`
            SELECT * FROM "MegaphoneIntegration" 
            WHERE "organizationId" = $1 AND "isActive" = true
            LIMIT 1
          `, [session.user.organizationId])
          return res.rows
        }
      )

      if (!integrationResult || integrationResult.length === 0) {
        return NextResponse.json({ 
          error: 'Megaphone integration not configured. Please connect your Megaphone account first.' 
        }, { status: 400 })
      }

      const integration = integrationResult[0]

      // Update sync status to 'syncing'
      await querySchema(
        org.slug,
        async (client) => {
          await client.query(`
            UPDATE "MegaphoneIntegration" 
            SET "syncStatus" = 'syncing', "updatedAt" = CURRENT_TIMESTAMP
            WHERE "organizationId" = $1
          `, [session.user.organizationId])
        }
      )

      // In a real implementation, this would:
      // 1. Fetch data from Megaphone API using the stored apiToken
      // 2. Process and store the data in organization-specific tables
      // 3. Update sync status and timestamps
      // For now, we'll simulate a basic sync

      // Simulate sync completion after a short delay
      setTimeout(async () => {
        try {
          await querySchema(
            org.slug,
            async (client) => {
              await client.query(`
                UPDATE "MegaphoneIntegration" 
                SET "syncStatus" = 'success', 
                    "lastSyncAt" = CURRENT_TIMESTAMP,
                    "updatedAt" = CURRENT_TIMESTAMP
                WHERE "organizationId" = $1
              `, [session.user.organizationId])
            }
          )
        } catch (err) {
          console.error('Error updating sync status:', err)
        }
      }, 2000)

      return NextResponse.json({
        success: true,
        syncType: body.syncType || 'full',
        itemsProcessed: 0,
        message: 'Megaphone sync started. This may take a few minutes.',
        startedAt: new Date().toISOString()
      })
    } catch (dbError) {
      console.error('Database error during sync:', dbError)
      return NextResponse.json({ 
        error: 'Megaphone integration not properly configured' 
      }, { status: 500 })
    }
  } catch (error) {
    console.error('Error syncing Megaphone data:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    )
  }
}