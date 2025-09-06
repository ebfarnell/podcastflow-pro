import prisma from '@/lib/db/prisma'
import { quickBooksService, Account, ProfitAndLossReport } from './quickbooks-service'
import { Prisma } from '@prisma/client'

export interface SyncOptions {
  type: 'full' | 'incremental' | 'manual'
  startDate?: Date
  endDate?: Date
  accounts?: string[]
}

export interface SyncResult {
  success: boolean
  recordsProcessed: number
  errors: string[]
  duration: number
}

class QuickBooksSyncService {
  /**
   * Start a new sync job
   */
  async startSync(organizationId: string, userId: string, options: SyncOptions): Promise<string> {
    // Check if there's already a running sync
    const runningSync = await prisma.quickBooksSync.findFirst({
      where: {
        organizationId,
        status: 'running'
      }
    })

    if (runningSync) {
      throw new Error('A sync is already in progress')
    }

    // Create new sync record
    const sync = await prisma.quickBooksSync.create({
      data: {
        organizationId,
        type: options.type,
        status: 'pending',
        recordsProcessed: 0,
        startedAt: new Date(),
        createdBy: userId
      }
    })

    // Start sync in background (in production, this would be a queue job)
    this.performSync(sync.id, options).catch(error => {
      console.error('Sync error:', error)
    })

    return sync.id
  }

  /**
   * Perform the actual sync
   */
  private async performSync(syncId: string, options: SyncOptions): Promise<void> {
    const startTime = Date.now()
    const errors: string[] = []
    let recordsProcessed = 0

    try {
      // Update sync status to running
      const sync = await prisma.quickBooksSync.update({
        where: { id: syncId },
        data: { 
          status: 'running',
          startedAt: new Date()
        }
      })

      const { organizationId } = sync

      // Step 1: Sync Chart of Accounts
      try {
        const accountsProcessed = await this.syncChartOfAccounts(organizationId, syncId)
        recordsProcessed += accountsProcessed
      } catch (error) {
        const errorMsg = `Failed to sync chart of accounts: ${error instanceof Error ? error.message : 'Unknown error'}`
        errors.push(errorMsg)
        console.error(errorMsg)
      }

      // Step 2: Sync P&L Data
      try {
        const plProcessed = await this.syncProfitAndLoss(organizationId, syncId, options)
        recordsProcessed += plProcessed
      } catch (error) {
        const errorMsg = `Failed to sync P&L data: ${error instanceof Error ? error.message : 'Unknown error'}`
        errors.push(errorMsg)
        console.error(errorMsg)
      }

      // Step 3: Update last sync timestamp
      await prisma.quickBooksIntegration.update({
        where: { organizationId },
        data: { lastSyncAt: new Date() }
      })

      // Update sync record with results
      const duration = Date.now() - startTime
      await prisma.quickBooksSync.update({
        where: { id: syncId },
        data: {
          status: errors.length > 0 ? 'completed_with_errors' : 'completed',
          recordsProcessed,
          errors: errors.length > 0 ? errors : null,
          completedAt: new Date(),
          duration: Math.round(duration / 1000) // seconds
        }
      })

    } catch (error) {
      // Fatal error - mark sync as failed
      const duration = Date.now() - startTime
      await prisma.quickBooksSync.update({
        where: { id: syncId },
        data: {
          status: 'failed',
          recordsProcessed,
          errors: [`Fatal error: ${error instanceof Error ? error.message : 'Unknown error'}`],
          completedAt: new Date(),
          duration: Math.round(duration / 1000)
        }
      })
      throw error
    }
  }

  /**
   * Sync chart of accounts
   */
  private async syncChartOfAccounts(organizationId: string, syncId: string): Promise<number> {
    const accounts = await quickBooksService.getAccounts(organizationId)
    let processed = 0

    // Map QuickBooks account types to our internal types
    const accountTypeMapping: Record<string, string> = {
      'Bank': 'asset',
      'Accounts Receivable': 'asset',
      'Other Current Asset': 'asset',
      'Fixed Asset': 'asset',
      'Other Asset': 'asset',
      'Accounts Payable': 'liability',
      'Credit Card': 'liability',
      'Other Current Liability': 'liability',
      'Long Term Liability': 'liability',
      'Equity': 'equity',
      'Income': 'revenue',
      'Other Income': 'revenue',
      'Cost of Goods Sold': 'expense',
      'Expense': 'expense',
      'Other Expense': 'expense'
    }

    for (const account of accounts) {
      try {
        const accountType = accountTypeMapping[account.AccountType] || 'other'
        
        // Upsert financial data record
        await prisma.financialData.upsert({
          where: {
            organizationId_quickbooksId: {
              organizationId,
              quickbooksId: account.Id
            }
          },
          update: {
            accountName: account.Name,
            fullyQualifiedName: account.FullyQualifiedName,
            accountType,
            active: account.Active,
            currentBalance: account.CurrentBalance || 0,
            currency: account.CurrencyRef?.value || 'USD',
            classification: account.Classification,
            accountSubType: account.AccountSubType,
            quickbooksSyncId: syncId,
            lastSyncedAt: new Date()
          },
          create: {
            organizationId,
            quickbooksId: account.Id,
            accountCode: account.Id, // Using ID as code for now
            accountName: account.Name,
            fullyQualifiedName: account.FullyQualifiedName,
            accountType,
            active: account.Active,
            currentBalance: account.CurrentBalance || 0,
            currency: account.CurrencyRef?.value || 'USD',
            classification: account.Classification,
            accountSubType: account.AccountSubType,
            year: new Date().getFullYear(),
            month: new Date().getMonth() + 1,
            amount: account.CurrentBalance || 0,
            quickbooksSyncId: syncId,
            lastSyncedAt: new Date()
          }
        })
        
        processed++
      } catch (error) {
        console.error(`Failed to sync account ${account.Name}:`, error)
      }
    }

    return processed
  }

