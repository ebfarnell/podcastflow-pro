import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug, safeQuerySchema } from '@/lib/db/schema-db'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Get session and verify authentication
    const authToken = request.cookies.get('auth-token')?.value
    if (!authToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken)
    if (!user || !['master', 'admin', 'sales'].includes(user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') as 'advertiser' | 'agency' | 'seller' | undefined
    const sellerId = searchParams.get('sellerId')
    const includeInactive = searchParams.get('includeInactive') === 'true'

    // Get organization slug
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const response: any = {
      sellers: [],
      agencies: [],
      advertisers: []
    }

    // Fetch sellers (users with sales role)
    if (!type || type === 'seller') {
      const sellersQuery = `
        SELECT 
          u.id,
          u.name,
          u.email,
          u."isActive",
          COUNT(DISTINCT a.id) as "advertiserCount",
          COUNT(DISTINCT ag.id) as "agencyCount"
        FROM public."User" u
        LEFT JOIN "Advertiser" a ON u.id = a."sellerId" AND a."isActive" = true
        LEFT JOIN "Agency" ag ON u.id = ag."sellerId" AND ag."isActive" = true
        WHERE u.role = 'sales' 
          AND u."organizationId" = $1
          ${!includeInactive ? 'AND u."isActive" = true' : ''}
          ${user.role === 'sales' ? 'AND u.id = $2' : ''}
        GROUP BY u.id, u.name, u.email, u."isActive"
        ORDER BY u.name
      `
      
      const sellersParams = user.role === 'sales' ? [user.organizationId, user.id] : [user.organizationId]
      const { data: sellers = [], error: sellersError } = await safeQuerySchema(orgSlug, sellersQuery, sellersParams)
      
      if (!sellersError) {
        response.sellers = sellers
      }
    }

    // Fetch agencies
    if (!type || type === 'agency') {
      const whereConditions = ['ag."organizationId" = $1']
      const queryParams = [user.organizationId]
      let paramIndex = 2

      if (!includeInactive) {
        whereConditions.push('ag."isActive" = true')
      }

      if (sellerId) {
        whereConditions.push(`ag."sellerId" = $${paramIndex++}`)
        queryParams.push(sellerId)
      }

      if (user.role === 'sales') {
        whereConditions.push(`ag."sellerId" = $${paramIndex++}`)
        queryParams.push(user.id)
      }

      const agenciesQuery = `
        SELECT 
          ag.id,
          ag.name,
          ag."contactEmail",
          ag."contactPhone",
          ag."website",
          ag."sellerId",
          ag."isActive",
          s.name as "sellerName",
          s.email as "sellerEmail",
          COUNT(DISTINCT a.id) as "advertiserCount"
        FROM "Agency" ag
        LEFT JOIN public."User" s ON ag."sellerId" = s.id
        LEFT JOIN "Advertiser" a ON ag.id = a."agencyId" AND a."isActive" = true
        WHERE ${whereConditions.join(' AND ')}
        GROUP BY ag.id, ag.name, ag."contactEmail", ag."contactPhone", ag."website", 
                 ag."sellerId", ag."isActive", s.name, s.email
        ORDER BY ag.name
      `

      const { data: agencies = [], error: agenciesError } = await safeQuerySchema(orgSlug, agenciesQuery, queryParams)
      
      if (!agenciesError) {
        response.agencies = agencies
      }
    }

    // Fetch advertisers
    if (!type || type === 'advertiser') {
      const whereConditions = ['a."organizationId" = $1']
      const queryParams = [user.organizationId]
      let paramIndex = 2

      if (!includeInactive) {
        whereConditions.push('a."isActive" = true')
      }

      if (sellerId) {
        whereConditions.push(`a."sellerId" = $${paramIndex++}`)
        queryParams.push(sellerId)
      }

      if (user.role === 'sales') {
        whereConditions.push(`a."sellerId" = $${paramIndex++}`)
        queryParams.push(user.id)
      }

      const advertisersQuery = `
        SELECT 
          a.id,
          a.name,
          a."contactEmail",
          a."contactPhone",
          a."website",
          a."industry",
          a."sellerId",
          a."agencyId",
          a."isActive",
          s.name as "sellerName",
          s.email as "sellerEmail",
          ag.name as "agencyName"
        FROM "Advertiser" a
        LEFT JOIN public."User" s ON a."sellerId" = s.id
        LEFT JOIN "Agency" ag ON a."agencyId" = ag.id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY a.name
      `

      const { data: advertisers = [], error: advertisersError } = await safeQuerySchema(orgSlug, advertisersQuery, queryParams)
      
      if (!advertisersError) {
        response.advertisers = advertisers
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Error fetching budget entities:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}