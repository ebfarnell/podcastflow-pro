import { NextRequest, NextResponse } from 'next/server'
import { withApiProtection } from '@/lib/auth/api-protection'
import { auditService, AuditEventType, AuditSeverity } from '@/lib/audit/audit-service'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


// GET /api/audit/export - Export audit logs
export const GET = await withApiProtection(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const { user } = request as any

    // Only admin and master can export audit logs
    if (user.role !== 'master' && user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const organizationId = user.role === 'master'
      ? (searchParams.get('organizationId') || user.organizationId)
      : user.organizationId

    const format = searchParams.get('format') || 'json'
    if (!['json', 'csv'].includes(format)) {
      return NextResponse.json(
        { error: 'Invalid format. Use json or csv' },
        { status: 400 }
      )
    }

    // Build filters
    const filters: any = {}
    
    if (searchParams.get('userId')) {
      filters.userId = searchParams.get('userId')
    }

    if (searchParams.get('eventType')) {
      filters.eventType = searchParams.get('eventType')
    }

    if (searchParams.get('severity')) {
      filters.severity = searchParams.get('severity')
    }

    if (searchParams.get('startDate')) {
      filters.startDate = new Date(searchParams.get('startDate')!)
    }

    if (searchParams.get('endDate')) {
      filters.endDate = new Date(searchParams.get('endDate')!)
    }

    console.log('📤 Exporting audit logs:', {
      organizationId,
      format,
      filters
    })

    const exportData = await auditService.exportAuditLogs(
      organizationId,
      format as 'json' | 'csv',
      filters
    )

    // Log export activity
    await auditService.log({
      eventType: AuditEventType.DATA_EXPORTED,
      severity: AuditSeverity.MEDIUM,
      userId: user.id,
      organizationId,
      action: `Exported audit logs in ${format} format`,
      details: {
        format,
        filters,
        exportSize: exportData.length
      },
      success: true
    })

    // Set appropriate headers
    const headers: HeadersInit = {
      'Content-Type': format === 'json' ? 'application/json' : 'text/csv',
      'Content-Disposition': `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.${format}"`
    }

    return new NextResponse(exportData, {
      status: 200,
      headers
    })

  } catch (error) {
    console.error('❌ Audit export error:', error)
    return NextResponse.json(
      { error: 'Failed to export audit logs' },
      { status: 500 }
    )
  }
})
