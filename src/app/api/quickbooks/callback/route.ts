import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { quickBooksService } from '@/lib/quickbooks/quickbooks-service'

// Force this route to be dynamic
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const realmId = searchParams.get('realmId')
    const error = searchParams.get('error')

    if (error) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/executive/integrations?error=${error}`)
    }

    if (!code || !state || !realmId) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/executive/integrations?error=missing_parameters`)
    }

    // Parse state to get organization ID and verify state token
    const [stateToken, organizationId] = state.split(':')
    if (!organizationId) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/executive/integrations?error=invalid_state`)
    }

    // TODO: Verify state token against session for CSRF protection
    // For now, we'll proceed with the flow

    try {
      // Exchange code for tokens using the service
      const tokenResponse = await quickBooksService.exchangeCodeForTokens(code)
      
      // Get company info from QuickBooks
      const companyInfo = await quickBooksService.getCompanyInfo(
        organizationId,
        realmId,
        tokenResponse.access_token
      )

      // Calculate token expiration times
      const tokenExpiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000)
      const refreshTokenExpiresAt = new Date(Date.now() + tokenResponse.x_refresh_token_expires_in * 1000)

      // Store integration in database
      await prisma.quickBooksIntegration.upsert({
        where: {
          organizationId: organizationId
        },
        update: {
          accessToken: tokenResponse.access_token,
          refreshToken: tokenResponse.refresh_token,
          realmId: realmId,
          companyName: companyInfo.CompanyName,
          companyAddr: companyInfo.CompanyAddr ? JSON.stringify(companyInfo.CompanyAddr) : null,
          country: companyInfo.Country || 'US',
          fiscalYearStartMonth: parseInt(companyInfo.FiscalYearStartMonth || '1'),
          tokenExpiresAt,
          refreshTokenExpiresAt,
          isActive: true,
          updatedAt: new Date()
        },
        create: {
          organizationId: organizationId,
          accessToken: tokenResponse.access_token,
          refreshToken: tokenResponse.refresh_token,
          realmId: realmId,
          companyName: companyInfo.CompanyName,
          companyAddr: companyInfo.CompanyAddr ? JSON.stringify(companyInfo.CompanyAddr) : null,
          country: companyInfo.Country || 'US',
          fiscalYearStartMonth: parseInt(companyInfo.FiscalYearStartMonth || '1'),
          tokenExpiresAt,
          refreshTokenExpiresAt,
          isActive: true,
          syncSettings: {
            autoSync: true,
            frequency: 'daily',
            accountMappings: {
              revenue: [],
              expenses: [],
              cogs: [],
              assets: [],
              liabilities: [],
              equity: []
            }
          }
        }
      })

      // Redirect back to integrations page with success
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/executive/integrations?success=connected`)
    } catch (error) {
      console.error('Error processing QuickBooks callback:', error)
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/executive/integrations?error=connection_failed`)
    }
  } catch (error) {
    console.error('Error in QuickBooks callback:', error)
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/executive/integrations?error=callback_error`)
  }
}