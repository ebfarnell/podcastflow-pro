import { NextRequest, NextResponse } from 'next/server'
import { withApiProtection } from '@/lib/auth/api-protection'
import { comprehensiveQuickBooksService } from '@/lib/quickbooks/comprehensive-service'
import prisma from '@/lib/db/prisma'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


// GET /api/quickbooks/export - Export QuickBooks data
export const GET = await withApiProtection(async (
  request: NextRequest,
  context: any,
  { user, organization }
) => {
  try {
    // Check if user has appropriate permissions
    if (!user || !['master', 'admin'].includes(user.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const url = new URL(request.url)
    const format = url.searchParams.get('format') || 'json'
    const entityTypes = url.searchParams.get('entities')?.split(',') || []
    const startDate = url.searchParams.get('startDate')
    const endDate = url.searchParams.get('endDate')
    const includeInactive = url.searchParams.get('includeInactive') === 'true'

    // Validate format
    if (!['json', 'csv'].includes(format)) {
      return NextResponse.json(
        { error: 'Invalid format. Supported formats: json, csv' },
        { status: 400 }
      )
    }

    // Default entity types if none specified
    const defaultEntityTypes = [
      'Account', 'Customer', 'Vendor', 'Item', 'Invoice', 'Bill'
    ]
    const entitiesToExport = entityTypes.length > 0 ? entityTypes : defaultEntityTypes

    // Validate entity types
    const validEntities = [
      'Account', 'Customer', 'Vendor', 'Item', 'Invoice', 'Bill', 'Payment',
      'Employee', 'Class', 'Department', 'TaxCode', 'TaxRate', 'Term',
      'PaymentMethod', 'TimeActivity', 'Transfer', 'Deposit', 'Purchase',
      'PurchaseOrder', 'Estimate', 'CreditMemo', 'RefundReceipt', 'SalesReceipt',
      'JournalEntry', 'VendorCredit', 'BillPayment', 'Budget', 'ExchangeRate'
    ]

    const invalidEntities = entitiesToExport.filter(entity => !validEntities.includes(entity))
    if (invalidEntities.length > 0) {
      return NextResponse.json(
        { 
          error: `Invalid entities: ${invalidEntities.join(', ')}`,
          validEntities 
        },
        { status: 400 }
      )
    }

    // Build export data
    const exportData: any = {
      metadata: {
        exportedAt: new Date().toISOString(),
        organizationId: organization.id,
        format,
        entities: entitiesToExport,
        dateRange: startDate && endDate ? { startDate, endDate } : null,
        includeInactive
      },
      data: {}
    }

    // Fetch data for each entity type
    for (const entityType of entitiesToExport) {
      try {
        let query = `SELECT * FROM ${entityType}`
        const conditions: string[] = []

        // Add active filter if not including inactive
        if (!includeInactive && ['Account', 'Customer', 'Vendor', 'Item'].includes(entityType)) {
          conditions.push('Active = true')
        }

        // Add date filters for transactional entities
        if (startDate && endDate && ['Invoice', 'Bill', 'Payment', 'TimeActivity', 'JournalEntry'].includes(entityType)) {
          const dateField = entityType === 'TimeActivity' ? 'TxnDate' : 'TxnDate'
          conditions.push(`${dateField} >= '${startDate}' AND ${dateField} <= '${endDate}'`)
        }

        if (conditions.length > 0) {
          query += ` WHERE ${conditions.join(' AND ')}`
        }

        query += ` ORDER BY MetaData.CreateTime DESC MAXRESULTS 1000`

        const response = await comprehensiveQuickBooksService.queryEntities(
          organization.id,
          query
        )

        exportData.data[entityType] = response.QueryResponse?.[entityType] || []
        
      } catch (error) {
        console.warn(`Failed to export ${entityType}:`, error)
        exportData.data[entityType] = { error: 'Failed to fetch data' }
      }
    }

    // Add summary statistics
    exportData.summary = {
      totalEntities: entitiesToExport.length,
      recordCounts: Object.fromEntries(
        Object.entries(exportData.data).map(([key, value]) => [
          key, 
          Array.isArray(value) ? value.length : 0
        ])
      ),
      totalRecords: Object.values(exportData.data).reduce(
        (sum, value) => sum + (Array.isArray(value) ? value.length : 0), 
        0
      )
    }

    // Handle different export formats
    if (format === 'csv') {
      // For CSV, we'll export the largest entity type
      const largestEntity = Object.entries(exportData.summary.recordCounts)
        .reduce((max, [entity, count]) => 
          (count as number) > (exportData.summary.recordCounts[max] || 0) ? entity : max
        )

      const csvData = exportData.data[largestEntity] || []
      
      if (csvData.length === 0) {
        return NextResponse.json(
          { error: 'No data available for CSV export' },
          { status: 404 }
        )
      }

      // Convert to CSV
      const headers = Object.keys(csvData[0] || {})
      const csvRows = [
        headers.join(','),
        ...csvData.map((row: any) => 
          headers.map(header => {
            const value = row[header]
            if (typeof value === 'object' && value !== null) {
              return `"${JSON.stringify(value).replace(/"/g, '""')}"`
            }
            return `"${String(value || '').replace(/"/g, '""')}"`
          }).join(',')
        )
      ]

      const csvContent = csvRows.join('\n')
      
      return new Response(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="quickbooks-${largestEntity}-${new Date().toISOString().split('T')[0]}.csv"`
        }
      })
    }

    // For JSON format
    return NextResponse.json(exportData, {
      headers: {
        'Content-Disposition': `attachment; filename="quickbooks-export-${new Date().toISOString().split('T')[0]}.json"`
      }
    })

  } catch (error) {
    console.error('QuickBooks export error:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('not found') || error.message.includes('not connected')) {
        return NextResponse.json(
          { error: 'QuickBooks integration not found or not connected' },
          { status: 404 }
        )
      }
      
      if (error.message.includes('token') || error.message.includes('unauthorized')) {
        return NextResponse.json(
          { error: 'QuickBooks authentication failed. Please reconnect.' },
          { status: 401 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Failed to export data from QuickBooks' },
      { status: 500 }
    )
  }
}, ['QUICKBOOKS_READ'])

// POST /api/quickbooks/export - Create export job for large datasets
export const POST = await withApiProtection(async (
  request: NextRequest,
  context: any,
  { user, organization }
) => {
  try {
    // Check if user has appropriate permissions
    if (!user || !['master', 'admin'].includes(user.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const body = await request.json()
    
    // Validate request body
    const { entities, format, startDate, endDate, includeInactive, email } = body

    if (!entities || !Array.isArray(entities) || entities.length === 0) {
      return NextResponse.json(
        { error: 'entities array is required' },
        { status: 400 }
      )
    }

    // Create export job record
    const exportJob = await prisma.quickBooksSync.create({
      data: {
        organizationId: organization.id,
        syncType: 'export',
        status: 'pending',
        startedAt: new Date(),
        createdBy: user.id,
        errors: {
          exportRequest: {
            entities,
            format,
            startDate,
            endDate,
            includeInactive,
            email,
            requestedBy: {
              id: user.id,
              name: user.name,
              email: user.email
            }
          }
        }
      }
    })

    // For now, we'll process the export immediately
    // In a production system, you might queue this for background processing
    try {
      const exportData: any = {
        metadata: {
          jobId: exportJob.id,
          exportedAt: new Date().toISOString(),
          organizationId: organization.id,
          format: format || 'json',
          entities,
          dateRange: startDate && endDate ? { startDate, endDate } : null,
          includeInactive: includeInactive || false
        },
        data: {}
      }

      // Fetch data for each entity type
      for (const entityType of entities) {
        try {
          let query = `SELECT * FROM ${entityType}`
          const conditions: string[] = []

          if (!includeInactive && ['Account', 'Customer', 'Vendor', 'Item'].includes(entityType)) {
            conditions.push('Active = true')
          }

          if (startDate && endDate && ['Invoice', 'Bill', 'Payment', 'TimeActivity', 'JournalEntry'].includes(entityType)) {
            conditions.push(`TxnDate >= '${startDate}' AND TxnDate <= '${endDate}'`)
          }

          if (conditions.length > 0) {
            query += ` WHERE ${conditions.join(' AND ')}`
          }

          query += ` ORDER BY MetaData.CreateTime DESC MAXRESULTS 5000`

          const response = await comprehensiveQuickBooksService.queryEntities(
            organization.id,
            query
          )

          exportData.data[entityType] = response.QueryResponse?.[entityType] || []
          
        } catch (error) {
          console.warn(`Failed to export ${entityType}:`, error)
          exportData.data[entityType] = { error: 'Failed to fetch data' }
        }
      }

      // Update job status
      await prisma.quickBooksSync.update({
        where: { id: exportJob.id },
        data: {
          status: 'completed',
          completedAt: new Date(),
          recordsProcessed: Object.values(exportData.data).reduce(
            (sum, value) => sum + (Array.isArray(value) ? value.length : 0), 
            0
          ),
          errors: {
            ...exportJob.errors,
            exportResult: {
              recordCounts: Object.fromEntries(
                Object.entries(exportData.data).map(([key, value]) => [
                  key, 
                  Array.isArray(value) ? value.length : 0
                ])
              ),
              totalRecords: Object.values(exportData.data).reduce(
                (sum, value) => sum + (Array.isArray(value) ? value.length : 0), 
                0
              )
            }
          }
        }
      })

      return NextResponse.json({
        success: true,
        jobId: exportJob.id,
        status: 'completed',
        data: exportData
      })

    } catch (processingError) {
      // Update job status to failed
      await prisma.quickBooksSync.update({
        where: { id: exportJob.id },
        data: {
          status: 'failed',
          completedAt: new Date(),
          errors: {
            ...exportJob.errors,
            processingError: processingError instanceof Error ? processingError.message : 'Unknown error'
          }
        }
      })

      throw processingError
    }

  } catch (error) {
    console.error('QuickBooks export job error:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('not found') || error.message.includes('not connected')) {
        return NextResponse.json(
          { error: 'QuickBooks integration not found or not connected' },
          { status: 404 }
        )
      }
      
      if (error.message.includes('token') || error.message.includes('unauthorized')) {
        return NextResponse.json(
          { error: 'QuickBooks authentication failed. Please reconnect.' },
          { status: 401 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Failed to create export job' },
      { status: 500 }
    )
  }
}, ['QUICKBOOKS_READ'])
