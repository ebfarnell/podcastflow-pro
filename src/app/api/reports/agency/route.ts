import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { format, parseISO } from 'date-fns'
import { v4 as uuidv4 } from 'uuid'
import prisma from '@/lib/db/prisma'
import {
  fetchAgencyData,
  checkSalesUserAccess,
  fetchAdvertisers,
  fetchCampaigns,
  fetchBudgets,
  fetchWeeklySpots,
  fetchLineItems,
  processMonthlyData,
  processWeeklyData,
  generateSummaryJson,
  generateMonthlyCSV,
  generateWeeklyCSV,
  generateCampaignsCSV,
  generateLineItemsCSV,
  generateZipBuffer,
  type ReportArtifacts,
  type ReportMetadata
} from '@/lib/reports/agency'

// Input validation schema
const reportRequestSchema = z.object({
  agencyId: z.string().min(1),
  range: z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
  }).optional(),
  format: z.enum(['zip', 'pdf']).default('zip'),
  includeSections: z.array(z.enum(['summary', 'monthly', 'weekly', 'campaigns', 'lineItems'])).optional(),
})

// Error codes
const ErrorCodes = {
  E_SCHEMA: 'E_SCHEMA',
  E_INPUT: 'E_INPUT',
  E_PERM: 'E_PERM',
  E_DATA: 'E_DATA',
  E_UNEXPECTED: 'E_UNEXPECTED',
} as const

