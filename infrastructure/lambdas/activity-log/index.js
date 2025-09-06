const AWS = require('aws-sdk');
const { requireAuth, hasPermission } = require('../shared/authMiddleware');
const { v4: uuidv4 } = require('uuid');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.TABLE_NAME || 'PodcastFlowPro';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
};

// Activity types
const ACTIVITY_TYPES = {
  // User activities
  USER_LOGIN: 'user_login',
  USER_LOGOUT: 'user_logout',
  USER_CREATED: 'user_created',
  USER_UPDATED: 'user_updated',
  USER_DELETED: 'user_deleted',
  USER_ROLE_CHANGED: 'user_role_changed',
  
  // Campaign activities
  CAMPAIGN_CREATED: 'campaign_created',
  CAMPAIGN_UPDATED: 'campaign_updated',
  CAMPAIGN_DELETED: 'campaign_deleted',
  CAMPAIGN_STATUS_CHANGED: 'campaign_status_changed',
  CAMPAIGN_TEAM_MEMBER_ADDED: 'campaign_team_member_added',
  CAMPAIGN_TEAM_MEMBER_REMOVED: 'campaign_team_member_removed',
  
  // Show activities
  SHOW_CREATED: 'show_created',
  SHOW_UPDATED: 'show_updated',
  SHOW_DELETED: 'show_deleted',
  SHOW_PRODUCER_ASSIGNED: 'show_producer_assigned',
  SHOW_TALENT_ASSIGNED: 'show_talent_assigned',
  
  // Episode activities
  EPISODE_CREATED: 'episode_created',
  EPISODE_UPDATED: 'episode_updated',
  EPISODE_DELETED: 'episode_deleted',
  EPISODE_TALENT_ASSIGNED: 'episode_talent_assigned',
  EPISODE_TALENT_REMOVED: 'episode_talent_removed',
  EPISODE_STATUS_CHANGED: 'episode_status_changed',
  
  // Client activities
  CLIENT_CREATED: 'client_created',
  CLIENT_UPDATED: 'client_updated',
  CLIENT_DELETED: 'client_deleted',
  CLIENT_SELLER_ASSIGNED: 'client_seller_assigned',
  
  // Permission activities
  PERMISSION_GRANTED: 'permission_granted',
  PERMISSION_REVOKED: 'permission_revoked',
  ROLE_PERMISSIONS_UPDATED: 'role_permissions_updated',
  
  // Data activities
  DATA_EXPORTED: 'data_exported',
  DATA_IMPORTED: 'data_imported',
  BACKUP_CREATED: 'backup_created',
  BACKUP_RESTORED: 'backup_restored',
  
  // Security activities
  PASSWORD_CHANGED: 'password_changed',
  TWO_FACTOR_ENABLED: 'two_factor_enabled',
  TWO_FACTOR_DISABLED: 'two_factor_disabled',
  API_KEY_CREATED: 'api_key_created',
  API_KEY_DELETED: 'api_key_deleted',
  
  // Integration activities
  INTEGRATION_CONNECTED: 'integration_connected',
  INTEGRATION_DISCONNECTED: 'integration_disconnected',
  INTEGRATION_SYNC_STARTED: 'integration_sync_started',
  INTEGRATION_SYNC_COMPLETED: 'integration_sync_completed',
  INTEGRATION_SYNC_FAILED: 'integration_sync_failed'
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
    const { httpMethod, pathParameters, body, queryStringParameters } = event;
    const user = event.user;

    switch (httpMethod) {
      case 'GET':
        if (pathParameters?.activityId) {
          return await getActivity(pathParameters.activityId, user);
        }
        return await listActivities(user, queryStringParameters);

      case 'POST':
        return await logActivity(JSON.parse(body), user);

      default:
        return {
          statusCode: 405,
          headers: CORS_HEADERS,
          body: JSON.stringify({ message: 'Method not allowed' })
        };
    }
  } catch (error) {
    console.error('Handler error:', error);
    return {
      statusCode: error.statusCode || 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ 
        message: error.message || 'Internal server error',
        error: error.toString()
      })
    };
  }
};

