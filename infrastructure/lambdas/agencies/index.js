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
        if (pathParameters?.agencyId) {
          return await getAgency(pathParameters.agencyId);
        }
        return await listAgencies();

      case 'POST':
        return await createAgency(JSON.parse(body));

      case 'PUT':
        if (pathParameters?.agencyId) {
          return await updateAgency(pathParameters.agencyId, JSON.parse(body));
        }
        break;

      case 'DELETE':
        if (pathParameters?.agencyId) {
          return await deleteAgency(pathParameters.agencyId);
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

async function listAgencies() {
  const params = {
    TableName: TABLE_NAME,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: {
      ':pk': 'AGENCY'
    }
  };

  const result = await dynamodb.query(params).promise();
  
  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(result.Items)
  };
}

async function getAgency(agencyId) {
  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: `AGENCY#${agencyId}`,
      SK: `AGENCY#${agencyId}`
    }
  };

  const result = await dynamodb.get(params).promise();
  
  if (!result.Item) {
    return {
      statusCode: 404,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: 'Agency not found' })
    };
  }

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(result.Item)
  };
}

async function createAgency(agencyData) {
  const agencyId = `AGN-${Date.now()}`;
  const timestamp = new Date().toISOString();

  const item = {
    PK: `AGENCY#${agencyId}`,
    SK: `AGENCY#${agencyId}`,
    GSI1PK: 'AGENCY',
    GSI1SK: agencyData.name,
    id: agencyId,
    ...agencyData,
    status: 'pending',
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

async function updateAgency(agencyId, updateData) {
  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: `AGENCY#${agencyId}`,
      SK: `AGENCY#${agencyId}`
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

async function deleteAgency(agencyId) {
  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: `AGENCY#${agencyId}`,
      SK: `AGENCY#${agencyId}`
    }
  };

  await dynamodb.delete(params).promise();

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({ message: 'Agency deleted successfully' })
  };
}
