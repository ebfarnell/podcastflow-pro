import prisma from '@/lib/db/prisma'
import { Prisma } from '@prisma/client'

export interface CreateCreativeInput {
  name: string
  description?: string
  type: string
  format: string
  duration: number
  script?: string
  talkingPoints?: string[]
  audioUrl?: string
  videoUrl?: string
  thumbnailUrl?: string
  s3Key?: string
  fileSize?: number
  fileType?: string
  advertiserId?: string
  campaignId?: string
  tags?: string[]
  category?: string
  restrictedTerms?: string[]
  legalDisclaimer?: string
  expiryDate?: Date
  organizationId: string
  createdBy: string
}

export interface UpdateCreativeInput extends Partial<CreateCreativeInput> {
  updatedBy?: string
}

export interface TrackUsageInput {
  creativeId: string
  entityType: string
  entityId: string
  entityName?: string
  startDate: Date
  endDate?: Date
  createdBy: string
}

export interface CreativeFilters {
  organizationId?: string
  advertiserId?: string
  campaignId?: string
  type?: string
  format?: string
  status?: string
  category?: string
  tags?: string[]
  search?: string
  minDuration?: number
  maxDuration?: number
  expiryBefore?: Date
  expiryAfter?: Date
}

export class CreativeService {
  // Create a new ad creative
  async create(data: CreateCreativeInput) {
    return prisma.adCreative.create({
      data: {
        ...data,
        updatedAt: new Date(),
      },
      include: {
        organization: true,
        advertiser: true,
        campaign: true,
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })
  }

  // Update an existing creative
  async update(id: string, data: UpdateCreativeInput) {
    const { updatedBy, ...updateData } = data
    
    return prisma.adCreative.update({
      where: { id },
      data: {
        ...updateData,
        updatedBy,
        updatedAt: new Date(),
      },
      include: {
        organization: true,
        advertiser: true,
        campaign: true,
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        updater: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })
  }

  // Get a single creative by ID
  async getById(id: string) {
    return prisma.adCreative.findUnique({
      where: { id },
      include: {
        organization: true,
        advertiser: true,
        campaign: true,
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        updater: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        usage: {
          orderBy: {
            startDate: 'desc',
          },
          take: 10,
        },
      },
    })
  }

  // List creatives with filtering and pagination
  async list(filters: CreativeFilters & { page?: number; limit?: number }) {
    const { page = 1, limit = 20, search, tags, ...filterData } = filters
    const skip = (page - 1) * limit

    const where: Prisma.AdCreativeWhereInput = {
      ...filterData,
    }

    // Handle search across multiple fields
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { script: { contains: search, mode: 'insensitive' } },
      ]
    }

    // Handle tags filter
    if (tags && tags.length > 0) {
      where.tags = {
        hasEvery: tags,
      }
    }

    // Handle date range filters
    if (filters.expiryBefore || filters.expiryAfter) {
      where.expiryDate = {}
      if (filters.expiryBefore) {
        where.expiryDate.lte = filters.expiryBefore
      }
      if (filters.expiryAfter) {
        where.expiryDate.gte = filters.expiryAfter
      }
    }

    // Handle duration range filters
    if (filters.minDuration !== undefined || filters.maxDuration !== undefined) {
      where.duration = {}
      if (filters.minDuration !== undefined) {
        where.duration.gte = filters.minDuration
      }
      if (filters.maxDuration !== undefined) {
        where.duration.lte = filters.maxDuration
      }
    }

    const [creatives, total] = await Promise.all([
      prisma.adCreative.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          advertiser: true,
          campaign: true,
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      prisma.adCreative.count({ where }),
    ])

    return {
      creatives,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    }
  }

  // Delete a creative (soft delete by setting status to 'archived')
  async archive(id: string, userId: string) {
    return prisma.adCreative.update({
      where: { id },
      data: {
        status: 'archived',
        updatedBy: userId,
        updatedAt: new Date(),
      },
    })
  }

