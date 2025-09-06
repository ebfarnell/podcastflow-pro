import prisma from '@/lib/db/prisma'
import axios, { AxiosInstance } from 'axios'
import crypto from 'crypto'

export interface QuickBooksConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
  environment: 'sandbox' | 'production'
  webhookToken?: string
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
  x_refresh_token_expires_in: number
}

export interface CompanyInfo {
  Id: string
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

export interface QBEntity {
  Id?: string
  Name?: string
  Active?: boolean
  MetaData?: {
    CreateTime?: string
    LastUpdatedTime?: string
  }
  [key: string]: any
}

export interface Account extends QBEntity {
  FullyQualifiedName?: string
  Classification?: string
  AccountType?: string
  AccountSubType?: string
  CurrentBalance?: number
  CurrencyRef?: {
    value: string
    name: string
  }
}

export interface Customer extends QBEntity {
  CompanyName?: string
  GivenName?: string
  FamilyName?: string
  FullyQualifiedName?: string
  BillAddr?: Address
  ShipAddr?: Address
  PrimaryPhone?: PhoneNumber
  PrimaryEmailAddr?: EmailAddress
  DefaultTaxCodeRef?: Reference
  CustomerTypeRef?: Reference
  Balance?: number
  BalanceWithJobs?: number
}

export interface Vendor extends QBEntity {
  CompanyName?: string
  GivenName?: string
  FamilyName?: string
  PrimaryPhone?: PhoneNumber
  PrimaryEmailAddr?: EmailAddress
  BillAddr?: Address
  TaxIdentifier?: string
  AcctNum?: string
  Vendor1099?: boolean
}

export interface Item extends QBEntity {
  Type?: string
  UnitPrice?: number
  IncomeAccountRef?: Reference
  ExpenseAccountRef?: Reference
  TrackQtyOnHand?: boolean
  QtyOnHand?: number
  InvStartDate?: string
}

export interface Invoice extends QBEntity {
  Line?: InvoiceLine[]
  CustomerRef?: Reference
  BillAddr?: Address
  ShipAddr?: Address
  DueDate?: string
  TxnDate?: string
  TotalAmt?: number
  Balance?: number
  DocNumber?: string
  EmailStatus?: string
  PrintStatus?: string
}

export interface Bill extends QBEntity {
  Line?: BillLine[]
  VendorRef?: Reference
  APAccountRef?: Reference
  TxnDate?: string
  DueDate?: string
  TotalAmt?: number
  Balance?: number
  DocNumber?: string
}

export interface Address {
  Line1?: string
  Line2?: string
  City?: string
  CountrySubDivisionCode?: string
  PostalCode?: string
  Country?: string
}

export interface PhoneNumber {
  FreeFormNumber?: string
}

export interface EmailAddress {
  Address?: string
}

export interface Reference {
  value: string
  name?: string
}

export interface InvoiceLine {
  Id?: string
  LineNum?: number
  Amount?: number
  DetailType?: string
  SalesItemLineDetail?: {
    ItemRef?: Reference
    UnitPrice?: number
    Qty?: number
    TaxCodeRef?: Reference
  }
}

export interface BillLine {
  Id?: string
  LineNum?: number
  Amount?: number
  DetailType?: string
  AccountBasedExpenseLineDetail?: {
    AccountRef?: Reference
    TaxCodeRef?: Reference
  }
  ItemBasedExpenseLineDetail?: {
    ItemRef?: Reference
    UnitPrice?: number
    Qty?: number
    TaxCodeRef?: Reference
  }
}

export interface QueryResponse<T = any> {
  QueryResponse?: {
    [key: string]: T[]
    startPosition?: number
    maxResults?: number
    totalCount?: number
  }
}

export interface BatchRequest {
  BatchItemRequest: BatchItemRequest[]
}

export interface BatchItemRequest {
  bId: string
  operation: 'create' | 'update' | 'delete' | 'query'
  entity?: QBEntity
  query?: string
}

export interface BatchResponse {
  BatchItemResponse: BatchItemResponse[]
}

export interface BatchItemResponse {
  bId: string
  Fault?: any
  [key: string]: any
}

export interface WebhookEvent {
  eventNotifications: Array<{
    realmId: string
    dataChangeEvent: {
      entities: Array<{
        name: string
        id: string
        operation: string
        lastUpdated: string
      }>
    }
  }>
}

export interface ReportRequest {
  reportName: string
  startDate?: string
  endDate?: string
  asOfDate?: string
  accountingMethod?: 'Cash' | 'Accrual'
  summarizeColumnBy?: 'Days' | 'Weeks' | 'Months' | 'Quarters' | 'Years'
  customer?: string
  vendor?: string
  department?: string
  class?: string
}

export interface CDCRequest {
  entities: string[]
  changedSince: string
}

class ComprehensiveQuickBooksService {
  private config: QuickBooksConfig
  private apiClient: AxiosInstance | null = null

