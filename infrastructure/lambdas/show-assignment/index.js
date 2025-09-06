const AWS = require('aws-sdk');
const { requireAuth, hasPermission } = require('../shared/authMiddleware');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const cognito = new AWS.CognitoIdentityServiceProvider();

const TABLE_NAME = process.env.TABLE_NAME || 'PodcastFlowPro';
const USER_POOL_ID = process.env.USER_POOL_ID;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS'
};

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
    const { httpMethod, pathParameters, body, queryStringParameters } = event;
    const user = event.user; // Added by auth middleware

    switch (httpMethod) {
      case 'POST':
        if (pathParameters?.showId) {
          return await assignToShow(pathParameters.showId, JSON.parse(body), user);
        }
        break;

      case 'GET':
        if (pathParameters?.showId) {
          return await getShowAssignments(pathParameters.showId, user);
        } else if (queryStringParameters?.userId) {
          return await getUserAssignments(queryStringParameters.userId, user);
        }
        break;

      case 'DELETE':
        if (pathParameters?.showId && pathParameters?.userId) {
          return await removeFromShow(pathParameters.showId, pathParameters.userId, user);
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

async function assignToShow(showId, data, user) {
  // Check permissions
  if (!hasPermission(user, 'shows.manage.assignments')) {
    return {
      statusCode: 403,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: 'Forbidden: Insufficient permissions' })
    };
  }

  const { userId, role } = data;
  const timestamp = new Date().toISOString();

  // Validate role
  if (!['producer', 'talent'].includes(role)) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: 'Invalid role. Must be producer or talent.' })
    };
  }

  try {
    // Verify user exists and has the correct role
    const userInfo = await getUserInfo(userId);
    if (!userInfo) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: 'User not found' })
      };
    }

    if (userInfo.role !== role) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ 
          message: `User does not have ${role} role. Current role: ${userInfo.role}` 
        })
      };
    }

    // Create assignment
    const assignment = {
      PK: `SHOW#${showId}`,
      SK: `ASSIGNMENT#${role.toUpperCase()}#${userId}`,
      GSI1PK: `USER#${userId}`,
      GSI1SK: `SHOW#${showId}`,
      GSI2PK: 'SHOW_ASSIGNMENT',
      GSI2SK: timestamp,
      showId,
      userId,
      userName: userInfo.name || userInfo.email,
      userEmail: userInfo.email,
      role,
      assignedAt: timestamp,
      assignedBy: user.userId,
      active: true
    };

    await dynamodb.put({
      TableName: TABLE_NAME,
      Item: assignment
    }).promise();

    // Update show with assigned users
    await updateShowAssignments(showId, userId, role, 'add');

    return {
      statusCode: 201,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        message: 'User assigned to show successfully',
        assignment
      })
    };
  } catch (error) {
    console.error('Error assigning to show:', error);
    throw error;
  }
}

async function removeFromShow(showId, userId, user) {
  // Check permissions
  if (!hasPermission(user, 'shows.manage.assignments')) {
    return {
      statusCode: 403,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: 'Forbidden: Insufficient permissions' })
    };
  }

  try {
    // Find the assignment
    const assignments = await dynamodb.query({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `SHOW#${showId}`,
        ':sk': 'ASSIGNMENT#'
      },
      FilterExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':pk': `SHOW#${showId}`,
        ':sk': 'ASSIGNMENT#',
        ':userId': userId
      }
    }).promise();

    if (assignments.Items.length === 0) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: 'Assignment not found' })
      };
    }

    // Mark as inactive instead of deleting
    const assignment = assignments.Items[0];
    const updateParams = {
      TableName: TABLE_NAME,
      Key: {
        PK: assignment.PK,
        SK: assignment.SK
      },
      UpdateExpression: 'SET active = :active, removedAt = :removedAt, removedBy = :removedBy',
      ExpressionAttributeValues: {
        ':active': false,
        ':removedAt': new Date().toISOString(),
        ':removedBy': user.userId
      }
    };

    await dynamodb.update(updateParams).promise();

    // Update show assignments
    await updateShowAssignments(showId, userId, assignment.role, 'remove');

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        message: 'User removed from show successfully'
      })
    };
  } catch (error) {
    console.error('Error removing from show:', error);
    throw error;
  }
}

