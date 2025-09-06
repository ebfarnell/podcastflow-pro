import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug, querySchema } from '@/lib/db/schema-db'
import { accessLogger } from '@/lib/security/access-logger'
import { z } from 'zod'
import crypto from 'crypto'
import { emailService } from '@/lib/email/email-service'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


const ReminderSchema = z.object({
  clientEmail: z.string().email(),
  clientName: z.string().optional(),
  expiresInDays: z.number().int().min(1).max(90).default(30),
})

// POST /api/campaigns/[id]/kpi/send-reminder - Send KPI update reminder to client
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Check if user has permission to manage campaigns
    if (!['admin', 'sales', 'master'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const campaignId = params.id
    const body = await request.json()

    // Validate input
    const validatedData = ReminderSchema.parse(body)

    // CRITICAL SECURITY FIX: Use schema-aware queries for multi-tenant data
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }
    
    // Check if master is accessing cross-org data
    if (user.role === 'master' && user.organizationId !== orgSlug) {
      await accessLogger.logMasterCrossOrgAccess(
        user.id,
        user.organizationId!,
        orgSlug,
        'POST',
        `/api/campaigns/${campaignId}/kpi/send-reminder`,
        request
      )
    }

    // Check if user has access to this campaign
    const campaignQuery = `
      SELECT 
        c.*,
        a.id as advertiser_id,
        a.name as advertiser_name,
        o.id as organization_id,
        o.name as organization_name
      FROM "Campaign" c
      LEFT JOIN "Advertiser" a ON a.id = c."advertiserId"
      LEFT JOIN public."Organization" o ON o.id = $2
      WHERE c.id = $1
    `
    const campaigns = await querySchema<any>(orgSlug, campaignQuery, [campaignId, user.organizationId])
    
    if (!campaigns || campaigns.length === 0) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }
    const campaign = {
      ...campaigns[0],
      advertiser: campaigns[0].advertiser_id ? {
        id: campaigns[0].advertiser_id,
        name: campaigns[0].advertiser_name
      } : null,
      organization: campaigns[0].organization_id ? {
        id: campaigns[0].organization_id,
        name: campaigns[0].organization_name
      } : null
    }

    // Get KPI for this campaign
    const kpiQuery = `SELECT * FROM "CampaignKPI" WHERE "campaignId" = $1`
    const kpis = await querySchema<any>(orgSlug, kpiQuery, [campaignId])
    
    if (!kpis || kpis.length === 0) {
      return NextResponse.json({ error: 'No KPI configured for this campaign' }, { status: 404 })
    }
    const kpi = kpis[0]

    // Get agency details if available
    let agency = null
    if (campaign.agencyId) {
      const agencyQuery = `SELECT id, name FROM "Agency" WHERE id = $1`
      const agencies = await querySchema<any>(orgSlug, agencyQuery, [campaign.agencyId])
      if (agencies && agencies.length > 0) {
        agency = agencies[0]
      }
    }

    if (!kpi.clientCanUpdate) {
      return NextResponse.json({ error: 'Client updates are disabled for this KPI' }, { status: 400 })
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + validatedData.expiresInDays)

    // Create update token
    const tokenId = `kut_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const createTokenQuery = `
      INSERT INTO "KPIUpdateToken" (
        id, "campaignKPIId", token, "clientEmail", "clientName",
        "expiresAt", "createdBy", "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, NOW(), NOW()
      )
      RETURNING *
    `
    
    const tokens = await querySchema<any>(orgSlug, createTokenQuery, [
      tokenId,
      kpi.id,
      token,
      validatedData.clientEmail,
      validatedData.clientName || null,
      expiresAt,
      user.id
    ])
    const updateToken = tokens[0]

    // Generate update URL
    const updateUrl = `${process.env.NEXT_PUBLIC_APP_URL}/kpi-update/${token}`

    // Prepare email content
    const emailSubject = `KPI Update Request - ${campaign.name}`
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>KPI Update Request</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">KPI Update Request</h1>
          <p style="color: #f0f0f0; margin: 10px 0 0 0; font-size: 16px;">Campaign Performance Metrics</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;">
          <p style="font-size: 16px; margin-bottom: 20px;">
            Hello ${validatedData.clientName || 'there'},
          </p>
          
          <p style="font-size: 16px; margin-bottom: 20px;">
            We hope your campaign <strong>${campaign.name}</strong> is performing well! 
            We would like to request an update on your campaign's key performance indicators (KPIs).
          </p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #667eea;">Campaign Details</h3>
            <p style="margin: 5px 0;"><strong>Campaign:</strong> ${campaign.name}</p>
            <p style="margin: 5px 0;"><strong>Advertiser:</strong> ${campaign.advertiser?.name || 'N/A'}</p>
            <p style="margin: 5px 0;"><strong>Organization:</strong> ${campaign.organization?.name || 'N/A'}</p>
            <p style="margin: 5px 0;"><strong>KPI Type:</strong> ${
              kpi.kpiType === 'both' ? 'Web Visits + Conversions' :
              kpi.kpiType === 'unique_web_visits' ? 'Unique Web Visits' :
              'Conversions'
            }</p>
          </div>
          
          <p style="font-size: 16px; margin-bottom: 25px;">
            Please click the button below to securely update your campaign metrics. 
            This link will expire on <strong>${expiresAt.toLocaleDateString()}</strong>.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${updateUrl}" 
               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                      color: white; 
                      text-decoration: none; 
                      padding: 15px 30px; 
                      border-radius: 8px; 
                      font-weight: bold; 
                      font-size: 16px; 
                      display: inline-block;
                      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);">
              Update Campaign KPIs
            </a>
          </div>
          
          <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #1565c0;">
              <strong>Security Note:</strong> This is a secure, one-time use link. 
              If you have any concerns about this email, please contact us directly.
            </p>
          </div>
          
          <p style="font-size: 14px; color: #666; margin-top: 25px;">
            If the button doesn't work, you can copy and paste this link into your browser:<br>
            <a href="${updateUrl}" style="color: #667eea; word-break: break-all;">${updateUrl}</a>
          </p>
          
          <div style="border-top: 1px solid #dee2e6; padding-top: 20px; margin-top: 30px;">
            <p style="font-size: 14px; color: #666; margin: 0;">
              Best regards,<br>
              <strong>${user.name || 'The Team'}</strong><br>
              ${campaign.organization?.name || 'PodcastFlow Pro'}
            </p>
          </div>
        </div>
        
        <div style="text-align: center; padding: 20px 0; color: #666; font-size: 12px;">
          <p style="margin: 0;">
            This email was sent from PodcastFlow Pro campaign management system.
          </p>
        </div>
      </body>
      </html>
    `

    // Send email
    try {
      await emailService.sendEmail({
        to: validatedData.clientEmail,
        subject: emailSubject,
        html: emailHtml,
        from: process.env.EMAIL_FROM || 'noreply@podcastflow.pro',
        organizationId: user.organizationId,
        userId: user.id,
        templateKey: 'kpi_update_reminder',
        metadata: {
          campaignId: campaign.id,
          campaignName: campaign.name,
          advertiserId: campaign.advertiserId,
          advertiserName: campaign.advertiser?.name,
          agencyId: campaign.agencyId,
          agencyName: agency?.name,
          sellerId: user.id,
          sellerName: user.name,
          sellerEmail: user.email,
          kpiType: kpi.kpiType
        }
      })

      // Update token to mark email as sent
      await querySchema(orgSlug, 
        `UPDATE "KPIUpdateToken" SET "emailSentAt" = NOW() WHERE id = $1`, 
        [updateToken.id]
      )

      // Don't automatically update next reminder date - let admin/seller control this

      return NextResponse.json({
        message: 'Reminder email sent successfully',
        token: updateToken.id,
        expiresAt,
      })
    } catch (emailError) {
      console.error('Failed to send email:', emailError)
      
      // Delete the token since email failed
      await querySchema(orgSlug, 
        `DELETE FROM "KPIUpdateToken" WHERE id = $1`, 
        [updateToken.id]
      )
      
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input data', details: error.errors }, { status: 400 })
    }
    console.error('Error sending KPI reminder:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
