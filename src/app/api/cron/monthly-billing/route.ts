import { NextRequest, NextResponse } from 'next/server'
import { campaignBillingService } from '@/lib/invoices/campaign-billing'

// POST /api/cron/monthly-billing - Automated monthly billing (for cron jobs)
export async function POST(request: NextRequest) {
  try {
    // Verify this is coming from an authorized source
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || 'podcastflow-cron-2025'
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      console.log('🚫 Unauthorized cron request')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('🕐 Starting automated monthly billing...')
    
    const currentDate = new Date()
    const isFirstOfMonth = currentDate.getDate() === 1

    if (!isFirstOfMonth) {
      console.log('ℹ️ Not the first of the month, skipping automated billing')
      return NextResponse.json({
        success: true,
        message: 'Skipped - not first of month',
        date: currentDate.toISOString()
      })
    }

    // Generate monthly invoices for all organizations
    const results = await campaignBillingService.generateMonthlyRecurringInvoices()

    const summary = {
      processed: results.length,
      created: results.filter(r => r.status === 'created').length,
      existing: results.filter(r => r.status === 'already_exists').length,
      errors: results.filter(r => r.status === 'error').length,
      totalAmount: results
        .filter(r => r.status === 'created')
        .reduce((sum, r) => sum + (r.amount || 0), 0)
    }

    // Send notification to administrators
    await sendBillingNotification(summary, results)

    console.log('✅ Automated monthly billing completed:', summary)

    return NextResponse.json({
      success: true,
      message: 'Monthly billing completed',
      summary,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Automated monthly billing error:', error)
    
    // Send error notification
    await sendErrorNotification(error)

    return NextResponse.json(
      { error: 'Automated billing failed', details: error.message },
      { status: 500 }
    )
  }
}

// GET /api/cron/monthly-billing - Check billing status (for monitoring)
export async function GET() {
  try {
    const currentDate = new Date()
    const currentMonth = currentDate.getMonth()
    const currentYear = currentDate.getFullYear()

    const prisma = (await import('@/lib/db/prisma')).default

    // Check if billing has run this month
    const startOfMonth = new Date(currentYear, currentMonth, 1)
    const endOfMonth = new Date(currentYear, currentMonth + 1, 0)

    const monthlyInvoices = await prisma.invoice.count({
      where: {
        issueDate: {
          gte: startOfMonth,
          lte: endOfMonth
        },
        plan: 'campaign'
      }
    })

    const activeCampaigns = await prisma.campaign.count({
      where: {
        status: 'active',
        budget: { gt: 0 }
      }
    })

    return NextResponse.json({
      currentMonth: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`,
      monthlyInvoicesGenerated: monthlyInvoices,
      activeCampaigns,
      billingComplete: monthlyInvoices > 0,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Billing status check error:', error)
    return NextResponse.json(
      { error: 'Failed to check billing status' },
      { status: 500 }
    )
  }
}

// Helper functions
async function sendBillingNotification(summary: any, results: any[]) {
  try {
    // This would integrate with your email service
    // For now, just log the notification
    console.log('📧 Billing notification:', {
      subject: `Monthly Billing Complete - ${summary.created} invoices created`,
      summary,
      errorCount: summary.errors
    })

    // You could add email sending here:
    // await emailService.send({
    //   to: 'admin@podcastflow.pro',
    //   subject: 'Monthly Billing Complete',
    //   template: 'monthly-billing-summary',
    //   data: { summary, results }
    // })

  } catch (error) {
    console.error('❌ Failed to send billing notification:', error)
  }
}

async function sendErrorNotification(error: any) {
  try {
    console.log('🚨 Billing error notification:', {
      subject: 'Monthly Billing Failed',
      error: error.message,
      timestamp: new Date().toISOString()
    })

    // You could add email sending here:
    // await emailService.send({
    //   to: 'admin@podcastflow.pro',
    //   subject: 'URGENT: Monthly Billing Failed',
    //   template: 'billing-error',
    //   data: { error: error.message }
    // })

  } catch (notificationError) {
    console.error('❌ Failed to send error notification:', notificationError)
  }
}