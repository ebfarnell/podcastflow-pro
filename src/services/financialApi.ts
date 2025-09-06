import { api } from './api'

export interface FinancialSummary {
  totalRevenue: number
  totalExpenses: number
  netProfit: number
  profitMargin: number
  outstandingInvoices: number
  outstandingInvoiceCount: number
  monthlyRecurring: number
  revenueGrowth: number
  topRevenueSource?: {
    source: string
    amount: number
  }
}

export interface Transaction {
  id: string
  date: string
  description: string
  type: 'income' | 'expense'
  category: string
  amount: number
  status: 'completed' | 'pending' | 'failed'
  client?: string
  vendor?: string
  invoiceId?: string
  campaignId?: string
  createdAt: string
  updatedAt: string
}

export interface Invoice {
  id: string
  number: string
  client: string
  clientId: string
  amount: number
  issueDate: string
  dueDate: string
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
  paidDate?: string
  items: InvoiceItem[]
  notes?: string
  campaignId?: string
  createdAt: string
  updatedAt: string
}

export interface InvoiceItem {
  description: string
  amount: number
  quantity?: number
  unitPrice?: number
}

export interface Payment {
  id: string
  date: string
  amount: number
  method: string
  status: 'completed' | 'pending' | 'processing' | 'failed'
  client: string
  clientId?: string
  invoiceId?: string
  reference: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface CashFlowData {
  period: string
  data: Array<{
    month: string
    year?: number
    income: number
    expenses: number
    net: number
  }>
  projections: {
    nextMonth: {
      income: number
      expenses: number
      net: number
    }
    nextQuarter: {
      income: number
      expenses: number
      net: number
    }
  }
}

export interface FinancialReport {
  type: string
  period: string
  generatedAt: string
  summary: FinancialSummary
  transactions?: Transaction[]
  cashFlow?: any
  topClients?: Array<{ client: string; amount: number }>
  expenseBreakdown?: Array<{ category: string; amount: number }>
}

class FinancialApi {

  // Get financial summary
  async getFinancialSummary(dateRange?: string): Promise<FinancialSummary> {
    const params = dateRange ? { dateRange } : {}
    return api.get<FinancialSummary>('/financials', { params })
  }

  // Transaction management
  async getTransactions(params?: {
    dateRange?: string
    type?: 'income' | 'expense'
    status?: string
    limit?: number
  }): Promise<Transaction[]> {
    return api.get<Transaction[]>('/financials/transactions', { params })
  }

  async createTransaction(transaction: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>): Promise<Transaction> {
    return api.post<Transaction>('/financials/transactions', transaction)
  }

  // Invoice management
  async getInvoices(params?: {
    status?: string
    clientId?: string
    dateRange?: string
    limit?: number
  }): Promise<any> {
    return api.get<any>('/financials/invoices', { params })
  }

  async getInvoice(id: string): Promise<Invoice> {
    return api.get<Invoice>(`/financials/invoices/${id}`)
  }

  async createInvoice(invoice: Omit<Invoice, 'id' | 'number' | 'createdAt' | 'updatedAt'>): Promise<Invoice> {
    return api.post<Invoice>('/financials/invoices', invoice)
  }

  async updateInvoice(id: string, updates: Partial<Invoice>): Promise<Invoice> {
    return api.put<Invoice>(`/financials/invoices/${id}`, updates)
  }

  async sendInvoice(id: string): Promise<{ success: boolean; message: string }> {
    return api.post<{ success: boolean; message: string }>(`/financials/invoices/${id}/send`, {})
  }

  // Payment management
  async getPayments(params?: {
    dateRange?: string
    method?: string
    status?: string
    limit?: number
  }): Promise<Payment[]> {
    return api.get<Payment[]>('/financials/payments', { params })
  }

  async recordPayment(payment: Omit<Payment, 'id' | 'createdAt' | 'updatedAt'>): Promise<Payment> {
    return api.post<Payment>('/financials/payments', payment)
  }

  // Cash flow analysis
  async getCashFlow(params?: {
    period?: string
    months?: number
  }): Promise<CashFlowData> {
    const response = await api.get<{data: any[]}>('/financials/cashflow', { params })
    return {
      period: params?.period || 'monthly',
      data: response.data || [],
      projections: {
        nextMonth: { income: 0, expenses: 0, net: 0 },
        nextQuarter: { income: 0, expenses: 0, net: 0 }
      }
    }
  }

