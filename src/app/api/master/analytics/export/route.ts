import { NextRequest, NextResponse } from 'next/server'
import { withMasterProtection } from '@/lib/auth/api-protection'
import prisma from '@/lib/db/prisma'
import { getSchemaName } from '@/lib/db/utils'

// POST /api/master/analytics/export - Export analytics report
export const POST = await withMasterProtection(async (request: NextRequest) => {
  try {
    const body = await request.json()
    const { format = 'pdf', timeRange = '30d', includeCharts = true, includeData = true } = body

    console.log('📊 Exporting analytics report:', { format, timeRange, includeCharts, includeData })

    // Get analytics data for the export
    const [users, organizations] = await Promise.all([
      prisma.user.findMany({
        where: { isActive: true },
        include: { organization: true }
      }),
      prisma.organization.findMany({
        where: { isActive: true },
        include: {
          _count: {
            select: {
              users: true
            }
          }
        }
      })
    ])
    
    // Get campaigns from all organization schemas
    let allCampaigns: any[] = []
    let organizationCampaignCounts: Record<string, number> = {}
    
    for (const org of organizations) {
      if (org.slug) {
        try {
          const schemaName = getSchemaName(org.slug)
          const campaignResults = await prisma.$queryRawUnsafe<any[]>(`
            SELECT * FROM "${schemaName}"."Campaign"
            WHERE "isActive" = true
          `)
          
          organizationCampaignCounts[org.id] = campaignResults.length
          allCampaigns = allCampaigns.concat(campaignResults.map(c => ({
            ...c,
            organizationId: org.id,
            organizationName: org.name
          })))
        } catch (error) {
          console.warn(`Could not get campaigns for org ${org.id}:`, error)
          organizationCampaignCounts[org.id] = 0
        }
      }
    }

    // Calculate metrics
    const totalUsers = users.length
    const activeUsers = users.filter(u => u.lastLoginAt && 
      new Date(u.lastLoginAt) > new Date(Date.now() - 24 * 60 * 60 * 1000)
    ).length
    const totalRevenue = allCampaigns.reduce((sum, c) => sum + (c.budget || 0), 0)
    const storageUsed = Math.round(totalUsers * 2) // 2GB per user estimate

    // Create a mock PDF report (in production, use a proper PDF library like puppeteer or jsPDF)
    const reportContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj

4 0 obj
<<
/Length 800
>>
stream
BT
/F1 16 Tf
72 720 Td
(PodcastFlow Pro - Global Analytics Report) Tj
0 -30 Td
/F1 12 Tf
(Time Range: ${timeRange}) Tj
0 -20 Td
(Generated: ${new Date().toISOString()}) Tj
0 -40 Td
(=== PLATFORM METRICS ===) Tj
0 -20 Td
(Total Users: ${totalUsers.toLocaleString()}) Tj
0 -20 Td
(Active Users (24h): ${activeUsers.toLocaleString()}) Tj
0 -20 Td
(Total Organizations: ${organizations.length}) Tj
0 -20 Td
(Total Revenue: $${totalRevenue.toLocaleString()}) Tj
0 -20 Td
(Storage Used: ${storageUsed}GB) Tj
0 -40 Td
(=== TOP ORGANIZATIONS ===) Tj
${organizations.slice(0, 10).map((org, i) => `0 -20 Td
(${i + 1}. ${org.name} - ${org._count.users} users, ${organizationCampaignCounts[org.id] || 0} campaigns) Tj`).join('\n')}
0 -40 Td
(=== EXPORT SETTINGS ===) Tj
0 -20 Td
(Format: ${format.toUpperCase()}) Tj
0 -20 Td
(Include Charts: ${includeCharts ? 'Yes' : 'No'}) Tj
0 -20 Td
(Include Data: ${includeData ? 'Yes' : 'No'}) Tj
0 -40 Td
(This is a mock PDF report.) Tj
0 -20 Td
(In production, this would include charts, graphs, and detailed tables.) Tj
ET
endstream
endobj

xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000217 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
1079
%%EOF`

    const headers = new Headers({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="global-analytics-${timeRange}-${Date.now()}.pdf"`,
      'Content-Length': reportContent.length.toString()
    })

    console.log('✅ Analytics export completed successfully')

    return new NextResponse(reportContent, {
      status: 200,
      headers
    })

  } catch (error) {
    console.error('❌ Master analytics export error:', error)
    return NextResponse.json(
      { error: 'Failed to export analytics report' },
      { status: 500 }
    )
  }
})