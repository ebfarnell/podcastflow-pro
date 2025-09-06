const AWS = require('aws-sdk')
const crypto = require('crypto')
const axios = require('axios')

const dynamodb = new AWS.DynamoDB.DocumentClient()
const apigateway = new AWS.APIGateway()

const TABLE_NAME = process.env.TABLE_NAME || 'PodcastFlowPro'
const API_GATEWAY_ID = process.env.API_GATEWAY_ID

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
}

const webhookEvents = [
  'campaign.created',
  'campaign.updated',
  'campaign.completed',
  'campaign.paused',
  'analytics.daily',
  'budget.alert',
  'integration.connected',
  'integration.error'
]

exports.handler = async (event) => {
  console.log('API/Webhooks Lambda received event:', JSON.stringify(event))
  
  const { httpMethod, path, pathParameters, body, requestContext } = event
  
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
    if (path.includes('/api-keys')) {
      return await handleApiKeyOperations(httpMethod, pathParameters, body, organizationId, userId)
    } else if (path.includes('/webhooks')) {
      if (path.includes('/test')) {
        return await testWebhook(body, organizationId)
      }
      return await handleWebhookOperations(httpMethod, pathParameters, body, organizationId, userId)
    } else {
      // GET /api - return all API settings
      return await getApiSettings(organizationId)
    }
  } catch (error) {
    console.error('API/Webhooks Lambda error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || 'Internal server error' })
    }
  }
}

async function getApiSettings(organizationId) {
  // Get API keys
  const apiKeyParams = {
    TableName: TABLE_NAME,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': `ORG#${organizationId}`,
      ':sk': 'APIKEY#'
    }
  }
  
  const apiKeyResult = await dynamodb.query(apiKeyParams).promise()
  
  // Get webhooks
  const webhookParams = {
    TableName: TABLE_NAME,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': `ORG#${organizationId}`,
      ':sk': 'WEBHOOK#'
    }
  }
  
  const webhookResult = await dynamodb.query(webhookParams).promise()
  
  const apiKeys = apiKeyResult.Items.map(item => ({
    id: item.SK.replace('APIKEY#', ''),
    name: item.name,
    key: maskApiKey(item.key),
    created: item.created,
    lastUsed: item.lastUsed,
    permissions: item.permissions,
    isActive: item.isActive
  }))
  
  const webhooks = webhookResult.Items.map(item => ({
    id: item.SK.replace('WEBHOOK#', ''),
    name: item.name,
    url: item.url,
    events: item.events,
    isActive: item.isActive,
    secret: 'whsec_' + item.SK.replace('WEBHOOK#', '').substring(0, 16),
    lastTriggered: item.lastTriggered,
    failureCount: item.failureCount || 0
  }))
  
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      apiKeys,
      webhooks
    })
  }
}

