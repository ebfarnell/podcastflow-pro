import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug, querySchema, safeQuerySchema } from '@/lib/db/schema-db'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Get session and verify authentication
    const authToken = request.cookies.get('auth-token')?.value
    if (!authToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken)
    if (!user || !['master', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : new Date().getFullYear()

    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Fetch revenue forecasts
    const forecastsQuery = `
      SELECT 
        id,
        year,
        month,
        "forecastAmount",
        notes,
        "createdAt",
        "updatedAt"
      FROM "RevenueForecast"
      WHERE "organizationId" = $1 AND year = $2
      ORDER BY month ASC
    `
    
    const { data: forecasts = [], error } = await safeQuerySchema(orgSlug, forecastsQuery, [user.organizationId!, year])
    
    if (error) {
      console.error('Error fetching forecasts:', error)
      // Return empty array instead of error
      return NextResponse.json({ forecasts: [], year })
    }

    // Format month names
    const formattedForecasts = forecasts.map(forecast => ({
      ...forecast,
      month: new Date(year, forecast.month - 1).toLocaleString('default', { month: 'short', year: 'numeric' })
    }))

    return NextResponse.json({
      forecasts: formattedForecasts,
      year
    })
  } catch (error) {
    console.error('Error fetching revenue forecasts:', error)
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
    if (!user || !['master', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { year, forecasts } = body

    if (!year || !forecasts || typeof forecasts !== 'object') {
      return NextResponse.json({ 
        error: 'Year and forecasts are required' 
      }, { status: 400 })
    }

    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Process each forecast entry
    const promises = []
    
    for (const [monthStr, forecastAmount] of Object.entries(forecasts)) {
      // Extract month number from format "Jan 2025"
      const monthDate = new Date(monthStr)
      const month = monthDate.getMonth() + 1

      // Upsert forecast entry
      const upsertQuery = `
        INSERT INTO "RevenueForecast" (
          "organizationId", 
          year, 
          month, 
          "forecastAmount", 
          "createdBy",
          "createdAt",
          "updatedAt"
        )
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT ("organizationId", year, month) 
        DO UPDATE SET 
          "forecastAmount" = EXCLUDED."forecastAmount",
          "updatedBy" = $5,
          "updatedAt" = CURRENT_TIMESTAMP
        RETURNING *
      `

      promises.push(
        querySchema(orgSlug, upsertQuery, [
          user.organizationId!,
          year,
          month,
          forecastAmount,
          user.id
        ])
      )
    }

    await Promise.all(promises)

    return NextResponse.json({ 
      success: true, 
      message: 'Forecasts updated successfully' 
    })
  } catch (error) {
    console.error('Error saving revenue forecasts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}