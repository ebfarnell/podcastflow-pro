import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { safeQuerySchema } from '@/lib/db/schema-db'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin and sales can export schedules
    if (!['admin', 'sales', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'pdf'

    // Get schedule with all related data
    const { data: scheduleData } = await safeQuerySchema(
      session.organizationSlug,
      `
        SELECT 
          s.*,
          a.name as "advertiserName",
          ag.name as "agencyName",
          c.name as "campaignName",
          u1.name as "createdByName"
        FROM "ScheduleBuilder" s
        LEFT JOIN "Advertiser" a ON s."advertiserId" = a.id
        LEFT JOIN "Agency" ag ON s."agencyId" = ag.id
        LEFT JOIN "Campaign" c ON s."campaignId" = c.id
        LEFT JOIN public."User" u1 ON s."createdBy" = u1.id
        WHERE s.id = $1
      `,
      [params.id]
    )

    if (!scheduleData || scheduleData.length === 0) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
    }

    const schedule = scheduleData[0]

    // Get schedule items
    const { data: items } = await safeQuerySchema(
      session.organizationSlug,
      `
        SELECT 
          si.*,
          s.name as "showName",
          e.title as "episodeTitle",
          e."episodeNumber"
        FROM "ScheduleBuilderItem" si
        JOIN "Show" s ON si."showId" = s.id
        LEFT JOIN "Episode" e ON si."episodeId" = e.id
        WHERE si."scheduleId" = $1
        ORDER BY si."airDate", s.name, si."placementType"
      `,
      [params.id]
    )

    if (format === 'xlsx') {
      // Generate CSV as a simpler alternative
      const headers = ['Air Date', 'Show', 'Episode', 'Episode #', 'Placement', 'Slot #', 'Rate Card Price', 'Negotiated Price', 'Notes']
      const rows = [headers]
      
      items?.forEach(item => {
        rows.push([
          new Date(item.airDate).toLocaleDateString(),
          item.showName,
          item.episodeTitle || 'TBD',
          item.episodeNumber || 'TBD',
          item.placementType,
          item.slotNumber.toString(),
          item.rateCardPrice.toString(),
          item.negotiatedPrice.toString(),
          item.notes || ''
        ])
      })

      // Add summary
      rows.push([])
      rows.push(['Summary'])
      rows.push(['Total Spots:', schedule.totalSpots])
      rows.push(['Total Value:', schedule.netAmount])
      rows.push(['Campaign:', schedule.campaignName || 'N/A'])
      rows.push(['Advertiser:', schedule.advertiserName])

      // Convert to CSV
      const csv = rows.map(row => 
        row.map(cell => {
          const value = cell?.toString() || ''
          // Escape quotes and wrap in quotes if contains comma
          if (value.includes(',') || value.includes('"')) {
            return `"${value.replace(/"/g, '""')}"`
          }
          return value
        }).join(',')
      ).join('\n')

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="schedule-${schedule.name.replace(/[^a-z0-9]/gi, '-')}.csv"`
        }
      })
    } else {
      // Generate simple HTML for PDF
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Schedule Proposal - ${schedule.name}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #333; }
            .info { margin-bottom: 20px; }
            .info p { margin: 5px 0; }
            table { border-collapse: collapse; width: 100%; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            .summary { margin-top: 30px; padding: 20px; background-color: #f9f9f9; }
          </style>
        </head>
        <body>
          <h1>Schedule Proposal</h1>
          <div class="info">
            <p><strong>Campaign:</strong> ${schedule.campaignName || 'N/A'}</p>
            <p><strong>Advertiser:</strong> ${schedule.advertiserName}</p>
            <p><strong>Period:</strong> ${new Date(schedule.startDate).toLocaleDateString()} - ${new Date(schedule.endDate).toLocaleDateString()}</p>
            <p><strong>Status:</strong> ${schedule.status}</p>
          </div>
          
          <h2>Schedule Details</h2>
          <table>
            <thead>
              <tr>
                <th>Air Date</th>
                <th>Show</th>
                <th>Episode</th>
                <th>Placement</th>
                <th>Price</th>
              </tr>
            </thead>
            <tbody>
              ${items?.map(item => `
                <tr>
                  <td>${new Date(item.airDate).toLocaleDateString()}</td>
                  <td>${item.showName}</td>
                  <td>${item.episodeTitle || 'TBD'}</td>
                  <td>${item.placementType}</td>
                  <td>$${item.negotiatedPrice.toLocaleString()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="summary">
            <h3>Summary</h3>
            <p><strong>Total Spots:</strong> ${schedule.totalSpots}</p>
            <p><strong>Total Impressions:</strong> ${schedule.totalImpressions ? (schedule.totalImpressions / 1000).toFixed(0) + 'K' : 'N/A'}</p>
            <p><strong>Total Value:</strong> $${schedule.netAmount?.toLocaleString() || '0'}</p>
          </div>
        </body>
        </html>
      `

      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html',
          'Content-Disposition': `attachment; filename="schedule-${schedule.name.replace(/[^a-z0-9]/gi, '-')}.html"`
        }
      })
    }
  } catch (error) {
    console.error('Schedule export error:', error)
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}