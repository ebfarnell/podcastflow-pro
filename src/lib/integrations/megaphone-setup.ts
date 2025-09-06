import prisma from '@/lib/db/prisma'
import { getSchemaDb } from '@/lib/db/schema-db'

/**
 * Megaphone Integration Setup Service
 * Automatically creates organization-specific tables and schema when connecting to Megaphone
 */

export interface MegaphoneIntegrationConfig {
  organizationId: string
  organizationSlug: string
  apiKey: string
  apiSecret: string
  networkId?: string
  webhookUrl?: string
  syncFrequency?: 'hourly' | 'daily' | 'weekly'
  enableAnalytics?: boolean
  enableRevenue?: boolean
}

export class MegaphoneSetupService {
  
  /**
   * Initialize Megaphone integration for an organization
   * Creates all necessary tables and schema isolation
   */
  async initializeIntegration(config: MegaphoneIntegrationConfig): Promise<void> {
    console.log(`🔧 Initializing Megaphone integration for organization: ${config.organizationSlug}`)
    
    try {
      // 1. Ensure organization schema exists
      await this.ensureOrganizationSchema(config.organizationSlug)
      
      // 2. Create Megaphone-specific tables in organization schema
      await this.createMegaphoneTables(config.organizationSlug)
      
      // 3. Create analytics tables for data isolation
      await this.createAnalyticsTables(config.organizationSlug)
      
      // 4. Set up integration record in public schema
      await this.createIntegrationRecord(config)
      
      // 5. Initialize default settings and sync preferences
      await this.setupDefaultConfiguration(config)
      
      console.log(`✅ Megaphone integration initialized successfully for ${config.organizationSlug}`)
      
    } catch (error) {
      console.error(`❌ Failed to initialize Megaphone integration:`, error)
      throw new Error(`Megaphone setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Ensure organization-specific schema exists
   */
  private async ensureOrganizationSchema(organizationSlug: string): Promise<void> {
    const schemaName = `org_${organizationSlug}`
    
    await prisma.$executeRawUnsafe(`
      CREATE SCHEMA IF NOT EXISTS "${schemaName}";
    `)
    
    console.log(`📂 Organization schema ensured: ${schemaName}`)
  }

  /**
   * Create Megaphone-specific tables in organization schema
   */
  private async createMegaphoneTables(organizationSlug: string): Promise<void> {
    const schemaName = `org_${organizationSlug}`
    
    // MegaphonePodcast table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${schemaName}"."MegaphonePodcast" (
        "id" TEXT NOT NULL,
        "megaphoneId" TEXT NOT NULL,
        "organizationId" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "subtitle" TEXT,
        "description" TEXT,
        "author" TEXT,
        "ownerName" TEXT,
        "ownerEmail" TEXT,
        "imageUrl" TEXT,
        "language" TEXT DEFAULT 'en',
        "category" TEXT,
        "subcategory" TEXT,
        "explicit" TEXT DEFAULT 'no',
        "type" TEXT DEFAULT 'episodic',
        "status" TEXT DEFAULT 'active',
        "feedUrl" TEXT,
        "websiteUrl" TEXT,
        "tags" TEXT[],
        "customFields" JSONB,
        "lastSyncAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "megaphoneCreatedAt" TIMESTAMP(3),
        "megaphoneUpdatedAt" TIMESTAMP(3),
        "rawData" JSONB,
        
        CONSTRAINT "${schemaName}_MegaphonePodcast_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "${schemaName}_MegaphonePodcast_megaphoneId_key" UNIQUE ("megaphoneId")
      );
    `)

    // MegaphoneEpisode table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${schemaName}"."MegaphoneEpisode" (
        "id" TEXT NOT NULL,
        "megaphoneId" TEXT NOT NULL,
        "organizationId" TEXT NOT NULL,
        "podcastId" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "subtitle" TEXT,
        "summary" TEXT,
        "author" TEXT,
        "pubdate" TIMESTAMP(3),
        "link" TEXT,
        "imageFile" TEXT,
        "audioFile" TEXT,
        "downloadUrl" TEXT,
        "duration" DOUBLE PRECISION,
        "size" BIGINT,
        "explicit" TEXT DEFAULT 'no',
        "episodeType" TEXT DEFAULT 'full',
        "seasonNumber" INTEGER,
        "episodeNumber" INTEGER,
        "uid" TEXT,
        "guid" TEXT,
        "bitrate" INTEGER,
        "samplerate" INTEGER,
        "channelMode" TEXT,
        "preCount" INTEGER DEFAULT 0,
        "postCount" INTEGER DEFAULT 0,
        "insertionPoints" DOUBLE PRECISION[],
        "cuepoints" JSONB,
        "draft" BOOLEAN DEFAULT false,
        "externalId" TEXT,
        "cleanTitle" TEXT,
        "customFields" JSONB,
        "advertisingTags" TEXT[],
        "status" TEXT DEFAULT 'published',
        "audioFileStatus" TEXT,
        "adFree" BOOLEAN DEFAULT false,
        "lastSyncAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "megaphoneCreatedAt" TIMESTAMP(3),
        "megaphoneUpdatedAt" TIMESTAMP(3),
        "rawData" JSONB,
        
        CONSTRAINT "${schemaName}_MegaphoneEpisode_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "${schemaName}_MegaphoneEpisode_megaphoneId_key" UNIQUE ("megaphoneId"),
        CONSTRAINT "${schemaName}_MegaphoneEpisode_podcastId_fkey" FOREIGN KEY ("podcastId") REFERENCES "${schemaName}"."MegaphonePodcast"("id") ON DELETE CASCADE
      );
    `)

    // Create indexes for performance
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "${schemaName}_MegaphonePodcast_organizationId_idx" ON "${schemaName}"."MegaphonePodcast" ("organizationId");
      CREATE INDEX IF NOT EXISTS "${schemaName}_MegaphoneEpisode_organizationId_idx" ON "${schemaName}"."MegaphoneEpisode" ("organizationId");
      CREATE INDEX IF NOT EXISTS "${schemaName}_MegaphoneEpisode_podcastId_idx" ON "${schemaName}"."MegaphoneEpisode" ("podcastId");
      CREATE INDEX IF NOT EXISTS "${schemaName}_MegaphoneEpisode_pubdate_idx" ON "${schemaName}"."MegaphoneEpisode" ("pubdate");
    `)

