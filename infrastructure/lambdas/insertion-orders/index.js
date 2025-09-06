const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

const TABLE_NAME = process.env.TABLE_NAME || 'PodcastFlowPro';
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
};

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: ''
    };
  }

  try {
    const { httpMethod, pathParameters, body } = event;
    const path = event.path;

    switch (httpMethod) {
      case 'GET':
        if (pathParameters?.orderId) {
          return await getOrder(pathParameters.orderId);
        }
        return await listOrders();

      case 'POST':
        return await createOrder(JSON.parse(body));

      case 'PUT':
        if (pathParameters?.orderId) {
          return await updateOrder(pathParameters.orderId, JSON.parse(body));
        }
        break;

      case 'DELETE':
        if (pathParameters?.orderId) {
          return await deleteOrder(pathParameters.orderId);
        }
        break;
    }

    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: 'Invalid request' })
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: 'Internal server error', error: error.message })
    };
  }
};

async function listOrders() {
  const params = {
    TableName: TABLE_NAME,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: {
      ':pk': 'INSERTION_ORDER'
    }
  };

  const result = await dynamodb.query(params).promise();
  
  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(result.Items)
  };
}

async function getOrder(orderId) {
  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: `ORDER#${orderId}`,
      SK: `ORDER#${orderId}`
    }
  };

  const result = await dynamodb.get(params).promise();
  
  if (!result.Item) {
    return {
      statusCode: 404,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: 'Order not found' })
    };
  }

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(result.Item)
  };
}

async function createOrder(orderData) {
  const orderId = `IO-${Date.now()}`;
  const timestamp = new Date().toISOString();

  const item = {
    PK: `ORDER#${orderId}`,
    SK: `ORDER#${orderId}`,
    GSI1PK: 'INSERTION_ORDER',
    GSI1SK: timestamp,
    id: orderId,
    ...orderData,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  const params = {
    TableName: TABLE_NAME,
    Item: item
  };

  await dynamodb.put(params).promise();

  return {
    statusCode: 201,
    headers: CORS_HEADERS,
    body: JSON.stringify(item)
  };
}

async function updateOrder(orderId, updateData) {
  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: `ORDER#${orderId}`,
      SK: `ORDER#${orderId}`
    },
    UpdateExpression: 'SET #data = :data, updatedAt = :updatedAt',
    ExpressionAttributeNames: {
      '#data': 'data'
    },
    ExpressionAttributeValues: {
      ':data': updateData,
      ':updatedAt': new Date().toISOString()
    },
    ReturnValues: 'ALL_NEW'
  };

  const result = await dynamodb.update(params).promise();

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(result.Attributes)
  };
}

async function deleteOrder(orderId) {
  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: `ORDER#${orderId}`,
      SK: `ORDER#${orderId}`
    }
  };

  await dynamodb.delete(params).promise();

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({ message: 'Order deleted successfully' })
  };
}