  /**
   * Sync profit and loss data
   */
  private async syncProfitAndLoss(
    organizationId: string, 
    syncId: string,
    options: SyncOptions
  ): Promise<number> {
    // Determine date range
    const endDate = options.endDate || new Date()
    const startDate = options.startDate || new Date(endDate.getFullYear(), 0, 1) // Start of year
    
    // Format dates for QuickBooks API
    const formatDate = (date: Date) => date.toISOString().split('T')[0]
    
    const report = await quickBooksService.getProfitAndLossReport(
      organizationId,
      formatDate(startDate),
      formatDate(endDate),
      'Months'
    )

    let processed = 0

    // Parse the P&L report structure
    if (report.Rows && report.Rows.Row) {
      for (const row of report.Rows.Row) {
        if (row.type === 'Data' && row.ColData) {
          await this.processReportRow(organizationId, syncId, row, report.Header)
          processed++
        } else if (row.Rows && row.Rows.Row) {
          // Process nested rows (groups)
          for (const nestedRow of row.Rows.Row) {
            if (nestedRow.type === 'Data' && nestedRow.ColData) {
              await this.processReportRow(organizationId, syncId, nestedRow, report.Header, row.group)
              processed++
            }
          }
        }
      }
    }

    return processed
  }

  /**
   * Process a single report row
   */
  private async processReportRow(
    organizationId: string,
    syncId: string,
    row: any,
    header: any,
    group?: string
  ): Promise<void> {
    if (!row.ColData || row.ColData.length < 2) return

    const accountName = row.ColData[0].value
    const accountId = row.ColData[0].id

    // Process each month's data
    for (let i = 1; i < row.ColData.length; i++) {
      const amount = parseFloat(row.ColData[i].value) || 0
      if (amount === 0) continue

      // Extract month/year from column header
      const period = header.Columns.Column[i].ColTitle
      const [monthName, year] = period.split(' ')
      const month = this.getMonthNumber(monthName)
      
      if (!month || !year) continue

      try {
        await prisma.financialData.upsert({
          where: {
            organizationId_quickbooksId_year_month: {
              organizationId,
              quickbooksId: accountId || `${accountName}-${i}`,
              year: parseInt(year),
              month
            }
          },
          update: {
            amount,
            accountName,
            accountGroup: group,
            quickbooksSyncId: syncId,
            lastSyncedAt: new Date()
          },
          create: {
            organizationId,
            quickbooksId: accountId || `${accountName}-${i}`,
            accountCode: accountId || accountName,
            accountName,
            accountGroup: group,
            accountType: this.determineAccountType(group || accountName),
            year: parseInt(year),
            month,
            amount,
            currency: header.Currency || 'USD',
            quickbooksSyncId: syncId,
            lastSyncedAt: new Date()
          }
        })
      } catch (error) {
        console.error(`Failed to save financial data for ${accountName}:`, error)
      }
    }
  }

  /**
   * Convert month name to number
   */
  private getMonthNumber(monthName: string): number {
    const months: Record<string, number> = {
      'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4,
      'May': 5, 'Jun': 6, 'Jul': 7, 'Aug': 8,
      'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12
    }
    return months[monthName] || 0
  }

  /**
   * Determine account type from name/group
   */
  private determineAccountType(nameOrGroup: string): string {
    const lowerCase = nameOrGroup.toLowerCase()
    
    if (lowerCase.includes('income') || lowerCase.includes('revenue') || lowerCase.includes('sales')) {
      return 'revenue'
    } else if (lowerCase.includes('expense') || lowerCase.includes('cost')) {
      return 'expense'
    } else if (lowerCase.includes('asset')) {
      return 'asset'
    } else if (lowerCase.includes('liability')) {
      return 'liability'
    } else if (lowerCase.includes('equity')) {
      return 'equity'
    }
    
    return 'other'
  }

  /**
   * Get sync history
   */
  async getSyncHistory(
    organizationId: string,
    limit: number = 10
  ): Promise<Array<any>> {
    const syncs = await prisma.quickBooksSync.findMany({
      where: { organizationId },
      orderBy: { startedAt: 'desc' },
      take: limit,
      include: {
        creator: {
          select: {
            name: true,
            email: true
          }
        }
      }
    })

    return syncs
  }

  /**
   * Get financial data summary
   */
  async getFinancialSummary(
    organizationId: string,
    year?: number,
    month?: number
  ): Promise<{
    revenue: number
    expenses: number
    netIncome: number
    accounts: number
  }> {
    const where: Prisma.FinancialDataWhereInput = {
      organizationId,
      active: true
    }

    if (year) where.year = year
    if (month) where.month = month

    const [revenue, expenses, accounts] = await Promise.all([
      prisma.financialData.aggregate({
        where: { ...where, accountType: 'revenue' },
        _sum: { amount: true }
      }),
      prisma.financialData.aggregate({
        where: { ...where, accountType: 'expense' },
        _sum: { amount: true }
      }),
      prisma.financialData.count({
        where: { ...where }
      })
    ])

    const totalRevenue = revenue._sum.amount || 0
    const totalExpenses = expenses._sum.amount || 0

    return {
      revenue: totalRevenue,
      expenses: totalExpenses,
      netIncome: totalRevenue - totalExpenses,
      accounts
    }
  }
}

// Export singleton instance
export const quickBooksSyncService = new QuickBooksSyncService()