  // Hard delete a creative
  async delete(id: string) {
    // First delete all usage records
    await prisma.creativeUsage.deleteMany({
      where: { creativeId: id },
    })

    // Then delete the creative
    return prisma.adCreative.delete({
      where: { id },
    })
  }

  // Track creative usage
  async trackUsage(data: TrackUsageInput) {
    return prisma.creativeUsage.create({
      data,
    })
  }

  // Update usage metrics
  async updateUsageMetrics(
    usageId: string,
    metrics: {
      impressions?: number
      clicks?: number
      conversions?: number
      revenue?: number
    }
  ) {
    const usage = await prisma.creativeUsage.update({
      where: { id: usageId },
      data: metrics,
    })

    // Update the creative's aggregate metrics
    await this.updateCreativeMetrics(usage.creativeId)

    return usage
  }

  // Update creative aggregate metrics based on all usage
  private async updateCreativeMetrics(creativeId: string) {
    const usageMetrics = await prisma.creativeUsage.aggregate({
      where: { creativeId },
      _sum: {
        impressions: true,
        clicks: true,
        conversions: true,
        revenue: true,
      },
    })

    return prisma.adCreative.update({
      where: { id: creativeId },
      data: {
        impressions: usageMetrics._sum.impressions || 0,
        clicks: usageMetrics._sum.clicks || 0,
        conversions: usageMetrics._sum.conversions || 0,
        revenue: usageMetrics._sum.revenue || 0,
      },
    })
  }

  // Get usage analytics for a creative
  async getUsageAnalytics(creativeId: string, dateRange?: { start: Date; end: Date }) {
    const where: Prisma.CreativeUsageWhereInput = {
      creativeId,
    }

    if (dateRange) {
      where.startDate = {
        gte: dateRange.start,
        lte: dateRange.end,
      }
    }

    const usage = await prisma.creativeUsage.findMany({
      where,
      orderBy: {
        startDate: 'desc',
      },
    })

    const totals = await prisma.creativeUsage.aggregate({
      where,
      _sum: {
        impressions: true,
        clicks: true,
        conversions: true,
        revenue: true,
      },
      _count: true,
    })

    return {
      usage,
      totals: {
        impressions: totals._sum.impressions || 0,
        clicks: totals._sum.clicks || 0,
        conversions: totals._sum.conversions || 0,
        revenue: totals._sum.revenue || 0,
        usageCount: totals._count,
      },
    }
  }

  // Duplicate a creative
  async duplicate(id: string, userId: string, newName?: string) {
    const original = await this.getById(id)
    if (!original) {
      throw new Error('Creative not found')
    }

    const { id: _, createdAt, updatedAt, usage, ...creativeData } = original
    
    return prisma.adCreative.create({
      data: {
        ...creativeData,
        name: newName || `${original.name} (Copy)`,
        impressions: 0,
        clicks: 0,
        conversions: 0,
        revenue: 0,
        createdBy: userId,
        updatedBy: null,
        organizationId: original.organizationId,
        advertiserId: original.advertiserId,
        campaignId: original.campaignId,
      },
    })
  }

  // Get creatives by advertiser
  async getByAdvertiser(advertiserId: string, limit = 10) {
    return prisma.adCreative.findMany({
      where: {
        advertiserId,
        status: 'active',
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    })
  }

  // Get creatives by campaign
  async getByCampaign(campaignId: string) {
    return prisma.adCreative.findMany({
      where: {
        campaignId,
        status: 'active',
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        usage: {
          where: {
            entityType: 'campaign',
            entityId: campaignId,
          },
        },
      },
    })
  }

  // Search creatives for dropdown/autocomplete
  async search(query: string, organizationId: string, limit = 10) {
    return prisma.adCreative.findMany({
      where: {
        organizationId,
        status: 'active',
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        name: true,
        type: true,
        format: true,
        duration: true,
        advertiser: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      take: limit,
    })
  }
}

export const creativeService = new CreativeService()