// Log activity
async function logActivity(activityData, user) {
  try {
    const activityId = uuidv4();
    const timestamp = new Date().toISOString();

    const activity = {
      // Keys
      PK: `ACTIVITY#${timestamp.substring(0, 10)}`, // Partition by date
      SK: `ACTIVITY#${timestamp}#${activityId}`,
      GSI1PK: 'ACTIVITY',
      GSI1SK: timestamp,
      // Activity data
      activityId,
      type: activityData.type,
      action: activityData.action,
      entityType: activityData.entityType,
      entityId: activityData.entityId,
      entityName: activityData.entityName,
      // Actor information
      actorId: user?.userId || activityData.actorId || 'SYSTEM',
      actorName: user?.name || user?.email || activityData.actorName || 'System',
      actorRole: user?.role || activityData.actorRole || 'system',
      actorIp: activityData.ip || event.requestContext?.identity?.sourceIp,
      // Details
      details: activityData.details || {},
      previousValue: activityData.previousValue,
      newValue: activityData.newValue,
      // Metadata
      userAgent: event.headers?.['User-Agent'],
      organizationId: user?.organizationId || activityData.organizationId,
      // Timestamps
      timestamp,
      createdAt: timestamp,
      // TTL for auto-deletion (90 days)
      ttl: Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60)
    };

    await dynamodb.put({
      TableName: TABLE_NAME,
      Item: activity
    }).promise();

    // Index by entity for entity-specific queries
    if (activityData.entityType && activityData.entityId) {
      const entityActivity = {
        ...activity,
        PK: `${activityData.entityType.toUpperCase()}#${activityData.entityId}`,
        SK: `ACTIVITY#${timestamp}#${activityId}`
      };

      await dynamodb.put({
        TableName: TABLE_NAME,
        Item: entityActivity
      }).promise();
    }

    // Index by actor for user-specific queries
    if (activity.actorId !== 'SYSTEM') {
      const actorActivity = {
        ...activity,
        PK: `USER#${activity.actorId}`,
        SK: `ACTIVITY#${timestamp}#${activityId}`
      };

      await dynamodb.put({
        TableName: TABLE_NAME,
        Item: actorActivity
      }).promise();
    }

    return {
      statusCode: 201,
      headers: CORS_HEADERS,
      body: JSON.stringify(activity)
    };
  } catch (error) {
    console.error('Error logging activity:', error);
    throw error;
  }
}

// List activities
async function listActivities(user, queryParams) {
  try {
    // Check permissions
    if (!hasPermission(user, 'activities.view')) {
      return {
        statusCode: 403,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: 'Forbidden: Cannot view activities' })
      };
    }

    const limit = parseInt(queryParams?.limit) || 50;
    const entityType = queryParams?.entityType;
    const entityId = queryParams?.entityId;
    const actorId = queryParams?.actorId;
    const type = queryParams?.type;
    const startDate = queryParams?.startDate;
    const endDate = queryParams?.endDate;
    
    let params = {
      TableName: TABLE_NAME,
      Limit: limit,
      ScanIndexForward: false // Newest first
    };

    // Query by entity
    if (entityType && entityId) {
      params.KeyConditionExpression = 'PK = :pk AND begins_with(SK, :sk)';
      params.ExpressionAttributeValues = {
        ':pk': `${entityType.toUpperCase()}#${entityId}`,
        ':sk': 'ACTIVITY#'
      };
    }
    // Query by actor
    else if (actorId) {
      params.KeyConditionExpression = 'PK = :pk AND begins_with(SK, :sk)';
      params.ExpressionAttributeValues = {
        ':pk': `USER#${actorId}`,
        ':sk': 'ACTIVITY#'
      };
    }
    // Query by date range
    else if (startDate || endDate) {
      params.IndexName = 'GSI1';
      params.KeyConditionExpression = 'GSI1PK = :pk';
      params.ExpressionAttributeValues = {
        ':pk': 'ACTIVITY'
      };
      
      if (startDate && endDate) {
        params.KeyConditionExpression += ' AND GSI1SK BETWEEN :start AND :end';
        params.ExpressionAttributeValues[':start'] = startDate;
        params.ExpressionAttributeValues[':end'] = endDate;
      } else if (startDate) {
        params.KeyConditionExpression += ' AND GSI1SK >= :start';
        params.ExpressionAttributeValues[':start'] = startDate;
      } else if (endDate) {
        params.KeyConditionExpression += ' AND GSI1SK <= :end';
        params.ExpressionAttributeValues[':end'] = endDate;
      }
    }
    // Default: query today's activities
    else {
      const today = new Date().toISOString().substring(0, 10);
      params.KeyConditionExpression = 'PK = :pk AND begins_with(SK, :sk)';
      params.ExpressionAttributeValues = {
        ':pk': `ACTIVITY#${today}`,
        ':sk': 'ACTIVITY#'
      };
    }

    // Add type filter
    if (type) {
      params.FilterExpression = '#type = :type';
      params.ExpressionAttributeNames = { '#type': 'type' };
      params.ExpressionAttributeValues = params.ExpressionAttributeValues || {};
      params.ExpressionAttributeValues[':type'] = type;
    }

    const result = await dynamodb.query(params).promise();
    
    // Remove duplicate activities (same activity indexed multiple ways)
    const uniqueActivities = {};
    (result.Items || []).forEach(item => {
      uniqueActivities[item.activityId] = item;
    });

    const activities = Object.values(uniqueActivities)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        activities,
        count: activities.length,
        lastEvaluatedKey: result.LastEvaluatedKey
      })
    };
  } catch (error) {
    console.error('Error listing activities:', error);
    throw error;
  }
}

