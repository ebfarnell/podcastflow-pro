const AWS = require('aws-sdk');
const { requireAuth, hasPermission } = require('../shared/authMiddleware');
const { v4: uuidv4 } = require('uuid');

const dynamoDB = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.TABLE_NAME || 'PodcastFlowPro';

// Get deals/pipeline
async function getDeals(event) {
  const user = event.user;
  const { stage, status } = event.queryStringParameters || {};
  
  try {
    let queryParams = {
      TableName: TABLE_NAME,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: {
        ':pk': 'DEAL'
      }
    };

    // Filter by seller for non-admins
    let filterExpressions = [];
    if (user.role === 'seller') {
      filterExpressions.push('sellerId = :userId');
      queryParams.ExpressionAttributeValues[':userId'] = user.id;
    }
    
    // Filter by stage
    if (stage) {
      filterExpressions.push('stage = :stage');
      queryParams.ExpressionAttributeValues[':stage'] = stage;
    }
    
    // Filter by status
    if (status) {
      filterExpressions.push('#status = :status');
      queryParams.ExpressionAttributeValues[':status'] = status;
      queryParams.ExpressionAttributeNames = { '#status': 'status' };
    }
    
    if (filterExpressions.length > 0) {
      queryParams.FilterExpression = filterExpressions.join(' AND ');
    }

    const result = await dynamoDB.query(queryParams).promise();
    const deals = result.Items || [];
    
    // Calculate pipeline metrics
    const metrics = {
      totalDeals: deals.length,
      totalValue: deals.reduce((sum, deal) => sum + (deal.estimatedValue || 0), 0),
      avgDealSize: 0,
      conversionRate: 0,
      dealsThisMonth: 0,
      valueThisMonth: 0,
      stageBreakdown: {}
    };
    
    // Calculate average deal size
    if (metrics.totalDeals > 0) {
      metrics.avgDealSize = metrics.totalValue / metrics.totalDeals;
    }
    
    // Calculate deals this month
    const currentMonth = new Date();
    currentMonth.setDate(1);
    deals.forEach(deal => {
      if (new Date(deal.createdAt) >= currentMonth) {
        metrics.dealsThisMonth++;
        metrics.valueThisMonth += deal.estimatedValue || 0;
      }
      
      // Stage breakdown
      if (!metrics.stageBreakdown[deal.stage]) {
        metrics.stageBreakdown[deal.stage] = { count: 0, value: 0 };
      }
      metrics.stageBreakdown[deal.stage].count++;
      metrics.stageBreakdown[deal.stage].value += deal.estimatedValue || 0;
    });
    
    // Calculate conversion rate
    const closedWonDeals = deals.filter(d => d.stage === 'closed-won').length;
    const totalClosedDeals = deals.filter(d => d.stage === 'closed-won' || d.stage === 'closed-lost').length;
    if (totalClosedDeals > 0) {
      metrics.conversionRate = (closedWonDeals / totalClosedDeals) * 100;
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        deals,
        metrics
      })
    };
  } catch (error) {
    console.error('Error fetching deals:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        message: 'Error fetching deals',
        error: error.message 
      })
    };
  }
}

// Create deal
async function createDeal(event) {
  const user = event.user;
  const dealData = JSON.parse(event.body);
  
  // Only sellers and admins can create deals
  if (user.role !== 'seller' && user.role !== 'admin') {
    return {
      statusCode: 403,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ message: 'Forbidden: Cannot create deals' })
    };
  }
  
  try {
    const dealId = `DEAL-${Date.now()}`;
    const timestamp = new Date().toISOString();
    
    const deal = {
      PK: `DEAL#${dealId}`,
      SK: `DEAL#${dealId}`,
      GSI1PK: 'DEAL',
      GSI1SK: `${timestamp}#${dealId}`,
      id: dealId,
      ...dealData,
      sellerId: user.role === 'seller' ? user.id : dealData.sellerId,
      stage: dealData.stage || 'lead',
      probability: dealData.probability || 25,
      status: 'active',
      createdAt: timestamp,
      createdBy: user.id,
      updatedAt: timestamp,
      activities: []
    };
    
    await dynamoDB.put({
      TableName: TABLE_NAME,
      Item: deal
    }).promise();
    
    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(deal)
    };
  } catch (error) {
    console.error('Error creating deal:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        message: 'Error creating deal',
        error: error.message 
      })
    };
  }
}

