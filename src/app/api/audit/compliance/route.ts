import { NextRequest, NextResponse } from 'next/server'
import { withApiProtection } from '@/lib/auth/api-protection'
import { auditService } from '@/lib/audit/audit-service'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


// GET /api/audit/compliance - Generate compliance report
export const GET = await withApiProtection(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const { user } = request as any

    // Only admin and master can generate compliance reports
    if (user.role !== 'master' && user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const organizationId = user.role === 'master'
      ? (searchParams.get('organizationId') || user.organizationId)
      : user.organizationId

    const startDate = searchParams.get('startDate')
      ? new Date(searchParams.get('startDate')!)
      : new Date(new Date().setMonth(new Date().getMonth() - 1))

    const endDate = searchParams.get('endDate')
      ? new Date(searchParams.get('endDate')!)
      : new Date()

    console.log('📊 Generating compliance report:', {
      organizationId,
      startDate,
      endDate
    })

    const report = await auditService.generateComplianceReport(
      organizationId,
      startDate,
      endDate
    )

    // Log compliance report generation
    await auditService.log({
      eventType: AuditEventType.REPORT_GENERATED,
      severity: AuditSeverity.MEDIUM,
      userId: user.id,
      organizationId,
      action: 'Generated compliance report',
      details: {
        period: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        }
      },
      success: true
    })

    return NextResponse.json({
      report,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Compliance report error:', error)
    return NextResponse.json(
      { error: 'Failed to generate compliance report' },
      { status: 500 }
    )
  }
})

// Import AuditEventType and AuditSeverity
