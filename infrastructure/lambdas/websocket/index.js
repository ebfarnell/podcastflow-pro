const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, DeleteCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require('@aws-sdk/client-apigatewaymanagementapi');

// Initialize clients
const ddbClient = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(ddbClient);

const apigatewaymanagementapi = new ApiGatewayManagementApiClient({ 
  endpoint: process.env.WEBSOCKET_ENDPOINT || 'https://pmmgmoce5d.execute-api.us-east-1.amazonaws.com/prod'
});

const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE_NAME || 'WebSocketConnections';
const SUBSCRIPTIONS_TABLE = process.env.SUBSCRIPTIONS_TABLE_NAME || 'WebSocketSubscriptions';

exports.handler = async (event) => {
  console.log('WebSocket Event:', JSON.stringify(event, null, 2));

  const { routeKey, connectionId, requestContext } = event;
  
  try {
    switch (routeKey) {
      case '$connect':
        return await handleConnect(connectionId, requestContext);
      case '$disconnect':
        return await handleDisconnect(connectionId);
      case 'subscribe':
        return await handleSubscribe(connectionId, JSON.parse(event.body));
      case 'unsubscribe':
        return await handleUnsubscribe(connectionId, JSON.parse(event.body));
      case 'broadcast':
        return await handleBroadcast(JSON.parse(event.body));
      default:
        return {
          statusCode: 400,
          body: JSON.stringify({ message: 'Invalid route' })
        };
    }
  } catch (error) {
    console.error('WebSocket handler error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal server error' })
    };
  }
};

async function handleConnect(connectionId, requestContext) {
  const userId = requestContext.authorizer?.userId || 'anonymous';
  const userRole = requestContext.authorizer?.userRole || 'anonymous';
  
  const command = new PutCommand({
    TableName: CONNECTIONS_TABLE,
    Item: {
      connectionId,
      userId,
      userRole,
      connectedAt: new Date().toISOString(),
      ttl: Math.floor(Date.now() / 1000) + 86400 // 24 hours
    }
  });
  
  await dynamodb.send(command);
  
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Connected' })
  };
}

async function handleDisconnect(connectionId) {
  // Remove connection
  const deleteConnectionCommand = new DeleteCommand({
    TableName: CONNECTIONS_TABLE,
    Key: { connectionId }
  });
  await dynamodb.send(deleteConnectionCommand);
  
  // Find all subscriptions for this connection
  const queryCommand = new QueryCommand({
    TableName: SUBSCRIPTIONS_TABLE,
    IndexName: 'connectionId-index',
    KeyConditionExpression: 'connectionId = :connectionId',
    ExpressionAttributeValues: {
      ':connectionId': connectionId
    }
  });
  
  const subscriptions = await dynamodb.send(queryCommand);
  
  // Delete each subscription
  for (const sub of subscriptions.Items || []) {
    const deleteSubCommand = new DeleteCommand({
      TableName: SUBSCRIPTIONS_TABLE,
      Key: {
        subscriptionKey: sub.subscriptionKey,
        connectionId: sub.connectionId
      }
    });
    await dynamodb.send(deleteSubCommand);
  }
  
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Disconnected' })
  };
}

async function handleSubscribe(connectionId, data) {
  const { channel, entityType, entityId } = data;
  
  if (!channel || !entityType) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Missing required fields: channel, entityType' })
    };
  }
  
  // Create subscription key
  const subscriptionKey = entityId 
    ? `${channel}:${entityType}:${entityId}`
    : `${channel}:${entityType}`;
  
  const command = new PutCommand({
    TableName: SUBSCRIPTIONS_TABLE,
    Item: {
      subscriptionKey,
      connectionId,
      channel,
      entityType,
      entityId,
      subscribedAt: new Date().toISOString(),
      ttl: Math.floor(Date.now() / 1000) + 86400 // 24 hours
    }
  });
  
  await dynamodb.send(command);
  
  // Send confirmation
  await sendToConnection(connectionId, {
    action: 'subscribed',
    channel,
    entityType,
    entityId
  });
  
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Subscribed' })
  };
}

async function handleUnsubscribe(connectionId, data) {
  const { channel, entityType, entityId } = data;
  
  const subscriptionKey = entityId 
    ? `${channel}:${entityType}:${entityId}`
    : `${channel}:${entityType}`;
  
  const command = new DeleteCommand({
    TableName: SUBSCRIPTIONS_TABLE,
    Key: {
      subscriptionKey,
      connectionId
    }
  });
  
  await dynamodb.send(command);
  
  // Send confirmation
  await sendToConnection(connectionId, {
    action: 'unsubscribed',
    channel,
    entityType,
    entityId
  });
  
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Unsubscribed' })
  };
}

async function handleBroadcast(data) {
  const { channel, entityType, entityId, eventType, payload } = data;
  
  if (!channel || !entityType || !eventType || !payload) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Missing required fields' })
    };
  }
  
  // Find all subscribers
  const subscriptionKey = entityId 
    ? `${channel}:${entityType}:${entityId}`
    : `${channel}:${entityType}`;
  
  const queryCommand = new QueryCommand({
    TableName: SUBSCRIPTIONS_TABLE,
    KeyConditionExpression: 'subscriptionKey = :key',
    ExpressionAttributeValues: {
      ':key': subscriptionKey
    }
  });
  
  const subscribers = await dynamodb.send(queryCommand);
  
  // Also get subscribers to the general entity type channel
  if (entityId) {
    const generalQueryCommand = new QueryCommand({
      TableName: SUBSCRIPTIONS_TABLE,
      KeyConditionExpression: 'subscriptionKey = :key',
      ExpressionAttributeValues: {
        ':key': `${channel}:${entityType}`
      }
    });
    
    const generalSubscribers = await dynamodb.send(generalQueryCommand);
    
    subscribers.Items = [...(subscribers.Items || []), ...(generalSubscribers.Items || [])];
  }
  
  // Send to all subscribers
  const messagePromises = [];
  const uniqueConnections = new Set();
  
  for (const sub of subscribers.Items || []) {
    if (!uniqueConnections.has(sub.connectionId)) {
      uniqueConnections.add(sub.connectionId);
      messagePromises.push(
        sendToConnection(sub.connectionId, {
          action: 'update',
          channel,
          entityType,
          entityId,
          eventType,
          payload,
          timestamp: new Date().toISOString()
        }).catch(err => {
          console.error(`Failed to send to ${sub.connectionId}:`, err);
          // Clean up stale connection
          if (err.statusCode === 410) {
            return handleDisconnect(sub.connectionId);
          }
        })
      );
    }
  }
  
  await Promise.all(messagePromises);
  
  return {
    statusCode: 200,
    body: JSON.stringify({ 
      message: 'Broadcast sent',
      recipients: uniqueConnections.size 
    })
  };
}

async function sendToConnection(connectionId, data) {
  const command = new PostToConnectionCommand({
    ConnectionId: connectionId,
    Data: JSON.stringify(data)
  });
  
  return apigatewaymanagementapi.send(command);
}

// Export individual functions for other Lambdas to use
exports.broadcastUpdate = async (channel, entityType, entityId, eventType, payload) => {
  return handleBroadcast({
    channel,
    entityType,
    entityId,
    eventType,
    payload
  });
};