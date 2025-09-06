const AWS = require('aws-sdk');
const { requireAuth, hasPermission } = require('../shared/authMiddleware');
const { v4: uuidv4 } = require('uuid');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const ses = new AWS.SES();
const TABLE_NAME = process.env.TABLE_NAME || 'PodcastFlowPro';
const SENDER_EMAIL = process.env.SENDER_EMAIL || 'notifications@podcastflow.pro';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
};

// Notification types
const NOTIFICATION_TYPES = {
  TEAM_ASSIGNMENT: 'team_assignment',
  ROLE_ASSIGNMENT: 'role_assignment',
  CAMPAIGN_UPDATE: 'campaign_update',
  SHOW_ASSIGNMENT: 'show_assignment',
  EPISODE_ASSIGNMENT: 'episode_assignment',
  CLIENT_ASSIGNMENT: 'client_assignment',
  STATUS_CHANGE: 'status_change',
  COMMENT_MENTION: 'comment_mention',
  DEADLINE_REMINDER: 'deadline_reminder',
  APPROVAL_REQUEST: 'approval_request',
  SYSTEM_ALERT: 'system_alert'
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
        if (pathParameters?.notificationId) {
          return await getNotification(pathParameters.notificationId, user);
        }
        return await listNotifications(user, queryStringParameters);

      case 'POST':
        if (pathParameters?.notificationId && event.path.includes('/read')) {
          return await markAsRead(pathParameters.notificationId, user);
        }
        if (event.path.includes('/batch-read')) {
          return await markBatchAsRead(JSON.parse(body), user);
        }
        return await createNotification(JSON.parse(body), user);

      case 'PUT':
        if (pathParameters?.notificationId) {
          return await updateNotification(pathParameters.notificationId, JSON.parse(body), user);
        }
        break;

      case 'DELETE':
        if (pathParameters?.notificationId) {
          return await deleteNotification(pathParameters.notificationId, user);
        }
        if (event.path.includes('/batch-delete')) {
          return await deleteBatchNotifications(JSON.parse(body), user);
        }
        break;

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

// Create notification
async function createNotification(notificationData, user) {
  try {
    // Validate permissions
    if (!hasPermission(user, 'notifications.create')) {
      return {
        statusCode: 403,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: 'Forbidden: Cannot create notifications' })
      };
    }

    const notificationId = uuidv4();
    const timestamp = new Date().toISOString();

    const notification = {
      // Keys
      PK: `USER#${notificationData.recipientId}`,
      SK: `NOTIFICATION#${notificationId}`,
      GSI1PK: 'NOTIFICATION',
      GSI1SK: timestamp,
      // Notification data
      notificationId,
      type: notificationData.type,
      recipientId: notificationData.recipientId,
      title: notificationData.title,
      message: notificationData.message,
      data: notificationData.data || {},
      // Status
      read: false,
      readAt: null,
      // Priority
      priority: notificationData.priority || 'normal',
      // Sender
      senderId: user.userId,
      senderName: user.name || user.email,
      senderRole: user.role,
      // Timestamps
      createdAt: timestamp,
      expiresAt: notificationData.expiresAt || null,
      // TTL for auto-deletion (30 days)
      ttl: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60)
    };

    await dynamodb.put({
      TableName: TABLE_NAME,
      Item: notification
    }).promise();

    // Send email notification if enabled
    if (notificationData.sendEmail) {
      await sendEmailNotification(notification);
    }

    // Send push notification if enabled (future implementation)
    if (notificationData.sendPush) {
      await sendPushNotification(notification);
    }

    return {
      statusCode: 201,
      headers: CORS_HEADERS,
      body: JSON.stringify(notification)
    };
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
}

