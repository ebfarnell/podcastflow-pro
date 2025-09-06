import prisma from '@/lib/db/prisma'
import axios, { AxiosInstance } from 'axios'
import crypto from 'crypto'

export interface QuickBooksConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
  environment: 'sandbox' | 'production'
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
  x_refresh_token_expires_in: number
}

export interface CompanyInfo {
  CompanyName: string
  LegalName?: string
  CompanyAddr?: {
    Line1?: string
    City?: string
    CountrySubDivisionCode?: string
    PostalCode?: string
  }
  Country?: string
  Email?: {
    Address?: string
  }
  PrimaryPhone?: {
    FreeFormNumber?: string
  }
  CompanyStartDate?: string
  FiscalYearStartMonth?: string
}

export interface Account {
  Id: string
  Name: string
  FullyQualifiedName: string
  Active: boolean
  Classification: string
  AccountType: string
  AccountSubType: string
  CurrentBalance?: number
  CurrencyRef?: {
    value: string
    name: string
  }
}

export interface ProfitAndLossReport {
  Header: {
    ReportName: string
    StartPeriod: string
    EndPeriod: string
    Currency: string
  }
  Columns: {
    Column: Array<{
      ColTitle: string
      ColType: string
    }>
  }
  Rows: {
    Row: Array<{
      group?: string
      type?: string
      ColData?: Array<{
        value: string
        id?: string
      }>
      Rows?: {
        Row: Array<any>
      }
    }>
  }
}

class QuickBooksService {
  private config: QuickBooksConfig
  private apiClient: AxiosInstance | null = null

  constructor() {
    this.config = {
      clientId: process.env.QUICKBOOKS_CLIENT_ID || '',
      clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET || '',
      redirectUri: process.env.QUICKBOOKS_REDIRECT_URI || '',
      environment: (process.env.QUICKBOOKS_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox'
    }
  }

  /**
   * Get the base URL for QuickBooks API
   */
  private getBaseUrl(): string {
    return this.config.environment === 'production' 
      ? 'https://quickbooks.api.intuit.com' 
      : 'https://sandbox-quickbooks.api.intuit.com'
  }

  /**
   * Get OAuth authorization URL
   */
  getAuthorizationUrl(state: string, organizationId: string): string {
    const baseUrl = this.config.environment === 'production'
      ? 'https://appcenter.intuit.com/connect/oauth2'
      : 'https://appcenter.intuit.com/connect/oauth2'

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      scope: 'com.intuit.quickbooks.accounting',
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      state: `${state}:${organizationId}`
    })

