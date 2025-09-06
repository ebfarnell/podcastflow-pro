import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import { jsPDF } from 'jspdf'
import 'jspdf-autotable'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


// Extend jsPDF type to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF
  }
}

export async function POST(request: NextRequest) {
  try {
    // Validate session
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, config, format, settings } = await request.json()

    if (!data || !config || !format) {
      return NextResponse.json(
        { error: 'Data, config, and format are required' },
        { status: 400 }
      )
    }

    switch (format) {
      case 'pdf':
        return await exportToPDF(data, config, settings)
      case 'csv':
        return await exportToCSVFormat(data, config)
      case 'json':
        return await exportToJSONFormat(data, config)
      default:
        return NextResponse.json(
          { error: 'Unsupported export format' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json(
      { error: 'Failed to export report' },
      { status: 500 }
    )
  }
}

async function exportToPDF(data: any[], config: any, settings: any) {
  try {
    const fileName = `custom-report-${config.name.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.pdf`
    
    // Create a new PDF document
    const doc = new jsPDF({
      orientation: settings?.orientation === 'landscape' ? 'landscape' : 'portrait',
      unit: 'mm',
      format: 'a4'
    })

    // Add title
    doc.setFontSize(18)
    doc.text(`Custom Report: ${config.name}`, 14, 20)
    
    // Add metadata
    doc.setFontSize(10)
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 28)
    doc.text(`Total Records: ${data.length}`, 14, 34)
    
    // Prepare table data
    const headers = [...(config.dimensions || []), ...(config.metrics || [])]
    const tableHeaders = headers.map(h => h.name || h)
    
    const tableData = data.map(row => {
      return headers.map(header => {
        const value = row[header.id || header]
        return formatValueForPDF(value, header.dataType)
      })
    })

    // Add table using autoTable plugin
    doc.autoTable({
      head: [tableHeaders],
      body: tableData,
      startY: 40,
      theme: 'striped',
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontSize: 10,
        fontStyle: 'bold'
      },
      bodyStyles: {
        fontSize: 9
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      },
      margin: { top: 40 },
      pageBreak: 'auto',
      styles: {
        overflow: 'linebreak',
        cellWidth: 'wrap'
      },
      columnStyles: {
        // Auto-width for all columns
      },
      didDrawPage: function (data: any) {
        // Footer
        doc.setFontSize(8)
        doc.text(
          `Page ${data.pageNumber} of ${doc.getNumberOfPages()}`,
          data.settings.margin.left,
          doc.internal.pageSize.height - 10
        )
      }
    })

    // Add summary if requested
    if (settings?.includeSummary && data.length > 0) {
      const lastY = (doc as any).lastAutoTable.finalY || 40
      
      if (lastY < doc.internal.pageSize.height - 60) {
        doc.setFontSize(12)
        doc.text('Summary:', 14, lastY + 15)
        
        doc.setFontSize(10)
        const metrics = config.metrics || []
        metrics.forEach((metric: any, idx: number) => {
          if (metric.dataType === 'number' || metric.dataType === 'currency') {
            const values = data.map(row => Number(row[metric.id]) || 0)
            const sum = values.reduce((a, b) => a + b, 0)
            const avg = sum / values.length
            
            const summaryText = `${metric.name}: Total = ${formatValueForPDF(sum, metric.dataType)}, Average = ${formatValueForPDF(avg, metric.dataType)}`
            doc.text(summaryText, 14, lastY + 25 + (idx * 6))
          }
        })
      }
    }

    // Convert to blob
    const pdfBlob = doc.output('blob')

    return new NextResponse(pdfBlob, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    })
  } catch (error) {
    console.error('PDF export error:', error)
    throw error
  }
}

async function exportToCSVFormat(data: any[], config: any) {
  try {
    const fileName = `custom-report-${config.name.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv`
    
    // Generate CSV content
    let csvContent = `"Custom Report: ${config.name}"\n`
    csvContent += `"Generated on: ${new Date().toLocaleDateString()}"\n\n`
    
    // Add headers
    const headers = [...(config.dimensions || []), ...(config.metrics || [])]
    csvContent += headers.map(h => `"${h.name || h}"`).join(',') + '\n'
    
    // Add data rows
    data.forEach(row => {
      const values = headers.map(header => {
        const value = row[header.id || header] || ''
        // Escape values that contain commas, quotes, or newlines
        if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
          return `"${value.replace(/"/g, '""')}"`
        }
        return `"${value}"`
      })
      csvContent += values.join(',') + '\n'
    })

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    })
  } catch (error) {
    console.error('CSV export error:', error)
    throw error
  }
}

async function exportToJSONFormat(data: any[], config: any) {
  try {
    const fileName = `custom-report-${config.name.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.json`
    
    const exportData = {
      reportName: config.name,
      reportType: config.type,
      generatedAt: new Date().toISOString(),
      configuration: {
        dimensions: config.dimensions,
        metrics: config.metrics,
        filters: config.filters,
        dateRange: config.dateRange
      },
      data,
      metadata: {
        totalRows: data.length,
        totalColumns: (config.dimensions?.length || 0) + (config.metrics?.length || 0)
      }
    }

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    })
  } catch (error) {
    console.error('JSON export error:', error)
    throw error
  }
}

function formatValueForPDF(value: any, dataType?: string): string {
  if (value === null || value === undefined) return '-'
  
  switch (dataType) {
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(Number(value) || 0)
    case 'percentage':
      return `${(Number(value) || 0).toFixed(1)}%`
    case 'number':
      return new Intl.NumberFormat('en-US').format(Number(value) || 0)
    case 'date':
      return new Date(value).toLocaleDateString()
    default:
      return String(value)
  }
}
