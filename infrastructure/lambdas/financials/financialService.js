const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();
const { v4: uuidv4 } = require('uuid');

const TABLE_NAME = process.env.TABLE_NAME || 'PodcastFlowPro';

class FinancialService {
  constructor() {
    this.tableName = TABLE_NAME;
  }

  // Generate sequential invoice numbers
  async getNextInvoiceNumber() {
    const year = new Date().getFullYear();
    const counterKey = `INVOICE_COUNTER#${year}`;
    
    try {
      const result = await dynamodb.update({
        TableName: this.tableName,
        Key: {
          PK: 'SYSTEM',
          SK: counterKey
        },
        UpdateExpression: 'ADD #counter :increment',
        ExpressionAttributeNames: {
          '#counter': 'counter'
        },
        ExpressionAttributeValues: {
          ':increment': 1
        },
        ReturnValues: 'UPDATED_NEW'
      }).promise();

      const counter = result.Attributes.counter;
      return `INV-${year}-${String(counter).padStart(5, '0')}`;
    } catch (error) {
      // If counter doesn't exist, create it
      if (error.code === 'ValidationException') {
        await dynamodb.put({
          TableName: this.tableName,
          Item: {
            PK: 'SYSTEM',
            SK: counterKey,
            counter: 1
          }
        }).promise();
        return `INV-${year}-00001`;
      }
      throw error;
    }
  }

  // Get financial summary with real calculations
  async getFinancialSummary(dateRange = 'thisMonth') {
    const dateFilter = this.getDateFilter(dateRange);
    
    // Get all transactions for the period
    const transactions = await this.getTransactionsByDateRange(dateFilter.start, dateFilter.end);
    
    // Calculate totals
    const totalRevenue = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const totalExpenses = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const netProfit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
    
    // Get outstanding invoices
    const outstandingInvoices = await this.getOutstandingInvoices();
    const outstandingAmount = outstandingInvoices.reduce((sum, inv) => sum + inv.amount, 0);
    
    // Get monthly recurring revenue from active campaigns
    const monthlyRecurring = await this.getMonthlyRecurringRevenue();
    
    return {
      totalRevenue,
      totalExpenses,
      netProfit,
      profitMargin: Math.round(profitMargin * 10) / 10,
      outstandingInvoices: outstandingAmount,
      outstandingInvoiceCount: outstandingInvoices.length,
      monthlyRecurring,
      revenueGrowth: await this.calculateRevenueGrowth(dateRange),
      topRevenueSource: await this.getTopRevenueSource(transactions)
    };
  }

  // Get transactions with real DynamoDB queries
  async getTransactions(queryParams = {}) {
    const { dateRange = 'thisMonth', type, status, limit = 100 } = queryParams;
    const dateFilter = this.getDateFilter(dateRange);
    
    const params = {
      TableName: this.tableName,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK BETWEEN :start AND :end',
      ExpressionAttributeValues: {
        ':pk': 'TRANSACTION',
        ':start': dateFilter.start,
        ':end': dateFilter.end
      },
      Limit: limit
    };

    if (type || status) {
      params.FilterExpression = [];
      params.ExpressionAttributeNames = {};
      
      if (type) {
        params.FilterExpression.push('#type = :type');
        params.ExpressionAttributeNames['#type'] = 'type';
        params.ExpressionAttributeValues[':type'] = type;
      }
      
      if (status) {
        params.FilterExpression.push('#status = :status');
        params.ExpressionAttributeNames['#status'] = 'status';
        params.ExpressionAttributeValues[':status'] = status;
      }
      
      params.FilterExpression = params.FilterExpression.join(' AND ');
    }

    const result = await dynamodb.query(params).promise();
    return result.Items;
  }

  // Create transaction (automatically called when payments are received)
  async createTransaction(transactionData) {
    const transactionId = uuidv4();
    const timestamp = new Date().toISOString();
    
    const transaction = {
      PK: `TRANSACTION#${transactionId}`,
      SK: 'METADATA',
      GSI1PK: 'TRANSACTION',
      GSI1SK: timestamp,
      GSI2PK: `TRANSACTION#${transactionData.type}`,
      GSI2SK: timestamp,
      id: transactionId,
      date: timestamp,
      ...transactionData,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    await dynamodb.put({
      TableName: this.tableName,
      Item: transaction
    }).promise();

    return transaction;
  }

  // Get invoices with filtering
  async getInvoices(queryParams = {}) {
    const { status, clientId, dateRange = 'thisMonth', limit = 100 } = queryParams;
    
    let params = {
      TableName: this.tableName,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: {
        ':pk': 'INVOICE'
      },
      Limit: limit
    };

    if (status) {
      params = {
        ...params,
        IndexName: 'GSI2',
        KeyConditionExpression: 'GSI2PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `INVOICE#${status.toUpperCase()}`
        }
      };
    }

    const result = await dynamodb.query(params).promise();
    return result.Items;
  }

