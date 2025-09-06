const AWS = require('aws-sdk');
const { requireAuth, hasPermission, ROLE_PERMISSIONS } = require('../shared/authMiddleware');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.TABLE_NAME || 'PodcastFlowPro';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS'
};

// Default permission configurations
const DEFAULT_PERMISSIONS = {
  admin: [
    'users.view', 'users.create', 'users.update', 'users.delete', 'users.manage.roles',
    'permissions.manage', 'system.config', 'analytics.view.all', 'shows.manage', 
    'campaigns.manage', 'billing.manage', 'approvals.manage'
  ],
  seller: [
    'campaigns.view', 'campaigns.create', 'campaigns.update', 'campaigns.delete',
    'deals.view', 'deals.create', 'deals.update', 'deals.delete',
    'clients.view.own', 'clients.create', 'clients.update.own',
    'billing.view', 'invoices.create', 'invoices.view.own',
    'approvals.submit', 'analytics.view.campaigns'
  ],
  producer: [
    'shows.view.assigned', 'shows.edit.assigned', 'episodes.manage.assigned',
    'approvals.review', 'approvals.manage', 'analytics.view.shows',
    'talent.assign', 'schedule.manage.shows'
  ],
  talent: [
    'episodes.view.assigned', 'recordings.manage', 'approvals.view.assigned',
    'schedule.view.own', 'analytics.view.own'
  ],
  client: [
    'campaigns.view.own', 'billing.view', 'analytics.view.own', 'approvals.view.own'
  ]
};

// Main handler
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
    const { httpMethod, pathParameters } = event;
    const user = event.user;

    // Check permissions
    if (!hasPermission(user, 'permissions.manage')) {
      return {
        statusCode: 403,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: 'Forbidden: Insufficient permissions' })
      };
    }

    switch (httpMethod) {
      case 'GET':
        if (pathParameters?.role) {
          return await getRolePermissions(pathParameters.role);
        }
        return await getAllRolePermissions();

      case 'PUT':
        if (pathParameters?.role) {
          return await updateRolePermissions(pathParameters.role, JSON.parse(event.body));
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

async function getAllRolePermissions() {
  try {
    // Try to fetch custom permissions from DynamoDB
    const params = {
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': 'PERMISSIONS'
      }
    };

    const result = await dynamodb.query(params).promise();
    
    // Merge with default permissions
    const customPermissions = {};
    result.Items.forEach(item => {
      if (item.SK && item.SK.startsWith('ROLE#')) {
        const role = item.SK.replace('ROLE#', '');
        customPermissions[role] = item.permissions;
      }
    });

    // Build response with all roles
    const allPermissions = {};
    Object.keys(DEFAULT_PERMISSIONS).forEach(role => {
      allPermissions[role] = {
        role,
        permissions: customPermissions[role] || DEFAULT_PERMISSIONS[role],
        isCustom: !!customPermissions[role]
      };
    });

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify(allPermissions)
    };
  } catch (error) {
    console.error('Error fetching permissions:', error);
    throw error;
  }
}

async function getRolePermissions(role) {
  try {
    // Validate role
    if (!DEFAULT_PERMISSIONS[role]) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: 'Role not found' })
      };
    }

    // Try to fetch custom permissions
    const params = {
      TableName: TABLE_NAME,
      Key: {
        PK: 'PERMISSIONS',
        SK: `ROLE#${role}`
      }
    };

    const result = await dynamodb.get(params).promise();
    
    const permissions = result.Item?.permissions || DEFAULT_PERMISSIONS[role];

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        role,
        permissions,
        isCustom: !!result.Item
      })
    };
  } catch (error) {
    console.error('Error fetching role permissions:', error);
    throw error;
  }
}

async function updateRolePermissions(role, data) {
  try {
    // Validate role
    if (!DEFAULT_PERMISSIONS[role]) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: 'Role not found' })
      };
    }

    const { permissions } = data;
    
    // Validate permissions array
    if (!Array.isArray(permissions)) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: 'Permissions must be an array' })
      };
    }

    // Store custom permissions
    const timestamp = new Date().toISOString();
    const item = {
      PK: 'PERMISSIONS',
      SK: `ROLE#${role}`,
      GSI1PK: 'ROLE_PERMISSIONS',
      GSI1SK: timestamp,
      role,
      permissions,
      updatedAt: timestamp,
      updatedBy: data.updatedBy || 'system'
    };

    await dynamodb.put({
      TableName: TABLE_NAME,
      Item: item
    }).promise();

    // Create audit log
    await createAuditLog({
      action: 'permissions.update',
      role,
      permissions,
      updatedBy: data.updatedBy || 'system',
      timestamp
    });

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        message: 'Permissions updated successfully',
        role,
        permissions
      })
    };
  } catch (error) {
    console.error('Error updating permissions:', error);
    throw error;
  }
}

async function createAuditLog(data) {
  try {
    const auditItem = {
      PK: `AUDIT#${data.timestamp}`,
      SK: `PERMISSIONS#${data.role}`,
      GSI1PK: 'AUDIT_LOG',
      GSI1SK: data.timestamp,
      ...data
    };

    await dynamodb.put({
      TableName: TABLE_NAME,
      Item: auditItem
    }).promise();
  } catch (error) {
    console.error('Error creating audit log:', error);
    // Don't throw - audit logging should not fail the main operation
  }
}

// Export handler with auth middleware
exports.handler = requireAuth(mainHandler, { permissions: ['permissions.manage'] });