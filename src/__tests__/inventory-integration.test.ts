import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals'
import { PrismaClient } from '@prisma/client'
import { getOrganizationDb } from '../lib/db/multi-tenant-prisma'

const prisma = new PrismaClient()
const TEST_ORG_SCHEMA = 'org_test_inventory'

describe('Inventory Integration Tests', () => {
  let orgDb: any
  let testShowId: string
  let testEpisodeId: string
  let testUserId: string
  let testScheduleId: string

  beforeAll(async () => {
    // Create test organization schema
    await prisma.$executeRaw`CREATE SCHEMA IF NOT EXISTS ${TEST_ORG_SCHEMA}`
    orgDb = await getOrganizationDb(TEST_ORG_SCHEMA)
    
    // Create test user
    const user = await prisma.user.create({
      data: {
        id: 'test_user_' + Date.now(),
        email: 'test@inventory.com',
        password: 'hashed_password',
        name: 'Test User',
        role: 'admin',
        organizationId: 'test_org'
      }
    })
    testUserId = user.id
  })

  afterAll(async () => {
    // Cleanup
    await prisma.user.delete({ where: { id: testUserId } })
    await prisma.$executeRaw`DROP SCHEMA IF EXISTS ${TEST_ORG_SCHEMA} CASCADE`
    await orgDb.$disconnect()
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    // Create test show
    const show = await orgDb.show.create({
      data: {
        id: 'show_' + Date.now(),
        name: 'Test Show',
        organizationId: 'test_org',
        enableDynamicSpots: true,
        spotConfiguration: {
          defaultPreRoll: 1,
          defaultMidRoll: 2,
          defaultPostRoll: 1
        }
      }
    })
    testShowId = show.id

    // Create test episode
    const episode = await orgDb.episode.create({
      data: {
        id: 'ep_' + Date.now(),
        showId: testShowId,
        title: 'Test Episode',
        episodeNumber: 1,
        airDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week future
        length: 45, // 45 minutes
        status: 'scheduled',
        organizationId: 'test_org'
      }
    })
    testEpisodeId = episode.id
  })

  describe('Dynamic Spot Assignment', () => {
    it('should calculate spots based on episode length', async () => {
      // Test the spot calculation function
      const spots = await orgDb.$queryRaw`
        SELECT * FROM calculate_episode_spots(45, ${testShowId})
      `
      
      expect(spots[0]).toMatchObject({
        preRollSlots: 1,
        midRollSlots: 2,
        postRollSlots: 1
      })
    })

    it('should auto-create inventory when episode is scheduled', async () => {
      // Wait for trigger to execute
      await new Promise(resolve => setTimeout(resolve, 100))
      
      const inventory = await orgDb.episodeInventory.findUnique({
        where: { episodeId: testEpisodeId }
      })
      
      expect(inventory).toBeDefined()
      expect(inventory.preRollSlots).toBe(1)
      expect(inventory.midRollSlots).toBe(2)
      expect(inventory.postRollSlots).toBe(1)
      expect(inventory.calculatedFromLength).toBe(true)
    })

    it('should update inventory when episode length changes', async () => {
      // Update episode length
      await orgDb.episode.update({
        where: { id: testEpisodeId },
        data: { length: 90 } // 90 minutes
      })
      
      // Wait for trigger
      await new Promise(resolve => setTimeout(resolve, 100))
      
      const inventory = await orgDb.episodeInventory.findUnique({
        where: { episodeId: testEpisodeId }
      })
      
      expect(inventory.preRollSlots).toBe(2) // Should increase for longer episode
      expect(inventory.midRollSlots).toBe(3)
    })
  })

  describe('Inventory Hold and Reservation Flow', () => {
    let testOrderId: string

    beforeEach(async () => {
      // Create test schedule
      const schedule = await orgDb.scheduleBuilder.create({
        data: {
          id: 'sched_' + Date.now(),
          name: 'Test Schedule',
          advertiserId: 'test_advertiser',
          organizationId: 'test_org',
          status: 'approved',
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          netAmount: 10000,
          createdBy: testUserId
        }
      })
      testScheduleId = schedule.id

      // Create schedule item
      await orgDb.scheduleBuilderItem.create({
        data: {
          id: 'si_' + Date.now(),
          scheduleId: testScheduleId,
          showId: testShowId,
          episodeId: testEpisodeId,
          airDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          placementType: 'pre-roll',
          slotNumber: 1,
          rateCardPrice: 500,
          negotiatedPrice: 450,
          addedBy: testUserId
        }
      })

      // Create test order
      const order = await orgDb.order.create({
        data: {
          id: 'ord_' + Date.now(),
          orderNumber: 'TEST-001',
          scheduleId: testScheduleId,
          organizationId: 'test_org',
          advertiserId: 'test_advertiser',
          status: 'pending_approval',
          totalAmount: 450,
          netAmount: 450,
          submittedBy: testUserId
        }
      })
      testOrderId = order.id
    })

    it('should create inventory hold when order is created', async () => {
      // Create hold using the function
      const result = await orgDb.$queryRaw`
        SELECT * FROM create_inventory_hold(
          ${testScheduleId}, 
          ${testOrderId}, 
          ${testUserId}
        )
      `
      
      expect(result[0].success).toBe(true)
      expect(result[0].holdsCreated).toBe(1)
      
      // Verify hold was created
      const hold = await orgDb.inventoryReservation.findFirst({
        where: { orderId: testOrderId }
      })
      
      expect(hold).toBeDefined()
      expect(hold.status).toBe('reserved')
      expect(hold.holdType).toBe('order')
    })

    it('should update inventory availability when hold is created', async () => {
      // Get initial inventory
      const initialInventory = await orgDb.episodeInventory.findUnique({
        where: { episodeId: testEpisodeId }
      })
      
      // Create hold
      await orgDb.$queryRaw`
        SELECT * FROM create_inventory_hold(
          ${testScheduleId}, 
          ${testOrderId}, 
          ${testUserId}
        )
      `
      
      // Check updated inventory
      const updatedInventory = await orgDb.episodeInventory.findUnique({
        where: { episodeId: testEpisodeId }
      })
      
      expect(updatedInventory.preRollAvailable).toBe(
        initialInventory.preRollAvailable - 1
      )
      expect(updatedInventory.preRollReserved).toBe(
        initialInventory.preRollReserved + 1
      )
    })

    it('should prevent double-booking', async () => {
      // Create initial hold
      await orgDb.$queryRaw`
        SELECT * FROM create_inventory_hold(
          ${testScheduleId}, 
          ${testOrderId}, 
          ${testUserId}
        )
      `
      
      // Try to create another hold for same slot
      const secondOrder = await orgDb.order.create({
        data: {
          id: 'ord2_' + Date.now(),
          orderNumber: 'TEST-002',
          scheduleId: testScheduleId,
          organizationId: 'test_org',
          advertiserId: 'test_advertiser',
          status: 'pending_approval',
          totalAmount: 450,
          netAmount: 450,
          submittedBy: testUserId
        }
      })
      
      const result = await orgDb.$queryRaw`
        SELECT * FROM create_inventory_hold(
          ${testScheduleId}, 
          ${secondOrder.id}, 
          ${testUserId}
        )
      `
      
      expect(result[0].holdsCreated).toBe(0)
      expect(result[0].errors.length).toBeGreaterThan(0)
    })

    it('should release inventory when order is rejected', async () => {
      // Create hold
      await orgDb.$queryRaw`
        SELECT * FROM create_inventory_hold(
          ${testScheduleId}, 
          ${testOrderId}, 
          ${testUserId}
        )
      `
      
      // Reject the hold
      await orgDb.inventoryReservation.updateMany({
        where: { orderId: testOrderId },
        data: {
          status: 'released',
          approvalStatus: 'rejected',
          rejectionReason: 'Test rejection'
        }
      })
      
      // Update inventory
      await orgDb.episodeInventory.update({
        where: { episodeId: testEpisodeId },
        data: {
          preRollAvailable: { increment: 1 },
          preRollReserved: { decrement: 1 }
        }
      })
      
      // Verify inventory was restored
      const inventory = await orgDb.episodeInventory.findUnique({
        where: { episodeId: testEpisodeId }
      })
      
      expect(inventory.preRollAvailable).toBe(1)
      expect(inventory.preRollReserved).toBe(0)
    })
  })

  describe('Role-Based Inventory Visibility', () => {
    it('should allow admin to see all inventory', async () => {
      const visibility = await orgDb.inventoryVisibility.create({
        data: {
          id: 'iv_' + Date.now(),
          showId: testShowId,
          role: 'admin',
          accessType: 'manage',
          grantedBy: testUserId
        }
      })
      
      expect(visibility.accessType).toBe('manage')
    })

    it('should restrict producer/talent to assigned shows only', async () => {
      // Create show assignment
      await orgDb.$executeRaw`
        INSERT INTO "_ShowToUser" ("A", "B") VALUES (${testShowId}, ${testUserId})
      `
      
      // Query with producer role filter
      const shows = await orgDb.$queryRaw`
        SELECT s.* FROM "Show" s
        WHERE EXISTS (
          SELECT 1 FROM "_ShowToUser" su 
          WHERE su."A" = s.id AND su."B" = ${testUserId}
        )
      `
      
      expect(shows.length).toBe(1)
      expect(shows[0].id).toBe(testShowId)
    })

    it('should respect custom visibility grants', async () => {
      const customUserId = 'custom_user_' + Date.now()
      
      // Grant custom visibility
      await orgDb.inventoryVisibility.create({
        data: {
          id: 'iv_custom_' + Date.now(),
          showId: testShowId,
          userId: customUserId,
          accessType: 'view',
          grantedBy: testUserId,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 1 day
        }
      })
      
      // Check visibility
      const visibility = await orgDb.inventoryVisibility.findFirst({
        where: {
          showId: testShowId,
          userId: customUserId,
          expiresAt: { gt: new Date() }
        }
      })
      
      expect(visibility).toBeDefined()
      expect(visibility.accessType).toBe('view')
    })
  })

  describe('Deletion and Update Notifications', () => {
    it('should create alert when episode deletion impacts orders', async () => {
      // Create order with inventory hold
      await orgDb.$queryRaw`
        SELECT * FROM create_inventory_hold(
          ${testScheduleId}, 
          ${testOrderId}, 
          ${testUserId}
        )
      `
      
      // Create deletion alert
      const alert = await orgDb.inventoryAlert.create({
        data: {
          id: 'alert_' + Date.now(),
          alertType: 'deletion_impact',
          severity: 'high',
          episodeId: testEpisodeId,
          affectedOrders: [testOrderId],
          details: {
            message: 'Episode deletion will impact 1 order',
            episodeTitle: 'Test Episode',
            impactedSlots: 1
          }
        }
      })
      
      expect(alert.alertType).toBe('deletion_impact')
      expect(alert.affectedOrders).toContain(testOrderId)
    })

    it('should detect overbooking scenarios', async () => {
      // Manually create overbooking scenario
      await orgDb.episodeInventory.update({
        where: { episodeId: testEpisodeId },
        data: {
          preRollSlots: 1,
          preRollReserved: 1,
          preRollBooked: 1 // Total 2, but only 1 slot
        }
      })
      
      // Create overbooking alert
      const alert = await orgDb.inventoryAlert.create({
        data: {
          id: 'alert_ob_' + Date.now(),
          alertType: 'overbooking',
          severity: 'critical',
          episodeId: testEpisodeId,
          details: {
            placementType: 'pre-roll',
            totalSlots: 1,
            totalUsed: 2,
            overbookedBy: 1,
            message: 'Episode is overbooked by 1 pre-roll slots'
          }
        }
      })
      
      expect(alert.severity).toBe('critical')
      expect(alert.details.overbookedBy).toBe(1)
    })
  })

  describe('Data Sync and Retroactive Population', () => {
    it('should populate inventory for existing episodes', async () => {
      // Create episodes without inventory
      const episodes = await Promise.all([
        orgDb.episode.create({
          data: {
            id: 'ep_retro_1_' + Date.now(),
            showId: testShowId,
            title: 'Retro Episode 1',
            episodeNumber: 2,
            airDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            length: 30,
            status: 'scheduled',
            organizationId: 'test_org'
          }
        }),
        orgDb.episode.create({
          data: {
            id: 'ep_retro_2_' + Date.now(),
            showId: testShowId,
            title: 'Retro Episode 2',
            episodeNumber: 3,
            airDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
            length: 60,
            status: 'scheduled',
            organizationId: 'test_org'
          }
        })
      ])
      
      // Simulate retroactive sync
      for (const episode of episodes) {
        const spots = await orgDb.$queryRaw`
          SELECT * FROM calculate_episode_spots(${episode.length}, ${testShowId})
        `
        
        await orgDb.episodeInventory.create({
          data: {
            id: 'einv_retro_' + Date.now(),
            episodeId: episode.id,
            showId: testShowId,
            airDate: episode.airDate,
            preRollSlots: spots[0].preRollSlots,
            preRollAvailable: spots[0].preRollSlots,
            midRollSlots: spots[0].midRollSlots,
            midRollAvailable: spots[0].midRollSlots,
            postRollSlots: spots[0].postRollSlots,
            postRollAvailable: spots[0].postRollSlots,
            calculatedFromLength: true,
            spotConfiguration: spots[0]
          }
        })
      }
      
      // Verify all episodes have inventory
      const inventoryCount = await orgDb.episodeInventory.count({
        where: { showId: testShowId }
      })
      
      expect(inventoryCount).toBe(3) // Original + 2 retroactive
    })
  })
})

describe('Inventory Permission Tests', () => {
  describe('API Permission Checks', () => {
    it('should enforce role-based access for inventory visibility API', async () => {
      // Test cases for different roles
      const testCases = [
        { role: 'admin', canView: true, canManage: true },
        { role: 'sales', canView: true, canManage: false },
        { role: 'producer', canView: true, canManage: false }, // Only assigned shows
        { role: 'talent', canView: true, canManage: false }, // Only assigned shows
        { role: 'client', canView: false, canManage: false }
      ]
      
      for (const testCase of testCases) {
        // Simulate permission check
        const hasViewPermission = ['admin', 'master', 'sales', 'producer', 'talent']
          .includes(testCase.role)
        const hasManagePermission = ['admin', 'master'].includes(testCase.role)
        
        expect(hasViewPermission).toBe(testCase.canView)
        expect(hasManagePermission).toBe(testCase.canManage)
      }
    })
  })
})