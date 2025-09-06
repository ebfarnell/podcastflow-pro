import { safeQuerySchema } from '@/lib/db/schema-db'

export interface AgencyData {
  id: string
  name: string
  contactEmail: string | null
  contactPhone: string | null
  website: string | null
  address: string | null
  city: string | null
  state: string | null
  zipCode: string | null
  country: string | null
  isActive: boolean
  createdAt: Date
  sellerId: string | null
}

export async function fetchAgencyData(
  orgSlug: string,
  agencyId: string
): Promise<{ data: AgencyData | null; error: string | null }> {
  try {
    const result = await safeQuerySchema<AgencyData>(
      orgSlug,
      `
        SELECT 
          id, 
          name, 
          "contactEmail", 
          "contactPhone",
          website,
          address,
          city,
          state,
          "zipCode",
          country,
          "isActive",
          "createdAt",
          "sellerId"
        FROM "Agency"
        WHERE id = $1
      `,
      [agencyId]
    )

    if (result.error || !result.data || result.data.length === 0) {
      return { data: null, error: result.error || 'Agency not found' }
    }

    return { data: result.data[0], error: null }
  } catch (error) {
    console.error('[fetchAgencyData] Error:', error)
    return { data: null, error: 'Failed to fetch agency data' }
  }
}

export async function checkSalesUserAccess(
  orgSlug: string,
  agencyId: string,
  userId: string
): Promise<boolean> {
  try {
    const result = await safeQuerySchema<{ count: number }>(
      orgSlug,
      `
        SELECT COUNT(*) as count
        FROM "Advertiser"
        WHERE "agencyId" = $1 AND "sellerId" = $2
      `,
      [agencyId, userId]
    )

    if (result.error || !result.data) {
      return false
    }

    return result.data[0]?.count > 0
  } catch (error) {
    console.error('[checkSalesUserAccess] Error:', error)
    return false
  }
}