const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();
const cognito = new AWS.CognitoIdentityServiceProvider();
const { getCORSHeaders } = require('../shared/cors');

const TABLE_NAME = process.env.TABLE_NAME || 'PodcastFlowPro';
const USER_POOL_ID = process.env.USER_POOL_ID;
// CORS headers will be dynamically generated based on the request origin

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  // Get CORS headers based on request origin
  const CORS_HEADERS = getCORSHeaders(event.headers?.origin || event.headers?.Origin);

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: ''
    };
  }

  try {
    const { httpMethod, pathParameters, body, path } = event;
    const userId = pathParameters?.userId || pathParameters?.id;

    switch (httpMethod) {
      case 'GET':
        if (userId) {
          return await getUser(userId);
        }
        return await listUsers(event.queryStringParameters);

      case 'POST':
        if (path.includes('/invite')) {
          return await inviteUser(JSON.parse(body));
        }
        return await createUser(JSON.parse(body));

      case 'PUT':
        if (userId) {
          if (path.includes('/role')) {
            return await updateUserRole(userId, JSON.parse(body));
          }
          if (path.includes('/status')) {
            return await updateUserStatus(userId, JSON.parse(body));
          }
          return await updateUser(userId, JSON.parse(body));
        }
        break;

      case 'DELETE':
        if (userId) {
          return await deleteUser(userId);
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

async function listUsers(queryParams) {
  const { role, status, organizationId, search } = queryParams || {};
  
  let params = {
    TableName: TABLE_NAME,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: {
      ':pk': 'USER'
    }
  };

  // Add filters if provided
  let filterExpressions = [];
  
  if (role) {
    filterExpressions.push('#role = :role');
    params.ExpressionAttributeNames = { ...params.ExpressionAttributeNames, '#role': 'role' };
    params.ExpressionAttributeValues[':role'] = role;
  }
  
  if (status) {
    filterExpressions.push('#status = :status');
    params.ExpressionAttributeNames = { ...params.ExpressionAttributeNames, '#status': 'status' };
    params.ExpressionAttributeValues[':status'] = status;
  }
  
  if (organizationId) {
    filterExpressions.push('organizationId = :orgId');
    params.ExpressionAttributeValues[':orgId'] = organizationId;
  }
  
  if (filterExpressions.length > 0) {
    params.FilterExpression = filterExpressions.join(' AND ');
  }

  const result = await dynamodb.query(params).promise();
  
  // Apply search filter if provided
  let users = result.Items;
  if (search) {
    const searchLower = search.toLowerCase();
    users = users.filter(user => 
      user.name?.toLowerCase().includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower)
    );
  }
  
  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(users)
  };
}

async function getUser(userId) {
  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: `USER#${userId}`,
      SK: `USER#${userId}`
    }
  };

  const result = await dynamodb.get(params).promise();
  
  if (!result.Item) {
    // Try to get from Cognito if not in DynamoDB
    try {
      const cognitoUser = await getCognitoUser(userId);
      if (cognitoUser) {
        // Create user record in DynamoDB
        const user = await createUserRecord({
          id: userId,
          email: cognitoUser.UserAttributes.find(attr => attr.Name === 'email')?.Value,
          name: cognitoUser.UserAttributes.find(attr => attr.Name === 'name')?.Value,
          role: 'client', // Default role
          status: cognitoUser.UserStatus === 'CONFIRMED' ? 'active' : 'inactive'
        });
        return {
          statusCode: 200,
          headers: CORS_HEADERS,
          body: JSON.stringify(user)
        };
      }
    } catch (error) {
      console.error('Error fetching from Cognito:', error);
    }
    
    return {
      statusCode: 404,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: 'User not found' })
    };
  }

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(result.Item)
  };
}

async function createUser(userData) {
  const timestamp = new Date().toISOString();
  
  // Create user in Cognito first
  let cognitoUserId;
  try {
    const cognitoParams = {
      UserPoolId: USER_POOL_ID,
      Username: userData.email,
      UserAttributes: [
        { Name: 'email', Value: userData.email },
        { Name: 'name', Value: userData.name },
        { Name: 'email_verified', Value: 'true' }
      ],
      TemporaryPassword: userData.temporaryPassword || generateTemporaryPassword(),
      MessageAction: userData.sendInvite === false ? 'SUPPRESS' : undefined
    };
    
    const cognitoResult = await cognito.adminCreateUser(cognitoParams).promise();
    cognitoUserId = cognitoResult.User.Username;
  } catch (error) {
    console.error('Error creating Cognito user:', error);
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ 
        message: 'Failed to create user account',
        error: error.message 
      })
    };
  }
  
  // Create user record in DynamoDB
  const user = await createUserRecord({
    ...userData,
    id: cognitoUserId,
    createdAt: timestamp,
    updatedAt: timestamp
  });

  return {
    statusCode: 201,
    headers: CORS_HEADERS,
    body: JSON.stringify(user)
  };
}