  // Report generation
  async generateReport(type: string, params?: {
    dateRange?: string
    format?: string
  }): Promise<FinancialReport> {
    const queryParams = { type, ...params }
    return api.get<FinancialReport>('/financials/reports', { params: queryParams })
  }

  async generateReportPDF(type: string, params?: {
    dateRange?: string
  }): Promise<Blob> {
    const queryParams = new URLSearchParams({ type, format: 'pdf', ...params } as any).toString()
    // Note: This method may need special handling for blob responses
    // For now, returning a placeholder until PDF generation is implemented
    throw new Error('PDF generation not yet implemented')
  }

  // Campaign financial integration
  async processCampaignPayment(campaignId: string, paymentData: {
    amount: number
    method?: string
    reference?: string
    notes?: string
    dueDate?: string
  }): Promise<{
    success: boolean
    invoiceId: string
    paymentId: string
    transactionId: string
  }> {
    return api.post<{
      success: boolean
      invoiceId: string
      paymentId: string
      transactionId: string
    }>(`/campaigns/${campaignId}/payments`, paymentData)
  }

  async getCampaignFinancialMetrics(campaignId: string): Promise<{
    campaignId: string
    campaignName: string
    totalBudget: number
    totalPaid: number
    remainingBudget: number
    budgetUtilization: number
    paymentCount: number
    lastPaymentDate?: string
    totalImpressions: number
    totalClicks: number
    cpm: number
    cpc: number
    roi: number
    status: string
  }> {
    return api.get<{
      campaignId: string
      campaignName: string
      totalBudget: number
      totalPaid: number
      remainingBudget: number
      budgetUtilization: number
      paymentCount: number
      lastPaymentDate?: string
      totalImpressions: number
      totalClicks: number
      cpm: number
      cpc: number
      roi: number
      status: string
    }>(`/campaigns/${campaignId}/financial-metrics`)
  }

  // Bulk operations
  async batchCreateInvoices(invoices: Array<Omit<Invoice, 'id' | 'number' | 'createdAt' | 'updatedAt'>>): Promise<Invoice[]> {
    return api.post<Invoice[]>('/financials/invoices/batch', { invoices })
  }

  async batchUpdateInvoiceStatus(invoiceIds: string[], status: Invoice['status']): Promise<{
    success: boolean
    updated: number
    failed: string[]
  }> {
    return api.put<{ success: boolean; updated: number; failed: string[] }>('/financials/invoices/batch-status', { invoiceIds, status })
  }

  // Export functions (keep existing frontend export logic)
  async exportFinancialData(format: 'csv' | 'json' | 'pdf', params: {
    dateRange: string
    includeTransactions?: boolean
    includeInvoices?: boolean
    includePayments?: boolean
    includeSummary?: boolean
    includeCharts?: boolean
  }): Promise<Blob | any> {
    if (format === 'pdf') {
      return this.generateReportPDF('monthly', { dateRange: params.dateRange })
    }

    // For CSV and JSON, fetch data and format locally
    const data: any = {}
    
    if (params.includeSummary) {
      data.summary = await this.getFinancialSummary(params.dateRange)
    }
    
    if (params.includeTransactions) {
      data.transactions = await this.getTransactions({ dateRange: params.dateRange })
    }
    
    if (params.includeInvoices) {
      data.invoices = await this.getInvoices({ dateRange: params.dateRange })
    }
    
    if (params.includePayments) {
      data.payments = await this.getPayments({ dateRange: params.dateRange })
    }

    if (format === 'json') {
      return data
    }

    // Format as CSV (implement CSV conversion logic)
    return this.convertToCSV(data)
  }

  private convertToCSV(data: any): Blob {
    // Implementation for CSV conversion
    let csv = ''
    
    if (data.summary) {
      csv += 'Financial Summary\n'
      csv += 'Metric,Value\n'
      Object.entries(data.summary).forEach(([key, value]) => {
        csv += `${key},${value}\n`
      })
      csv += '\n'
    }
    
    if (data.transactions) {
      csv += 'Transactions\n'
      csv += 'Date,Description,Type,Amount,Status\n'
      data.transactions.forEach((t: Transaction) => {
        csv += `${t.date},"${t.description}",${t.type},${t.amount},${t.status}\n`
      })
      csv += '\n'
    }
    
    return new Blob([csv], { type: 'text/csv' })
  }
}

export const financialApi = new FinancialApi()