export async function POST(request: NextRequest) {
  const correlationId = uuidv4()
  const startTime = Date.now()

  try {
    // Get session and validate auth
    const sessionData = await getSessionFromCookie(request)
    if (!sessionData) {
      return NextResponse.json(
        { code: ErrorCodes.E_PERM, message: 'Unauthorized', correlationId },
        { status: 401 }
      )
    }

    // Extract session properties without destructuring
    const userId = sessionData.userId
    const organizationId = sessionData.organizationId
    const organizationSlug = sessionData.organizationSlug
    const role = sessionData.role

    // Only allow admin, master, or sales roles
    const allowedRoles = ['admin', 'master', 'sales']
    if (!allowedRoles.includes(role)) {
      return NextResponse.json(
        { code: ErrorCodes.E_PERM, message: 'Insufficient permissions', correlationId },
        { status: 403 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validationResult = reportRequestSchema.safeParse(body)
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          code: ErrorCodes.E_INPUT, 
          message: 'Invalid request parameters',
          errors: validationResult.error.flatten(),
          correlationId 
        },
        { status: 400 }
      )
    }

    const agencyId = validationResult.data.agencyId
    const range = validationResult.data.range
    const reportFormat = validationResult.data.format || 'zip'
    const sections = validationResult.data.includeSections || ['summary', 'monthly', 'weekly', 'campaigns', 'lineItems']

    // Resolve organization schema
    let orgSlug = organizationSlug
    if (!orgSlug && organizationId) {
      // Look up the organization slug from the database
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { slug: true }
      })
      orgSlug = org?.slug || null
    }
    
    if (!orgSlug) {
      return NextResponse.json(
        { code: ErrorCodes.E_SCHEMA, message: 'Organization not found', correlationId },
        { status: 400 }
      )
    }

    // Set date range defaults
    const endDate = range?.end ? parseISO(range.end) : new Date()
    const startDate = range?.start ? parseISO(range.start) : new Date(endDate.getFullYear(), endDate.getMonth() - 11, 1)

    // Log the report generation request
    if (process.env.DEBUG_REPORTS === '1') {
      console.log('[REPORT] Agency Report Generation', {
        correlationId,
        orgId: organizationId,
        orgSlug,
        agencyId,
        format: reportFormat,
        sections,
        dateRange: { start: startDate.toISOString(), end: endDate.toISOString() },
        userId,
        role,
      })
    }

    // Fetch agency details
    console.log('[REPORT] Fetching agency:', { agencyId, orgSlug, correlationId })
    const agencyResult = await fetchAgencyData(orgSlug, agencyId)
    
    if (agencyResult.error || !agencyResult.data) {
      return NextResponse.json(
        { code: ErrorCodes.E_DATA, message: agencyResult.error || 'Agency not found', correlationId },
        { status: 404 }
      )
    }

    const agencyData = agencyResult.data

    // Check permissions for sales users
    if (role === 'sales' && agencyData.sellerId !== userId) {
      const hasAccess = await checkSalesUserAccess(orgSlug, agencyId, userId)
      
      if (!hasAccess) {
        return NextResponse.json(
          { code: ErrorCodes.E_PERM, message: 'Access denied to this agency', correlationId },
          { status: 403 }
        )
      }
    }

    // Fetch all related data
    const advertisersResult = await fetchAdvertisers(orgSlug, agencyId)
    const advertisers = advertisersResult.data
    const advertiserIds = advertisers.map(function(a) { return a.id })

    const campaignsResult = await fetchCampaigns(orgSlug, advertiserIds, startDate, endDate)
    const campaigns = campaignsResult.data

    const budgetsResult = await fetchBudgets(orgSlug, agencyId, advertiserIds, startDate, endDate)
    const budgets = budgetsResult.data

    // Process data
    const monthlyData = processMonthlyData(budgets)

    // Generate report artifacts
    const artifacts: ReportArtifacts = {}

    // Summary JSON
    if (sections.includes('summary')) {
      artifacts['summary.json'] = generateSummaryJson(
        correlationId,
        agencyData,
        advertisers,
        campaigns,
        monthlyData,
        startDate,
        endDate
      )
    }

    // Monthly CSV
    if (sections.includes('monthly')) {
      artifacts['monthly_summary.csv'] = generateMonthlyCSV(monthlyData)
    }

    // Weekly CSV and processing
    if (sections.includes('weekly')) {
      const weeklyResult = await fetchWeeklySpots(orgSlug, advertiserIds, startDate, endDate)
      const weeklyData = processWeeklyData(weeklyResult.data, campaigns)
      artifacts['weekly_summary.csv'] = generateWeeklyCSV(weeklyData)
    }

    // Campaigns CSV
    if (sections.includes('campaigns')) {
      artifacts['campaigns.csv'] = generateCampaignsCSV(campaigns)
    }

    // Line Items CSV
    if (sections.includes('lineItems')) {
      const lineItemsResult = await fetchLineItems(orgSlug, advertiserIds, startDate, endDate)
      artifacts['line_items.csv'] = generateLineItemsCSV(lineItemsResult.data)
    }

    // Check format
    if (reportFormat === 'pdf') {
      return NextResponse.json(
        { 
          code: ErrorCodes.E_INPUT, 
          message: 'PDF format is not yet supported. Please use ZIP format.',
          correlationId 
        },
        { status: 400 }
      )
    }

    // Generate ZIP file
    const metadata: ReportMetadata = {
      reportId: correlationId,
      generatedAt: new Date().toISOString(),
      agency: agencyData.name,
      agencyId: agencyData.id,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      files: Object.keys(artifacts),
      generatedBy: userId || 'Unknown',
      organizationId: organizationId || 'Unknown',
    }

    const zipBuffer = await generateZipBuffer(artifacts, metadata)

    // Log successful generation
    if (process.env.DEBUG_REPORTS === '1') {
      console.log('[REPORT] Successfully generated agency report', {
        correlationId,
        agencyId,
        artifactCount: Object.keys(artifacts).length,
        format: reportFormat,
        sizeBytes: zipBuffer.length,
        duration: Date.now() - startTime,
      })
    }

    // Generate filename
    const agencyNameSlug = agencyData.name.toLowerCase().replace(/\s+/g, '-')
    const dateStr = format(new Date(), 'yyyyMMdd')
    const filename = `agency-report-${agencyNameSlug}-${dateStr}.zip`

    // Return ZIP file as response
    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Correlation-Id': correlationId,
      },
    })

  } catch (error: any) {
    console.error('[REPORT] Error generating agency report:', {
      correlationId,
      error: error.message,
      stack: error.stack,
    })

    return NextResponse.json(
      {
        code: ErrorCodes.E_UNEXPECTED,
        message: 'Failed to generate report',
        correlationId,
      },
      { status: 500 }
    )
  }
}