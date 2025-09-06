import { NextRequest, NextResponse } from 'next/server'
import { withMasterProtection } from '@/lib/auth/api-protection'
import { auditService, AuditEventType, AuditSeverity } from '@/lib/audit/audit-service'

// POST /api/audit/retention - Run audit log retention cleanup (master only)
export const POST = await withMasterProtection(async (request: NextRequest) => {
  try {
    const body = await request.json()
    const { retentionDays = 365 } = body
    const { user } = request as any

    if (retentionDays < 90) {
      return NextResponse.json(
        { error: 'Retention period must be at least 90 days' },
        { status: 400 }
      )
    }

    console.log('🗑️ Running audit log retention cleanup:', {
      retentionDays
    })

    const deletedCount = await auditService.retainAuditLogs(retentionDays)

    // Log retention activity
    await auditService.log({
      eventType: AuditEventType.SETTINGS_CHANGED,
      severity: AuditSeverity.HIGH,
      userId: user.id,
      action: 'Ran audit log retention cleanup',
      details: {
        retentionDays,
        deletedCount
      },
      success: true
    })

    return NextResponse.json({
      success: true,
      retentionDays,
      deletedCount,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Audit retention error:', error)
    return NextResponse.json(
      { error: 'Failed to run retention cleanup' },
      { status: 500 }
    )
  }
})

// GET /api/audit/retention - Get retention policy (master only)
export const GET = await withMasterProtection(async (request: NextRequest) => {
  try {
    // For now, return the default policy
    const policy = {
      retentionDays: 365,
      criticalEventRetention: 'indefinite',
      lastCleanup: null, // Could be stored in a settings table
      nextScheduledCleanup: null
    }

    return NextResponse.json({
      policy,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Retention policy error:', error)
    return NextResponse.json(
      { error: 'Failed to get retention policy' },
      { status: 500 }
    )
  }
})