// List notifications for user
async function listNotifications(user, queryParams) {
  try {
    const limit = parseInt(queryParams?.limit) || 20;
    const unreadOnly = queryParams?.unreadOnly === 'true';
    const type = queryParams?.type;

    const params = {
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${user.userId}`,
        ':sk': 'NOTIFICATION#'
      },
      ScanIndexForward: false, // Newest first
      Limit: limit
    };

    // Add filters
    if (unreadOnly || type) {
      let filterExpression = [];
      
      if (unreadOnly) {
        filterExpression.push('#read = :read');
        params.ExpressionAttributeNames = { '#read': 'read' };
        params.ExpressionAttributeValues[':read'] = false;
      }
      
      if (type) {
        filterExpression.push('#type = :type');
        params.ExpressionAttributeNames = params.ExpressionAttributeNames || {};
        params.ExpressionAttributeNames['#type'] = 'type';
        params.ExpressionAttributeValues[':type'] = type;
      }
      
      params.FilterExpression = filterExpression.join(' AND ');
    }

    const result = await dynamodb.query(params).promise();
    
    // Get unread count
    const unreadCountParams = {
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${user.userId}`,
        ':sk': 'NOTIFICATION#'
      },
      FilterExpression: '#read = :read',
      ExpressionAttributeNames: { '#read': 'read' },
      ExpressionAttributeValues: {
        ...params.ExpressionAttributeValues,
        ':read': false
      },
      Select: 'COUNT'
    };
    
    const unreadResult = await dynamodb.query(unreadCountParams).promise();

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        notifications: result.Items || [],
        count: result.Count || 0,
        unreadCount: unreadResult.Count || 0,
        lastEvaluatedKey: result.LastEvaluatedKey
      })
    };
  } catch (error) {
    console.error('Error listing notifications:', error);
    throw error;
  }
}

// Get single notification
async function getNotification(notificationId, user) {
  try {
    const params = {
      TableName: TABLE_NAME,
      Key: {
        PK: `USER#${user.userId}`,
        SK: `NOTIFICATION#${notificationId}`
      }
    };

    const result = await dynamodb.get(params).promise();

    if (!result.Item) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: 'Notification not found' })
      };
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify(result.Item)
    };
  } catch (error) {
    console.error('Error getting notification:', error);
    throw error;
  }
}

// Mark notification as read
async function markAsRead(notificationId, user) {
  try {
    const timestamp = new Date().toISOString();

    const params = {
      TableName: TABLE_NAME,
      Key: {
        PK: `USER#${user.userId}`,
        SK: `NOTIFICATION#${notificationId}`
      },
      UpdateExpression: 'SET #read = :read, readAt = :readAt',
      ExpressionAttributeNames: {
        '#read': 'read'
      },
      ExpressionAttributeValues: {
        ':read': true,
        ':readAt': timestamp
      },
      ReturnValues: 'ALL_NEW'
    };

    const result = await dynamodb.update(params).promise();

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify(result.Attributes)
    };
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
}

// Mark batch as read
async function markBatchAsRead(data, user) {
  try {
    const { notificationIds } = data;
    
    if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: 'Invalid notification IDs' })
      };
    }

    const timestamp = new Date().toISOString();
    const promises = notificationIds.map(notificationId => 
      dynamodb.update({
        TableName: TABLE_NAME,
        Key: {
          PK: `USER#${user.userId}`,
          SK: `NOTIFICATION#${notificationId}`
        },
        UpdateExpression: 'SET #read = :read, readAt = :readAt',
        ExpressionAttributeNames: {
          '#read': 'read'
        },
        ExpressionAttributeValues: {
          ':read': true,
          ':readAt': timestamp
        }
      }).promise()
    );

    await Promise.all(promises);

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ 
        message: 'Notifications marked as read',
        count: notificationIds.length 
      })
    };
  } catch (error) {
    console.error('Error marking batch as read:', error);
    throw error;
  }
}

// Delete notification
async function deleteNotification(notificationId, user) {
  try {
    await dynamodb.delete({
      TableName: TABLE_NAME,
      Key: {
        PK: `USER#${user.userId}`,
        SK: `NOTIFICATION#${notificationId}`
      }
    }).promise();

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: 'Notification deleted' })
    };
  } catch (error) {
    console.error('Error deleting notification:', error);
    throw error;
  }
}