  constructor() {
    this.config = {
      clientId: process.env.QUICKBOOKS_CLIENT_ID || '',
      clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET || '',
      redirectUri: process.env.QUICKBOOKS_REDIRECT_URI || '',
      environment: (process.env.QUICKBOOKS_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox',
      webhookToken: process.env.QUICKBOOKS_WEBHOOK_TOKEN || ''
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
    const baseUrl = 'https://appcenter.intuit.com/connect/oauth2'

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
   * Generic entity CRUD operations
   */

  // Create entity
  async createEntity<T extends QBEntity>(organizationId: string, entityName: string, data: T): Promise<T> {
    await this.initializeClient(organizationId)
    
    if (!this.apiClient) {
      throw new Error('API client not initialized')
    }

    try {
      const response = await this.apiClient.post(`/${entityName}`, data)
      const responseData = response.data.QueryResponse || response.data
      return responseData[entityName] || responseData
    } catch (error) {
      console.error(`Failed to create ${entityName}:`, error)
      throw new Error(`Failed to create ${entityName}`)
    }
  }

  // Read entity by ID
  async getEntity<T extends QBEntity>(organizationId: string, entityName: string, id: string): Promise<T> {
    await this.initializeClient(organizationId)
    
    if (!this.apiClient) {
      throw new Error('API client not initialized')
    }

    try {
      const response = await this.apiClient.get(`/${entityName}/${id}`)
      const responseData = response.data.QueryResponse || response.data
      return responseData[entityName] || responseData
    } catch (error) {
      console.error(`Failed to get ${entityName}:`, error)
      throw new Error(`Failed to get ${entityName}`)
    }
  }

  // Update entity
  async updateEntity<T extends QBEntity>(organizationId: string, entityName: string, data: T): Promise<T> {
    await this.initializeClient(organizationId)
    
    if (!this.apiClient) {
      throw new Error('API client not initialized')
    }

    try {
      const response = await this.apiClient.post(`/${entityName}`, data)
      const responseData = response.data.QueryResponse || response.data
      return responseData[entityName] || responseData
    } catch (error) {
      console.error(`Failed to update ${entityName}:`, error)
      throw new Error(`Failed to update ${entityName}`)
    }
  }

  // Delete entity
  async deleteEntity(organizationId: string, entityName: string, id: string, syncToken: string): Promise<void> {
    await this.initializeClient(organizationId)
    
    if (!this.apiClient) {
      throw new Error('API client not initialized')
    }

    try {
      await this.apiClient.delete(`/${entityName}/${id}`, {
        params: { syncToken }
      })
    } catch (error) {
      console.error(`Failed to delete ${entityName}:`, error)
      throw new Error(`Failed to delete ${entityName}`)
    }
  }

  // Query entities
  async queryEntities<T extends QBEntity>(
    organizationId: string, 
    query: string
  ): Promise<QueryResponse<T>> {
    await this.initializeClient(organizationId)
    
    if (!this.apiClient) {
      throw new Error('API client not initialized')
    }

    try {
      const response = await this.apiClient.get('/query', {
        params: { query }
      })
      return response.data
    } catch (error) {
      console.error('Failed to execute query:', error)
      throw new Error('Failed to execute query')
    }
  }

  // List entities with pagination
  async listEntities<T extends QBEntity>(
    organizationId: string,
    entityName: string,
    options: {
      startPosition?: number
      maxResults?: number
      filter?: string
    } = {}
  ): Promise<QueryResponse<T>> {
    const { startPosition = 1, maxResults = 20, filter = '' } = options
    let query = `SELECT * FROM ${entityName}`
    
    if (filter) {
      query += ` WHERE ${filter}`
    }
    
    query += ` STARTPOSITION ${startPosition} MAXRESULTS ${maxResults}`
    
    return this.queryEntities<T>(organizationId, query)
  }

  /**
   * Specific entity methods
   */

  // Accounts
  async getAccounts(organizationId: string): Promise<Account[]> {
    const response = await this.queryEntities<Account>(
      organizationId,
      'SELECT * FROM Account WHERE Active = true ORDER BY Name'
    )
    return response.QueryResponse?.Account || []
  }

  async createAccount(organizationId: string, account: Account): Promise<Account> {
    return this.createEntity<Account>(organizationId, 'Account', account)
  }

  // Customers
  async getCustomers(organizationId: string): Promise<Customer[]> {
    const response = await this.queryEntities<Customer>(
      organizationId,
      'SELECT * FROM Customer WHERE Active = true ORDER BY Name'
    )
    return response.QueryResponse?.Customer || []
  }

  async createCustomer(organizationId: string, customer: Customer): Promise<Customer> {
    return this.createEntity<Customer>(organizationId, 'Customer', customer)
  }

  async updateCustomer(organizationId: string, customer: Customer): Promise<Customer> {
    return this.updateEntity<Customer>(organizationId, 'Customer', customer)
  }

  // Vendors
  async getVendors(organizationId: string): Promise<Vendor[]> {
    const response = await this.queryEntities<Vendor>(
      organizationId,
      'SELECT * FROM Vendor WHERE Active = true ORDER BY Name'
    )
    return response.QueryResponse?.Vendor || []
  }

  async createVendor(organizationId: string, vendor: Vendor): Promise<Vendor> {
    return this.createEntity<Vendor>(organizationId, 'Vendor', vendor)
  }

  // Items
  async getItems(organizationId: string): Promise<Item[]> {
    const response = await this.queryEntities<Item>(
      organizationId,
      'SELECT * FROM Item WHERE Active = true ORDER BY Name'
    )
    return response.QueryResponse?.Item || []
  }

  async createItem(organizationId: string, item: Item): Promise<Item> {
    return this.createEntity<Item>(organizationId, 'Item', item)
  }

  // Invoices
  async getInvoices(organizationId: string): Promise<Invoice[]> {
    const response = await this.queryEntities<Invoice>(
      organizationId,
      'SELECT * FROM Invoice ORDER BY TxnDate DESC MAXRESULTS 100'
    )
    return response.QueryResponse?.Invoice || []
  }

  async createInvoice(organizationId: string, invoice: Invoice): Promise<Invoice> {
    return this.createEntity<Invoice>(organizationId, 'Invoice', invoice)
  }

  async updateInvoice(organizationId: string, invoice: Invoice): Promise<Invoice> {
    return this.updateEntity<Invoice>(organizationId, 'Invoice', invoice)
  }

  // Bills
  async getBills(organizationId: string): Promise<Bill[]> {
    const response = await this.queryEntities<Bill>(
      organizationId,
      'SELECT * FROM Bill ORDER BY TxnDate DESC MAXRESULTS 100'
    )
    return response.QueryResponse?.Bill || []
  }

  async createBill(organizationId: string, bill: Bill): Promise<Bill> {
    return this.createEntity<Bill>(organizationId, 'Bill', bill)
  }

  /**
   * Batch operations
   */
  async executeBatch(organizationId: string, batchRequest: BatchRequest): Promise<BatchResponse> {
    await this.initializeClient(organizationId)
    
    if (!this.apiClient) {
      throw new Error('API client not initialized')
    }

    try {
      const response = await this.apiClient.post('/batch', batchRequest)
      return response.data
    } catch (error) {
      console.error('Failed to execute batch request:', error)
      throw new Error('Failed to execute batch request')
    }
  }

  /**
   * Change Data Capture (CDC)
   */
  async getChangedEntities(organizationId: string, cdcRequest: CDCRequest): Promise<any> {
    await this.initializeClient(organizationId)
    
    if (!this.apiClient) {
      throw new Error('API client not initialized')
    }

    try {
      const response = await this.apiClient.get('/cdc', {
        params: {
          entities: cdcRequest.entities.join(','),
          changedSince: cdcRequest.changedSince
        }
      })
      return response.data
    } catch (error) {
      console.error('Failed to get changed entities:', error)
      throw new Error('Failed to get changed entities')
    }
  }

  /**
   * Reports
   */
  async getReport(organizationId: string, reportRequest: ReportRequest): Promise<any> {
    await this.initializeClient(organizationId)
    
    if (!this.apiClient) {
      throw new Error('API client not initialized')
    }

    try {
      const params: any = {}
      
      if (reportRequest.startDate) params.start_date = reportRequest.startDate
      if (reportRequest.endDate) params.end_date = reportRequest.endDate
      if (reportRequest.asOfDate) params.as_of_date = reportRequest.asOfDate
      if (reportRequest.accountingMethod) params.accounting_method = reportRequest.accountingMethod
      if (reportRequest.summarizeColumnBy) params.summarize_column_by = reportRequest.summarizeColumnBy
      if (reportRequest.customer) params.customer = reportRequest.customer
      if (reportRequest.vendor) params.vendor = reportRequest.vendor
      if (reportRequest.department) params.department = reportRequest.department
      if (reportRequest.class) params.class = reportRequest.class

      const response = await this.apiClient.get(`/reports/${reportRequest.reportName}`, { params })
      return response.data
    } catch (error) {
      console.error('Failed to get report:', error)
      throw new Error('Failed to get report')
    }
  }

  /**
   * Company Info
   */
  async getCompanyInfo(organizationId: string, realmId?: string, accessToken?: string): Promise<CompanyInfo> {
    if (realmId && accessToken) {
      // Direct call for initial setup
      const client = axios.create({
        baseURL: `${this.getBaseUrl()}/v3/company/${realmId}`,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      })

      try {
        const response = await client.get<{ QueryResponse: { CompanyInfo: CompanyInfo[] } }>('/companyinfo/1')
        return response.data.QueryResponse.CompanyInfo[0]
      } catch (error) {
        console.error('Failed to fetch company info:', error)
        throw new Error('Failed to fetch company information')
      }
    } else {
      await this.initializeClient(organizationId)
      
      if (!this.apiClient) {
        throw new Error('API client not initialized')
      }

      try {
        const response = await this.apiClient.get<{ QueryResponse: { CompanyInfo: CompanyInfo[] } }>('/companyinfo/1')
        return response.data.QueryResponse.CompanyInfo[0]
      } catch (error) {
        console.error('Failed to fetch company info:', error)
        throw new Error('Failed to fetch company information')
      }
    }
  }

  /**
   * Webhook handling
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!this.config.webhookToken) {
      throw new Error('Webhook token not configured')
    }

    const hash = crypto
      .createHmac('sha256', this.config.webhookToken)
      .update(payload)
      .digest('base64')
    
    return hash === signature
  }

  async processWebhookEvent(organizationId: string, event: WebhookEvent): Promise<void> {
    // Process webhook events to trigger incremental syncs
    for (const notification of event.eventNotifications) {
      if (notification.realmId) {
        // Trigger incremental sync for the specific entities that changed
        const changedEntities = notification.dataChangeEvent.entities.map(e => e.name)
        
        // Create sync job for incremental sync
        await prisma.quickBooksSync.create({
          data: {
            organizationId,
            syncType: 'incremental',
            status: 'pending',
            startedAt: new Date(),
            createdBy: 'webhook'
          }
        })
      }
    }
  }

  /**
   * Disconnect integration
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
   * Utility methods
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
export const comprehensiveQuickBooksService = new ComprehensiveQuickBooksService()