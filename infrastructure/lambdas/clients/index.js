const AWS = require('aws-sdk');
const { requireAuth } = require('./shared/authMiddleware');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.TABLE_NAME;

// Client handlers
async function getClients(event, user) {
  const ownOnly = event.queryStringParameters?.ownOnly === 'true';
  
  try {
    const params = {
      TableName: TABLE_NAME,
      IndexName: 'sk-data-index',
      KeyConditionExpression: 'sk = :sk',
      ExpressionAttributeValues: {
        ':sk': 'CLIENT'
      }
    };
    
    const result = await dynamodb.query(params).promise();
    let clients = result.Items || [];
    
    // Filter based on role
    if (user.role === 'seller') {
      if (ownOnly) {
        // Only show clients assigned to this seller
        clients = clients.filter(client => client.assignedSeller === user.userId);
      }
    } else if (user.role === 'client') {
      // Clients can only see their own data
      clients = clients.filter(client => client.pk === `CLIENT#${user.userId}`);
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        clients,
        count: clients.length
      }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };
  } catch (error) {
    console.error('Error getting clients:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to get clients' }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };
  }
}

async function getClient(event, user) {
  const clientId = event.pathParameters?.clientId;
  
  if (!clientId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Client ID is required' }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };
  }
  
  try {
    const result = await dynamodb.get({
      TableName: TABLE_NAME,
      Key: {
        pk: `CLIENT#${clientId}`,
        sk: 'CLIENT'
      }
    }).promise();
    
    if (!result.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Client not found' }),
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      };
    }
    
    // Check access based on role
    const client = result.Item;
    if (user.role === 'seller') {
      // Check if seller is assigned to this client
      if (client.assignedSeller !== user.userId) {
        return {
          statusCode: 403,
          body: JSON.stringify({ error: 'Access denied' }),
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        };
      }
    } else if (user.role === 'client') {
      // Clients can only see their own data
      if (clientId !== user.userId) {
        return {
          statusCode: 403,
          body: JSON.stringify({ error: 'Access denied' }),
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        };
      }
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify(client),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };
  } catch (error) {
    console.error('Error getting client:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to get client' }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };
  }
}

async function createClient(event, user) {
  try {
    const clientData = JSON.parse(event.body);
    const timestamp = new Date().toISOString();
    const clientId = `CL${Date.now()}`;
    
    // Validate required fields
    if (!clientData.name || !clientData.email) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Name and email are required' }),
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      };
    }
    
    // Check permissions
    if (user.role !== 'admin' && user.role !== 'seller') {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Permission denied' }),
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      };
    }
    
    const client = {
      pk: `CLIENT#${clientId}`,
      sk: 'CLIENT',
      clientId,
      name: clientData.name,
      email: clientData.email,
      company: clientData.company || '',
      phone: clientData.phone || '',
      address: clientData.address || '',
      website: clientData.website || '',
      industry: clientData.industry || '',
      budget: clientData.budget || 0,
      status: clientData.status || 'active',
      assignedSeller: user.role === 'seller' ? user.userId : (clientData.assignedSeller || ''),
      notes: clientData.notes || '',
      tags: clientData.tags || [],
      createdAt: timestamp,
      updatedAt: timestamp,
      createdBy: user.userId
    };
    
    await dynamodb.put({
      TableName: TABLE_NAME,
      Item: client
    }).promise();
    
    // Log activity
    await dynamodb.put({
      TableName: TABLE_NAME,
      Item: {
        pk: `AUDIT#${Date.now()}`,
        sk: 'AUDIT',
        entityType: 'client',
        entityId: clientId,
        action: 'create',
        userId: user.userId,
        timestamp,
        details: {
          clientName: client.name,
          company: client.company
        }
      }
    }).promise();
    
    return {
      statusCode: 201,
      body: JSON.stringify(client),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };
  } catch (error) {
    console.error('Error creating client:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to create client' }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };
  }
}

