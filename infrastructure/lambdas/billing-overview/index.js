const AWS = require('aws-sdk');
const { requireAuth, hasPermission } = require('../shared/authMiddleware');

const dynamoDB = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.TABLE_NAME || 'PodcastFlowPro';

// Helper function to get date ranges
function getDateRanges() {
  const now = new Date();
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);
  
  return {
    currentMonth: currentMonth.toISOString(),
    lastMonth: lastMonth.toISOString(),
    yearStart: yearStart.toISOString()
  };
}

// Get billing overview
async function getBillingOverview(event) {
  const user = event.user;
  const { currentMonth, lastMonth, yearStart } = getDateRanges();
  
  try {
    // For sellers, get their own billing data
    let queryParams = {
      TableName: TABLE_NAME,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: {
        ':pk': 'BILLING'
      }
    };

    // If not admin, filter by user
    if (user.role !== 'admin') {
      queryParams.FilterExpression = 'sellerId = :userId';
      queryParams.ExpressionAttributeValues[':userId'] = user.id;
    }

    const result = await dynamoDB.query(queryParams).promise();
    const invoices = result.Items || [];

    // Calculate metrics
    const metrics = {
      totalRevenue: 0,
      monthlyRevenue: 0,
      lastMonthRevenue: 0,
      pendingInvoices: 0,
      paidInvoices: 0,
      overdueInvoices: 0,
      averageInvoiceValue: 0,
      revenueGrowth: 0,
      yearToDateRevenue: 0
    };

    invoices.forEach(invoice => {
      const amount = invoice.amount || 0;
      const issueDate = new Date(invoice.issueDate);
      
      // Total revenue (paid invoices only)
      if (invoice.status === 'paid') {
        metrics.totalRevenue += amount;
        metrics.paidInvoices += amount;
        
        // Year to date
        if (issueDate >= new Date(yearStart)) {
          metrics.yearToDateRevenue += amount;
        }
        
        // Current month
        if (issueDate >= new Date(currentMonth)) {
          metrics.monthlyRevenue += amount;
        }
        
        // Last month
        if (issueDate >= new Date(lastMonth) && issueDate < new Date(currentMonth)) {
          metrics.lastMonthRevenue += amount;
        }
      }
      
      // Pending invoices
      if (invoice.status === 'pending') {
        metrics.pendingInvoices += amount;
      }
      
      // Overdue invoices
      if (invoice.status === 'overdue' || 
          (invoice.status === 'pending' && new Date(invoice.dueDate) < new Date())) {
        metrics.overdueInvoices += amount;
      }
    });

    // Calculate average and growth
    const paidCount = invoices.filter(i => i.status === 'paid').length;
    metrics.averageInvoiceValue = paidCount > 0 ? metrics.totalRevenue / paidCount : 0;
    
    if (metrics.lastMonthRevenue > 0) {
      metrics.revenueGrowth = ((metrics.monthlyRevenue - metrics.lastMonthRevenue) / metrics.lastMonthRevenue) * 100;
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        metrics,
        summary: {
          totalInvoices: invoices.length,
          paidCount: invoices.filter(i => i.status === 'paid').length,
          pendingCount: invoices.filter(i => i.status === 'pending').length,
          overdueCount: invoices.filter(i => i.status === 'overdue' || 
            (i.status === 'pending' && new Date(i.dueDate) < new Date())).length
        }
      })
    };
  } catch (error) {
    console.error('Error fetching billing overview:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        message: 'Error fetching billing overview',
        error: error.message 
      })
    };
  }
}

// Main handler with auth
exports.handler = requireAuth(getBillingOverview, { permissions: ['billing.view'] });