async function getShowAssignments(showId, user) {
  try {
    // Query all assignments for the show
    const params = {
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `SHOW#${showId}`,
        ':sk': 'ASSIGNMENT#'
      },
      FilterExpression: 'active = :active',
      ExpressionAttributeValues: {
        ':pk': `SHOW#${showId}`,
        ':sk': 'ASSIGNMENT#',
        ':active': true
      }
    };

    const result = await dynamodb.query(params).promise();

    // Group by role
    const assignments = {
      producers: [],
      talent: []
    };

    result.Items.forEach(item => {
      if (item.role === 'producer') {
        assignments.producers.push(item);
      } else if (item.role === 'talent') {
        assignments.talent.push(item);
      }
    });

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        showId,
        assignments,
        totalAssignments: result.Items.length
      })
    };
  } catch (error) {
    console.error('Error getting show assignments:', error);
    throw error;
  }
}

async function getUserAssignments(userId, user) {
  // Check if user can view assignments
  if (userId !== user.userId && !hasPermission(user, 'shows.view.all')) {
    return {
      statusCode: 403,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: 'Forbidden: Cannot view other users assignments' })
    };
  }

  try {
    const params = {
      TableName: TABLE_NAME,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':sk': 'SHOW#'
      },
      FilterExpression: 'active = :active',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':sk': 'SHOW#',
        ':active': true
      }
    };

    const result = await dynamodb.query(params).promise();

    // Get show details for each assignment
    const showsWithDetails = await Promise.all(
      result.Items.map(async (assignment) => {
        const showDetails = await getShowDetails(assignment.showId);
        return {
          ...assignment,
          showDetails
        };
      })
    );

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        userId,
        assignments: showsWithDetails,
        totalAssignments: result.Items.length
      })
    };
  } catch (error) {
    console.error('Error getting user assignments:', error);
    throw error;
  }
}

// Helper functions
async function getUserInfo(userId) {
  try {
    const cognitoParams = {
      UserPoolId: USER_POOL_ID,
      Username: userId
    };

    const userData = await cognito.adminGetUser(cognitoParams).promise();
    
    const roleAttribute = userData.UserAttributes.find(attr => attr.Name === 'custom:role');
    const emailAttribute = userData.UserAttributes.find(attr => attr.Name === 'email');
    const nameAttribute = userData.UserAttributes.find(attr => attr.Name === 'name');

    return {
      userId,
      email: emailAttribute?.Value,
      name: nameAttribute?.Value,
      role: roleAttribute?.Value || 'client'
    };
  } catch (error) {
    console.error('Error getting user info:', error);
    return null;
  }
}

async function getShowDetails(showId) {
  try {
    const params = {
      TableName: TABLE_NAME,
      Key: {
        PK: `SHOW#${showId}`,
        SK: `SHOW#${showId}`
      }
    };

    const result = await dynamodb.get(params).promise();
    return result.Item || null;
  } catch (error) {
    console.error('Error getting show details:', error);
    return null;
  }
}

async function updateShowAssignments(showId, userId, role, action) {
  try {
    const showParams = {
      TableName: TABLE_NAME,
      Key: {
        PK: `SHOW#${showId}`,
        SK: `SHOW#${showId}`
      }
    };

    // Get current show data
    const showData = await dynamodb.get(showParams).promise();
    if (!showData.Item) return;

    const show = showData.Item;
    const arrayField = role === 'producer' ? 'producers' : 'talent';
    let assignedUsers = show[arrayField] || [];

    if (action === 'add') {
      if (!assignedUsers.includes(userId)) {
        assignedUsers.push(userId);
      }
    } else if (action === 'remove') {
      assignedUsers = assignedUsers.filter(id => id !== userId);
    }

    // Update show
    const updateParams = {
      TableName: TABLE_NAME,
      Key: {
        PK: `SHOW#${showId}`,
        SK: `SHOW#${showId}`
      },
      UpdateExpression: `SET ${arrayField} = :users, updatedAt = :updatedAt`,
      ExpressionAttributeValues: {
        ':users': assignedUsers,
        ':updatedAt': new Date().toISOString()
      }
    };

    await dynamodb.update(updateParams).promise();
  } catch (error) {
    console.error('Error updating show assignments:', error);
  }
}

// Export handler with auth middleware
exports.handler = requireAuth(mainHandler);