// Get single activity
async function getActivity(activityId, user) {
  try {
    // Check permissions
    if (!hasPermission(user, 'activities.view')) {
      return {
        statusCode: 403,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: 'Forbidden: Cannot view activities' })
      };
    }

    // Query across all partitions to find the activity
    const params = {
      TableName: TABLE_NAME,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      FilterExpression: 'activityId = :activityId',
      ExpressionAttributeValues: {
        ':pk': 'ACTIVITY',
        ':activityId': activityId
      },
      Limit: 1
    };

    const result = await dynamodb.query(params).promise();

    if (!result.Items || result.Items.length === 0) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: 'Activity not found' })
      };
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify(result.Items[0])
    };
  } catch (error) {
    console.error('Error getting activity:', error);
    throw error;
  }
}

// Utility function to log activities from other services
async function createActivityLog(type, action, entityType, entityId, entityName, actorId, actorName, actorRole, details, previousValue, newValue) {
  const activityId = uuidv4();
  const timestamp = new Date().toISOString();

  const activity = {
    PK: `ACTIVITY#${timestamp.substring(0, 10)}`,
    SK: `ACTIVITY#${timestamp}#${activityId}`,
    GSI1PK: 'ACTIVITY',
    GSI1SK: timestamp,
    activityId,
    type,
    action,
    entityType,
    entityId,
    entityName,
    actorId: actorId || 'SYSTEM',
    actorName: actorName || 'System',
    actorRole: actorRole || 'system',
    details: details || {},
    previousValue,
    newValue,
    timestamp,
    createdAt: timestamp,
    ttl: Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60)
  };

  const promises = [
    // Main activity record
    dynamodb.put({
      TableName: TABLE_NAME,
      Item: activity
    }).promise()
  ];

  // Index by entity
  if (entityType && entityId) {
    promises.push(
      dynamodb.put({
        TableName: TABLE_NAME,
        Item: {
          ...activity,
          PK: `${entityType.toUpperCase()}#${entityId}`,
          SK: `ACTIVITY#${timestamp}#${activityId}`
        }
      }).promise()
    );
  }

  // Index by actor
  if (actorId && actorId !== 'SYSTEM') {
    promises.push(
      dynamodb.put({
        TableName: TABLE_NAME,
        Item: {
          ...activity,
          PK: `USER#${actorId}`,
          SK: `ACTIVITY#${timestamp}#${activityId}`
        }
      }).promise()
    );
  }

  await Promise.all(promises);
  return activity;
}

// Export handler with auth middleware
exports.handler = requireAuth(mainHandler);

// Export utility functions and constants
exports.createActivityLog = createActivityLog;
exports.ACTIVITY_TYPES = ACTIVITY_TYPES;