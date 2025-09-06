#!/usr/bin/env ts-node

/**
 * Sync Episode Inventory Script
 * 
 * This script retroactively populates inventory for all existing episodes
 * based on their length and admin-configured thresholds.
 */

import { PrismaClient } from '@prisma/client'
import { getOrganizationDb } from '../src/lib/db/multi-tenant-prisma'

const prisma = new PrismaClient()

interface SpotThreshold {
  minLength: number
  maxLength: number
  preRoll: number
  midRoll: number
  postRoll: number
}

const DEFAULT_THRESHOLDS: SpotThreshold[] = [
  { minLength: 0, maxLength: 15, preRoll: 1, midRoll: 0, postRoll: 0 },
  { minLength: 15, maxLength: 30, preRoll: 1, midRoll: 1, postRoll: 1 },
  { minLength: 30, maxLength: 60, preRoll: 1, midRoll: 2, postRoll: 1 },
  { minLength: 60, maxLength: 120, preRoll: 2, midRoll: 3, postRoll: 1 }
]

async function calculateSpotsForEpisode(
  episodeLength: number,
  showConfig?: any
): { preRollSlots: number; midRollSlots: number; postRollSlots: number } {
  // Use show-specific thresholds if available
  const thresholds = showConfig?.spotThresholds || DEFAULT_THRESHOLDS
  
  // Find matching threshold based on episode length
  const threshold = thresholds.find(
    (t: SpotThreshold) => episodeLength >= t.minLength && episodeLength <= t.maxLength
  )
  
  if (threshold) {
    return {
      preRollSlots: threshold.preRoll,
      midRollSlots: threshold.midRoll,
      postRollSlots: threshold.postRoll
    }
  }
  
  // Default fallback
  return {
    preRollSlots: 1,
    midRollSlots: 2,
    postRollSlots: 1
  }
}

async function syncInventoryForOrganization(orgSchemaName: string) {
  console.log(`\n📊 Syncing inventory for organization: ${orgSchemaName}`)
  
  const db = await getOrganizationDb(orgSchemaName)
  
  try {
    // Get all scheduled episodes that need inventory
    const episodes = await db.$queryRaw<any[]>`
      SELECT 
        e.id,
        e."showId",
        e.title,
        e."airDate",
        e.length,
        s.name as show_name,
        sc."spotThresholds"
      FROM "Episode" e
      JOIN "Show" s ON s.id = e."showId"
      LEFT JOIN "ShowConfiguration" sc ON sc."showId" = e."showId"
      WHERE e.status = 'scheduled'
        AND e."airDate" > CURRENT_DATE
    `
    
    console.log(`Found ${episodes.length} future episodes to process`)
    
    let created = 0
    let updated = 0
    let errors = 0
    
    for (const episode of episodes) {
      try {
        // Calculate spots based on episode length
        const spots = await calculateSpotsForEpisode(
          episode.length || 30,
          { spotThresholds: episode.spotThresholds }
        )
        
        // Check if inventory already exists
        const existingInventory = await db.$queryRaw<any[]>`
          SELECT id, "preRollReserved", "midRollReserved", "postRollReserved",
                 "preRollBooked", "midRollBooked", "postRollBooked"
          FROM "EpisodeInventory"
          WHERE "episodeId" = ${episode.id}
        `
        
        if (existingInventory.length === 0) {
          // Create new inventory record
          await db.$executeRaw`
            INSERT INTO "EpisodeInventory" (
              id, "episodeId", "showId", "airDate",
              "preRollSlots", "preRollAvailable", "preRollReserved", "preRollBooked",
              "midRollSlots", "midRollAvailable", "midRollReserved", "midRollBooked",
              "postRollSlots", "postRollAvailable", "postRollReserved", "postRollBooked",
              "calculatedFromLength", "spotConfiguration", "lastSyncedAt"
            ) VALUES (
              ${'einv_' + Math.random().toString(36).substr(2, 16)},
              ${episode.id},
              ${episode.showId},
              ${episode.airDate},
              ${spots.preRollSlots}, ${spots.preRollSlots}, 0, 0,
              ${spots.midRollSlots}, ${spots.midRollSlots}, 0, 0,
              ${spots.postRollSlots}, ${spots.postRollSlots}, 0, 0,
              true,
              ${JSON.stringify(spots)}::jsonb,
              CURRENT_TIMESTAMP
            )
          `
          created++
          console.log(`✅ Created inventory for episode: ${episode.title}`)
        } else {
          const inv = existingInventory[0]
          // Only update if no spots are reserved or booked
          if (
            inv.preRollReserved === 0 && inv.preRollBooked === 0 &&
            inv.midRollReserved === 0 && inv.midRollBooked === 0 &&
            inv.postRollReserved === 0 && inv.postRollBooked === 0
          ) {
            await db.$executeRaw`
              UPDATE "EpisodeInventory"
              SET "preRollSlots" = ${spots.preRollSlots},
                  "preRollAvailable" = ${spots.preRollSlots},
                  "midRollSlots" = ${spots.midRollSlots},
                  "midRollAvailable" = ${spots.midRollSlots},
                  "postRollSlots" = ${spots.postRollSlots},
                  "postRollAvailable" = ${spots.postRollSlots},
                  "calculatedFromLength" = true,
                  "spotConfiguration" = ${JSON.stringify(spots)}::jsonb,
                  "lastSyncedAt" = CURRENT_TIMESTAMP
              WHERE id = ${inv.id}
            `
            updated++
            console.log(`🔄 Updated inventory for episode: ${episode.title}`)
          } else {
            console.log(`⏭️  Skipped episode with existing bookings: ${episode.title}`)
          }
        }
      } catch (err) {
        errors++
        console.error(`❌ Error processing episode ${episode.id}:`, err)
      }
    }
    
    console.log(`\n📊 Summary for ${orgSchemaName}:`)
    console.log(`  - Created: ${created} inventory records`)
    console.log(`  - Updated: ${updated} inventory records`)
    console.log(`  - Errors: ${errors}`)
    
  } catch (error) {
    console.error(`Error syncing inventory for ${orgSchemaName}:`, error)
  } finally {
    await db.$disconnect()
  }
}

async function main() {
  console.log('🚀 Starting Episode Inventory Sync')
  console.log('================================')
  
  try {
    // Get all organizations
    const organizations = await prisma.organization.findMany({
      where: { active: true },
      select: { id: true, name: true, schemaName: true }
    })
    
    console.log(`Found ${organizations.length} active organizations`)
    
    // Process each organization
    for (const org of organizations) {
      await syncInventoryForOrganization(org.schemaName)
    }
    
    console.log('\n✅ Inventory sync completed successfully!')
    
  } catch (error) {
    console.error('❌ Fatal error during sync:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the sync
main()
  .catch(console.error)
  .finally(() => process.exit(0))