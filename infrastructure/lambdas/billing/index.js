const AWS = require('aws-sdk')
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)

const dynamodb = new AWS.DynamoDB.DocumentClient()
const ses = new AWS.SES()

const TABLE_NAME = process.env.TABLE_NAME || 'PodcastFlowPro'

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
}

const plans = {
  starter: {
    id: 'starter',
    name: 'Starter',
    price: 49,
    interval: 'monthly',
    stripeProductId: process.env.STRIPE_STARTER_PRODUCT_ID,
    stripePriceId: process.env.STRIPE_STARTER_PRICE_ID,
    features: [
      'Up to 5 campaigns',
      'Basic analytics',
      '1 team member',
      'Email support',
      'Standard integrations'
    ],
    limits: {
      campaigns: 5,
      teamMembers: 1,
      storage: 5 // GB
    }
  },
  professional: {
    id: 'professional',
    name: 'Professional',
    price: 149,
    interval: 'monthly',
    stripeProductId: process.env.STRIPE_PRO_PRODUCT_ID,
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID,
    features: [
      'Up to 20 campaigns',
      'Advanced analytics',
      '5 team members',
      'Priority support',
      'All integrations',
      'Custom reports'
    ],
    limits: {
      campaigns: 20,
      teamMembers: 5,
      storage: 25 // GB
    }
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    price: 499,
    interval: 'monthly',
    stripeProductId: process.env.STRIPE_ENTERPRISE_PRODUCT_ID,
    stripePriceId: process.env.STRIPE_ENTERPRISE_PRICE_ID,
    features: [
      'Unlimited campaigns',
      'Advanced analytics & AI insights',
      'Unlimited team members',
      'Dedicated support',
      'All integrations',
      'Custom reports',
      'API access',
      'White-label options'
    ],
    limits: {
      campaigns: -1, // unlimited
      teamMembers: -1, // unlimited
      storage: 100 // GB
    }
  }
}

exports.handler = async (event) => {
  console.log('Billing Lambda received event:', JSON.stringify(event))
  
  const { httpMethod, path, body, requestContext } = event
  
  // Handle preflight OPTIONS requests
  if (httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'OK' })
    }
  }
  
  try {
    const userId = requestContext?.authorizer?.claims?.sub || 'test-user'
    const organizationId = requestContext?.authorizer?.claims['custom:organizationId'] || 'default-org'
    
    // Route based on path
    if (path.includes('/subscription')) {
      return await handleSubscriptionOperations(httpMethod, body, organizationId, userId)
    } else if (path.includes('/payment-methods')) {
      return await handlePaymentMethodOperations(httpMethod, body, organizationId, userId)
    } else if (path.includes('/invoices')) {
      return await handleInvoiceOperations(httpMethod, organizationId)
    } else if (path.includes('/usage')) {
      return await getUsageData(organizationId)
    } else {
      // GET /billing - return all billing data
      return await getBillingOverview(organizationId)
    }
  } catch (error) {
    console.error('Billing Lambda error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || 'Internal server error' })
    }
  }
}

async function getBillingOverview(organizationId) {
  // Get organization billing data
  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: `ORG#${organizationId}`,
      SK: 'BILLING'
    }
  }
  
  const result = await dynamodb.get(params).promise()
  const billingData = result.Item || {}
  
  // Get current subscription
  let subscription = null
  if (billingData.stripeSubscriptionId) {
    try {
      subscription = await stripe.subscriptions.retrieve(billingData.stripeSubscriptionId)
    } catch (error) {
      console.error('Failed to retrieve Stripe subscription:', error)
    }
  }
  
  // Get payment methods
  let paymentMethods = []
  if (billingData.stripeCustomerId) {
    try {
      const methods = await stripe.paymentMethods.list({
        customer: billingData.stripeCustomerId,
        type: 'card'
      })
      paymentMethods = methods.data
    } catch (error) {
      console.error('Failed to retrieve payment methods:', error)
    }
  }
  
  // Get recent invoices
  let invoices = []
  if (billingData.stripeCustomerId) {
    try {
      const invoiceList = await stripe.invoices.list({
        customer: billingData.stripeCustomerId,
        limit: 10
      })
      invoices = invoiceList.data
    } catch (error) {
      console.error('Failed to retrieve invoices:', error)
    }
  }
  
  // Get usage data
  const usage = await getUsageData(organizationId)
  
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      currentPlan: billingData.planId ? plans[billingData.planId] : null,
      subscription: subscription ? {
        status: subscription.status,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
        cancelAtPeriodEnd: subscription.cancel_at_period_end
      } : null,
      paymentMethods: paymentMethods.map(pm => ({
        id: pm.id,
        type: pm.type,
        last4: pm.card.last4,
        brand: pm.card.brand,
        expiryMonth: pm.card.exp_month,
        expiryYear: pm.card.exp_year,
        isDefault: pm.id === billingData.defaultPaymentMethodId
      })),
      invoices: invoices.map(inv => ({
        id: inv.id,
        date: new Date(inv.created * 1000).toISOString(),
        amount: inv.amount_paid / 100,
        status: inv.status,
        description: inv.description || `${billingData.planId} Plan`,
        invoiceUrl: inv.hosted_invoice_url
      })),
      usage: usage.body ? JSON.parse(usage.body) : {},
      nextBillingDate: subscription ? new Date(subscription.current_period_end * 1000).toISOString() : null
    })
  }
}

