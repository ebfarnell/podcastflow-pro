import prisma from '@/lib/db/prisma'
import { safeQuerySchema } from '@/lib/db/schema-db'

interface ConflictCheckOptions {
  campaignId: string
  categoryId: string
  schemaName: string
  policy: 'WARN' | 'BLOCK'
}

interface ConflictResult {
  conflictType: 'category' | 'competitor'
  campaignId: string
  campaignName: string
  advertiserName: string
  categoryName: string
  severity: 'warning' | 'blocking'
  dateRange: {
    start: Date
    end: Date
  }
}

export async function checkCategoryConflicts(options: ConflictCheckOptions): Promise<ConflictResult[]> {
  const { campaignId, categoryId, schemaName, policy } = options
  const conflicts: ConflictResult[] = []

  try {
    // Get campaign details and schedule
    const { data: campaigns } = await safeQuerySchema(schemaName, async (schema) => {
      return await prisma.$queryRawUnsafe(`
        SELECT 
          c.*,
          a."name" as "advertiserName",
          cat."name" as "categoryName",
          MIN(ss."airDate") as "startDate",
          MAX(ss."airDate") as "endDate"
        FROM "${schema}"."Campaign" c
        LEFT JOIN "${schema}"."Advertiser" a ON c."advertiserId" = a.id
        LEFT JOIN "${schema}"."Category" cat ON c."categoryId" = cat.id
        LEFT JOIN "${schema}"."ScheduledSpot" ss ON c.id = ss."campaignId"
        WHERE c.id = $1
        GROUP BY c.id, a."name", cat."name"
      `, campaignId)
    })

    if (!campaigns || campaigns.length === 0) {
      return conflicts
    }

    const campaign = campaigns[0]
    const startDate = campaign.startDate
    const endDate = campaign.endDate

    // Check for other campaigns in the same category with overlapping dates
    const { data: conflictingCampaigns } = await safeQuerySchema(schemaName, async (schema) => {
      return await prisma.$queryRawUnsafe(`
        SELECT DISTINCT
          c.id,
          c."name" as "campaignName",
          a."name" as "advertiserName",
          cat."name" as "categoryName",
          MIN(ss."airDate") as "startDate",
          MAX(ss."airDate") as "endDate"
        FROM "${schema}"."Campaign" c
        JOIN "${schema}"."Advertiser" a ON c."advertiserId" = a.id
        JOIN "${schema}"."Category" cat ON c."categoryId" = cat.id
        JOIN "${schema}"."ScheduledSpot" ss ON c.id = ss."campaignId"
        WHERE c."categoryId" = $1
        AND c.id != $2
        AND c.status IN ('approved', 'in_reservations')
        GROUP BY c.id, c."name", a."name", cat."name"
        HAVING 
          (MIN(ss."airDate") <= $4 AND MAX(ss."airDate") >= $3)
      `, categoryId, campaignId, startDate, endDate)
    })

    // Add category conflicts
    for (const conflict of conflictingCampaigns || []) {
      conflicts.push({
        conflictType: 'category',
        campaignId: conflict.id,
        campaignName: conflict.campaignName,
        advertiserName: conflict.advertiserName,
        categoryName: conflict.categoryName,
        severity: policy === 'BLOCK' ? 'blocking' : 'warning',
        dateRange: {
          start: conflict.startDate,
          end: conflict.endDate,
        },
      })
    }

    // Check for competitor exclusivity
    const { data: competitorSets } = await safeQuerySchema(schemaName, async (schema) => {
      return await prisma.$queryRawUnsafe(`
        SELECT * FROM "${schema}"."CompetitorSet"
        WHERE "categoryId" = $1
        AND "isActive" = true
      `, categoryId)
    })

    if (competitorSets && competitorSets.length > 0) {
      // Get advertiser for the current campaign
      const { data: advertiser } = await safeQuerySchema(schemaName, async (schema) => {
        return await prisma.$queryRawUnsafe(`
          SELECT id, "name" FROM "${schema}"."Advertiser"
          WHERE id = (SELECT "advertiserId" FROM "${schema}"."Campaign" WHERE id = $1)
        `, campaignId)
      })

      if (advertiser && advertiser.length > 0) {
        const advertiserId = advertiser[0].id

        // Check if any competitor has active campaigns in the same period
        for (const set of competitorSets) {
          const competitors = set.advertiserIds || []
          if (competitors.includes(advertiserId)) {
            // This advertiser is in a competitor set, check for conflicts
            const otherCompetitors = competitors.filter((id: string) => id !== advertiserId)
            
            const { data: competitorCampaigns } = await safeQuerySchema(schemaName, async (schema) => {
              return await prisma.$queryRawUnsafe(`
                SELECT DISTINCT
                  c.id,
                  c."name" as "campaignName",
                  a."name" as "advertiserName",
                  cat."name" as "categoryName",
                  MIN(ss."airDate") as "startDate",
                  MAX(ss."airDate") as "endDate"
                FROM "${schema}"."Campaign" c
                JOIN "${schema}"."Advertiser" a ON c."advertiserId" = a.id
                JOIN "${schema}"."Category" cat ON c."categoryId" = cat.id
                JOIN "${schema}"."ScheduledSpot" ss ON c.id = ss."campaignId"
                WHERE c."advertiserId" = ANY($1::text[])
                AND c.status IN ('approved', 'in_reservations')
                GROUP BY c.id, c."name", a."name", cat."name"
                HAVING 
                  (MIN(ss."airDate") <= $3 AND MAX(ss."airDate") >= $2)
              `, otherCompetitors, startDate, endDate)
            })

            for (const conflict of competitorCampaigns || []) {
              conflicts.push({
                conflictType: 'competitor',
                campaignId: conflict.id,
                campaignName: conflict.campaignName,
                advertiserName: conflict.advertiserName,
                categoryName: conflict.categoryName,
                severity: 'blocking', // Competitor conflicts are always blocking
                dateRange: {
                  start: conflict.startDate,
                  end: conflict.endDate,
                },
              })
            }
          }
        }
      }
    }

    console.log(`Found ${conflicts.length} exclusivity conflicts for campaign ${campaignId}`)

  } catch (error) {
    console.error('Error checking category conflicts:', error)
  }

  return conflicts
}

export async function createCompetitorSet(
  schemaName: string,
  categoryId: string,
  advertiserIds: string[],
  name: string
): Promise<string> {
  const { data: result } = await safeQuerySchema(schemaName, async (schema) => {
    return await prisma.$queryRawUnsafe(`
      INSERT INTO "${schema}"."CompetitorSet" (
        id, "categoryId", "advertiserIds", "name", "isActive",
        "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, true,
        NOW(), NOW()
      )
      RETURNING id
    `, categoryId, JSON.stringify(advertiserIds), name)
  })

  return result?.[0]?.id || ''
}

export async function getCompetitorSets(schemaName: string, categoryId?: string) {
  let query = `
    SELECT 
      cs.*,
      cat."name" as "categoryName"
    FROM "${schemaName}"."CompetitorSet" cs
    JOIN "${schemaName}"."Category" cat ON cs."categoryId" = cat.id
    WHERE cs."isActive" = true
  `

  if (categoryId) {
    query += ` AND cs."categoryId" = '${categoryId}'`
  }

  query += ` ORDER BY cs."createdAt" DESC`

  const { data: sets } = await safeQuerySchema(schemaName, async () => {
    return await prisma.$queryRawUnsafe(query)
  })

  return sets || []
}