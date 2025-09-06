const AWS = require('aws-sdk');
const { requireAuth, hasPermission } = require('../shared/authMiddleware');

const cognito = new AWS.CognitoIdentityServiceProvider();
const dynamodb = new AWS.DynamoDB.DocumentClient();

const USER_POOL_ID = process.env.USER_POOL_ID;
const TABLE_NAME = process.env.TABLE_NAME || 'PodcastFlowPro';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS'
};

const VALID_ROLES = ['admin', 'seller', 'producer', 'talent', 'client'];

// Main handler wrapped with auth
const mainHandler = async (event) => {
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
    const user = event.user; // Added by auth middleware

    // Check if user has permission
    if (!hasPermission(user, 'users.manage.roles')) {
      return {
        statusCode: 403,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: 'Forbidden: Insufficient permissions' })
      };
    }

    switch (httpMethod) {
      case 'POST':
        if (pathParameters?.userId) {
          return await assignRole(pathParameters.userId, JSON.parse(body));
        }
        break;

      case 'GET':
        if (pathParameters?.userId) {
          return await getUserRole(pathParameters.userId);
        }
        break;

      case 'PUT':
        if (pathParameters?.userId) {
          return await updateRole(pathParameters.userId, JSON.parse(body));
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

async function assignRole(userId, data) {
  const { role, organizationId } = data;

  // Validate role
  if (!VALID_ROLES.includes(role)) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` })
    };
  }

  try {
    // Update Cognito user attributes
    const cognitoParams = {
      UserPoolId: USER_POOL_ID,
      Username: userId,
      UserAttributes: [
        {
          Name: 'custom:role',
          Value: role
        }
      ]
    };

    if (organizationId) {
      cognitoParams.UserAttributes.push({
        Name: 'custom:organizationId',
        Value: organizationId
      });
    }

    await cognito.adminUpdateUserAttributes(cognitoParams).promise();

    // Store role assignment in DynamoDB for audit trail
    const timestamp = new Date().toISOString();
    const roleAssignment = {
      PK: `USER#${userId}`,
      SK: `ROLE#${timestamp}`,
      GSI1PK: 'ROLE_ASSIGNMENT',
      GSI1SK: timestamp,
      userId,
      role,
      organizationId: organizationId || 'default',
      assignedAt: timestamp,
      assignedBy: data.assignedBy || 'system'
    };

    await dynamodb.put({
      TableName: TABLE_NAME,
      Item: roleAssignment
    }).promise();

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        message: 'Role assigned successfully',
        userId,
        role,
        organizationId: organizationId || 'default'
      })
    };
  } catch (error) {
    console.error('Error assigning role:', error);
    
    if (error.code === 'UserNotFoundException') {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: 'User not found' })
      };
    }

    throw error;
  }
}

async function getUserRole(userId) {
  try {
    // Get user from Cognito
    const cognitoParams = {
      UserPoolId: USER_POOL_ID,
      Username: userId
    };

    const userData = await cognito.adminGetUser(cognitoParams).promise();
    
    // Extract role from attributes
    const roleAttribute = userData.UserAttributes.find(attr => attr.Name === 'custom:role');
    const orgAttribute = userData.UserAttributes.find(attr => attr.Name === 'custom:organizationId');
    
    const role = roleAttribute?.Value || 'client';
    const organizationId = orgAttribute?.Value || 'default';

    // Get role history from DynamoDB
    const historyParams = {
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':sk': 'ROLE#'
      },
      ScanIndexForward: false,
      Limit: 10
    };

    const history = await dynamodb.query(historyParams).promise();

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        userId,
        currentRole: role,
        organizationId,
        roleHistory: history.Items || []
      })
    };
  } catch (error) {
    console.error('Error getting user role:', error);
    
    if (error.code === 'UserNotFoundException') {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: 'User not found' })
      };
    }

    throw error;
  }
}

async function updateRole(userId, data) {
  // Same as assignRole for now
  return await assignRole(userId, data);
}

// Export handler with auth middleware
exports.handler = requireAuth(mainHandler, { permissions: ['users.manage.roles'] });