async function handleApiKeyOperations(httpMethod, pathParameters, body, organizationId, userId) {
  switch (httpMethod) {
    case 'POST':
      // Create new API key
      const { name, permissions } = JSON.parse(body)
      
      const apiKeyId = crypto.randomBytes(16).toString('hex')
      const apiKey = `pk_${process.env.STAGE || 'live'}_${crypto.randomBytes(24).toString('hex')}`
      const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex')
      
      const createParams = {
        TableName: TABLE_NAME,
        Item: {
          PK: `ORG#${organizationId}`,
          SK: `APIKEY#${apiKeyId}`,
          name,
          key: hashedKey, // Store hashed version
          keyPrefix: apiKey.substring(0, 12), // Store prefix for display
          permissions: permissions || ['read'],
          created: new Date().toISOString(),
          createdBy: userId,
          isActive: true,
          usageCount: 0
        }
      }
      
      await dynamodb.put(createParams).promise()
      
      // Create API Gateway API key if configured
      if (API_GATEWAY_ID) {
        try {
          await apigateway.createApiKey({
            name: `${organizationId}-${apiKeyId}`,
            value: apiKey,
            enabled: true,
            stageKeys: [{
              restApiId: API_GATEWAY_ID,
              stageName: process.env.STAGE || 'prod'
            }]
          }).promise()
        } catch (error) {
          console.error('Failed to create API Gateway key:', error)
        }
      }
      
      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({
          id: apiKeyId,
          key: apiKey, // Return full key only on creation
          name,
          message: 'API key created. Store it securely as it won\'t be shown again.'
        })
      }
      
    case 'PUT':
      // Update API key (permissions, status)
      const { keyId } = pathParameters
      const updateData = JSON.parse(body)
      
      const updateExpressions = []
      const expressionAttributeValues = {}
      
      if (updateData.permissions) {
        updateExpressions.push('permissions = :permissions')
        expressionAttributeValues[':permissions'] = updateData.permissions
      }
      
      if (typeof updateData.isActive !== 'undefined') {
        updateExpressions.push('isActive = :isActive')
        expressionAttributeValues[':isActive'] = updateData.isActive
      }
      
      updateExpressions.push('updatedAt = :updatedAt')
      expressionAttributeValues[':updatedAt'] = new Date().toISOString()
      
      const updateParams = {
        TableName: TABLE_NAME,
        Key: {
          PK: `ORG#${organizationId}`,
          SK: `APIKEY#${keyId}`
        },
        UpdateExpression: 'SET ' + updateExpressions.join(', '),
        ExpressionAttributeValues: expressionAttributeValues
      }
      
      await dynamodb.update(updateParams).promise()
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'API key updated'
        })
      }
      
    case 'DELETE':
      // Delete API key
      const { keyId: deleteKeyId } = pathParameters
      
      // Get key details first for API Gateway deletion
      const getParams = {
        TableName: TABLE_NAME,
        Key: {
          PK: `ORG#${organizationId}`,
          SK: `APIKEY#${deleteKeyId}`
        }
      }
      
      const keyResult = await dynamodb.get(getParams).promise()
      
      if (!keyResult.Item) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'API key not found' })
        }
      }
      
      // Delete from DynamoDB
      const deleteParams = {
        TableName: TABLE_NAME,
        Key: {
          PK: `ORG#${organizationId}`,
          SK: `APIKEY#${deleteKeyId}`
        }
      }
      
      await dynamodb.delete(deleteParams).promise()
      
      // TODO: Delete from API Gateway if needed
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'API key deleted'
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

async function handleWebhookOperations(httpMethod, pathParameters, body, organizationId, userId) {
  switch (httpMethod) {
    case 'POST':
      // Create new webhook
      const { name, url, events } = JSON.parse(body)
      
      // Validate URL
      try {
        new URL(url)
      } catch {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid webhook URL' })
        }
      }
      
      // Validate events
      const invalidEvents = events.filter(e => !webhookEvents.includes(e))
      if (invalidEvents.length > 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: `Invalid events: ${invalidEvents.join(', ')}` })
        }
      }
      
      const webhookId = crypto.randomBytes(16).toString('hex')
      const secret = crypto.randomBytes(32).toString('hex')
      
      const createParams = {
        TableName: TABLE_NAME,
        Item: {
          PK: `ORG#${organizationId}`,
          SK: `WEBHOOK#${webhookId}`,
          name,
          url,
          events,
          secret: crypto.createHash('sha256').update(secret).digest('hex'),
          created: new Date().toISOString(),
          createdBy: userId,
          isActive: true,
          failureCount: 0
        }
      }
      
      await dynamodb.put(createParams).promise()
      
      // Send test webhook to verify endpoint
      try {
        await sendWebhook(url, secret, {
          event: 'webhook.test',
          data: {
            message: 'Webhook endpoint configured successfully'
          }
        })
      } catch (error) {
        console.warn('Failed to send test webhook:', error.message)
      }
      
      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({
          id: webhookId,
          secret: `whsec_${secret}`, // Return full secret only on creation
          message: 'Webhook created successfully'
        })
      }
      
    case 'PUT':
      // Update webhook
      const { webhookId } = pathParameters
      const updateData = JSON.parse(body)
      
      const updateExpressions = []
      const expressionAttributeValues = {}
      
      if (updateData.url) {
        try {
          new URL(updateData.url)
        } catch {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Invalid webhook URL' })
          }
        }
        updateExpressions.push('url = :url')
        expressionAttributeValues[':url'] = updateData.url
      }
      
      if (updateData.events) {
        const invalidEvents = updateData.events.filter(e => !webhookEvents.includes(e))
        if (invalidEvents.length > 0) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: `Invalid events: ${invalidEvents.join(', ')}` })
          }
        }
        updateExpressions.push('events = :events')
        expressionAttributeValues[':events'] = updateData.events
      }
      
      if (typeof updateData.isActive !== 'undefined') {
        updateExpressions.push('isActive = :isActive')
        expressionAttributeValues[':isActive'] = updateData.isActive
      }
      
      updateExpressions.push('updatedAt = :updatedAt')
      expressionAttributeValues[':updatedAt'] = new Date().toISOString()
      
      const updateParams = {
        TableName: TABLE_NAME,
        Key: {
          PK: `ORG#${organizationId}`,
          SK: `WEBHOOK#${webhookId}`
        },
        UpdateExpression: 'SET ' + updateExpressions.join(', '),
        ExpressionAttributeValues: expressionAttributeValues
      }
      
      await dynamodb.update(updateParams).promise()
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Webhook updated'
        })
      }
      
    case 'DELETE':
      // Delete webhook
      const { webhookId: deleteWebhookId } = pathParameters
      
      const deleteParams = {
        TableName: TABLE_NAME,
        Key: {
          PK: `ORG#${organizationId}`,
          SK: `WEBHOOK#${deleteWebhookId}`
        }
      }
      
      await dynamodb.delete(deleteParams).promise()
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Webhook deleted'
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

