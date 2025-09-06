import { NextRequest, NextResponse } from 'next/server'
import { withApiProtection } from '@/lib/auth/api-protection'
import { analyticsSimulator } from '@/lib/analytics/event-simulator'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


// POST /api/analytics/real-time/simulate - Start analytics simulation
export const POST = await withApiProtection(async (request: NextRequest) => {
  try {
    const body = await request.json()
    const { 
      campaignIds, 
      organizationId, 
      action = 'start',
      options = {} 
    } = body

    console.log('🎯 Analytics simulation request:', { action, campaignIds: campaignIds?.length })

    switch (action) {
      case 'start':
        if (!campaignIds || !Array.isArray(campaignIds) || campaignIds.length === 0) {
          return NextResponse.json(
            { error: 'campaignIds array is required' },
            { status: 400 }
          )
        }

        if (!organizationId) {
          return NextResponse.json(
            { error: 'organizationId is required' },
            { status: 400 }
          )
        }

        await analyticsSimulator.startSimulation(campaignIds, organizationId, options)

        return NextResponse.json({
          success: true,
          message: 'Analytics simulation started',
          campaignIds,
          options,
          timestamp: new Date().toISOString()
        })

      case 'stop':
        analyticsSimulator.stopSimulation()

        return NextResponse.json({
          success: true,
          message: 'Analytics simulation stopped',
          timestamp: new Date().toISOString()
        })

      case 'burst':
        if (!campaignIds || !Array.isArray(campaignIds) || campaignIds.length === 0) {
          return NextResponse.json(
            { error: 'campaignIds array is required' },
            { status: 400 }
          )
        }

        if (!organizationId) {
          return NextResponse.json(
            { error: 'organizationId is required' },
            { status: 400 }
          )
        }

        const count = options.count || 100
        await analyticsSimulator.generateEventBurst(campaignIds, organizationId, count)

        return NextResponse.json({
          success: true,
          message: `Generated ${count} events`,
          campaignIds,
          count,
          timestamp: new Date().toISOString()
        })

      case 'journey':
        if (!campaignIds || campaignIds.length === 0) {
          return NextResponse.json(
            { error: 'At least one campaignId is required' },
            { status: 400 }
          )
        }

        if (!organizationId) {
          return NextResponse.json(
            { error: 'organizationId is required' },
            { status: 400 }
          )
        }

        // Simulate user journey for each campaign
        for (const campaignId of campaignIds) {
          await analyticsSimulator.simulateUserJourney(campaignId, organizationId)
        }

        return NextResponse.json({
          success: true,
          message: `Simulated user journeys for ${campaignIds.length} campaigns`,
          campaignIds,
          timestamp: new Date().toISOString()
        })

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: start, stop, burst, or journey' },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('❌ Analytics simulation error:', error)
    return NextResponse.json(
      { error: 'Failed to handle simulation request' },
      { status: 500 }
    )
  }
})

// GET /api/analytics/real-time/simulate - Get simulation status
export const GET = await withApiProtection(async (request: NextRequest) => {
  try {
    const status = analyticsSimulator.getStatus()

    return NextResponse.json({
      success: true,
      status,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Simulation status error:', error)
    return NextResponse.json(
      { error: 'Failed to get simulation status' },
      { status: 500 }
    )
  }
})
