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
      return NextResponse.json({ error: 'Unauthorized - insufficient permissions' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())
    const monthParam = searchParams.get('month')
    const month = monthParam ? parseInt(monthParam) : null
    const sellerId = searchParams.get('sellerId')
    const entityType = searchParams.get('entityType') as 'advertiser' | 'agency' | 'seller' | undefined
    const includeInactive = searchParams.get('includeInactive') === 'true'

    // Get organization slug for schema-aware queries
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Build where conditions
    const whereConditions = ['hb.year = $1']
    const queryParams: any[] = [year]
    let paramIndex = 2

    if (month) {
      if (month > 0) {
        // Specific month
        whereConditions.push(`hb.month = $${paramIndex++}`)
        queryParams.push(month)
      } else {
        // Quarter (negative values: -1=Q1, -2=Q2, -3=Q3, -4=Q4)
        const quarterMonths = {
          [-1]: [1, 2, 3],    // Q1: Jan, Feb, Mar
          [-2]: [4, 5, 6],    // Q2: Apr, May, Jun
          [-3]: [7, 8, 9],    // Q3: Jul, Aug, Sep
          [-4]: [10, 11, 12]  // Q4: Oct, Nov, Dec
        }
        const months = quarterMonths[month as keyof typeof quarterMonths]
        if (months) {
          whereConditions.push(`hb.month = ANY($${paramIndex++}::int[])`)
          queryParams.push(months)
        }
      }
    }

    if (sellerId) {
      whereConditions.push(`hb."sellerId" = $${paramIndex++}`)
      queryParams.push(sellerId)
    }

    if (entityType) {
      whereConditions.push(`hb."entityType" = $${paramIndex++}`)
      queryParams.push(entityType)
    }

    if (!includeInactive) {
      whereConditions.push(`hb."isActive" = true`)
    }

    // For sales users, restrict to their own entities only
    if (user.role === 'sales') {
      whereConditions.push(`hb."sellerId" = $${paramIndex++}`)
      queryParams.push(user.id)
    }

    const whereClause = whereConditions.join(' AND ')

    // Fetch hierarchical budget data with entity details
    const budgetsQuery = `
      SELECT 
        hb.*,
        s.name as "sellerName",
        s.email as "sellerEmail",
        CASE 
          WHEN hb."entityType" = 'advertiser' THEN a.name
          WHEN hb."entityType" = 'agency' THEN ag.name  
          WHEN hb."entityType" = 'seller' THEN s.name
        END as "entityName",
        CASE 
          WHEN hb."entityType" = 'advertiser' THEN a."isActive"
          WHEN hb."entityType" = 'agency' THEN ag."isActive"
          WHEN hb."entityType" = 'seller' THEN s."isActive"
        END as "entityActive",
        ag.name as "agencyName",
        (hb."actualAmount" - hb."budgetAmount") as variance,
        CASE 
          WHEN hb."budgetAmount" > 0 
          THEN ((hb."actualAmount" - hb."budgetAmount") / hb."budgetAmount") * 100 
          ELSE 0 
        END as "variancePercent",
        CASE 
          WHEN hb."previousYearActual" > 0 
          THEN ((hb."actualAmount" - hb."previousYearActual") / hb."previousYearActual") * 100 
          ELSE 0 
        END as "yearOverYearGrowth"
      FROM "HierarchicalBudget" hb
      LEFT JOIN public."User" s ON hb."sellerId" = s.id
      LEFT JOIN "Advertiser" a ON hb."entityType" = 'advertiser' AND hb."entityId" = a.id
      LEFT JOIN "Agency" ag ON (
        (hb."entityType" = 'agency' AND hb."entityId" = ag.id) OR
        (hb."entityType" = 'advertiser' AND hb."agencyId" = ag.id)
      )
      WHERE ${whereClause}
        AND (
          hb."entityType" != 'advertiser' 
          OR (hb."entityType" = 'advertiser' AND a.id IS NOT NULL AND a."isActive" = true)
        )
        AND (
          hb."entityType" != 'agency' 
          OR (hb."entityType" = 'agency' AND ag.id IS NOT NULL AND ag."isActive" = true)
        )
      ORDER BY 
        s.name,
        CASE hb."entityType" 
          WHEN 'seller' THEN 1 
          WHEN 'agency' THEN 2 
          WHEN 'advertiser' THEN 3 
        END,
        hb."entityName",
        hb.month
    `

    const { data: budgets = [], error: budgetsError } = await safeQuerySchema(orgSlug, budgetsQuery, queryParams)
    if (budgetsError) {
      console.error('Error fetching hierarchical budgets:', budgetsError)
      return NextResponse.json({ budgets: [], rollups: {}, metadata: {} })
    }

    console.log(`[DEBUG] Fetched ${budgets.length} budget entries from HierarchicalBudget table`)

    // Fetch ALL advertisers and agencies to ensure complete display
    const allEntitiesQuery = `
      WITH advertiser_actuals AS (
        SELECT 
          a.id,
          a.name,
          a."sellerId",
          a."agencyId",
          a."isActive",
          -- Get actual revenue from orders/invoices, not campaign budgets
          COALESCE(SUM(
            CASE 
              WHEN o.id IS NOT NULL THEN COALESCE(i."totalAmount", o."totalAmount", 0)
              ELSE 0
            END
          ), 0) as actual_amount
        FROM "Advertiser" a
        LEFT JOIN "Campaign" c ON a.id = c."advertiserId"
        LEFT JOIN "Order" o ON c.id = o."campaignId"
          AND o.status NOT IN ('cancelled', 'voided')
          AND EXTRACT(YEAR FROM o."createdAt") = $1
        LEFT JOIN "Invoice" i ON i."orderId" = o.id
          AND i.status != 'voided'
        WHERE a."organizationId" = $2 AND a."isActive" = true
        GROUP BY a.id, a.name, a."sellerId", a."agencyId", a."isActive"
      ),
      agency_actuals AS (
        SELECT 
          ag.id,
          ag.name,
          ag."sellerId",
          ag."isActive",
          -- Get actual revenue from orders/invoices for advertisers under this agency
          COALESCE(SUM(
            CASE 
              WHEN o.id IS NOT NULL THEN COALESCE(i."totalAmount", o."totalAmount", 0)
              ELSE 0
            END
          ), 0) as actual_amount
        FROM "Agency" ag
        LEFT JOIN "Advertiser" a ON ag.id = a."agencyId"
        LEFT JOIN "Campaign" c ON a.id = c."advertiserId"
        LEFT JOIN "Order" o ON c.id = o."campaignId"
          AND o.status NOT IN ('cancelled', 'voided')
          AND EXTRACT(YEAR FROM o."createdAt") = $1
        LEFT JOIN "Invoice" i ON i."orderId" = o.id
          AND i.status != 'voided'
        WHERE ag."organizationId" = $2 AND ag."isActive" = true
        GROUP BY ag.id, ag.name, ag."sellerId", ag."isActive"
      )
      SELECT * FROM (
        SELECT 
          'advertiser' as entity_type,
          a.id as entity_id,
          a.name as entity_name,
          a."sellerId" as seller_id,
          s.name as seller_name,
          s.email as seller_email,
          a."agencyId" as agency_id,
          ag.name as agency_name,
          a.actual_amount,
          a."isActive"
        FROM advertiser_actuals a
        LEFT JOIN public."User" s ON a."sellerId" = s.id
        LEFT JOIN "Agency" ag ON a."agencyId" = ag.id
        UNION ALL
        SELECT 
          'agency' as entity_type,
          ag.id as entity_id,
          ag.name as entity_name,
          ag."sellerId" as seller_id,
          s.name as seller_name,
          s.email as seller_email,
          NULL as agency_id,
          NULL as agency_name,
          ag.actual_amount,
          ag."isActive"
        FROM agency_actuals ag
        LEFT JOIN public."User" s ON ag."sellerId" = s.id
      ) entities
      ORDER BY entity_type, entity_name
    `
    
    const { data: allEntities = [], error: entitiesError } = await safeQuerySchema(
      orgSlug, 
      allEntitiesQuery, 
      [year, user.organizationId]
    )
    
    if (entitiesError) {
      console.error('Error fetching all entities:', entitiesError)
    }
    
    console.log(`[DEBUG] Fetched ${allEntities.length} total entities (advertisers + agencies)`)

    // Calculate dynamic rollups from base budget data
    const sellerTotals: Record<string, any> = {}
    
    // Group budgets by seller and calculate totals
    budgets.forEach(budget => {
      if (!sellerTotals[budget.sellerId]) {
        sellerTotals[budget.sellerId] = {
          sellerId: budget.sellerId,
          sellerName: budget.sellerName,
          sellerEmail: budget.sellerEmail,
          totalBudget: 0,
          totalActual: 0,
          advertiserBudget: 0,
          agencyBudget: 0,
          sellerBudget: 0,
          developmentalBudget: 0,
          variance: 0,
          previousYearTotal: 0,
          yearOverYearGrowth: 0,
          isOnTarget: true,
          periods: new Map()
        }
      }

      const seller = sellerTotals[budget.sellerId]
      
      // Add to appropriate category
      if (budget.entityType === 'advertiser') {
        seller.advertiserBudget += budget.budgetAmount || 0
      } else if (budget.entityType === 'agency') {
        seller.agencyBudget += budget.budgetAmount || 0
      } else if (budget.entityType === 'seller' && budget.notes?.toLowerCase().includes('developmental')) {
        seller.developmentalBudget += budget.budgetAmount || 0
      }
      
      seller.totalBudget += budget.budgetAmount || 0
      seller.totalActual += budget.actualAmount || 0
      seller.variance += budget.variance || 0
      seller.previousYearTotal += budget.previousYearActual || 0
      
      // Track by period for monthly breakdowns
      const periodKey = `${budget.year}-${budget.month}`
      if (!seller.periods.has(periodKey)) {
        seller.periods.set(periodKey, {
          year: budget.year,
          month: budget.month,
          totalBudget: 0,
          totalActual: 0,
          advertiserBudget: 0,
          developmentalBudget: 0,
          previousYearActual: 0
        })
      }
      
      const period = seller.periods.get(periodKey)
      period.totalBudget += budget.budgetAmount || 0
      period.totalActual += budget.actualAmount || 0
      period.previousYearActual += budget.previousYearActual || 0
      
      if (budget.entityType === 'advertiser') {
        period.advertiserBudget += budget.budgetAmount || 0
      } else if (budget.entityType === 'seller' && budget.notes?.toLowerCase().includes('developmental')) {
        period.developmentalBudget += budget.budgetAmount || 0
      }
    })

    // Convert period maps to arrays and calculate year-over-year growth
    Object.values(sellerTotals).forEach((seller: any) => {
      seller.periods = Array.from(seller.periods.values())
      if (seller.previousYearTotal > 0) {
        seller.yearOverYearGrowth = ((seller.totalActual - seller.previousYearTotal) / seller.previousYearTotal) * 100
      }
      // Update isOnTarget based on variance
      seller.isOnTarget = seller.variance >= 0
    })

    // Merge entities without budgets
    const budgetEntityKeys = new Set(budgets.map(b => `${b.entityType}_${b.entityId}`))
    const missingEntities: any[] = []
    
    allEntities.forEach((entity: any) => {
      const entityKey = `${entity.entity_type}_${entity.entity_id}`
      if (!budgetEntityKeys.has(entityKey)) {
        // Create a dummy budget entry for entities without budgets
        missingEntities.push({
          id: `missing_${entity.entity_id}_${year}_${month || 0}`,
          entityType: entity.entity_type,
          entityId: entity.entity_id,
          entityName: entity.entity_name,
          sellerId: entity.seller_id,
          sellerName: entity.seller_name,
          sellerEmail: entity.seller_email,
          agencyId: entity.agency_id,
          agencyName: entity.agency_name,
          year: year,
          month: month || 0,
          budgetAmount: 0,
          actualAmount: entity.actual_amount || 0,
          previousYearActual: 0,
          variance: entity.actual_amount || 0,
          variancePercent: 0,
          yearOverYearGrowth: 0,
          entityActive: entity.isActive,
          isActive: true,
          notes: null
        })
      }
    })
    
    // Combine budgets with missing entities
    const allBudgets = [...budgets, ...missingEntities]
    
    console.log(`[DEBUG] Total budgets after merge: ${allBudgets.length} (${budgets.length} existing + ${missingEntities.length} missing)`)

    // Calculate grand totals from seller totals
    const grandTotals = {
      totalBudget: Object.values(sellerTotals).reduce((sum: number, seller: any) => sum + seller.totalBudget, 0),
      totalActual: Object.values(sellerTotals).reduce((sum: number, seller: any) => sum + seller.totalActual, 0),
      variance: Object.values(sellerTotals).reduce((sum: number, seller: any) => sum + seller.variance, 0),
      variancePercent: 0
    }

    if (grandTotals.totalBudget > 0) {
      grandTotals.variancePercent = (grandTotals.variance / grandTotals.totalBudget) * 100
    }

    // Get metadata
    let entityCountQuery = `
      SELECT 
        COUNT(DISTINCT CASE WHEN hb."entityType" = 'seller' THEN hb."sellerId" END) as "sellerCount",
        COUNT(*) as "totalEntities",
        MAX(hb."updatedAt") as "lastUpdate"
      FROM "HierarchicalBudget" hb
      WHERE hb.year = $1 AND hb."isActive" = true
    `
    
    const metadataParams: any[] = [year]
    let metadataParamIndex = 2

    if (month) {
      if (month > 0) {
        // Specific month
        entityCountQuery += ` AND hb.month = $${metadataParamIndex++}`
        metadataParams.push(month)
      } else {
        // Quarter
        const quarterMonths = {
          [-1]: [1, 2, 3],    // Q1: Jan, Feb, Mar
          [-2]: [4, 5, 6],    // Q2: Apr, May, Jun
          [-3]: [7, 8, 9],    // Q3: Jul, Aug, Sep
          [-4]: [10, 11, 12]  // Q4: Oct, Nov, Dec
        }
        const months = quarterMonths[month as keyof typeof quarterMonths]
        if (months) {
          entityCountQuery += ` AND hb.month = ANY($${metadataParamIndex++}::int[])`
          metadataParams.push(months)
        }
      }
    }

    if (user.role === 'sales') {
      entityCountQuery += ` AND hb."sellerId" = $${metadataParamIndex++}`
      metadataParams.push(user.id)
    }
    const { data: metadata = [{}], error: metadataError } = await safeQuerySchema(orgSlug, entityCountQuery, metadataParams)

    return NextResponse.json({
      budgets: allBudgets,
      rollups: {
        sellerTotals,
        grandTotals
      },
      metadata: {
        year,
        month,
        totalSellers: metadata[0]?.sellerCount || 0,
        totalEntities: metadata[0]?.totalEntities || 0,
        lastCacheUpdate: metadata[0]?.lastUpdate || null
      }
    })

  } catch (error) {
    console.error('Error fetching hierarchical budgets:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get session and verify authentication
    const authToken = request.cookies.get('auth-token')?.value
    if (!authToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken)
    if (!user || !['master', 'admin', 'sales'].includes(user.role)) {
      return NextResponse.json({ error: 'Unauthorized - insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    console.log('POST /api/budget/hierarchical - Request body:', JSON.stringify(body))
    const { entityType, entityId, year, month, budgetAmount, notes } = body

    if (!entityType || !entityId || !year || !month || budgetAmount === undefined) {
      console.error('Missing required fields:', { entityType, entityId, year, month, budgetAmount })
      return NextResponse.json({ 
        error: 'Entity type, entity ID, year, month, and budget amount are required' 
      }, { status: 400 })
    }

    if (!['advertiser', 'agency', 'seller'].includes(entityType)) {
      return NextResponse.json({ error: 'Invalid entity type' }, { status: 400 })
    }

    // Only allow advertiser-level budgets and developmental seller budgets
    if (entityType === 'agency') {
      return NextResponse.json({ 
        error: 'Agency budgets are calculated automatically from their advertisers. Please set budgets at the advertiser level.' 
      }, { status: 400 })
    }
    
    if (entityType === 'seller' && (!notes || !notes.toLowerCase().includes('developmental'))) {
      return NextResponse.json({ 
        error: 'Seller budgets are calculated automatically from their accounts. Only developmental goals can be set at the seller level.' 
      }, { status: 400 })
    }

    // Get organization slug
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Verify entity exists and get additional data
    let entityName = ''
    let sellerId = ''
    let agencyId = null

    if (entityType === 'advertiser') {
      const advertiserQuery = `
        SELECT a.name, a."sellerId", a."agencyId" 
        FROM "Advertiser" a 
        WHERE a.id = $1 AND a."isActive" = true
      `
      const { data: advertiser, error } = await safeQuerySchema(orgSlug, advertiserQuery, [entityId])
      
      if (error || !advertiser || advertiser.length === 0) {
        console.error('Advertiser validation failed:', { entityId, error })
        return NextResponse.json({ error: 'Advertiser not found or inactive' }, { status: 404 })
      }

      // Additional validation: ensure advertiser name exists
      if (!advertiser[0].name || advertiser[0].name.trim() === '') {
        console.error('Advertiser has blank name:', { entityId, name: advertiser[0].name })
        return NextResponse.json({ error: 'Advertiser has invalid name' }, { status: 400 })
      }

      entityName = advertiser[0].name
      sellerId = advertiser[0].sellerId || user.id // Default to current user if not assigned
      agencyId = advertiser[0].agencyId
    } else if (entityType === 'agency') {
      const agencyQuery = `
        SELECT ag.name, ag."sellerId" 
        FROM "Agency" ag 
        WHERE ag.id = $1 AND ag."isActive" = true
      `
      const { data: agency, error } = await safeQuerySchema(orgSlug, agencyQuery, [entityId])
      
      if (error || !agency || agency.length === 0) {
        console.error('Agency validation failed:', { entityId, error })
        return NextResponse.json({ error: 'Agency not found or inactive' }, { status: 404 })
      }

      // Additional validation: ensure agency name exists
      if (!agency[0].name || agency[0].name.trim() === '') {
        console.error('Agency has blank name:', { entityId, name: agency[0].name })
        return NextResponse.json({ error: 'Agency has invalid name' }, { status: 400 })
      }

      entityName = agency[0].name
      sellerId = agency[0].sellerId || user.id
    } else if (entityType === 'seller') {
      // For seller type, entityId should be a user ID with sales role
      // Note: User table is in public schema, not organization schema
      console.log('Looking up seller with ID:', entityId)
      const sellerUser = await UserService.findById(entityId)
      
      if (!sellerUser || sellerUser.role !== 'sales' || !sellerUser.isActive) {
        console.error('Seller validation failed:', { 
          found: !!sellerUser, 
          role: sellerUser?.role, 
          isActive: sellerUser?.isActive 
        })
        return NextResponse.json({ error: 'Seller not found' }, { status: 404 })
      }

      entityName = sellerUser.name || 'Unknown Seller'
      sellerId = entityId
      console.log('Seller validated successfully:', { entityName, sellerId })
    }

    // Only admin and master users can create budgets
    console.log('User role check passed:', { userRole: user.role, userId: user.id, sellerId })

    // Check for existing budget entry
    const existingQuery = `
      SELECT * FROM "HierarchicalBudget"
      WHERE "organizationId" = $1 
        AND "entityType" = $2 
        AND "entityId" = $3 
        AND "year" = $4 
        AND "month" = $5
    `
    console.log('Checking for existing budget with params:', { 
      organizationId: user.organizationId, 
      entityType, 
      entityId, 
      year, 
      month 
    })
    const { data: existing, error: existingError } = await safeQuerySchema(orgSlug, existingQuery, [user.organizationId, entityType, entityId, year, month])
    
    if (existingError) {
      console.error('Error checking existing budget:', existingError)
      return NextResponse.json({ error: 'Failed to check existing budget' }, { status: 500 })
    }
    
    if (existing && existing.length > 0) {
      console.log('Budget already exists for this entity and period')
      // For developmental goals, silently return the existing one instead of throwing error
      if (notes?.includes('Developmental business goal')) {
        console.log('Returning existing developmental goal')
        return NextResponse.json(existing[0])
      }
      return NextResponse.json({ 
        error: 'Budget entry already exists for this entity and period' 
      }, { status: 400 })
    }

    // Get previous year actual for comparison
    const prevYearQuery = `
      SELECT "actualAmount" FROM "HierarchicalBudget"
      WHERE "organizationId" = $1 
        AND "entityType" = $2 
        AND "entityId" = $3 
        AND "year" = $4 
        AND "month" = $5
    `
    const { data: prevYear } = await safeQuerySchema(orgSlug, prevYearQuery, [user.organizationId, entityType, entityId, year - 1, month])
    const previousYearActual = prevYear && prevYear.length > 0 ? prevYear[0].actualAmount : 0

    // Create budget entry
    const insertQuery = `
      INSERT INTO "HierarchicalBudget" (
        "organizationId", "year", "month", "entityType", "entityId", "entityName",
        "budgetAmount", "sellerId", "agencyId", "previousYearActual", "notes", "createdBy"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `

    const { data: newBudget, error: insertError } = await safeQuerySchema(orgSlug, insertQuery, [
      user.organizationId, year, month, entityType, entityId, entityName,
      budgetAmount, sellerId, agencyId, previousYearActual, notes, user.id
    ])

    if (insertError || !newBudget || newBudget.length === 0) {
      console.error('Error creating budget entry:', insertError)
      return NextResponse.json({ error: 'Failed to create budget entry' }, { status: 500 })
    }

    return NextResponse.json(newBudget[0])

  } catch (error) {
    console.error('Error creating hierarchical budget:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}