async function testWebhook(body, organizationId) {
  const { webhookId } = JSON.parse(body)
  
  // Get webhook details
  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: `ORG#${organizationId}`,
      SK: `WEBHOOK#${webhookId}`
    }
  }
  
  const result = await dynamodb.get(params).promise()
  
  if (!result.Item) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Webhook not found' })
    }
  }
  
  const webhook = result.Item
  
  try {
    await sendWebhook(webhook.url, webhook.secret, {
      event: 'webhook.test',
      data: {
        webhookId,
        timestamp: new Date().toISOString(),
        message: 'Test webhook sent successfully'
      }
    })
    
    // Update last triggered
    const updateParams = {
      TableName: TABLE_NAME,
      Key: {
        PK: `ORG#${organizationId}`,
        SK: `WEBHOOK#${webhookId}`
      },
      UpdateExpression: 'SET lastTriggered = :timestamp',
      ExpressionAttributeValues: {
        ':timestamp': new Date().toISOString()
      }
    }
    
    await dynamodb.update(updateParams).promise()
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Test webhook sent successfully'
      })
    }
  } catch (error) {
    // Update failure count
    const updateParams = {
      TableName: TABLE_NAME,
      Key: {
        PK: `ORG#${organizationId}`,
        SK: `WEBHOOK#${webhookId}`
      },
      UpdateExpression: 'SET failureCount = failureCount + :inc, lastFailure = :timestamp',
      ExpressionAttributeValues: {
        ':inc': 1,
        ':timestamp': new Date().toISOString()
      }
    }
    
    await dynamodb.update(updateParams).promise()
    
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        error: 'Failed to send test webhook',
        details: error.message
      })
    }
  }
}

async function sendWebhook(url, secret, payload) {
  const timestamp = Math.floor(Date.now() / 1000)
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${JSON.stringify(payload)}`)
    .digest('hex')
  
  const response = await axios.post(url, payload, {
    headers: {
      'Content-Type': 'application/json',
      'X-Webhook-Timestamp': timestamp,
      'X-Webhook-Signature': signature
    },
    timeout: 5000
  })
  
  if (response.status >= 400) {
    throw new Error(`Webhook returned status ${response.status}`)
  }
  
  return response
}

function maskApiKey(key) {
  if (!key || key.length < 12) return key
  return key.substring(0, 12) + '...'
}