import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { safeQuerySchema, getSchemaClient } from '@/lib/db/schema-db'
import { randomUUID } from 'crypto'

// Force dynamic
export const dynamic = 'force-dynamic'

interface ReleaseReservationsRequest {
  reservationIds?: string[]
  episodeInventoryIds?: string[]
  releaseStaleOlderThanDays?: number
  releaseInvalidLinks?: boolean
  releaseAllOrphaned?: boolean
  dryRun: boolean
}

interface ReleaseDiff {
  type: 'reservation' | 'episode_inventory'
  id: string
  episodeId?: string
  showId?: string
  field: string
  before: any
  after: any
  reason: string
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication and authorization
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin or master can release reservations
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const orgSlug = session.organizationSlug
    const userId = session.userId

    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization context not found' }, { status: 400 })
    }

    const body: ReleaseReservationsRequest = await request.json()
    const { 
      reservationIds, 
      episodeInventoryIds,
      releaseStaleOlderThanDays,
      releaseInvalidLinks,
      releaseAllOrphaned,
      dryRun = true 
    } = body

    console.log(`[Release Reservations API] Starting ${dryRun ? 'DRY RUN' : 'RELEASE'} for org: ${orgSlug}`)
    console.log('[Release Reservations API] Request:', {
      reservationIds: reservationIds?.length || 0,
      episodeInventoryIds: episodeInventoryIds?.length || 0,
      releaseStaleOlderThanDays,
      releaseInvalidLinks,
      releaseAllOrphaned,
      dryRun
    })

    const diffs: ReleaseDiff[] = []
    let affectedCount = 0

    // Get schema client for transaction support
    const { client, release } = await getSchemaClient(orgSlug)

    try {
      // Start transaction if not dry run
      if (!dryRun) {
        await client.query('BEGIN')
      }

      // 1. Release specific reservations from Reservation table
      if (reservationIds && reservationIds.length > 0) {
        const placeholders = reservationIds.map((_, i) => `$${i + 1}`).join(', ')
        const query = `
          SELECT id, "showId", "episodeId", "campaignId", locked, "expiresAt"
          FROM "Reservation"
          WHERE id IN (${placeholders})
        `
        
        const result = await client.query(query, reservationIds)
        
        for (const row of result.rows) {
          if (row.locked) {
            diffs.push({
              type: 'reservation',
              id: row.id,
              showId: row.showId,
              episodeId: row.episodeId,
              field: 'locked',
              before: true,
              after: false,
              reason: 'manual_release'
            })
            affectedCount++

            if (!dryRun) {
              await client.query(
                'UPDATE "Reservation" SET locked = false, "updatedAt" = NOW() WHERE id = $1',
                [row.id]
              )
            }
          }
        }
      }

      // 2. Release specific episode inventory reservations
      if (episodeInventoryIds && episodeInventoryIds.length > 0) {
        const placeholders = episodeInventoryIds.map((_, i) => `$${i + 1}`).join(', ')
        const query = `
          SELECT id, "episodeId", "showId", "preRollReserved", "midRollReserved", "postRollReserved"
          FROM "EpisodeInventory"
          WHERE id IN (${placeholders})
        `
        
        const result = await client.query(query, episodeInventoryIds)
        
        for (const row of result.rows) {
          if (row.preRollReserved > 0) {
            diffs.push({
              type: 'episode_inventory',
              id: row.id,
              episodeId: row.episodeId,
              showId: row.showId,
              field: 'preRollReserved',
              before: row.preRollReserved,
              after: 0,
              reason: 'manual_release'
            })
            affectedCount++
          }
          if (row.midRollReserved > 0) {
            diffs.push({
              type: 'episode_inventory',
              id: row.id,
              episodeId: row.episodeId,
              showId: row.showId,
              field: 'midRollReserved',
              before: row.midRollReserved,
              after: 0,
              reason: 'manual_release'
            })
            affectedCount++
          }
          if (row.postRollReserved > 0) {
            diffs.push({
              type: 'episode_inventory',
              id: row.id,
              episodeId: row.episodeId,
              showId: row.showId,
              field: 'postRollReserved',
              before: row.postRollReserved,
              after: 0,
              reason: 'manual_release'
            })
            affectedCount++
          }

          if (!dryRun && (row.preRollReserved > 0 || row.midRollReserved > 0 || row.postRollReserved > 0)) {
            await client.query(
              `UPDATE "EpisodeInventory" 
               SET "preRollReserved" = 0, 
                   "midRollReserved" = 0, 
                   "postRollReserved" = 0,
                   "preRollAvailable" = "preRollSlots",
                   "midRollAvailable" = "midRollSlots", 
                   "postRollAvailable" = "postRollSlots",
                   "holdExpiresAt" = NULL,
                   "updatedAt" = NOW()
               WHERE id = $1`,
              [row.id]
            )
          }
        }
      }

      // 3. Release all orphaned reservations (no associated campaign)
      if (releaseAllOrphaned) {
        // Release from EpisodeInventory where no campaigns exist
        const orphanedQuery = `
          SELECT 
            ei.id, 
            ei."episodeId", 
            ei."showId",
            ei."preRollReserved", 
            ei."midRollReserved", 
            ei."postRollReserved"
          FROM "EpisodeInventory" ei
          WHERE (ei."preRollReserved" > 0 OR ei."midRollReserved" > 0 OR ei."postRollReserved" > 0)
            AND NOT EXISTS(SELECT 1 FROM "Campaign" c LIMIT 1)
        `
        
        const orphanedResult = await client.query(orphanedQuery)
        
        for (const row of orphanedResult.rows) {
          if (row.preRollReserved > 0) {
            diffs.push({
              type: 'episode_inventory',
              id: row.id,
              episodeId: row.episodeId,
              showId: row.showId,
              field: 'preRollReserved',
              before: row.preRollReserved,
              after: 0,
              reason: 'no_campaigns_exist'
            })
            affectedCount++
          }
          if (row.midRollReserved > 0) {
            diffs.push({
              type: 'episode_inventory',
              id: row.id,
              episodeId: row.episodeId,
              showId: row.showId,
              field: 'midRollReserved',
              before: row.midRollReserved,
              after: 0,
              reason: 'no_campaigns_exist'
            })
            affectedCount++
          }
          if (row.postRollReserved > 0) {
            diffs.push({
              type: 'episode_inventory',
              id: row.id,
              episodeId: row.episodeId,
              showId: row.showId,
              field: 'postRollReserved',
              before: row.postRollReserved,
              after: 0,
              reason: 'no_campaigns_exist'
            })
            affectedCount++
          }

          if (!dryRun) {
            await client.query(
              `UPDATE "EpisodeInventory" 
               SET "preRollReserved" = 0, 
                   "midRollReserved" = 0, 
                   "postRollReserved" = 0,
                   "preRollAvailable" = "preRollSlots",
                   "midRollAvailable" = "midRollSlots",
                   "postRollAvailable" = "postRollSlots",
                   "holdExpiresAt" = NULL,
                   "updatedAt" = NOW()
               WHERE id = $1`,
              [row.id]
            )
          }
        }
      }

      // 4. Release stale reservations (expired holds)
      if (releaseStaleOlderThanDays !== undefined) {
        const staleDate = new Date()
        staleDate.setDate(staleDate.getDate() - releaseStaleOlderThanDays)
        
        // Check Reservation table
        const staleReservationsQuery = `
          SELECT id, "showId", "episodeId", "expiresAt"
          FROM "Reservation"
          WHERE locked = true AND "expiresAt" < $1
        `
        
        const staleReservations = await client.query(staleReservationsQuery, [staleDate])
        
        for (const row of staleReservations.rows) {
          diffs.push({
            type: 'reservation',
            id: row.id,
            showId: row.showId,
            episodeId: row.episodeId,
            field: 'locked',
            before: true,
            after: false,
            reason: `expired_${releaseStaleOlderThanDays}_days_ago`
          })
          affectedCount++

          if (!dryRun) {
            await client.query(
              'UPDATE "Reservation" SET locked = false, "updatedAt" = NOW() WHERE id = $1',
              [row.id]
            )
          }
        }
        
        // Check EpisodeInventory table
        const staleInventoryQuery = `
          SELECT 
            id, 
            "episodeId", 
            "showId",
            "preRollReserved", 
            "midRollReserved", 
            "postRollReserved",
            "holdExpiresAt"
          FROM "EpisodeInventory"
          WHERE (ei."preRollReserved" > 0 OR ei."midRollReserved" > 0 OR ei."postRollReserved" > 0)
            AND "holdExpiresAt" < $1
        `
        
        const staleInventory = await client.query(staleInventoryQuery, [staleDate])
        
        for (const row of staleInventory.rows) {
          if (row.preRollReserved > 0) {
            diffs.push({
              type: 'episode_inventory',
              id: row.id,
              episodeId: row.episodeId,
              showId: row.showId,
              field: 'preRollReserved',
              before: row.preRollReserved,
              after: 0,
              reason: `expired_hold`
            })
            affectedCount++
          }
          // Similar for mid and post roll...
          
          if (!dryRun) {
            await client.query(
              `UPDATE "EpisodeInventory" 
               SET "preRollReserved" = 0, 
                   "midRollReserved" = 0, 
                   "postRollReserved" = 0,
                   "preRollAvailable" = "preRollSlots",
                   "midRollAvailable" = "midRollSlots",
                   "postRollAvailable" = "postRollSlots",
                   "holdExpiresAt" = NULL,
                   "updatedAt" = NOW()
               WHERE id = $1`,
              [row.id]
            )
          }
        }
      }

      // 5. Create audit log entry if not dry run
      if (!dryRun && affectedCount > 0) {
        const auditEntry = {
          id: randomUUID(),
          action: 'release_reservations',
          actorId: userId,
          organizationId: session.organizationId,
          payloadJson: JSON.stringify({
            affectedCount,
            diffs: diffs.slice(0, 100), // Limit stored diffs to prevent huge logs
            parameters: {
              reservationIds: reservationIds?.length,
              episodeInventoryIds: episodeInventoryIds?.length,
              releaseStaleOlderThanDays,
              releaseInvalidLinks,
              releaseAllOrphaned
            }
          }),
          createdAt: new Date()
        }
        
        // Check if admin_audit_log table exists, if not create it
        const tableExists = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = current_schema() 
            AND table_name = 'admin_audit_log'
          )
        `)
        
        if (!tableExists.rows[0].exists) {
          await client.query(`
            CREATE TABLE IF NOT EXISTS admin_audit_log (
              id TEXT PRIMARY KEY,
              action TEXT NOT NULL,
              "actorId" TEXT NOT NULL,
              "organizationId" TEXT NOT NULL,
              "payloadJson" JSONB,
              "createdAt" TIMESTAMP DEFAULT NOW()
            )
          `)
        }
        
        await client.query(
          `INSERT INTO admin_audit_log (id, action, "actorId", "organizationId", "payloadJson", "createdAt")
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [auditEntry.id, auditEntry.action, auditEntry.actorId, auditEntry.organizationId, auditEntry.payloadJson, auditEntry.createdAt]
        )
      }

      // Commit transaction if not dry run
      if (!dryRun) {
        await client.query('COMMIT')
        console.log(`[Release Reservations API] Released ${affectedCount} reservations`)
      } else {
        console.log(`[Release Reservations API] DRY RUN would release ${affectedCount} reservations`)
      }

      return NextResponse.json({
        dryRun,
        affectedCount,
        diffs: diffs.slice(0, 1000), // Limit response size
        summary: {
          reservationTableReleased: diffs.filter(d => d.type === 'reservation').length,
          episodeInventoryReleased: diffs.filter(d => d.type === 'episode_inventory').length,
          byReason: diffs.reduce((acc, d) => {
            acc[d.reason] = (acc[d.reason] || 0) + 1
            return acc
          }, {} as Record<string, number>)
        }
      })
      
    } catch (error) {
      // Rollback on error if not dry run
      if (!dryRun) {
        await client.query('ROLLBACK')
      }
      throw error
    } finally {
      // Release the client back to the pool
      release()
    }
    
  } catch (error) {
    console.error('[Release Reservations API] Error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to release reservations',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}