  // Create invoice with auto-numbering
  async createInvoice(invoiceData) {
    const invoiceId = uuidv4();
    const invoiceNumber = await this.getNextInvoiceNumber();
    const timestamp = new Date().toISOString();
    
    const invoice = {
      PK: `INVOICE#${invoiceId}`,
      SK: 'METADATA',
      GSI1PK: 'INVOICE',
      GSI1SK: invoiceData.dueDate || timestamp,
      GSI2PK: 'INVOICE#DRAFT',
      GSI2SK: timestamp,
      id: invoiceId,
      number: invoiceNumber,
      status: 'draft',
      ...invoiceData,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    await dynamodb.put({
      TableName: this.tableName,
      Item: invoice
    }).promise();

    return invoice;
  }

  // Update invoice
  async updateInvoice(invoiceId, updateData) {
    const timestamp = new Date().toISOString();
    
    // Build update expression dynamically
    const updateExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {
      ':updatedAt': timestamp
    };

    Object.keys(updateData).forEach(key => {
      if (key !== 'id' && key !== 'PK' && key !== 'SK') {
        updateExpressions.push(`#${key} = :${key}`);
        expressionAttributeNames[`#${key}`] = key;
        expressionAttributeValues[`:${key}`] = updateData[key];
      }
    });

    // Update GSI keys if status changes
    if (updateData.status) {
      expressionAttributeNames['#GSI2PK'] = 'GSI2PK';
      expressionAttributeValues[':GSI2PK'] = `INVOICE#${updateData.status.toUpperCase()}`;
      updateExpressions.push('#GSI2PK = :GSI2PK');
    }

    updateExpressions.push('updatedAt = :updatedAt');

    const params = {
      TableName: this.tableName,
      Key: {
        PK: `INVOICE#${invoiceId}`,
        SK: 'METADATA'
      },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW'
    };

    const result = await dynamodb.update(params).promise();
    
    // If invoice is being sent, send email notification
    if (updateData.status === 'sent') {
      await this.sendInvoiceEmail(result.Attributes);
    }
    
    return result.Attributes;
  }

  // Get payments with filtering
  async getPayments(queryParams = {}) {
    const { dateRange = 'thisMonth', method, status, limit = 100 } = queryParams;
    const dateFilter = this.getDateFilter(dateRange);
    
    const params = {
      TableName: this.tableName,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK BETWEEN :start AND :end',
      ExpressionAttributeValues: {
        ':pk': 'PAYMENT',
        ':start': dateFilter.start,
        ':end': dateFilter.end
      },
      Limit: limit
    };

    if (method || status) {
      params.FilterExpression = [];
      params.ExpressionAttributeNames = {};
      
      if (method) {
        params.FilterExpression.push('#method = :method');
        params.ExpressionAttributeNames['#method'] = 'method';
        params.ExpressionAttributeValues[':method'] = method;
      }
      
      if (status) {
        params.FilterExpression.push('#status = :status');
        params.ExpressionAttributeNames['#status'] = 'status';
        params.ExpressionAttributeValues[':status'] = status;
      }
      
      params.FilterExpression = params.FilterExpression.join(' AND ');
    }

    const result = await dynamodb.query(params).promise();
    return result.Items;
  }

  // Record payment
  async recordPayment(paymentData) {
    const paymentId = uuidv4();
    const timestamp = new Date().toISOString();
    
    const payment = {
      PK: `PAYMENT#${paymentId}`,
      SK: 'METADATA',
      GSI1PK: 'PAYMENT',
      GSI1SK: timestamp,
      GSI2PK: `PAYMENT#${paymentData.method.toUpperCase()}`,
      GSI2SK: timestamp,
      id: paymentId,
      date: timestamp,
      status: 'completed',
      ...paymentData,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    // Start transaction
    const transactItems = [
      {
        Put: {
          TableName: this.tableName,
          Item: payment
        }
      }
    ];

    // Update invoice if payment is linked to one
    if (paymentData.invoiceId) {
      transactItems.push({
        Update: {
          TableName: this.tableName,
          Key: {
            PK: `INVOICE#${paymentData.invoiceId}`,
            SK: 'METADATA'
          },
          UpdateExpression: 'SET #status = :status, paidDate = :paidDate, paidAmount = :paidAmount, paymentId = :paymentId',
          ExpressionAttributeNames: {
            '#status': 'status'
          },
          ExpressionAttributeValues: {
            ':status': 'paid',
            ':paidDate': timestamp,
            ':paidAmount': paymentData.amount,
            ':paymentId': paymentId
          }
        }
      });

      // Create transaction record
      const transaction = await this.createTransaction({
        type: 'income',
        category: 'advertising_revenue',
        amount: paymentData.amount,
        description: `Payment for Invoice ${paymentData.invoiceId}`,
        status: 'completed',
        client: paymentData.client,
        invoiceId: paymentData.invoiceId,
        paymentId: paymentId
      });

      transactItems.push({
        Put: {
          TableName: this.tableName,
          Item: transaction
        }
      });
    }

    await dynamodb.transactWrite({ TransactItems: transactItems }).promise();
    
    return payment;
  }

  // Get cash flow data
  async getCashFlow(queryParams = {}) {
    const { period = 'monthly', months = 6 } = queryParams;
    const cashFlowData = [];
    
    for (let i = months - 1; i >= 0; i--) {
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - i);
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
      
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1);
      endDate.setDate(0);
      endDate.setHours(23, 59, 59, 999);
      
      const transactions = await this.getTransactionsByDateRange(
        startDate.toISOString(),
        endDate.toISOString()
      );
      
      const income = transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
      
      const expenses = transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
      
      cashFlowData.push({
        month: startDate.toLocaleDateString('en-US', { month: 'short' }),
        year: startDate.getFullYear(),
        income,
        expenses,
        net: income - expenses
      });
    }
    
    // Calculate projections based on trend
    const projection = this.calculateProjections(cashFlowData);
    
    return {
      period,
      data: cashFlowData,
      projections: projection
    };
  }