async function handleSubscriptionOperations(httpMethod, body, organizationId, userId) {
  const billingParams = {
    TableName: TABLE_NAME,
    Key: {
      PK: `ORG#${organizationId}`,
      SK: 'BILLING'
    }
  }
  
  const billingResult = await dynamodb.get(billingParams).promise()
  const billingData = billingResult.Item || {}
  
  switch (httpMethod) {
    case 'POST':
      // Create or update subscription
      const { planId, paymentMethodId } = JSON.parse(body)
      
      if (!plans[planId]) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid plan' })
        }
      }
      
      let stripeCustomerId = billingData.stripeCustomerId
      
      // Create Stripe customer if doesn't exist
      if (!stripeCustomerId) {
        const customer = await stripe.customers.create({
          metadata: {
            organizationId,
            userId
          }
        })
        stripeCustomerId = customer.id
      }
      
      // Attach payment method to customer
      if (paymentMethodId) {
        await stripe.paymentMethods.attach(paymentMethodId, {
          customer: stripeCustomerId
        })
        
        // Set as default payment method
        await stripe.customers.update(stripeCustomerId, {
          invoice_settings: {
            default_payment_method: paymentMethodId
          }
        })
      }
      
      // Create or update subscription
      let subscription
      if (billingData.stripeSubscriptionId) {
        // Update existing subscription
        subscription = await stripe.subscriptions.update(billingData.stripeSubscriptionId, {
          items: [{
            id: billingData.stripeSubscriptionItemId,
            price: plans[planId].stripePriceId
          }],
          proration_behavior: 'create_prorations'
        })
      } else {
        // Create new subscription
        subscription = await stripe.subscriptions.create({
          customer: stripeCustomerId,
          items: [{
            price: plans[planId].stripePriceId
          }],
          payment_behavior: 'default_incomplete',
          expand: ['latest_invoice.payment_intent']
        })
      }
      
      // Update billing data in DynamoDB
      const updateParams = {
        TableName: TABLE_NAME,
        Key: {
          PK: `ORG#${organizationId}`,
          SK: 'BILLING'
        },
        UpdateExpression: 'SET planId = :planId, stripeCustomerId = :customerId, stripeSubscriptionId = :subId, stripeSubscriptionItemId = :itemId, defaultPaymentMethodId = :pmId, updatedAt = :timestamp, updatedBy = :userId',
        ExpressionAttributeValues: {
          ':planId': planId,
          ':customerId': stripeCustomerId,
          ':subId': subscription.id,
          ':itemId': subscription.items.data[0].id,
          ':pmId': paymentMethodId,
          ':timestamp': new Date().toISOString(),
          ':userId': userId
        }
      }
      
      await dynamodb.update(updateParams).promise()
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          subscription: {
            id: subscription.id,
            status: subscription.status,
            clientSecret: subscription.latest_invoice?.payment_intent?.client_secret
          }
        })
      }
      
    case 'DELETE':
      // Cancel subscription
      if (!billingData.stripeSubscriptionId) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'No active subscription found' })
        }
      }
      
      const canceledSubscription = await stripe.subscriptions.update(
        billingData.stripeSubscriptionId,
        { cancel_at_period_end: true }
      )
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Subscription will be canceled at the end of the billing period',
          cancelAt: new Date(canceledSubscription.cancel_at * 1000).toISOString()
        })
      }
      
    default:
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: 'Method not allowed' })
      }
  }
}

