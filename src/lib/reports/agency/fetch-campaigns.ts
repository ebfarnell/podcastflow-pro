import { safeQuerySchema } from '@/lib/db/schema-db'

export interface CampaignData {
  id: string
  name: string
  advertiserId: string
  advertiserName: string
  status: string
  budget: number | null
  startDate: Date
  endDate: Date
  createdAt: Date
  updatedAt: Date
}

export async function fetchCampaigns(
  orgSlug: string,
  advertiserIds: string[],
  startDate: Date,
  endDate: Date
): Promise<{ data: CampaignData[]; error: string | null }> {
  try {
    if (advertiserIds.length === 0) {
      return { data: [], error: null }
    }

    const result = await safeQuerySchema<CampaignData>(
      orgSlug,
      `
        SELECT 
          c.id,
          c.name,
          c."advertiserId",
          a.name as "advertiserName",
          c.status,
          c.budget,
          c."startDate",
          c."endDate",
          c."createdAt",
          c."updatedAt"
        FROM "Campaign" c
        JOIN "Advertiser" a ON c."advertiserId" = a.id
        WHERE c."advertiserId" = ANY($1::text[])
          AND c."startDate" <= $2
          AND c."endDate" >= $3
        ORDER BY c."startDate" DESC
      `,
      [advertiserIds, endDate.toISOString(), startDate.toISOString()]
    )

    if (result.error) {
      console.error('[fetchCampaigns] Query error:', result.error)
      return { data: [], error: result.error }
    }

    return { data: result.data || [], error: null }
  } catch (error) {
    console.error('[fetchCampaigns] Error:', error)
    return { data: [], error: 'Failed to fetch campaigns' }
  }
}