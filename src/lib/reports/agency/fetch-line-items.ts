import { safeQuerySchema } from '@/lib/db/schema-db'

export interface LineItemData {
  id: string
  campaignName: string
  showName: string
  episodeTitle: string
  placementType: string
  airDate: Date
  rate: number
  status: string
}

export async function fetchLineItems(
  orgSlug: string,
  advertiserIds: string[],
  startDate: Date,
  endDate: Date
): Promise<{ data: LineItemData[]; error: string | null }> {
  try {
    if (advertiserIds.length === 0) {
      return { data: [], error: null }
    }

    const result = await safeQuerySchema<LineItemData>(
      orgSlug,
      `
        SELECT 
          s.id,
          c.name as "campaignName",
          sh.name as "showName",
          e.title as "episodeTitle",
          s."placementType",
          s."airDate",
          s.rate,
          s.status
        FROM "ScheduledSpot" s
        JOIN "Campaign" c ON s."campaignId" = c.id
        JOIN "Episode" e ON s."episodeId" = e.id
        JOIN "Show" sh ON e."showId" = sh.id
        WHERE c."advertiserId" = ANY($1::text[])
          AND s."airDate" >= $2
          AND s."airDate" <= $3
        ORDER BY s."airDate"
        LIMIT 1000
      `,
      [advertiserIds, startDate.toISOString(), endDate.toISOString()]
    )

    if (result.error) {
      console.error('[fetchLineItems] Query error:', result.error)
      return { data: [], error: result.error }
    }

    return { data: result.data || [], error: null }
  } catch (error) {
    console.error('[fetchLineItems] Error:', error)
    return { data: [], error: 'Failed to fetch line items' }
  }
}