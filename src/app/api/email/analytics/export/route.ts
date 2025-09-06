import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { format, data, dateRange } = body

    if (format !== 'pdf') {
      return NextResponse.json({ error: 'Invalid format' }, { status: 400 })
    }

    // Create PDF
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    
    // Header
    doc.setFontSize(20)
    doc.text('Email Analytics Report', pageWidth / 2, 20, { align: 'center' })
    
    doc.setFontSize(12)
    doc.setTextColor(100)
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, pageWidth / 2, 30, { align: 'center' })
    doc.text(`Period: Last ${dateRange.days} days (${dateRange.groupBy})`, pageWidth / 2, 36, { align: 'center' })
    
    let yPosition = 50
    
    // Summary Section
    doc.setFontSize(16)
    doc.setTextColor(0)
    doc.text('Summary', 14, yPosition)
    yPosition += 10
    
    const summaryData = [
      ['Metric', 'Count', 'Rate'],
      ['Emails Sent', data.summary.totalSent.toLocaleString(), ''],
      ['Delivered', data.summary.totalDelivered.toLocaleString(), `${data.summary.deliveryRate.toFixed(2)}%`],
      ['Opened', data.summary.totalOpened.toLocaleString(), `${data.summary.openRate.toFixed(2)}%`],
      ['Unique Opens', data.summary.uniqueOpens.toLocaleString(), ''],
      ['Clicked', data.summary.totalClicked.toLocaleString(), `${data.summary.clickRate.toFixed(2)}%`],
      ['Unique Clicks', data.summary.uniqueClicks.toLocaleString(), ''],
      ['Bounced', data.summary.totalBounced.toLocaleString(), `${data.summary.bounceRate.toFixed(2)}%`],
      ['Complained', data.summary.totalComplained.toLocaleString(), `${data.summary.complaintRate.toFixed(2)}%`]
    ]
    
    autoTable(doc, {
      startY: yPosition,
      head: [summaryData[0]],
      body: summaryData.slice(1),
      theme: 'striped',
      headStyles: { fillColor: [33, 150, 243] },
      margin: { left: 14, right: 14 }
    })
    
    yPosition = (doc as any).lastAutoTable.finalY + 15
    
    // Top Templates Section
    doc.setFontSize(16)
    doc.text('Top Email Templates', 14, yPosition)
    yPosition += 10
    
    const templateData = [
      ['Template', 'Sent', 'Delivery Rate', 'Open Rate'],
      ...data.templates.slice(0, 10).map((t: any) => [
        t.name,
        t.sent.toLocaleString(),
        `${t.deliveryRate.toFixed(1)}%`,
        `${t.openRate.toFixed(1)}%`
      ])
    ]
    
    autoTable(doc, {
      startY: yPosition,
      head: [templateData[0]],
      body: templateData.slice(1),
      theme: 'striped',
      headStyles: { fillColor: [33, 150, 243] },
      margin: { left: 14, right: 14 }
    })
    
    yPosition = (doc as any).lastAutoTable.finalY + 15
    
    // Check if we need a new page
    if (yPosition > 250) {
      doc.addPage()
      yPosition = 20
    }
    
    // Bounce & Suppression Stats
    doc.setFontSize(16)
    doc.text('Delivery Issues', 14, yPosition)
    yPosition += 10
    
    doc.setFontSize(12)
    doc.text(`Total Bounces: ${data.bounces.total}`, 14, yPosition)
    yPosition += 6
    
    Object.entries(data.bounces.byType).forEach(([type, count]) => {
      doc.text(`  • ${type}: ${count}`, 14, yPosition)
      yPosition += 6
    })
    
    yPosition += 4
    doc.text(`Total Suppressed: ${data.suppression.total}`, 14, yPosition)
    yPosition += 6
    
    Object.entries(data.suppression.byReason).forEach(([reason, count]) => {
      doc.text(`  • ${reason.replace('_', ' ')}: ${count}`, 14, yPosition)
      yPosition += 6
    })
    
    // Warnings
    if (data.summary.bounceRate > 5 || data.summary.complaintRate > 0.1) {
      yPosition += 10
      doc.setFontSize(14)
      doc.setTextColor(255, 0, 0)
      doc.text('Warnings', 14, yPosition)
      yPosition += 8
      
      doc.setFontSize(11)
      if (data.summary.bounceRate > 5) {
        doc.text(`• High bounce rate (${data.summary.bounceRate.toFixed(1)}%) - above 5% threshold`, 14, yPosition)
        yPosition += 6
      }
      
      if (data.summary.complaintRate > 0.1) {
        doc.text(`• High complaint rate (${data.summary.complaintRate.toFixed(2)}%) - above 0.1% threshold`, 14, yPosition)
        yPosition += 6
      }
    }
    
    // Footer
    const pageCount = doc.internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(10)
      doc.setTextColor(150)
      doc.text(
        `Page ${i} of ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      )
    }
    
    // Generate buffer
    const pdfBuffer = doc.output('arraybuffer')
    
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="email-analytics-${new Date().toISOString().split('T')[0]}.pdf"`
      }
    })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}