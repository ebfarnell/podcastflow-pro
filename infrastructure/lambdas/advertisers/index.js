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

    switch (httpMethod) {
      case 'GET':
        if (pathParameters?.id || pathParameters?.advertiserId) {
          return await getAdvertiser(pathParameters.id || pathParameters.advertiserId);
        }
        return await listAdvertisers();

      case 'POST':
        return await createAdvertiser(JSON.parse(body));

      case 'PUT':
        if (pathParameters?.id || pathParameters?.advertiserId) {
          return await updateAdvertiser(pathParameters.id || pathParameters.advertiserId, JSON.parse(body));
        }
        break;

      case 'DELETE':
        if (pathParameters?.id || pathParameters?.advertiserId) {
          return await deleteAdvertiser(pathParameters.id || pathParameters.advertiserId);
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

async function listAdvertisers() {
  const params = {
    TableName: TABLE_NAME,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: {
      ':pk': 'ADVERTISER'
    }
  };

  const result = await dynamodb.query(params).promise();
  
  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(result.Items)
  };
}

async function getAdvertiser(advertiserId) {
  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: `ADVERTISER#${advertiserId}`,
      SK: `ADVERTISER#${advertiserId}`
    }
  };

  const result = await dynamodb.get(params).promise();
  
  if (!result.Item) {
    return {
      statusCode: 404,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: 'Advertiser not found' })
    };
  }

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(result.Item)
  };
}

async function createAdvertiser(advertiserData) {
  const advertiserId = `ADV-${Date.now()}`;
  const timestamp = new Date().toISOString();

  const item = {
    PK: `ADVERTISER#${advertiserId}`,
    SK: `ADVERTISER#${advertiserId}`,
    GSI1PK: 'ADVERTISER',
    GSI1SK: advertiserData.name,
    id: advertiserId,
    ...advertiserData,
    status: 'active',
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

async function updateAdvertiser(advertiserId, updateData) {
  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: `ADVERTISER#${advertiserId}`,
      SK: `ADVERTISER#${advertiserId}`
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

async function deleteAdvertiser(advertiserId) {
  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: `ADVERTISER#${advertiserId}`,
      SK: `ADVERTISER#${advertiserId}`
    }
  };

  await dynamodb.delete(params).promise();

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({ message: 'Advertiser deleted successfully' })
  };
}
