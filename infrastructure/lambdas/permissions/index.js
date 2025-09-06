const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

const TABLE_NAME = process.env.TABLE_NAME || 'PodcastFlowPro';
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS'
};

// Default permissions for each role
const DEFAULT_PERMISSIONS = {
  admin: {
    campaigns: { view: true, create: true, edit: true, delete: true },
    shows: { view: true, create: true, edit: true, delete: true },
    episodes: { view: true, create: true, edit: true, delete: true },
    clients: { view: true, create: true, edit: true, delete: true },
    users: { view: true, create: true, edit: true, delete: true },
    billing: { view: true, manage: true },
    analytics: { view: true, export: true },
    settings: { view: true, manage: true },
    permissions: { view: true, manage: true },
    backups: { view: true, create: true, restore: true },
    monitoring: { view: true }
  },
  seller: {
    campaigns: { view: true, create: true, edit: true, delete: true },
    shows: { view: true, create: false, edit: false, delete: false },
    episodes: { view: true, create: false, edit: false, delete: false },
    clients: { view: true, create: true, edit: true, delete: false },
    users: { view: false, create: false, edit: false, delete: false },
    billing: { view: true, manage: false },
    analytics: { view: true, export: true },
    settings: { view: true, manage: false },
    permissions: { view: false, manage: false },
    backups: { view: false, create: false, restore: false },
    monitoring: { view: false }
  },
  producer: {
    campaigns: { view: true, create: false, edit: false, delete: false },
    shows: { view: true, create: true, edit: true, delete: false },
    episodes: { view: true, create: true, edit: true, delete: true },
    clients: { view: true, create: false, edit: false, delete: false },
    users: { view: false, create: false, edit: false, delete: false },
    billing: { view: false, manage: false },
    analytics: { view: true, export: false },
    settings: { view: true, manage: false },
    permissions: { view: false, manage: false },
    backups: { view: false, create: false, restore: false },
    monitoring: { view: false }
  },
  talent: {
    campaigns: { view: true, create: false, edit: false, delete: false },
    shows: { view: true, create: false, edit: false, delete: false },
    episodes: { view: true, create: false, edit: false, delete: false },
    clients: { view: false, create: false, edit: false, delete: false },
    users: { view: false, create: false, edit: false, delete: false },
    billing: { view: false, manage: false },
    analytics: { view: false, export: false },
    settings: { view: true, manage: false },
    permissions: { view: false, manage: false },
    backups: { view: false, create: false, restore: false },
    monitoring: { view: false }
  },
  client: {
    campaigns: { view: true, create: false, edit: false, delete: false },
    shows: { view: false, create: false, edit: false, delete: false },
    episodes: { view: false, create: false, edit: false, delete: false },
    clients: { view: false, create: false, edit: false, delete: false },
    users: { view: false, create: false, edit: false, delete: false },
    billing: { view: true, manage: false },
    analytics: { view: true, export: false },
    settings: { view: true, manage: false },
    permissions: { view: false, manage: false },
    backups: { view: false, create: false, restore: false },
    monitoring: { view: false }
  }
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
    const role = pathParameters?.role;

    // Only admin can manage permissions
    const user = event.user;
    if (!user || user.role !== 'admin') {
      return {
        statusCode: 403,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: 'Only admins can manage permissions' })
      };
    }

    switch (httpMethod) {
      case 'GET':
        if (role) {
          return await getPermissionsForRole(role);
        }
        return await getAllPermissions();

      case 'PUT':
        if (role) {
          return await updatePermissionsForRole(role, JSON.parse(body));
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

async function getPermissionsForRole(role) {
  try {
    // Try to get custom permissions from database
    const result = await dynamodb.get({
      TableName: TABLE_NAME,
      Key: {
        PK: `PERMISSIONS#${role}`,
        SK: `PERMISSIONS#${role}`
      }
    }).promise();

    const permissions = result.Item?.permissions || DEFAULT_PERMISSIONS[role] || {};

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        role,
        permissions,
        isDefault: !result.Item
      })
    };
  } catch (error) {
    console.error('Error getting permissions:', error);
    throw error;
  }
}

async function getAllPermissions() {
  try {
    const roles = ['admin', 'seller', 'producer', 'talent', 'client'];
    const permissions = {};

    for (const role of roles) {
      const result = await dynamodb.get({
        TableName: TABLE_NAME,
        Key: {
          PK: `PERMISSIONS#${role}`,
          SK: `PERMISSIONS#${role}`
        }
      }).promise();

      permissions[role] = result.Item?.permissions || DEFAULT_PERMISSIONS[role];
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify(permissions)
    };
  } catch (error) {
    console.error('Error getting all permissions:', error);
    throw error;
  }
}

async function updatePermissionsForRole(role, permissions) {
  try {
    const timestamp = new Date().toISOString();

    await dynamodb.put({
      TableName: TABLE_NAME,
      Item: {
        PK: `PERMISSIONS#${role}`,
        SK: `PERMISSIONS#${role}`,
        GSI1PK: 'PERMISSIONS',
        GSI1SK: role,
        role,
        permissions,
        updatedAt: timestamp,
        updatedBy: 'admin'
      }
    }).promise();

    // Log the permission change
    await dynamodb.put({
      TableName: TABLE_NAME,
      Item: {
        PK: `AUDIT#${timestamp}`,
        SK: `PERMISSIONS#${role}`,
        GSI1PK: 'AUDIT_LOG',
        GSI1SK: timestamp,
        action: 'PERMISSIONS_UPDATED',
        role,
        permissions,
        timestamp,
        performedBy: 'admin'
      }
    }).promise();

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        message: `Permissions updated for role: ${role}`,
        role,
        permissions
      })
    };
  } catch (error) {
    console.error('Error updating permissions:', error);
    throw error;
  }
}