const AWS = require('aws-sdk');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const cognito = new AWS.CognitoIdentityServiceProvider();

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'podcastflow-pro';
const USER_POOL_ID = process.env.USER_POOL_ID;

exports.handler = async (event) => {
  const { httpMethod, path, body, headers } = event;
  
  try {
    switch (path) {
      case '/auth/profile':
        if (httpMethod === 'GET') {
          return await getProfile(headers);
        } else if (httpMethod === 'PUT') {
          return await updateProfile(headers, JSON.parse(body));
        }
        break;
      
      case '/auth/organization':
        if (httpMethod === 'POST') {
          return await createOrganization(headers, JSON.parse(body));
        } else if (httpMethod === 'PUT') {
          return await updateOrganization(headers, JSON.parse(body));
        }
        break;
      
      default:
        return {
          statusCode: 404,
          body: JSON.stringify({ error: 'Not found' }),
        };
    }
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

async function getProfile(headers) {
  const userId = await verifyToken(headers.Authorization);
  
  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: `USER#${userId}`,
      SK: 'PROFILE',
    },
  };
  
  const result = await dynamodb.get(params).promise();
  
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(result.Item || {}),
  };
}

async function updateProfile(headers, data) {
  const userId = await verifyToken(headers.Authorization);
  
  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: `USER#${userId}`,
      SK: 'PROFILE',
    },
    UpdateExpression: 'SET #name = :name, #phone = :phone, #timezone = :timezone, updatedAt = :updatedAt',
    ExpressionAttributeNames: {
      '#name': 'name',
      '#phone': 'phone',
      '#timezone': 'timezone',
    },
    ExpressionAttributeValues: {
      ':name': data.name,
      ':phone': data.phone,
      ':timezone': data.timezone,
      ':updatedAt': new Date().toISOString(),
    },
    ReturnValues: 'ALL_NEW',
  };
  
  const result = await dynamodb.update(params).promise();
  
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(result.Attributes),
  };
}

async function createOrganization(headers, data) {
  const userId = await verifyToken(headers.Authorization);
  const orgId = `ORG#${Date.now()}`;
  
  const params = {
    TableName: TABLE_NAME,
    Item: {
      PK: orgId,
      SK: 'METADATA',
      type: 'organization',
      name: data.name,
      owner: userId,
      members: [userId],
      plan: 'starter',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };
  
  await dynamodb.put(params).promise();
  
  // Update user profile with organization
  await dynamodb.update({
    TableName: TABLE_NAME,
    Key: {
      PK: `USER#${userId}`,
      SK: 'PROFILE',
    },
    UpdateExpression: 'SET organization = :orgId',
    ExpressionAttributeValues: {
      ':orgId': orgId,
    },
  }).promise();
  
  return {
    statusCode: 201,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({ organizationId: orgId }),
  };
}

async function updateOrganization(headers, data) {
  const userId = await verifyToken(headers.Authorization);
  
  // Get user's organization
  const userProfile = await dynamodb.get({
    TableName: TABLE_NAME,
    Key: {
      PK: `USER#${userId}`,
      SK: 'PROFILE',
    },
  }).promise();
  
  const orgId = userProfile.Item?.organization;
  if (!orgId) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'No organization found' }),
    };
  }
  
  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: orgId,
      SK: 'METADATA',
    },
    UpdateExpression: 'SET #name = :name, #plan = :plan, updatedAt = :updatedAt',
    ExpressionAttributeNames: {
      '#name': 'name',
      '#plan': 'plan',
    },
    ExpressionAttributeValues: {
      ':name': data.name,
      ':plan': data.plan,
      ':updatedAt': new Date().toISOString(),
    },
    ReturnValues: 'ALL_NEW',
  };
  
  const result = await dynamodb.update(params).promise();
  
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(result.Attributes),
  };
}

async function verifyToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Invalid authorization header');
  }
  
  const token = authHeader.substring(7);
  
  // For Cognito JWT tokens, you would verify with Cognito
  // This is a simplified example
  try {
    const decoded = jwt.decode(token);
    return decoded.sub; // Cognito user ID
  } catch (error) {
    throw new Error('Invalid token');
  }
}