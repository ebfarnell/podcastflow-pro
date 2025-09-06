import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug, querySchema } from '@/lib/db/schema-db'
import * as XLSX from 'xlsx'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get session and verify authentication
    const authToken = request.cookies.get('auth-token')?.value
    if (!authToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const body = await request.json()
    const { scheduleId, format = 'xlsx' } = body

    // Fetch schedule with all related data
    const scheduleQuery = `
      SELECT 
        cs.*,
        c.name as "campaignName",
        a.name as "advertiserName",
        ag.name as "agencyName"
      FROM "CampaignSchedule" cs
      LEFT JOIN "Campaign" c ON c.id = cs."campaignId"
      LEFT JOIN "Advertiser" a ON a.id = c."advertiserId"
      LEFT JOIN "Agency" ag ON ag.id = c."agencyId"
      WHERE cs.id = $1 AND cs."campaignId" = $2
    `
    const schedules = await querySchema(orgSlug, scheduleQuery, [scheduleId, params.id])
    
    if (schedules.length === 0) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
    }
    
    const schedule = schedules[0]

    // Fetch schedule items
    const itemsQuery = `
      SELECT 
        si.*,
        s.name as "showName"
      FROM "ScheduleItem" si
      LEFT JOIN "Show" s ON s.id = si."showId"
      WHERE si."scheduleId" = $1
      ORDER BY si."airDate" ASC, si."sortOrder" ASC
    `
    const scheduleItems = await querySchema(orgSlug, itemsQuery, [scheduleId])

    if (format === 'xlsx') {
      // Create Excel workbook
      const wb = XLSX.utils.book_new()
      
      // Campaign Info Sheet
      const campaignInfo = [
        ['Campaign Schedule Export'],
        [''],
        ['Campaign:', schedule.campaignName],
        ['Advertiser:', schedule.advertiserName],
        ['Agency:', schedule.agencyName || 'No Agency'],
        ['Schedule Name:', schedule.name],
        ['Version:', schedule.version.toString()],
        ['Created:', new Date(schedule.createdAt).toLocaleDateString()],
        ['Status:', schedule.status],
        [''],
        ['Total Spots:', scheduleItems.length.toString()],
        ['Total Cost:', '$' + scheduleItems.reduce((sum: number, item: any) => sum + item.rate, 0).toFixed(2)]
      ]
      
      const infoSheet = XLSX.utils.aoa_to_sheet(campaignInfo)
      XLSX.utils.book_append_sheet(wb, infoSheet, 'Campaign Info')
      
      // Schedule Details Sheet
      const scheduleHeaders = [
        'Air Date', 'Day', 'Show', 'Placement', 'Length', 'Live Read', 'Rate', 'Notes'
      ]
      
      const scheduleData = scheduleItems.map((item: any) => {
        const airDate = new Date(item.airDate)
        return [
          airDate.toLocaleDateString(),
          airDate.toLocaleDateString('en-US', { weekday: 'long' }),
          item.showName,
          item.placementType,
          `${item.length}s`,
          item.isLiveRead ? 'Yes' : 'No',
          `$${item.rate.toFixed(2)}`,
          item.notes || ''
        ]
      })
      
      const scheduleSheet = XLSX.utils.aoa_to_sheet([scheduleHeaders, ...scheduleData])
      
      // Set column widths
      scheduleSheet['!cols'] = [
        { wch: 12 }, // Air Date
        { wch: 12 }, // Day
        { wch: 25 }, // Show
        { wch: 12 }, // Placement
        { wch: 10 }, // Length
        { wch: 10 }, // Live Read
        { wch: 12 }, // Rate
        { wch: 30 }  // Notes
      ]
      
      XLSX.utils.book_append_sheet(wb, scheduleSheet, 'Schedule')
      
      // Summary by Show Sheet
      const showSummary: Record<string, any> = {}
      scheduleItems.forEach((item: any) => {
        if (!showSummary[item.showName]) {
          showSummary[item.showName] = {
            spots: 0,
            revenue: 0,
            placements: {}
          }
        }
        showSummary[item.showName].spots++
        showSummary[item.showName].revenue += item.rate
        
        const placement = item.placementType
        if (!showSummary[item.showName].placements[placement]) {
          showSummary[item.showName].placements[placement] = 0
        }
        showSummary[item.showName].placements[placement]++
      })
      
      const summaryHeaders = ['Show', 'Total Spots', 'Total Revenue', 'Preroll', 'Midroll', 'Postroll']
      const summaryData = Object.entries(showSummary).map(([show, data]) => [
        show,
        data.spots,
        `$${data.revenue.toFixed(2)}`,
        data.placements.preroll || 0,
        data.placements.midroll || 0,
        data.placements.postroll || 0
      ])
      
      const summarySheet = XLSX.utils.aoa_to_sheet([summaryHeaders, ...summaryData])
      summarySheet['!cols'] = [
        { wch: 25 }, // Show
        { wch: 12 }, // Total Spots
        { wch: 15 }, // Total Revenue
        { wch: 10 }, // Preroll
        { wch: 10 }, // Midroll
        { wch: 10 }  // Postroll
      ]
      
      XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary by Show')
      
      // Generate buffer
      const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' })
      
      // Update schedule export info
      const updateQuery = `
        UPDATE "CampaignSchedule" 
        SET "exportedAt" = NOW(), "exportedBy" = $1
        WHERE id = $2
      `
      await querySchema(orgSlug, updateQuery, [user.id, scheduleId])
      
      // Return file
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="schedule_${schedule.campaignName}_v${schedule.version}.xlsx"`
        }
      })
    } else if (format === 'csv') {
      // Generate CSV
      const csvRows = [
        ['Air Date', 'Show', 'Placement', 'Length', 'Rate', 'Notes'].join(',')
      ]
      
      scheduleItems.forEach((item: any) => {
        csvRows.push([
          new Date(item.airDate).toLocaleDateString(),
          `"${item.showName}"`,
          item.placementType,
          `${item.length}s`,
          item.rate.toFixed(2),
          `"${item.notes || ''}"`
        ].join(','))
      })
      
      const csv = csvRows.join('\n')
      
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="schedule_${schedule.campaignName}_v${schedule.version}.csv"`
        }
      })
    } else {
      return NextResponse.json({ error: 'Invalid format' }, { status: 400 })
    }
  } catch (error) {
    console.error('Error exporting campaign schedule:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}