  // Helper methods
  getDateFilter(dateRange) {
    const now = new Date();
    let start, end;
    
    switch (dateRange) {
      case 'today':
        start = new Date(now.setHours(0, 0, 0, 0));
        end = new Date(now.setHours(23, 59, 59, 999));
        break;
      case 'thisWeek':
        start = new Date(now.setDate(now.getDate() - now.getDay()));
        start.setHours(0, 0, 0, 0);
        end = new Date();
        break;
      case 'thisMonth':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'thisQuarter':
        const quarter = Math.floor(now.getMonth() / 3);
        start = new Date(now.getFullYear(), quarter * 3, 1);
        end = new Date(now.getFullYear(), quarter * 3 + 3, 0);
        break;
      case 'thisYear':
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31);
        break;
      default:
        // Last 30 days
        start = new Date(now.setDate(now.getDate() - 30));
        end = new Date();
    }
    
    return {
      start: start.toISOString(),
      end: end.toISOString()
    };
  }

  async getTransactionsByDateRange(startDate, endDate) {
    const params = {
      TableName: this.tableName,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK BETWEEN :start AND :end',
      ExpressionAttributeValues: {
        ':pk': 'TRANSACTION',
        ':start': startDate,
        ':end': endDate
      }
    };

    const result = await dynamodb.query(params).promise();
    return result.Items;
  }

  async getOutstandingInvoices() {
    const statuses = ['sent', 'overdue'];
    const invoices = [];
    
    for (const status of statuses) {
      const params = {
        TableName: this.tableName,
        IndexName: 'GSI2',
        KeyConditionExpression: 'GSI2PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `INVOICE#${status.toUpperCase()}`
        }
      };
      
      const result = await dynamodb.query(params).promise();
      invoices.push(...result.Items);
    }
    
    // Check for overdue invoices
    const today = new Date();
    return invoices.map(invoice => {
      if (invoice.status === 'sent' && new Date(invoice.dueDate) < today) {
        invoice.status = 'overdue';
        invoice.daysOverdue = Math.floor((today - new Date(invoice.dueDate)) / (1000 * 60 * 60 * 24));
      }
      return invoice;
    });
  }

  async getMonthlyRecurringRevenue() {
    // Get active campaigns and calculate MRR
    const params = {
      TableName: this.tableName,
      IndexName: 'GSI2',
      KeyConditionExpression: 'GSI2PK = :pk',
      ExpressionAttributeValues: {
        ':pk': 'CAMPAIGN#ACTIVE'
      }
    };
    
    const result = await dynamodb.query(params).promise();
    
    return result.Items.reduce((total, campaign) => {
      if (campaign.recurringRevenue) {
        return total + campaign.recurringRevenue;
      }
      return total;
    }, 0);
  }

  async calculateRevenueGrowth(dateRange) {
    const current = this.getDateFilter(dateRange);
    const previous = this.getDateFilter(dateRange);
    
    // Adjust previous period
    const currentStart = new Date(current.start);
    const currentEnd = new Date(current.end);
    const periodLength = currentEnd - currentStart;
    
    previous.start = new Date(currentStart - periodLength).toISOString();
    previous.end = new Date(currentStart).toISOString();
    
    const currentTransactions = await this.getTransactionsByDateRange(current.start, current.end);
    const previousTransactions = await this.getTransactionsByDateRange(previous.start, previous.end);
    
    const currentRevenue = currentTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const previousRevenue = previousTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    
    if (previousRevenue === 0) return 0;
    
    return Math.round(((currentRevenue - previousRevenue) / previousRevenue) * 100);
  }

  async getTopRevenueSource(transactions) {
    const sources = {};
    
    transactions
      .filter(t => t.type === 'income')
      .forEach(t => {
        const source = t.category || 'other';
        sources[source] = (sources[source] || 0) + t.amount;
      });
    
    const topSource = Object.entries(sources)
      .sort(([, a], [, b]) => b - a)[0];
    
    return topSource ? { source: topSource[0], amount: topSource[1] } : null;
  }

  calculateProjections(historicalData) {
    if (historicalData.length < 3) {
      return { nextMonth: null, nextQuarter: null };
    }
    
    // Simple linear regression for projection
    const recentMonths = historicalData.slice(-3);
    const avgGrowthRate = recentMonths.reduce((sum, month, index) => {
      if (index === 0) return sum;
      const previousMonth = recentMonths[index - 1];
      const growthRate = (month.income - previousMonth.income) / previousMonth.income;
      return sum + growthRate;
    }, 0) / (recentMonths.length - 1);
    
    const lastMonth = recentMonths[recentMonths.length - 1];
    const projectedIncome = lastMonth.income * (1 + avgGrowthRate);
    const projectedExpenses = lastMonth.expenses * (1 + avgGrowthRate * 0.7); // Expenses grow slower
    
    return {
      nextMonth: {
        income: Math.round(projectedIncome),
        expenses: Math.round(projectedExpenses),
        net: Math.round(projectedIncome - projectedExpenses)
      },
      nextQuarter: {
        income: Math.round(projectedIncome * 3),
        expenses: Math.round(projectedExpenses * 3),
        net: Math.round((projectedIncome - projectedExpenses) * 3)
      }
    };
  }

  async sendInvoiceEmail(invoice) {
    // TODO: Implement email sending via SES
    console.log(`Would send invoice ${invoice.number} to client ${invoice.client}`);
  }

  // Generate financial reports
  async generateReport(reportType, params = {}) {
    const { dateRange = 'thisMonth', format = 'json' } = params;
    
    switch (reportType) {
      case 'monthly':
        return await this.generateMonthlyReport(dateRange);
      case 'quarterly':
        return await this.generateQuarterlyReport(dateRange);
      case 'tax':
        return await this.generateTaxReport(dateRange);
      case 'pnl':
        return await this.generateProfitLossStatement(dateRange);
      default:
        throw new Error(`Unknown report type: ${reportType}`);
    }
  }

  async generateMonthlyReport(dateRange) {
    const summary = await this.getFinancialSummary(dateRange);
    const transactions = await this.getTransactions({ dateRange });
    const cashFlow = await this.getCashFlow({ period: 'monthly', months: 1 });
    
    return {
      type: 'monthly',
      period: dateRange,
      generatedAt: new Date().toISOString(),
      summary,
      transactions,
      cashFlow: cashFlow.data[0],
      topClients: await this.getTopClients(transactions),
      expenseBreakdown: await this.getExpenseBreakdown(transactions)
    };
  }

  async getTopClients(transactions) {
    const clients = {};
    
    transactions
      .filter(t => t.type === 'income' && t.client)
      .forEach(t => {
        clients[t.client] = (clients[t.client] || 0) + t.amount;
      });
    
    return Object.entries(clients)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([client, amount]) => ({ client, amount }));
  }

  async getExpenseBreakdown(transactions) {
    const categories = {};
    
    transactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        const category = t.category || 'other';
        categories[category] = (categories[category] || 0) + t.amount;
      });
    
    return Object.entries(categories)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
  }
}

module.exports = FinancialService;