const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();
const lambda = new AWS.Lambda();

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'podcastflow-pro';
const FINANCIAL_LAMBDA_NAME = process.env.FINANCIAL_LAMBDA_NAME || 'podcastflow-financials';

/**
 * This module handles the financial integration when campaign payments are processed.
 * It automatically creates financial records for tracking revenue.
 */
class CampaignPaymentHandler {
  constructor() {
    this.tableName = TABLE_NAME;
    this.financialLambda = FINANCIAL_LAMBDA_NAME;
  }

  /**
   * Process a campaign payment and create corresponding financial records
   */
  async processCampaignPayment(campaignId, paymentData) {
    try {
      // Get campaign details
      const campaign = await this.getCampaignDetails(campaignId);
      if (!campaign) {
        throw new Error(`Campaign ${campaignId} not found`);
      }

      // Get advertiser details
      const advertiser = await this.getAdvertiserDetails(campaign.advertiserId);

      // Create invoice if not exists
      let invoiceId = paymentData.invoiceId;
      if (!invoiceId) {
        const invoice = await this.createCampaignInvoice(campaign, advertiser, paymentData);
        invoiceId = invoice.id;
      }

      // Record the payment
      const payment = await this.recordCampaignPayment({
        ...paymentData,
        invoiceId,
        campaignId,
        advertiserId: campaign.advertiserId,
        advertiserName: advertiser.name,
        campaignName: campaign.name
      });

      // Update campaign financial status
      await this.updateCampaignFinancialStatus(campaignId, {
        totalPaid: (campaign.totalPaid || 0) + paymentData.amount,
        lastPaymentDate: new Date().toISOString(),
        lastPaymentId: payment.id
      });

      return {
        success: true,
        invoiceId,
        paymentId: payment.id,
        transactionId: payment.transactionId
      };
    } catch (error) {
      console.error('Error processing campaign payment:', error);
      throw error;
    }
  }

  /**
   * Get campaign details from DynamoDB
   */
  async getCampaignDetails(campaignId) {
    const params = {
      TableName: this.tableName,
      Key: {
        PK: `CAMPAIGN#${campaignId}`,
        SK: 'METADATA'
      }
    };

    const result = await dynamodb.get(params).promise();
    return result.Item;
  }

  /**
   * Get advertiser details from DynamoDB
   */
  async getAdvertiserDetails(advertiserId) {
    const params = {
      TableName: this.tableName,
      Key: {
        PK: `ADVERTISER#${advertiserId}`,
        SK: 'METADATA'
      }
    };

    const result = await dynamodb.get(params).promise();
    return result.Item || { id: advertiserId, name: 'Unknown Advertiser' };
  }

  /**
   * Create an invoice for the campaign through the financial Lambda
   */
  async createCampaignInvoice(campaign, advertiser, paymentData) {
    const invoiceData = {
      client: advertiser.name,
      clientId: advertiser.id,
      campaignId: campaign.id,
      amount: paymentData.amount,
      issueDate: new Date().toISOString(),
      dueDate: paymentData.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      items: [{
        description: `${campaign.name} - Advertising Campaign`,
        amount: paymentData.amount,
        quantity: 1,
        unitPrice: paymentData.amount
      }],
      notes: paymentData.notes || `Payment for campaign: ${campaign.name}`,
      status: 'sent'
    };

    const response = await lambda.invoke({
      FunctionName: this.financialLambda,
      InvocationType: 'RequestResponse',
      Payload: JSON.stringify({
        httpMethod: 'POST',
        path: '/invoices',
        body: JSON.stringify(invoiceData)
      })
    }).promise();

    const result = JSON.parse(response.Payload);
    if (result.statusCode !== 200 && result.statusCode !== 201) {
      throw new Error(`Failed to create invoice: ${result.body}`);
    }

    return JSON.parse(result.body);
  }

  /**
   * Record the payment through the financial Lambda
   */
  async recordCampaignPayment(paymentData) {
    const payment = {
      amount: paymentData.amount,
      method: paymentData.method || 'bank_transfer',
      client: paymentData.advertiserName,
      clientId: paymentData.advertiserId,
      invoiceId: paymentData.invoiceId,
      campaignId: paymentData.campaignId,
      reference: paymentData.reference || `CAMP-${paymentData.campaignId}-${Date.now()}`,
      notes: `Payment for campaign: ${paymentData.campaignName}`,
      metadata: {
        source: 'campaign_payment',
        campaignId: paymentData.campaignId,
        processedBy: 'campaign_payment_handler'
      }
    };

    const response = await lambda.invoke({
      FunctionName: this.financialLambda,
      InvocationType: 'RequestResponse',
      Payload: JSON.stringify({
        httpMethod: 'POST',
        path: '/payments',
        body: JSON.stringify(payment)
      })
    }).promise();

    const result = JSON.parse(response.Payload);
    if (result.statusCode !== 200 && result.statusCode !== 201) {
      throw new Error(`Failed to record payment: ${result.body}`);
    }

    return JSON.parse(result.body);
  }

  /**
   * Update campaign financial status
   */
  async updateCampaignFinancialStatus(campaignId, financialData) {
    const updateExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};

    Object.keys(financialData).forEach(key => {
      updateExpressions.push(`#${key} = :${key}`);
      expressionAttributeNames[`#${key}`] = key;
      expressionAttributeValues[`:${key}`] = financialData[key];
    });

    const params = {
      TableName: this.tableName,
      Key: {
        PK: `CAMPAIGN#${campaignId}`,
        SK: 'METADATA'
      },
      UpdateExpression: `SET ${updateExpressions.join(', ')}, updatedAt = :updatedAt`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: {
        ...expressionAttributeValues,
        ':updatedAt': new Date().toISOString()
      }
    };