    console.log(`📊 Megaphone tables created in schema: ${schemaName}`)
  }

  /**
   * Create analytics tables for data isolation
   */
  private async createAnalyticsTables(organizationSlug: string): Promise<void> {
    const schemaName = `org_${organizationSlug}`
    
    // MegaphoneAnalytics table - daily aggregated analytics from Megaphone
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${schemaName}"."MegaphoneAnalytics" (
        "id" TEXT NOT NULL,
        "episodeId" TEXT NOT NULL,
        "organizationId" TEXT NOT NULL,
        "date" DATE NOT NULL,
        "downloads" INTEGER NOT NULL DEFAULT 0,
        "uniqueListeners" INTEGER NOT NULL DEFAULT 0,
        "completions" INTEGER NOT NULL DEFAULT 0,
        "avgListenTime" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "impressions" INTEGER NOT NULL DEFAULT 0,
        "clicks" INTEGER NOT NULL DEFAULT 0,
        "ctr" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "cpm" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "fillRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "platformBreakdown" JSONB,
        "deviceBreakdown" JSONB,
        "geoBreakdown" JSONB,
        "hourlyBreakdown" JSONB,
        "lastSyncAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "rawData" JSONB,
        
        CONSTRAINT "${schemaName}_MegaphoneAnalytics_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "${schemaName}_MegaphoneAnalytics_episodeId_date_key" UNIQUE ("episodeId", "date"),
        CONSTRAINT "${schemaName}_MegaphoneAnalytics_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "${schemaName}"."MegaphoneEpisode"("id") ON DELETE CASCADE
      );
    `)

    // MegaphoneRevenueTracking table - detailed revenue analytics
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${schemaName}"."MegaphoneRevenueTracking" (
        "id" TEXT NOT NULL,
        "episodeId" TEXT NOT NULL,
        "organizationId" TEXT NOT NULL,
        "date" DATE NOT NULL,
        "campaignId" TEXT,
        "campaignName" TEXT,
        "advertiser" TEXT,
        "adType" TEXT,
        "position" TEXT,
        "impressions" INTEGER NOT NULL DEFAULT 0,
        "clicks" INTEGER NOT NULL DEFAULT 0,
        "conversions" INTEGER NOT NULL DEFAULT 0,
        "revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "cpm" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "cpc" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "cpa" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "fillRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "rawData" JSONB,
        
        CONSTRAINT "${schemaName}_MegaphoneRevenueTracking_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "${schemaName}_MegaphoneRevenueTracking_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "${schemaName}"."MegaphoneEpisode"("id") ON DELETE CASCADE
      );
    `)

    // MegaphoneListenerInsights table - audience analytics
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${schemaName}"."MegaphoneListenerInsights" (
        "id" TEXT NOT NULL,
        "episodeId" TEXT,
        "podcastId" TEXT,
        "organizationId" TEXT NOT NULL,
        "date" DATE NOT NULL,
        "metric" TEXT NOT NULL,
        "dimension" TEXT NOT NULL,
        "value" TEXT NOT NULL,
        "count" INTEGER NOT NULL DEFAULT 0,
        "percentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        
        CONSTRAINT "${schemaName}_MegaphoneListenerInsights_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "${schemaName}_MegaphoneListenerInsights_date_metric_dimension_value_key" UNIQUE ("date", "metric", "dimension", "value")
      );
    `)

    // Create analytics indexes
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "${schemaName}_MegaphoneAnalytics_date_idx" ON "${schemaName}"."MegaphoneAnalytics" ("date");
      CREATE INDEX IF NOT EXISTS "${schemaName}_MegaphoneAnalytics_organizationId_idx" ON "${schemaName}"."MegaphoneAnalytics" ("organizationId");
      CREATE INDEX IF NOT EXISTS "${schemaName}_MegaphoneRevenueTracking_date_idx" ON "${schemaName}"."MegaphoneRevenueTracking" ("date");
      CREATE INDEX IF NOT EXISTS "${schemaName}_MegaphoneRevenueTracking_campaignId_idx" ON "${schemaName}"."MegaphoneRevenueTracking" ("campaignId");
      CREATE INDEX IF NOT EXISTS "${schemaName}_MegaphoneListenerInsights_date_idx" ON "${schemaName}"."MegaphoneListenerInsights" ("date");
      CREATE INDEX IF NOT EXISTS "${schemaName}_MegaphoneListenerInsights_metric_idx" ON "${schemaName}"."MegaphoneListenerInsights" ("metric");
    `)

    console.log(`📈 Analytics tables created in schema: ${schemaName}`)
  }

  /**
   * Create integration record in public schema
   */
  private async createIntegrationRecord(config: MegaphoneIntegrationConfig): Promise<void> {
    // Check if integration already exists
    const existingIntegration = await prisma.megaphoneIntegration.findUnique({
      where: { organizationId: config.organizationId }
    })

    if (existingIntegration) {
      // Update existing integration
      await prisma.megaphoneIntegration.update({
        where: { organizationId: config.organizationId },
        data: {
          apiKey: config.apiKey,
          apiSecret: config.apiSecret,
          networkId: config.networkId,
          webhookUrl: config.webhookUrl,
          syncFrequency: config.syncFrequency || 'daily',
          enableAnalytics: config.enableAnalytics ?? true,
          enableRevenue: config.enableRevenue ?? true,
          status: 'active',
          lastSyncAt: new Date(),
          updatedAt: new Date()
        }
      })
      console.log(`🔄 Updated existing Megaphone integration for organization: ${config.organizationSlug}`)
    } else {
      // Create new integration
      await prisma.megaphoneIntegration.create({
        data: {
          id: `mp_${config.organizationSlug}_${Date.now()}`,
          organizationId: config.organizationId,
          apiKey: config.apiKey,
          apiSecret: config.apiSecret,
          networkId: config.networkId,
          webhookUrl: config.webhookUrl,
          syncFrequency: config.syncFrequency || 'daily',
          enableAnalytics: config.enableAnalytics ?? true,
          enableRevenue: config.enableRevenue ?? true,
          status: 'active',
          lastSyncAt: new Date()
        }
      })
      console.log(`✨ Created new Megaphone integration for organization: ${config.organizationSlug}`)
    }
  }

  /**
   * Setup default configuration and sync preferences
   */
  private async setupDefaultConfiguration(config: MegaphoneIntegrationConfig): Promise<void> {
    const schemaName = `org_${config.organizationSlug}`
    
    // Create default sync configuration
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${schemaName}"."MegaphoneSyncConfig" (
        "id" TEXT NOT NULL,
        "organizationId" TEXT NOT NULL,
        "syncType" TEXT NOT NULL,
        "frequency" TEXT NOT NULL DEFAULT 'daily',
        "enabled" BOOLEAN NOT NULL DEFAULT true,
        "lastSync" TIMESTAMP(3),
        "nextSync" TIMESTAMP(3),
        "retryCount" INTEGER DEFAULT 0,
        "maxRetries" INTEGER DEFAULT 3,
        "timeout" INTEGER DEFAULT 30000,
        "batchSize" INTEGER DEFAULT 100,
        "config" JSONB,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        
        CONSTRAINT "${schemaName}_MegaphoneSyncConfig_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "${schemaName}_MegaphoneSyncConfig_syncType_key" UNIQUE ("syncType")
      );
    `)

    // Insert default sync configurations
    const syncConfigs = [
      {
        id: `sync_podcasts_${Date.now()}`,
        syncType: 'podcasts',
        frequency: config.syncFrequency || 'daily',
        enabled: true
      },
      {
        id: `sync_episodes_${Date.now() + 1}`,
        syncType: 'episodes', 
        frequency: config.syncFrequency || 'daily',
        enabled: true
      },
      {
        id: `sync_analytics_${Date.now() + 2}`,
        syncType: 'analytics',
        frequency: 'hourly',
        enabled: config.enableAnalytics ?? true
      },
      {
        id: `sync_revenue_${Date.now() + 3}`,
        syncType: 'revenue',
        frequency: 'daily',
        enabled: config.enableRevenue ?? true
      }
    ]

    for (const syncConfig of syncConfigs) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "${schemaName}"."MegaphoneSyncConfig" (
          "id", "organizationId", "syncType", "frequency", "enabled", "createdAt", "updatedAt"
        ) VALUES (
          '${syncConfig.id}', '${config.organizationId}', '${syncConfig.syncType}', 
          '${syncConfig.frequency}', ${syncConfig.enabled}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        ) ON CONFLICT ("syncType") DO UPDATE SET
          "frequency" = EXCLUDED."frequency",
          "enabled" = EXCLUDED."enabled",
          "updatedAt" = CURRENT_TIMESTAMP;
      `)
    }

    console.log(`⚙️ Default sync configuration created for organization: ${config.organizationSlug}`)
  }

  /**
   * Remove Megaphone integration and cleanup organization-specific tables
   */
  async removeIntegration(organizationId: string, organizationSlug: string): Promise<void> {
    console.log(`🗑️ Removing Megaphone integration for organization: ${organizationSlug}`)
    
    try {
      const schemaName = `org_${organizationSlug}`
      
      // Remove integration record
      await prisma.megaphoneIntegration.delete({
        where: { organizationId }
      })
      
      // Drop organization-specific Megaphone tables
      await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${schemaName}"."MegaphoneSyncConfig" CASCADE;`)
      await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${schemaName}"."MegaphoneListenerInsights" CASCADE;`)
      await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${schemaName}"."MegaphoneRevenueTracking" CASCADE;`)
      await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${schemaName}"."MegaphoneAnalytics" CASCADE;`)
      await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${schemaName}"."MegaphoneEpisode" CASCADE;`)
      await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${schemaName}"."MegaphonePodcast" CASCADE;`)
      
      console.log(`✅ Megaphone integration removed successfully for ${organizationSlug}`)
      
    } catch (error) {
      console.error(`❌ Failed to remove Megaphone integration:`, error)
      throw new Error(`Integration removal failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Check integration status and health
   */
  async checkIntegrationHealth(organizationId: string): Promise<{
    status: 'healthy' | 'warning' | 'error'
    tablesCreated: boolean
    lastSync: Date | null
    syncErrors: number
    message: string
  }> {
    try {
      const integration = await prisma.megaphoneIntegration.findUnique({
        where: { organizationId }
      })

      if (!integration) {
        return {
          status: 'error',
          tablesCreated: false,
          lastSync: null,
          syncErrors: 0,
          message: 'No Megaphone integration found'
        }
      }

      // Check if tables exist in organization schema
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { slug: true }
      })

      if (!org) {
        return {
          status: 'error',
          tablesCreated: false,
          lastSync: integration.lastSyncAt,
          syncErrors: 0,
          message: 'Organization not found'
        }
      }

      const schemaName = `org_${org.slug}`
      const tableCheck = await prisma.$queryRawUnsafe(`
        SELECT COUNT(*) as count FROM information_schema.tables 
        WHERE table_schema = '${schemaName}' 
        AND table_name LIKE 'Megaphone%'
      `) as Array<{ count: bigint }>

      const tablesCreated = Number(tableCheck[0].count) >= 5

      let status: 'healthy' | 'warning' | 'error' = 'healthy'
      let message = 'Integration is healthy'

      if (!tablesCreated) {
        status = 'error'
        message = 'Required tables not found'
      } else if (integration.lastSyncAt && (Date.now() - integration.lastSyncAt.getTime()) > 86400000) {
        status = 'warning'
        message = 'Last sync was more than 24 hours ago'
      }

      return {
        status,
        tablesCreated,
        lastSync: integration.lastSyncAt,
        syncErrors: 0, // TODO: Track sync errors
        message
      }

    } catch (error) {
      return {
        status: 'error',
        tablesCreated: false,
        lastSync: null,
        syncErrors: 0,
        message: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }
}

// Export singleton instance
export const megaphoneSetup = new MegaphoneSetupService()