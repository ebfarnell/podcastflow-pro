import { NextRequest, NextResponse } from 'next/server'
import { withMasterProtection } from '@/lib/auth/api-protection'
import prisma from '@/lib/db/prisma'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

interface AWSCost {
  service: string
  amount: number
  unit: string
  startDate: string
  endDate: string
}

interface Expense {
  id: string
  category: string
  vendor: string
  description: string
  amount: number
  date: string
  status: 'paid' | 'pending' | 'overdue'
  recurring: boolean
  frequency?: 'monthly' | 'quarterly' | 'annual'
}

async function getAWSCosts(startDate: string, endDate: string): Promise<AWSCost[]> {
  try {
    // Use AWS CLI to get cost data
    // Note: This requires proper IAM permissions for Cost Explorer
    const command = `aws ce get-cost-and-usage \
      --time-period Start=${startDate},End=${endDate} \
      --granularity MONTHLY \
      --metrics "UnblendedCost" \
      --group-by Type=DIMENSION,Key=SERVICE \
      --output json`
    
    const { stdout } = await execAsync(command)
    const data = JSON.parse(stdout)
    
    const costs: AWSCost[] = []
    
    if (data.ResultsByTime) {
      for (const timeResult of data.ResultsByTime) {
        for (const group of timeResult.Groups || []) {
          const service = group.Keys[0]
          const amount = parseFloat(group.Metrics.UnblendedCost.Amount)
          
          if (amount > 0) {
            costs.push({
              service,
              amount,
              unit: group.Metrics.UnblendedCost.Unit,
              startDate: timeResult.TimePeriod.Start,
              endDate: timeResult.TimePeriod.End
            })
          }
        }
      }
    }
    
    return costs
  } catch (error) {
    console.error('Error fetching AWS costs:', error)
    // Return mock data if AWS API fails
    return getMockAWSCosts(startDate, endDate)
  }
}

function getMockAWSCosts(startDate: string, endDate: string): AWSCost[] {
  // Return empty array - no mock data
  console.warn('AWS Cost Explorer API failed. Please ensure AWS CLI is configured with proper credentials.')
  return []
}

