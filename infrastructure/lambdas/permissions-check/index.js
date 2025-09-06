const AWS = require('aws-sdk');
const { requireAuth, ROLE_PERMISSIONS, hasPermission } = require('../shared/authMiddleware');

const cognito = new AWS.CognitoIdentityServiceProvider();
const USER_POOL_ID = process.env.USER_POOL_ID;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET,OPTIONS'
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
    const { httpMethod, pathParameters, queryStringParameters } = event;
    const user = event.user; // Added by auth middleware

    if (httpMethod === 'GET') {
      if (pathParameters?.userId) {
        // Check permissions for a specific user
        const targetUserId = pathParameters.userId;
        
        // Only allow users to check their own permissions or admins
        if (targetUserId !== user.userId && !hasPermission(user, 'users.view')) {
          return {
            statusCode: 403,
            headers: CORS_HEADERS,
            body: JSON.stringify({ message: 'Forbidden: Cannot view other users permissions' })
          };
        }

        return await getUserPermissions(targetUserId, queryStringParameters);
      } else {
        // Return current user's permissions
        return await getCurrentUserPermissions(user, queryStringParameters);
      }
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

async function getUserPermissions(userId, query) {
  try {
    // Get user from Cognito
    const cognitoParams = {
      UserPoolId: USER_POOL_ID,
      Username: userId
    };

    const userData = await cognito.adminGetUser(cognitoParams).promise();
    
    // Extract role from attributes
    const roleAttribute = userData.UserAttributes.find(attr => attr.Name === 'custom:role');
    const role = roleAttribute?.Value || 'client';
    
    // Get permissions for role
    const permissions = ROLE_PERMISSIONS[role] || [];
    
    // Check specific permission if requested
    if (query?.permission) {
      const hasRequestedPermission = permissions.includes(query.permission);
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          userId,
          role,
          permission: query.permission,
          hasPermission: hasRequestedPermission
        })
      };
    }

    // Return all permissions
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        userId,
        role,
        permissions,
        permissionCount: permissions.length
      })
    };
  } catch (error) {
    console.error('Error getting user permissions:', error);
    
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

async function getCurrentUserPermissions(user, query) {
  const { userId, role } = user;
  const permissions = ROLE_PERMISSIONS[role] || [];

  // Check specific permission if requested
  if (query?.permission) {
    const hasRequestedPermission = permissions.includes(query.permission);
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        userId,
        role,
        permission: query.permission,
        hasPermission: hasRequestedPermission
      })
    };
  }

  // Return all permissions with categorization
  const categorizedPermissions = categorizePermissions(permissions);

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      userId,
      role,
      permissions,
      permissionCount: permissions.length,
      categorized: categorizedPermissions
    })
  };
}

function categorizePermissions(permissions) {
  const categories = {};
  
  permissions.forEach(permission => {
    const [category, ...actions] = permission.split('.');
    if (!categories[category]) {
      categories[category] = [];
    }
    categories[category].push(actions.join('.'));
  });

  return categories;
}

// Export handler with auth middleware (no specific permissions required for checking own permissions)
exports.handler = requireAuth(mainHandler);