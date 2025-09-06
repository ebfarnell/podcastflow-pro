import { PrismaClient } from '@prisma/client'
import prisma from '@/lib/db/prisma'

export interface CreateReservationData {
  campaignId?: string
  advertiserId: string
  agencyId?: string
  holdDuration?: number // hours, defaults to 48
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  notes?: string
  source?: string
  items: CreateReservationItemData[]
}

export interface CreateReservationItemData {
  showId: string
  episodeId?: string
  date: Date
  placementType: string
  spotNumber?: number
  length: number
  rate: number
  notes?: string
}

export interface UpdateReservationData {
  campaignId?: string
  holdDuration?: number
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  notes?: string
}

export interface ReservationFilters {
  status?: string[]
  advertiserId?: string
  campaignId?: string
  agencyId?: string
  createdBy?: string
  expiresAfter?: Date
  expiresBefore?: Date
  createdAfter?: Date
  createdBefore?: Date
  priority?: string[]
}

class ReservationService {
  /**
   * Create a new reservation with inventory hold
   */
  async createReservation(
    organizationId: string,
    userId: string,
    data: CreateReservationData
  ) {
    return await prisma.$transaction(async (tx) => {
      // Validate availability of all requested slots
      const availabilityChecks = await Promise.all(
        data.items.map(async (item) => {
          const inventory = await tx.inventory.findFirst({
            where: {
              organizationId,
              showId: item.showId,
              date: {
                gte: new Date(item.date.toDateString()),
                lt: new Date(new Date(item.date.toDateString()).getTime() + 24 * 60 * 60 * 1000)
              },
              placementType: item.placementType
            }
          })

          if (!inventory) {
            throw new Error(`No inventory found for show ${item.showId} on ${item.date.toDateString()} for ${item.placementType}`)
          }

          if (inventory.availableSpots < 1) {
            throw new Error(`No available spots for show ${item.showId} on ${item.date.toDateString()} for ${item.placementType}`)
          }

          return { item, inventory }
        })
      )

      // Calculate total amounts
      const totalAmount = data.items.reduce((sum, item) => sum + item.rate, 0)
      const estimatedRevenue = totalAmount // Can be adjusted with markup/fees

      // Calculate expiration time
      const holdDuration = data.holdDuration || 48
      const expiresAt = new Date(Date.now() + holdDuration * 60 * 60 * 1000)

      // Create the reservation
      const reservation = await tx.reservation.create({
        data: {
          organizationId,
          campaignId: data.campaignId,
          advertiserId: data.advertiserId,
          agencyId: data.agencyId,
          status: 'held',
          holdDuration,
          expiresAt,
          totalAmount,
          estimatedRevenue,
          createdBy: userId,
          notes: data.notes,
          priority: data.priority || 'normal',
          source: data.source || 'web'
        }
      })

      // Create reservation items
      const reservationItems = await Promise.all(
        availabilityChecks.map(async ({ item, inventory }) => {
          return tx.reservationItem.create({
            data: {
              reservationId: reservation.id,
              showId: item.showId,
              episodeId: item.episodeId,
              date: item.date,
              placementType: item.placementType,
              spotNumber: item.spotNumber,
              length: item.length,
              rate: item.rate,
              status: 'held',
              inventoryId: inventory.id,
              notes: item.notes
            }
          })
        })
      )

      // Update inventory to reserve spots
      await Promise.all(
        availabilityChecks.map(async ({ inventory }) => {
          return tx.inventory.update({
            where: { id: inventory.id },
            data: {
              availableSpots: { decrement: 1 },
              reservedSpots: { increment: 1 }
            }
          })
        })
      )

      // Create initial status history entry
      await tx.reservationStatusHistory.create({
        data: {
          reservationId: reservation.id,
          toStatus: 'held',
          reason: 'Reservation created',
          changedBy: userId
        }
      })

      // Return full reservation with items
      return this.getReservationById(reservation.id, organizationId)
    })
  }

  /**
   * Get reservation by ID with full details
   */
  async getReservationById(reservationId: string, organizationId: string) {
    const reservation = await prisma.reservation.findFirst({
      where: {
        id: reservationId,
        organizationId
      },
      include: {
        organization: { select: { name: true } },
        campaign: { select: { name: true, status: true } },
        advertiser: { select: { name: true, email: true } },
        agency: { select: { name: true, email: true } },
        creator: { select: { name: true, email: true, role: true } },
        confirmer: { select: { name: true, email: true, role: true } },
        canceller: { select: { name: true, email: true, role: true } },
        items: {
          include: {
            show: { select: { name: true, isActive: true } },
            episode: { select: { title: true, episodeNumber: true } }
          },
          orderBy: { date: 'asc' }
        },
        statusHistory: {
          include: {
            changer: { select: { name: true, email: true, role: true } }
          },
          orderBy: { changedAt: 'desc' }
        }
      }
    })

    if (!reservation) {
      throw new Error('Reservation not found')
    }

    return reservation
  }