// GET /api/master/expenses
export const GET = await withMasterProtection(async (request: NextRequest) => {
  try {
    const url = new URL(request.url)
    const timeRange = url.searchParams.get('timeRange') || 'thisMonth'
    const customStartDate = url.searchParams.get('startDate')
    const customEndDate = url.searchParams.get('endDate')
    
    // Calculate date range
    const now = new Date()
    let startDate: Date
    let endDate: Date = now
    
    if (customStartDate && customEndDate) {
      startDate = new Date(customStartDate)
      endDate = new Date(customEndDate)
    } else {
      switch (timeRange) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          break
        case 'yesterday':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
          endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          break
        case 'thisWeek':
          const weekStart = now.getDate() - now.getDay()
          startDate = new Date(now.getFullYear(), now.getMonth(), weekStart)
          break
        case 'thisMonth':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1)
          break
        case 'lastMonth':
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
          endDate = new Date(now.getFullYear(), now.getMonth(), 0)
          break
        case 'thisQuarter':
          const quarterStart = Math.floor(now.getMonth() / 3) * 3
          startDate = new Date(now.getFullYear(), quarterStart, 1)
          break
        case 'lastQuarter':
          const lastQuarterStart = Math.floor(now.getMonth() / 3) * 3 - 3
          startDate = new Date(now.getFullYear(), lastQuarterStart, 1)
          endDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 0)
          break
        case 'thisYear':
          startDate = new Date(now.getFullYear(), 0, 1)
          break
        case 'lastYear':
          startDate = new Date(now.getFullYear() - 1, 0, 1)
          endDate = new Date(now.getFullYear() - 1, 11, 31)
          break
        case '7d':
          startDate = new Date()
          startDate.setDate(endDate.getDate() - 7)
          break
        case '30d':
          startDate = new Date()
          startDate.setDate(endDate.getDate() - 30)
          break
        case '90d':
          startDate = new Date()
          startDate.setDate(endDate.getDate() - 90)
          break
        case 'ytd':
          startDate = new Date(now.getFullYear(), 0, 1) // January 1st
          break
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      }
    }
    
    // Format dates for AWS API
    const startDateStr = startDate.toISOString().split('T')[0]
    const endDateStr = endDate.toISOString().split('T')[0]
    
    // Get AWS costs
    const awsCosts = await getAWSCosts(startDateStr, endDateStr)
    
    // Convert AWS costs to expenses
    const awsExpenses: Expense[] = awsCosts.map((cost, index) => ({
      id: `aws-${index}`,
      category: 'Infrastructure',
      vendor: 'Amazon Web Services',
      description: cost.service,
      amount: cost.amount,
      date: cost.endDate,
      status: 'paid' as const,
      recurring: true,
      frequency: 'monthly' as const
    }))
    
    // Generate real expenses (domain and SSL cert)
    const otherExpenses: Expense[] = []
    
    // Helper to check if a date is within range
    const isDateInRange = (date: Date) => {
      return date >= startDate && date <= endDate
    }
    
    // Check for quarterly expenses (SSL cert every 3 months on the 15th)
    const currentMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1)
    const endMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1)
    
    while (currentMonth <= endMonth) {
      if (currentMonth.getMonth() % 3 === 0) {
        const sslDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 15)
        if (isDateInRange(sslDate)) {
          otherExpenses.push({
            id: `exp-ssl-${sslDate.toISOString().split('T')[0]}`,
            category: 'SSL Certificate',
            vendor: 'Let\'s Encrypt',
            description: 'SSL Certificate',
            amount: 0,
            date: sslDate.toISOString().split('T')[0],
            status: 'paid',
            recurring: true,
            frequency: 'quarterly'
          })
        }
      }
      currentMonth.setMonth(currentMonth.getMonth() + 1)
    }
    
    // Check for annual expenses (domain renewal on March 15th)
    const domainRenewalDate = new Date(endDate.getFullYear(), 2, 15) // March 15th each year
    if (isDateInRange(domainRenewalDate)) {
      otherExpenses.push({
        id: `exp-domain-${domainRenewalDate.getFullYear()}`,
        category: 'Domain',
        vendor: 'Namecheap',
        description: 'podcastflow.pro domain',
        amount: 12.88,
        date: domainRenewalDate.toISOString().split('T')[0],
        status: 'paid',
        recurring: true,
        frequency: 'annual'
      })
    }
    
    // Combine AWS expenses with real domain/SSL expenses
    const allExpenses = [...awsExpenses, ...otherExpenses]
    
    // Calculate totals
    const totalExpenses = allExpenses.reduce((sum, exp) => sum + exp.amount, 0)
    const recurringExpenses = allExpenses
      .filter(exp => exp.recurring && exp.frequency === 'monthly')
      .reduce((sum, exp) => sum + exp.amount, 0)
    
    // Calculate by category
    const byCategory = allExpenses.reduce((acc, exp) => {
      if (!acc[exp.category]) {
        acc[exp.category] = 0
      }
      acc[exp.category] += exp.amount
      return acc
    }, {} as Record<string, number>)
    
    return NextResponse.json({
      timeRange: {
        start: startDateStr,
        end: endDateStr,
        label: timeRange
      },
      expenses: allExpenses,
      summary: {
        total: totalExpenses,
        recurring: recurringExpenses,
        oneTime: totalExpenses - recurringExpenses,
        byCategory,
        awsTotal: awsExpenses.reduce((sum, exp) => sum + exp.amount, 0)
      }
    })
    
  } catch (error) {
    console.error('Master expenses API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch expenses data' },
      { status: 500 }
    )
  }
})