    await dynamodb.update(params).promise();
  }

  /**
   * Calculate commission for agencies/partners
   */
  async calculateAndRecordCommission(campaignId, paymentAmount) {
    const campaign = await this.getCampaignDetails(campaignId);
    
    if (campaign.agencyId && campaign.agencyCommissionRate) {
      const commissionAmount = paymentAmount * (campaign.agencyCommissionRate / 100);
      
      // Create expense transaction for commission
      const expenseData = {
        type: 'expense',
        category: 'commission',
        amount: commissionAmount,
        description: `Agency commission for campaign: ${campaign.name}`,
        vendor: campaign.agencyName || 'Agency',
        vendorId: campaign.agencyId,
        campaignId: campaignId,
        relatedPaymentAmount: paymentAmount,
        status: 'pending',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      };

      const response = await lambda.invoke({
        FunctionName: this.financialLambda,
        InvocationType: 'RequestResponse',
        Payload: JSON.stringify({
          httpMethod: 'POST',
          path: '/transactions',
          body: JSON.stringify(expenseData)
        })
      }).promise();

      const result = JSON.parse(response.Payload);
      if (result.statusCode === 200 || result.statusCode === 201) {
        return JSON.parse(result.body);
      }
    }

    return null;
  }

  /**
   * Get payment history for a campaign
   */
  async getCampaignPaymentHistory(campaignId) {
    const params = {
      TableName: this.tableName,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': 'PAYMENT',
        ':sk': `CAMPAIGN#${campaignId}`
      }
    };

    const result = await dynamodb.query(params).promise();
    return result.Items;
  }

  /**
   * Calculate campaign financial metrics
   */
  async getCampaignFinancialMetrics(campaignId) {
    const campaign = await this.getCampaignDetails(campaignId);
    const payments = await this.getCampaignPaymentHistory(campaignId);

    const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
    const totalBudget = campaign.budget || 0;
    const remainingBudget = totalBudget - totalPaid;
    const budgetUtilization = totalBudget > 0 ? (totalPaid / totalBudget) * 100 : 0;

    // Get ad performance metrics
    const adSlots = await this.getCampaignAdSlots(campaignId);
    const totalImpressions = adSlots.reduce((sum, slot) => sum + (slot.impressions || 0), 0);
    const totalClicks = adSlots.reduce((sum, slot) => sum + (slot.clicks || 0), 0);
    
    const cpm = totalImpressions > 0 ? (totalPaid / totalImpressions) * 1000 : 0;
    const cpc = totalClicks > 0 ? totalPaid / totalClicks : 0;

    return {
      campaignId,
      campaignName: campaign.name,
      totalBudget,
      totalPaid,
      remainingBudget,
      budgetUtilization: Math.round(budgetUtilization * 10) / 10,
      paymentCount: payments.length,
      lastPaymentDate: campaign.lastPaymentDate,
      totalImpressions,
      totalClicks,
      cpm: Math.round(cpm * 100) / 100,
      cpc: Math.round(cpc * 100) / 100,
      roi: campaign.roi || 0,
      status: campaign.status
    };
  }

  /**
   * Get campaign ad slots for metrics calculation
   */
  async getCampaignAdSlots(campaignId) {
    const params = {
      TableName: this.tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `CAMPAIGN#${campaignId}`,
        ':sk': 'ADSLOT#'
      }
    };

    const result = await dynamodb.query(params).promise();
    return result.Items;
  }

  /**
   * Process refund for a campaign payment
   */
  async processCampaignRefund(paymentId, refundData) {
    // Get original payment
    const originalPayment = await this.getPaymentDetails(paymentId);
    if (!originalPayment) {
      throw new Error(`Payment ${paymentId} not found`);
    }

    // Create refund transaction
    const refundTransaction = {
      type: 'expense',
      category: 'refund',
      amount: refundData.amount || originalPayment.amount,
      description: `Refund for payment ${paymentId} - ${refundData.reason}`,
      relatedPaymentId: paymentId,
      campaignId: originalPayment.campaignId,
      status: 'completed',
      refundReason: refundData.reason,
      refundedBy: refundData.processedBy
    };

    const response = await lambda.invoke({
      FunctionName: this.financialLambda,
      InvocationType: 'RequestResponse',
      Payload: JSON.stringify({
        httpMethod: 'POST',
        path: '/transactions',
        body: JSON.stringify(refundTransaction)
      })
    }).promise();

    const result = JSON.parse(response.Payload);
    if (result.statusCode !== 200 && result.statusCode !== 201) {
      throw new Error(`Failed to process refund: ${result.body}`);
    }

    // Update campaign financial status
    if (originalPayment.campaignId) {
      const campaign = await this.getCampaignDetails(originalPayment.campaignId);
      await this.updateCampaignFinancialStatus(originalPayment.campaignId, {
        totalPaid: (campaign.totalPaid || 0) - refundData.amount,
        totalRefunded: (campaign.totalRefunded || 0) + refundData.amount,
        lastRefundDate: new Date().toISOString()
      });
    }

    return JSON.parse(result.body);
  }

  async getPaymentDetails(paymentId) {
    const params = {
      TableName: this.tableName,
      Key: {
        PK: `PAYMENT#${paymentId}`,
        SK: 'METADATA'
      }
    };

    const result = await dynamodb.get(params).promise();
    return result.Item;
  }
}

module.exports = CampaignPaymentHandler;