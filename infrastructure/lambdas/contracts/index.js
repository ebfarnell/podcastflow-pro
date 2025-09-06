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
        if (pathParameters?.contractId) {
          return await getContract(pathParameters.contractId);
        }
        return await listContracts();

      case 'POST':
        return await createContract(JSON.parse(body));

      case 'PUT':
        if (pathParameters?.contractId) {
          return await updateContract(pathParameters.contractId, JSON.parse(body));
        }
        break;

      case 'DELETE':
        if (pathParameters?.contractId) {
          return await deleteContract(pathParameters.contractId);
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

async function listContracts() {
  const params = {
    TableName: TABLE_NAME,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: {
      ':pk': 'CONTRACT'
    }
  };

  const result = await dynamodb.query(params).promise();
  
  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(result.Items)
  };
}

async function getContract(contractId) {
  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: `CONTRACT#${contractId}`,
      SK: `CONTRACT#${contractId}`
    }
  };

  const result = await dynamodb.get(params).promise();
  
  if (!result.Item) {
    return {
      statusCode: 404,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: 'Contract not found' })
    };
  }

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(result.Item)
  };
}

async function createContract(contractData) {
  const contractId = `CTR-${Date.now()}`;
  const timestamp = new Date().toISOString();

  const item = {
    PK: `CONTRACT#${contractId}`,
    SK: `CONTRACT#${contractId}`,
    GSI1PK: 'CONTRACT',
    GSI1SK: contractData.startDate,
    id: contractId,
    ...contractData,
    status: 'draft',
    progress: 0,
    signedBy: [],
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

async function updateContract(contractId, updateData) {
  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: `CONTRACT#${contractId}`,
      SK: `CONTRACT#${contractId}`
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

async function deleteContract(contractId) {
  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: `CONTRACT#${contractId}`,
      SK: `CONTRACT#${contractId}`
    }
  };

  await dynamodb.delete(params).promise();

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({ message: 'Contract deleted successfully' })
  };
}