async function updateClient(event, user) {
  const clientId = event.pathParameters?.clientId;
  
  if (!clientId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Client ID is required' }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };
  }
  
  try {
    const updates = JSON.parse(event.body);
    const timestamp = new Date().toISOString();
    
    // Get existing client
    const existingResult = await dynamodb.get({
      TableName: TABLE_NAME,
      Key: {
        pk: `CLIENT#${clientId}`,
        sk: 'CLIENT'
      }
    }).promise();
    
    if (!existingResult.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Client not found' }),
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      };
    }
    
    const existingClient = existingResult.Item;
    
    // Check permissions
    if (user.role === 'seller') {
      // Seller can only update their assigned clients
      if (existingClient.assignedSeller !== user.userId) {
        return {
          statusCode: 403,
          body: JSON.stringify({ error: 'You are not assigned to this client' }),
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        };
      }
    } else if (user.role === 'client') {
      // Clients can only update certain fields
      const allowedUpdates = ['phone', 'address', 'website'];
      const updateKeys = Object.keys(updates);
      if (!updateKeys.every(key => allowedUpdates.includes(key))) {
        return {
          statusCode: 403,
          body: JSON.stringify({ error: 'You can only update contact information' }),
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        };
      }
    } else if (user.role !== 'admin') {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Permission denied' }),
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      };
    }
    
    // Build update expression
    const updateExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};
    
    Object.keys(updates).forEach(key => {
      if (key !== 'pk' && key !== 'sk' && key !== 'clientId') {
        updateExpressions.push(`#${key} = :${key}`);
        expressionAttributeNames[`#${key}`] = key;
        expressionAttributeValues[`:${key}`] = updates[key];
      }
    });
    
    updateExpressions.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = timestamp;
    
    await dynamodb.update({
      TableName: TABLE_NAME,
      Key: {
        pk: `CLIENT#${clientId}`,
        sk: 'CLIENT'
      },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues
    }).promise();
    
    // Log activity
    await dynamodb.put({
      TableName: TABLE_NAME,
      Item: {
        pk: `AUDIT#${Date.now()}`,
        sk: 'AUDIT',
        entityType: 'client',
        entityId: clientId,
        action: 'update',
        userId: user.userId,
        timestamp,
        details: {
          updates: Object.keys(updates)
        }
      }
    }).promise();
    
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: 'Client updated successfully',
        clientId 
      }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };
  } catch (error) {
    console.error('Error updating client:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to update client' }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };
  }
}

async function deleteClient(event, user) {
  const clientId = event.pathParameters?.clientId;
  
  if (!clientId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Client ID is required' }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };
  }
  
  try {
    // Only admin can delete clients
    if (user.role !== 'admin') {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Only administrators can delete clients' }),
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      };
    }
    
    await dynamodb.delete({
      TableName: TABLE_NAME,
      Key: {
        pk: `CLIENT#${clientId}`,
        sk: 'CLIENT'
      }
    }).promise();
    
    // Log activity
    await dynamodb.put({
      TableName: TABLE_NAME,
      Item: {
        pk: `AUDIT#${Date.now()}`,
        sk: 'AUDIT',
        entityType: 'client',
        entityId: clientId,
        action: 'delete',
        userId: user.userId,
        timestamp: new Date().toISOString()
      }
    }).promise();
    
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Client deleted successfully' }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };
  } catch (error) {
    console.error('Error deleting client:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to delete client' }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };
  }
}

// Client campaigns endpoint
async function getClientCampaigns(event, user) {
  const clientId = event.pathParameters?.clientId;
  
  if (!clientId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Client ID is required' }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };
  }
  
  try {
    // Check permissions
    if (user.role === 'client' && clientId !== user.userId) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Access denied' }),
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      };
    }
    
    // Get all campaigns
    const params = {
      TableName: TABLE_NAME,
      IndexName: 'sk-data-index',
      KeyConditionExpression: 'sk = :sk',
      ExpressionAttributeValues: {
        ':sk': 'CAMPAIGN'
      }
    };
    
    const result = await dynamodb.query(params).promise();
    const campaigns = (result.Items || []).filter(campaign => campaign.clientId === clientId);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        campaigns,
        count: campaigns.length
      }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };
  } catch (error) {
    console.error('Error getting client campaigns:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to get client campaigns' }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };
  }
}

// Lambda handler
exports.handler = requireAuth(async (event, context) => {
  const { httpMethod, path } = event;
  const user = event.user;
  
  // Route handling
  if (path === '/clients' && httpMethod === 'GET') {
    return getClients(event, user);
  } else if (path === '/clients' && httpMethod === 'POST') {
    return createClient(event, user);
  } else if (path.match(/^\/clients\/[^\/]+$/) && httpMethod === 'GET') {
    return getClient(event, user);
  } else if (path.match(/^\/clients\/[^\/]+$/) && httpMethod === 'PUT') {
    return updateClient(event, user);
  } else if (path.match(/^\/clients\/[^\/]+$/) && httpMethod === 'DELETE') {
    return deleteClient(event, user);
  } else if (path.match(/^\/clients\/[^\/]+\/campaigns$/) && httpMethod === 'GET') {
    return getClientCampaigns(event, user);
  }
  
  return {
    statusCode: 404,
    body: JSON.stringify({ error: 'Not found' }),
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  };
}, {
  permissions: ['clients.view', 'clients.create', 'clients.edit', 'clients.delete']
});