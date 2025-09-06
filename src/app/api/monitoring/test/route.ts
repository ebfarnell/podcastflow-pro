import { NextRequest, NextResponse } from 'next/server'
import { monitoringService } from '@/lib/monitoring/monitoring-service'
import { withMonitoring } from '@/lib/monitoring/monitoring-middleware'
import prisma from '@/lib/db/prisma'

// Test endpoint to verify monitoring is working
export const GET = withMonitoring(async (request: NextRequest) => {
  try {
    const testStartTime = Date.now()
    
    // Perform real system checks instead of random simulation
    const userCount = await prisma.user.count()
    const orgCount = await prisma.organization.count()
    
    const processingTime = Date.now() - testStartTime

    // Return success response with real metrics
    return NextResponse.json({
      message: 'Monitoring test successful',
      timestamp: new Date().toISOString(),
      metrics: {
        userCount,
        organizationCount: orgCount,
        processingTime,
        timestamp: Date.now()
      }
    })
  } catch (error) {
    console.error('Test endpoint error:', error)
    return NextResponse.json(
      { error: 'Test error occurred' },
      { status: 500 }
    )
  }
})