// Delete batch notifications
async function deleteBatchNotifications(data, user) {
  try {
    const { notificationIds } = data;
    
    if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: 'Invalid notification IDs' })
      };
    }

    const promises = notificationIds.map(notificationId => 
      dynamodb.delete({
        TableName: TABLE_NAME,
        Key: {
          PK: `USER#${user.userId}`,
          SK: `NOTIFICATION#${notificationId}`
        }
      }).promise()
    );

    await Promise.all(promises);

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ 
        message: 'Notifications deleted',
        count: notificationIds.length 
      })
    };
  } catch (error) {
    console.error('Error deleting batch notifications:', error);
    throw error;
  }
}

// Send email notification
async function sendEmailNotification(notification) {
  try {
    // Get recipient email
    const recipientResult = await dynamodb.get({
      TableName: TABLE_NAME,
      Key: {
        PK: `USER#${notification.recipientId}`,
        SK: `USER#${notification.recipientId}`
      }
    }).promise();

    if (!recipientResult.Item || !recipientResult.Item.email) {
      console.log('Recipient email not found');
      return;
    }

    const recipientEmail = recipientResult.Item.email;
    const emailEnabled = recipientResult.Item.emailNotifications !== false;

    if (!emailEnabled) {
      console.log('Email notifications disabled for recipient');
      return;
    }

    // Send email
    const params = {
      Source: SENDER_EMAIL,
      Destination: {
        ToAddresses: [recipientEmail]
      },
      Message: {
        Subject: {
          Data: notification.title
        },
        Body: {
          Html: {
            Data: generateEmailHtml(notification)
          },
          Text: {
            Data: notification.message
          }
        }
      }
    };

    await ses.sendEmail(params).promise();
    console.log('Email notification sent to:', recipientEmail);
  } catch (error) {
    console.error('Error sending email notification:', error);
    // Don't throw - email failures shouldn't break notification creation
  }
}

// Generate email HTML
function generateEmailHtml(notification) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #2196F3; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .footer { text-align: center; padding: 10px; color: #666; font-size: 12px; }
        .button { display: inline-block; padding: 10px 20px; background-color: #2196F3; color: white; text-decoration: none; border-radius: 4px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>PodcastFlow Pro</h1>
        </div>
        <div class="content">
          <h2>${notification.title}</h2>
          <p>${notification.message}</p>
          ${notification.data.actionUrl ? `
            <p style="margin-top: 20px;">
              <a href="${notification.data.actionUrl}" class="button">View Details</a>
            </p>
          ` : ''}
        </div>
        <div class="footer">
          <p>This is an automated message from PodcastFlow Pro.</p>
          <p>To manage your notification preferences, visit your account settings.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Send push notification (placeholder for future implementation)
async function sendPushNotification(notification) {
  // TODO: Implement push notifications using SNS or similar service
  console.log('Push notification not yet implemented');
}

// Utility function to create notifications (used by other services)
async function createSystemNotification(recipientId, type, title, message, data = {}) {
  const notificationId = uuidv4();
  const timestamp = new Date().toISOString();

  const notification = {
    PK: `USER#${recipientId}`,
    SK: `NOTIFICATION#${notificationId}`,
    GSI1PK: 'NOTIFICATION',
    GSI1SK: timestamp,
    notificationId,
    type,
    recipientId,
    title,
    message,
    data,
    read: false,
    readAt: null,
    priority: data.priority || 'normal',
    senderId: 'SYSTEM',
    senderName: 'System',
    senderRole: 'system',
    createdAt: timestamp,
    expiresAt: data.expiresAt || null,
    ttl: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60)
  };

  await dynamodb.put({
    TableName: TABLE_NAME,
    Item: notification
  }).promise();

  // Send email if specified
  if (data.sendEmail !== false) {
    await sendEmailNotification(notification);
  }

  return notification;
}

// Export handler with auth middleware
exports.handler = requireAuth(mainHandler);

// Export utility functions
exports.createSystemNotification = createSystemNotification;
exports.NOTIFICATION_TYPES = NOTIFICATION_TYPES;