  /**
   * List reservations with filtering and pagination
   */
  async listReservations(
    organizationId: string,
    filters: ReservationFilters = {},
    page: number = 1,
    limit: number = 20
  ) {
    const where: any = {
      organizationId
    }

    // Apply filters
    if (filters.status?.length) {
      where.status = { in: filters.status }
    }

    if (filters.advertiserId) {
      where.advertiserId = filters.advertiserId
    }

    if (filters.campaignId) {
      where.campaignId = filters.campaignId
    }

    if (filters.agencyId) {
      where.agencyId = filters.agencyId
    }

    if (filters.createdBy) {
      where.createdBy = filters.createdBy
    }

    if (filters.priority?.length) {
      where.priority = { in: filters.priority }
    }

    if (filters.expiresAfter || filters.expiresBefore) {
      where.expiresAt = {}
      if (filters.expiresAfter) where.expiresAt.gte = filters.expiresAfter
      if (filters.expiresBefore) where.expiresAt.lte = filters.expiresBefore
    }

    if (filters.createdAfter || filters.createdBefore) {
      where.createdAt = {}
      if (filters.createdAfter) where.createdAt.gte = filters.createdAfter
      if (filters.createdBefore) where.createdAt.lte = filters.createdBefore
    }

    const [reservations, total] = await Promise.all([
      prisma.reservation.findMany({
        where,
        include: {
          advertiser: { select: { name: true } },
          agency: { select: { name: true } },
          campaign: { select: { name: true, status: true } },
          creator: { select: { name: true, email: true } },
          items: {
            include: {
              show: { select: { name: true } }
            }
          },
          _count: {
            select: { items: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.reservation.count({ where })
    ])

    return {
      reservations,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }
  }

  /**
   * Update reservation details
   */
  async updateReservation(
    reservationId: string,
    organizationId: string,
    userId: string,
    data: UpdateReservationData
  ) {
    const reservation = await prisma.reservation.findFirst({
      where: { id: reservationId, organizationId }
    })

    if (!reservation) {
      throw new Error('Reservation not found')
    }

    if (reservation.status !== 'held') {
      throw new Error('Only held reservations can be updated')
    }

    const updates: any = {
      updatedAt: new Date()
    }

    if (data.campaignId !== undefined) updates.campaignId = data.campaignId
    if (data.priority !== undefined) updates.priority = data.priority
    if (data.notes !== undefined) updates.notes = data.notes

    // Handle hold duration changes
    if (data.holdDuration !== undefined && data.holdDuration !== reservation.holdDuration) {
      const newExpiresAt = new Date(reservation.createdAt.getTime() + data.holdDuration * 60 * 60 * 1000)
      updates.holdDuration = data.holdDuration
      updates.expiresAt = newExpiresAt
    }

    const updatedReservation = await prisma.reservation.update({
      where: { id: reservationId },
      data: updates
    })

    return this.getReservationById(reservationId, organizationId)
  }

  /**
   * Confirm reservation and convert to order
   */
  async confirmReservation(
    reservationId: string,
    organizationId: string,
    userId: string,
    orderData?: { notes?: string }
  ) {
    return await prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findFirst({
        where: { id: reservationId, organizationId },
        include: {
          items: true,
          advertiser: true,
          agency: true,
          campaign: true
        }
      })

      if (!reservation) {
        throw new Error('Reservation not found')
      }

      if (reservation.status !== 'held') {
        throw new Error('Only held reservations can be confirmed')
      }

      if (reservation.expiresAt < new Date()) {
        throw new Error('Reservation has expired')
      }

      // Generate order number
      const orderCount = await tx.order.count()
      const orderNumber = `ORD-${new Date().getFullYear()}-${String(orderCount + 1).padStart(6, '0')}`

      // Create order
      const order = await tx.order.create({
        data: {
          orderNumber,
          campaignId: reservation.campaignId!,
          organizationId,
          advertiserId: reservation.advertiserId,
          agencyId: reservation.agencyId,
          status: 'draft',
          totalAmount: reservation.totalAmount,
          discountAmount: 0,
          netAmount: reservation.totalAmount,
          createdBy: userId,
          notes: orderData?.notes || reservation.notes
        }
      })

      // Create order items from reservation items
      await Promise.all(
        reservation.items.map(async (item) => {
          return tx.orderItem.create({
            data: {
              orderId: order.id,
              showId: item.showId,
              episodeId: item.episodeId,
              airDate: item.date,
              placementType: item.placementType,
              length: item.length,
              rate: item.rate,
              totalCost: item.rate,
              notes: item.notes,
              adApprovalStatus: 'pending'
            }
          })
        })
      )

      // Update inventory: move from reserved to booked
      await Promise.all(
        reservation.items.map(async (item) => {
          if (item.inventoryId) {
            return tx.inventory.update({
              where: { id: item.inventoryId },
              data: {
                reservedSpots: { decrement: 1 },
                bookedSpots: { increment: 1 }
              }
            })
          }
        })
      )

      // Update reservation status
      await tx.reservation.update({
        where: { id: reservationId },
        data: {
          status: 'confirmed',
          confirmedAt: new Date(),
          confirmedBy: userId
        }
      })

      // Update reservation items status
      await tx.reservationItem.updateMany({
        where: { reservationId },
        data: { status: 'confirmed' }
      })

      // Add status history
      await tx.reservationStatusHistory.create({
        data: {
          reservationId,
          fromStatus: 'held',
          toStatus: 'confirmed',
          reason: 'Reservation confirmed and converted to order',
          notes: `Order created: ${orderNumber}`,
          changedBy: userId
        }
      })

      return { reservation: await this.getReservationById(reservationId, organizationId), order }
    })
  }

  /**
   * Cancel reservation and release inventory
   */
  async cancelReservation(
    reservationId: string,
    organizationId: string,
    userId: string,
    reason?: string
  ) {
    return await prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findFirst({
        where: { id: reservationId, organizationId },
        include: { items: true }
      })

      if (!reservation) {
        throw new Error('Reservation not found')
      }

      if (reservation.status !== 'held') {
        throw new Error('Only held reservations can be cancelled')
      }

      // Release inventory
      await Promise.all(
        reservation.items.map(async (item) => {
          if (item.inventoryId) {
            return tx.inventory.update({
              where: { id: item.inventoryId },
              data: {
                reservedSpots: { decrement: 1 },
                availableSpots: { increment: 1 }
              }
            })
          }
        })
      )

      // Update reservation status
      await tx.reservation.update({
        where: { id: reservationId },
        data: {
          status: 'cancelled',
          cancelledAt: new Date(),
          cancelledBy: userId
        }
      })

      // Update reservation items status
      await tx.reservationItem.updateMany({
        where: { reservationId },
        data: { status: 'released' }
      })

      // Add status history
      await tx.reservationStatusHistory.create({
        data: {
          reservationId,
          fromStatus: 'held',
          toStatus: 'cancelled',
          reason: reason || 'Reservation cancelled by user',
          changedBy: userId
        }
      })

      return this.getReservationById(reservationId, organizationId)
    })
  }

  /**
   * Run expiration process to expire old reservations
   */
  async expireReservations() {
    // This will be called by a cron job or scheduled task
    await prisma.$executeRaw`SELECT expire_reservations()`
    
    // Return count of expired reservations
    const expiredCount = await prisma.reservation.count({
      where: {
        status: 'expired',
        updatedAt: {
          gte: new Date(Date.now() - 60 * 1000) // Updated in last minute
        }
      }
    })

    return { expiredCount }
  }

  /**
   * Get reservation statistics
   */
  async getReservationStats(organizationId: string, dateRange?: { start: Date; end: Date }) {
    const where: any = { organizationId }
    
    if (dateRange) {
      where.createdAt = {
        gte: dateRange.start,
        lte: dateRange.end
      }
    }

    const [totalReservations, statusStats, priorityStats] = await Promise.all([
      prisma.reservation.count({ where }),
      prisma.reservation.groupBy({
        by: ['status'],
        where,
        _count: { status: true },
        _sum: { totalAmount: true }
      }),
      prisma.reservation.groupBy({
        by: ['priority'],
        where,
        _count: { priority: true }
      })
    ])

    return {
      totalReservations,
      statusBreakdown: statusStats.map(stat => ({
        status: stat.status,
        count: stat._count.status,
        totalAmount: stat._sum.totalAmount || 0
      })),
      priorityBreakdown: priorityStats.map(stat => ({
        priority: stat.priority,
        count: stat._count.priority
      }))
    }
  }
}

export const reservationService = new ReservationService()