// Update deal
async function updateDeal(event) {
  const user = event.user;
  const { dealId } = event.pathParameters;
  const updates = JSON.parse(event.body);
  
  try {
    // Get existing deal
    const result = await dynamoDB.get({
      TableName: TABLE_NAME,
      Key: {
        PK: `DEAL#${dealId}`,
        SK: `DEAL#${dealId}`
      }
    }).promise();
    
    if (!result.Item) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ message: 'Deal not found' })
      };
    }
    
    const deal = result.Item;
    
    // Check permissions
    if (user.role !== 'admin' && deal.sellerId !== user.id) {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ message: 'Forbidden: Cannot update this deal' })
      };
    }
    
    // Build update expression
    const updateExpressions = [];
    const expressionAttributeValues = {
      ':updatedAt': new Date().toISOString()
    };
    const expressionAttributeNames = {};
    
    // Update allowed fields
    const allowedFields = ['stage', 'probability', 'estimatedValue', 'expectedCloseDate', 'notes', 'nextAction'];
    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        updateExpressions.push(`#${field} = :${field}`);
        expressionAttributeNames[`#${field}`] = field;
        expressionAttributeValues[`:${field}`] = updates[field];
      }
    });
    
    updateExpressions.push('updatedAt = :updatedAt');
    
    // Add activity log
    if (updates.stage && updates.stage !== deal.stage) {
      const activity = {
        id: uuidv4(),
        type: 'stage_change',
        description: `Stage changed from ${deal.stage} to ${updates.stage}`,
        timestamp: new Date().toISOString(),
        userId: user.id
      };
      
      updateExpressions.push('activities = list_append(activities, :activity)');
      expressionAttributeValues[':activity'] = [activity];
    }
    
    await dynamoDB.update({
      TableName: TABLE_NAME,
      Key: {
        PK: `DEAL#${dealId}`,
        SK: `DEAL#${dealId}`
      },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
      ExpressionAttributeValues: expressionAttributeValues
    }).promise();
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        message: 'Deal updated successfully',
        dealId 
      })
    };
  } catch (error) {
    console.error('Error updating deal:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        message: 'Error updating deal',
        error: error.message 
      })
    };
  }
}

// Get single deal
async function getDeal(event) {
  const user = event.user;
  const { dealId } = event.pathParameters;
  
  try {
    const result = await dynamoDB.get({
      TableName: TABLE_NAME,
      Key: {
        PK: `DEAL#${dealId}`,
        SK: `DEAL#${dealId}`
      }
    }).promise();
    
    if (!result.Item) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ message: 'Deal not found' })
      };
    }
    
    const deal = result.Item;
    
    // Check permissions
    if (user.role !== 'admin' && deal.sellerId !== user.id) {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ message: 'Forbidden: Cannot view this deal' })
      };
    }
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(deal)
    };
  } catch (error) {
    console.error('Error fetching deal:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        message: 'Error fetching deal',
        error: error.message 
      })
    };
  }
}

// Main handler
exports.handler = requireAuth(async (event, context) => {
  const { httpMethod, path, pathParameters } = event;
  
  // Route requests
  if (path === '/deals' && httpMethod === 'GET') {
    return getDeals(event);
  } else if (path === '/deals' && httpMethod === 'POST') {
    return createDeal(event);
  } else if (pathParameters?.dealId && httpMethod === 'GET') {
    return getDeal(event);
  } else if (pathParameters?.dealId && httpMethod === 'PUT') {
    return updateDeal(event);
  }
  
  return {
    statusCode: 404,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({ message: 'Not found' })
  };
}, { permissions: ['deals.manage', 'campaigns.view.own'] });