async function handlePaymentMethodOperations(httpMethod, body, organizationId, userId) {
  const billingParams = {
    TableName: TABLE_NAME,
    Key: {
      PK: `ORG#${organizationId}`,
      SK: 'BILLING'
    }
  }
  
  const billingResult = await dynamodb.get(billingParams).promise()
  const billingData = billingResult.Item || {}
  
  switch (httpMethod) {
    case 'POST':
      // Add payment method
      const { paymentMethodId } = JSON.parse(body)
      
      if (!billingData.stripeCustomerId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'No customer account found' })
        }
      }
      
      // Attach payment method to customer
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: billingData.stripeCustomerId
      })
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Payment method added successfully'
        })
      }
      
    case 'PUT':
      // Set default payment method
      const { paymentMethodId: defaultMethodId } = JSON.parse(body)
      
      await stripe.customers.update(billingData.stripeCustomerId, {
        invoice_settings: {
          default_payment_method: defaultMethodId
        }
      })
      
      // Update in DynamoDB
      const updateParams = {
        TableName: TABLE_NAME,
        Key: {
          PK: `ORG#${organizationId}`,
          SK: 'BILLING'
        },
        UpdateExpression: 'SET defaultPaymentMethodId = :pmId, updatedAt = :timestamp',
        ExpressionAttributeValues: {
          ':pmId': defaultMethodId,
          ':timestamp': new Date().toISOString()
        }
      }
      
      await dynamodb.update(updateParams).promise()
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Default payment method updated'
        })
      }
      
    case 'DELETE':
      // Remove payment method
      const { methodId } = JSON.parse(body)
      
      await stripe.paymentMethods.detach(methodId)
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Payment method removed'
        })
      }
      
    default:
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: 'Method not allowed' })
      }
  }
}

async function handleInvoiceOperations(httpMethod, organizationId) {
  if (httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }
  
  const billingParams = {
    TableName: TABLE_NAME,
    Key: {
      PK: `ORG#${organizationId}`,
      SK: 'BILLING'
    }
  }
  
  const billingResult = await dynamodb.get(billingParams).promise()
  const billingData = billingResult.Item || {}
  
  if (!billingData.stripeCustomerId) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify([])
    }
  }
  
  const invoices = await stripe.invoices.list({
    customer: billingData.stripeCustomerId,
    limit: 100
  })
  
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(
      invoices.data.map(inv => ({
        id: inv.id,
        date: new Date(inv.created * 1000).toISOString(),
        amount: inv.amount_paid / 100,
        status: inv.status,
        description: inv.description || `${billingData.planId} Plan`,
        invoiceUrl: inv.hosted_invoice_url,
        pdfUrl: inv.invoice_pdf
      }))
    )
  }
}

async function getUsageData(organizationId) {
  // Get campaign count
  const campaignParams = {
    TableName: TABLE_NAME,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': `ORG#${organizationId}`,
      ':sk': 'CAMPAIGN#'
    },
    Select: 'COUNT'
  }
  
  const campaignResult = await dynamodb.query(campaignParams).promise()
  
  // Get team member count
  const teamParams = {
    TableName: TABLE_NAME,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': `ORG#${organizationId}`,
      ':sk': 'MEMBER#'
    },
    Select: 'COUNT'
  }
  
  const teamResult = await dynamodb.query(teamParams).promise()
  
  // Get storage usage (mock for now)
  const storageUsed = 2.5 // GB
  
  // Get current plan limits
  const billingParams = {
    TableName: TABLE_NAME,
    Key: {
      PK: `ORG#${organizationId}`,
      SK: 'BILLING'
    }
  }
  
  const billingResult = await dynamodb.get(billingParams).promise()
  const currentPlan = billingResult.Item?.planId ? plans[billingResult.Item.planId] : plans.starter
  
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      campaigns: campaignResult.Count || 0,
      campaignsLimit: currentPlan.limits.campaigns,
      teamMembers: teamResult.Count || 0,
      teamMembersLimit: currentPlan.limits.teamMembers,
      storage: storageUsed,
      storageLimit: currentPlan.limits.storage
    })
  }
}