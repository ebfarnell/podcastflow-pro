import { safeQuerySchema } from '@/lib/db/schema-db'

export interface WeeklySpotData {
  week: string
  spots: number
  revenue: number
}

export async function fetchWeeklySpots(
  orgSlug: string,
  advertiserIds: string[],
  startDate: Date,
  endDate: Date
): Promise<{ data: WeeklySpotData[]; error: string | null }> {
  try {
    if (advertiserIds.length === 0) {
      return { data: [], error: null }
    }

    const result = await safeQuerySchema<WeeklySpotData>(
      orgSlug,
      `
        SELECT 
          DATE_TRUNC('week', s."airDate") as week,
          COUNT(*) as spots,
          SUM(s.rate) as revenue
        FROM "ScheduledSpot" s
        JOIN "Campaign" c ON s."campaignId" = c.id
        WHERE c."advertiserId" = ANY($1::text[])
          AND s."airDate" >= $2
          AND s."airDate" <= $3
        GROUP BY DATE_TRUNC('week', s."airDate")
        ORDER BY week
      `,
      [advertiserIds, startDate.toISOString(), endDate.toISOString()]
    )

    if (result.error) {
      console.error('[fetchWeeklySpots] Query error:', result.error)
      return { data: [], error: result.error }
    }

    return { data: result.data || [], error: null }
  } catch (error) {
    console.error('[fetchWeeklySpots] Error:', error)
    return { data: [], error: 'Failed to fetch weekly spots' }
  }
}