async function createUserRecord(userData) {
  const userId = userData.id || `USER-${Date.now()}`;
  const timestamp = userData.createdAt || new Date().toISOString();
  
  const item = {
    PK: `USER#${userId}`,
    SK: `USER#${userId}`,
    GSI1PK: 'USER',
    GSI1SK: userData.email,
    id: userId,
    email: userData.email,
    name: userData.name,
    role: userData.role || 'client',
    organizationId: userData.organizationId || 'default',
    status: userData.status || 'active',
    avatar: userData.avatar,
    phone: userData.phone,
    metadata: userData.metadata || {},
    createdAt: timestamp,
    updatedAt: userData.updatedAt || timestamp
  };

  await dynamodb.put({
    TableName: TABLE_NAME,
    Item: item
  }).promise();
  
  return item;
}

async function updateUser(userId, updateData) {
  const timestamp = new Date().toISOString();
  
  // Build update expression
  let updateExpression = 'SET updatedAt = :updatedAt';
  let expressionAttributeNames = {};
  let expressionAttributeValues = {
    ':updatedAt': timestamp
  };
  
  const allowedFields = ['name', 'email', 'phone', 'avatar', 'metadata'];
  
  allowedFields.forEach(field => {
    if (updateData[field] !== undefined) {
      updateExpression += `, #${field} = :${field}`;
      expressionAttributeNames[`#${field}`] = field;
      expressionAttributeValues[`:${field}`] = updateData[field];
    }
  });
  
  // Update Cognito attributes if email or name changed
  if (updateData.email || updateData.name) {
    try {
      const attributes = [];
      if (updateData.email) attributes.push({ Name: 'email', Value: updateData.email });
      if (updateData.name) attributes.push({ Name: 'name', Value: updateData.name });
      
      await cognito.adminUpdateUserAttributes({
        UserPoolId: USER_POOL_ID,
        Username: userId,
        UserAttributes: attributes
      }).promise();
    } catch (error) {
      console.error('Error updating Cognito attributes:', error);
    }
  }
  
  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: `USER#${userId}`,
      SK: `USER#${userId}`
    },
    UpdateExpression: updateExpression,
    ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: 'ALL_NEW'
  };

  const result = await dynamodb.update(params).promise();

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(result.Attributes)
  };
}

async function updateUserRole(userId, data) {
  const timestamp = new Date().toISOString();
  
  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: `USER#${userId}`,
      SK: `USER#${userId}`
    },
    UpdateExpression: 'SET #role = :role, updatedAt = :updatedAt',
    ExpressionAttributeNames: {
      '#role': 'role'
    },
    ExpressionAttributeValues: {
      ':role': data.role,
      ':updatedAt': timestamp
    },
    ReturnValues: 'ALL_NEW'
  };

  const result = await dynamodb.update(params).promise();
  
  // Log role change for audit trail
  await createAuditLog({
    action: 'USER_ROLE_CHANGED',
    userId: userId,
    performedBy: data.performedBy,
    details: {
      oldRole: result.Attributes.role,
      newRole: data.role
    },
    timestamp: timestamp
  });

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(result.Attributes)
  };
}

async function updateUserStatus(userId, data) {
  const timestamp = new Date().toISOString();
  
  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: `USER#${userId}`,
      SK: `USER#${userId}`
    },
    UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
    ExpressionAttributeNames: {
      '#status': 'status'
    },
    ExpressionAttributeValues: {
      ':status': data.status,
      ':updatedAt': timestamp
    },
    ReturnValues: 'ALL_NEW'
  };

  const result = await dynamodb.update(params).promise();
  
  // Enable/disable Cognito user based on status
  try {
    if (data.status === 'suspended' || data.status === 'inactive') {
      await cognito.adminDisableUser({
        UserPoolId: USER_POOL_ID,
        Username: userId
      }).promise();
    } else if (data.status === 'active') {
      await cognito.adminEnableUser({
        UserPoolId: USER_POOL_ID,
        Username: userId
      }).promise();
    }
  } catch (error) {
    console.error('Error updating Cognito user status:', error);
  }

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(result.Attributes)
  };
}

async function deleteUser(userId) {
  // Delete from DynamoDB
  await dynamodb.delete({
    TableName: TABLE_NAME,
    Key: {
      PK: `USER#${userId}`,
      SK: `USER#${userId}`
    }
  }).promise();
  
  // Delete from Cognito
  try {
    await cognito.adminDeleteUser({
      UserPoolId: USER_POOL_ID,
      Username: userId
    }).promise();
  } catch (error) {
    console.error('Error deleting Cognito user:', error);
  }

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({ message: 'User deleted successfully' })
  };
}

async function inviteUser(data) {
  const temporaryPassword = generateTemporaryPassword();
  
  const userData = {
    ...data,
    temporaryPassword,
    sendInvite: true
  };
  
  return await createUser(userData);
}

// Helper functions
async function getCognitoUser(userId) {
  try {
    const result = await cognito.adminGetUser({
      UserPoolId: USER_POOL_ID,
      Username: userId
    }).promise();
    return result;
  } catch (error) {
    return null;
  }
}

function generateTemporaryPassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

async function createAuditLog(logData) {
  const item = {
    PK: `AUDIT#${logData.timestamp}`,
    SK: `USER#${logData.userId}`,
    GSI1PK: 'AUDIT_LOG',
    GSI1SK: logData.timestamp,
    ...logData
  };
  
  await dynamodb.put({
    TableName: TABLE_NAME,
    Item: item
  }).promise();
}