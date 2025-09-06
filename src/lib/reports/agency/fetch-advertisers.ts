import { safeQuerySchema } from '@/lib/db/schema-db'

export interface AdvertiserData {
  id: string
  name: string
  contactEmail: string | null
  isActive: boolean
  createdAt: Date
}

export async function fetchAdvertisers(
  orgSlug: string,
  agencyId: string
): Promise<{ data: AdvertiserData[]; error: string | null }> {
  try {
    const result = await safeQuerySchema<AdvertiserData>(
      orgSlug,
      `
        SELECT 
          id, 
          name, 
          "contactEmail",
          "isActive",
          "createdAt"
        FROM "Advertiser"
        WHERE "agencyId" = $1
        ORDER BY name
      `,
      [agencyId]
    )

    if (result.error) {
      console.error('[fetchAdvertisers] Query error:', result.error)
      return { data: [], error: result.error }
    }

    return { data: result.data || [], error: null }
  } catch (error) {
    console.error('[fetchAdvertisers] Error:', error)
    return { data: [], error: 'Failed to fetch advertisers' }
  }
}