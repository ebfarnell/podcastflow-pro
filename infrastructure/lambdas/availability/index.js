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
    const { httpMethod, pathParameters, body, queryStringParameters } = event;

    switch (httpMethod) {
      case 'GET':
        if (pathParameters?.slotId) {
          return await getSlot(pathParameters.slotId);
        }
        return await listAvailableSlots(queryStringParameters);

      case 'POST':
        if (event.path.includes('/reserve')) {
          return await reserveSlot(JSON.parse(body));
        }
        return await createSlot(JSON.parse(body));

      case 'PUT':
        if (pathParameters?.slotId) {
          return await updateSlot(pathParameters.slotId, JSON.parse(body));
        }
        break;

      case 'DELETE':
        if (pathParameters?.slotId) {
          return await deleteSlot(pathParameters.slotId);
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

async function listAvailableSlots(queryParams) {
  const status = queryParams?.status || 'available';
  
  const params = {
    TableName: TABLE_NAME,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk',
    FilterExpression: '#status = :status',
    ExpressionAttributeNames: {
      '#status': 'status'
    },
    ExpressionAttributeValues: {
      ':pk': 'AD_SLOT',
      ':status': status
    }
  };

  const result = await dynamodb.query(params).promise();
  
  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(result.Items)
  };
}

async function getSlot(slotId) {
  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: `SLOT#${slotId}`,
      SK: `SLOT#${slotId}`
    }
  };

  const result = await dynamodb.get(params).promise();
  
  if (!result.Item) {
    return {
      statusCode: 404,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: 'Slot not found' })
    };
  }

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(result.Item)
  };
}

async function createSlot(slotData) {
  const slotId = `SLOT-${Date.now()}`;
  const timestamp = new Date().toISOString();

  const item = {
    PK: `SLOT#${slotId}`,
    SK: `SLOT#${slotId}`,
    GSI1PK: 'AD_SLOT',
    GSI1SK: `${slotData.publishDate}#${slotId}`,
    id: slotId,
    ...slotData,
    status: 'available',
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

async function reserveSlot(reservationData) {
  const { slotId, advertiserId, campaignId } = reservationData;
  
  // Update slot status to reserved
  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: `SLOT#${slotId}`,
      SK: `SLOT#${slotId}`
    },
    UpdateExpression: 'SET #status = :status, advertiserId = :advertiserId, campaignId = :campaignId, reservedAt = :timestamp',
    ExpressionAttributeNames: {
      '#status': 'status'
    },
    ExpressionAttributeValues: {
      ':status': 'reserved',
      ':advertiserId': advertiserId,
      ':campaignId': campaignId,
      ':timestamp': new Date().toISOString()
    },
    ConditionExpression: '#status = :available',
    ReturnValues: 'ALL_NEW'
  };

  try {
    const result = await dynamodb.update(params).promise();
    
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify(result.Attributes)
    };
  } catch (error) {
    if (error.code === 'ConditionalCheckFailedException') {
      return {
        statusCode: 409,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: 'Slot is no longer available' })
      };
    }
    throw error;
  }
}

async function updateSlot(slotId, updateData) {
  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: `SLOT#${slotId}`,
      SK: `SLOT#${slotId}`
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

async function deleteSlot(slotId) {
  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: `SLOT#${slotId}`,
      SK: `SLOT#${slotId}`
    }
  };

  await dynamodb.delete(params).promise();

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({ message: 'Slot deleted successfully' })
  };
}