    return `${baseUrl}?${params.toString()}`
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string): Promise<TokenResponse> {
    const tokenUrl = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'
    
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.config.redirectUri
    })

    const auth = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64')

    try {
      const response = await axios.post(tokenUrl, params.toString(), {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      })

      return response.data
    } catch (error) {
      console.error('Token exchange error:', error)
      throw new Error('Failed to exchange code for tokens')
    }
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
    const tokenUrl = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'
    
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    })

    const auth = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64')

    try {
      const response = await axios.post(tokenUrl, params.toString(), {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      })

      return response.data
    } catch (error) {
      console.error('Token refresh error:', error)
      throw new Error('Failed to refresh access token')
    }
  }

  /**
   * Initialize API client with access token
   */
  private async initializeClient(organizationId: string): Promise<void> {
    const integration = await prisma.quickBooksIntegration.findUnique({
      where: { organizationId }
    })

    if (!integration || !integration.accessToken) {
      throw new Error('QuickBooks integration not found or not connected')
    }

    // Check if token needs refresh (expires in less than 5 minutes)
    const tokenExpiresAt = new Date(integration.tokenExpiresAt)
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000)

    if (tokenExpiresAt < fiveMinutesFromNow) {
      // Refresh the token
      const newTokens = await this.refreshAccessToken(integration.refreshToken)
      
      // Update tokens in database
      await prisma.quickBooksIntegration.update({
        where: { organizationId },
        data: {
          accessToken: newTokens.access_token,
          refreshToken: newTokens.refresh_token,
          tokenExpiresAt: new Date(Date.now() + newTokens.expires_in * 1000),
          refreshTokenExpiresAt: new Date(Date.now() + newTokens.x_refresh_token_expires_in * 1000)
        }
      })

      integration.accessToken = newTokens.access_token
    }

    this.apiClient = axios.create({
      baseURL: `${this.getBaseUrl()}/v3/company/${integration.realmId}`,
      headers: {
        'Authorization': `Bearer ${integration.accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    })
  }

  /**
   * Get company information
   */
  async getCompanyInfo(organizationId: string, realmId: string, accessToken: string): Promise<CompanyInfo> {
    const client = axios.create({
      baseURL: `${this.getBaseUrl()}/v3/company/${realmId}`,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    })

    try {
      const response = await client.get<{ CompanyInfo: CompanyInfo }>('/companyinfo/1')
      return response.data.CompanyInfo
    } catch (error) {
      console.error('Failed to fetch company info:', error)
      throw new Error('Failed to fetch company information')
    }
  }

  /**
   * Get chart of accounts
   */
  async getAccounts(organizationId: string): Promise<Account[]> {
    await this.initializeClient(organizationId)
    
    if (!this.apiClient) {
      throw new Error('API client not initialized')
    }

    try {
      const response = await this.apiClient.get('/query', {
        params: {
          query: 'SELECT * FROM Account WHERE Active = true ORDERBY Name'
        }
      })

      return response.data.QueryResponse?.Account || []
    } catch (error) {
      console.error('Failed to fetch accounts:', error)
      throw new Error('Failed to fetch chart of accounts')
    }
  }

  /**
   * Get profit and loss report
   */
  async getProfitAndLossReport(
    organizationId: string,
    startDate: string,
    endDate: string,
    summarizeBy: 'Days' | 'Weeks' | 'Months' | 'Quarters' | 'Years' = 'Months'
  ): Promise<ProfitAndLossReport> {
    await this.initializeClient(organizationId)
    
    if (!this.apiClient) {
      throw new Error('API client not initialized')
    }

    try {
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
        summarize_column_by: summarizeBy,
        accounting_method: 'Accrual'
      })

      const response = await this.apiClient.get(`/reports/ProfitAndLoss?${params.toString()}`)
      return response.data
    } catch (error) {
      console.error('Failed to fetch P&L report:', error)
      throw new Error('Failed to fetch profit and loss report')
    }
  }

  /**
   * Get balance sheet report
   */
  async getBalanceSheetReport(
    organizationId: string,
    asOfDate: string
  ): Promise<any> {
    await this.initializeClient(organizationId)
    
    if (!this.apiClient) {
      throw new Error('API client not initialized')
    }

    try {
      const params = new URLSearchParams({
        as_of_date: asOfDate,
        accounting_method: 'Accrual'
      })

      const response = await this.apiClient.get(`/reports/BalanceSheet?${params.toString()}`)
      return response.data
    } catch (error) {
      console.error('Failed to fetch balance sheet:', error)
      throw new Error('Failed to fetch balance sheet report')
    }
  }

  /**
   * Disconnect QuickBooks integration
   */
  async disconnect(organizationId: string): Promise<void> {
    const integration = await prisma.quickBooksIntegration.findUnique({
      where: { organizationId }
    })

    if (!integration) {
      throw new Error('QuickBooks integration not found')
    }

    // Revoke tokens
    if (integration.refreshToken) {
      try {
        const revokeUrl = 'https://developer.api.intuit.com/v2/oauth2/tokens/revoke'
        const auth = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64')
        
        await axios.post(revokeUrl, new URLSearchParams({
          token: integration.refreshToken
        }).toString(), {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        })
      } catch (error) {
        console.error('Failed to revoke token:', error)
      }
    }

    // Delete integration record
    await prisma.quickBooksIntegration.delete({
      where: { organizationId }
    })
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string, webhookToken: string): boolean {
    const hash = crypto
      .createHmac('sha256', webhookToken)
      .update(payload)
      .digest('base64')
    
    return hash === signature
  }

  /**
   * Get sync status
   */
  async getSyncStatus(organizationId: string): Promise<{
    connected: boolean
    lastSync?: Date
    nextSync?: Date
    syncInProgress: boolean
  }> {
    const integration = await prisma.quickBooksIntegration.findUnique({
      where: { organizationId }
    })

    if (!integration) {
      return { connected: false, syncInProgress: false }
    }

    // Check if there's an active sync
    const activeSync = await prisma.quickBooksSync.findFirst({
      where: {
        organizationId,
        status: 'running'
      },
      orderBy: { startedAt: 'desc' }
    })

    // Calculate next sync time based on settings
    let nextSync: Date | undefined
    if (integration.syncSettings && typeof integration.syncSettings === 'object') {
      const settings = integration.syncSettings as any
      if (settings.autoSync && settings.frequency && integration.lastSyncAt) {
        const lastSync = new Date(integration.lastSyncAt)
        const frequencyHours = settings.frequency === 'daily' ? 24 : 
                             settings.frequency === 'weekly' ? 168 : 
                             settings.frequency === 'monthly' ? 720 : 1
        
        nextSync = new Date(lastSync.getTime() + frequencyHours * 60 * 60 * 1000)
      }
    }

    return {
      connected: true,
      lastSync: integration.lastSyncAt || undefined,
      nextSync,
      syncInProgress: !!activeSync
    }
  }
}

// Export singleton instance
export const quickBooksService = new QuickBooksService()