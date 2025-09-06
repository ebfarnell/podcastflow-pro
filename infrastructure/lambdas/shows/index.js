const AWS = require('aws-sdk');
const { requireAuth, hasPermission } = require('../shared/authMiddleware');
const { v4: uuidv4 } = require('uuid');
const { broadcastShowUpdate, broadcastUserNotification } = require('../shared/broadcast-update');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.TABLE_NAME || 'PodcastFlowPro';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
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
        if (pathParameters?.showId) {
          return await getShow(pathParameters.showId, user);
        }
        return await listShows(user, queryStringParameters);

      case 'POST':
        return await createShow(JSON.parse(body), user);

      case 'PUT':
        if (pathParameters?.showId) {
          return await updateShow(pathParameters.showId, JSON.parse(body), user);
        }
        break;

      case 'DELETE':
        if (pathParameters?.showId) {
          return await deleteShow(pathParameters.showId, user);
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

async function createShow(showData, user) {
  // Check permissions
  if (!hasPermission(user, 'shows.create')) {
    return {
      statusCode: 403,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: 'Forbidden: Cannot create shows' })
    };
  }

  const showId = `SHOW-${uuidv4()}`;
  const timestamp = new Date().toISOString();

  try {
    const show = {
      PK: `SHOW#${showId}`,
      SK: `SHOW#${showId}`,
      GSI1PK: 'SHOW',
      GSI1SK: timestamp,
      id: showId,
      // Basic info
      name: showData.name,
      description: showData.description,
      category: showData.category || 'general',
      genre: showData.genre || [],
      // Production details
      format: showData.format || 'episodic',
      frequency: showData.frequency || 'weekly',
      duration: showData.duration || 30,
      language: showData.language || 'en',
      // Team
      producers: showData.producers || [],
      talent: showData.talent || [],
      // Status
      status: showData.status || 'active',
      // Metadata
      createdBy: user.userId,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    await dynamodb.put({
      TableName: TABLE_NAME,
      Item: show
    }).promise();

    // Broadcast real-time update
    await broadcastShowUpdate(showId, 'created', show, user.userId, user.role);

    return {
      statusCode: 201,
      headers: CORS_HEADERS,
      body: JSON.stringify(show)
    };
  } catch (error) {
    console.error('Error creating show:', error);
    throw error;
  }
}

async function listShows(user, queryParams) {
  try {
    let shows = [];

    if (user.role === 'admin' || hasPermission(user, 'shows.view.all')) {
      // Admins can see all shows
      const params = {
        TableName: TABLE_NAME,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk',
        ExpressionAttributeValues: {
          ':pk': 'SHOW'
        },
        ScanIndexForward: false
      };

      const result = await dynamodb.query(params).promise();
      shows = result.Items;
    } else if (user.role === 'producer' || user.role === 'talent') {
      // Producers and talent see assigned shows
      const params = {
        TableName: TABLE_NAME,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `USER#${user.userId}`
        },
        FilterExpression: 'begins_with(GSI1SK, :show)',
        ExpressionAttributeValues: {
          ':pk': `USER#${user.userId}`,
          ':show': 'SHOW#'
        }
      };

      const assignments = await dynamodb.query(params).promise();
      
      // Fetch full show details
      if (assignments.Items.length > 0) {
        const showIds = assignments.Items.map(item => item.showId);
        const keys = showIds.map(id => ({
          PK: `SHOW#${id}`,
          SK: `SHOW#${id}`
        }));

        const batchGetParams = {
          RequestItems: {
            [TABLE_NAME]: {
              Keys: keys
            }
          }
        };

        const batchResult = await dynamodb.batchGet(batchGetParams).promise();
        shows = batchResult.Responses[TABLE_NAME] || [];
      }
    }

    // Apply filters
    if (queryParams?.status) {
      shows = shows.filter(s => s.status === queryParams.status);
    }

    if (queryParams?.category) {
      shows = shows.filter(s => s.category === queryParams.category);
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        shows,
        count: shows.length
      })
    };
  } catch (error) {
    console.error('Error listing shows:', error);
    throw error;
  }
}

async function getShow(showId, user) {
  try {
    const params = {
      TableName: TABLE_NAME,
      Key: {
        PK: `SHOW#${showId}`,
        SK: `SHOW#${showId}`
      }
    };

    const result = await dynamodb.get(params).promise();

    if (!result.Item) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: 'Show not found' })
      };
    }

    // Check if user has access
    const isAssigned = result.Item.producers?.includes(user.userId) || 
                      result.Item.talent?.includes(user.userId);
    const canViewAll = hasPermission(user, 'shows.view.all');

    if (!isAssigned && !canViewAll) {
      return {
        statusCode: 403,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: 'Forbidden: Cannot view this show' })
      };
    }

    // Fetch additional data
    const additionalData = await getShowAdditionalData(showId);

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        ...result.Item,
        ...additionalData
      })
    };
  } catch (error) {
    console.error('Error getting show:', error);
    throw error;
  }
}

async function updateShow(showId, updateData, user) {
  try {
    // Fetch existing show
    const existingShow = await getShowData(showId);
    
    if (!existingShow) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: 'Show not found' })
      };
    }

    // Check permissions
    const isProducer = existingShow.producers?.includes(user.userId);
    const canEdit = hasPermission(user, 'shows.edit') || 
                   (hasPermission(user, 'shows.edit.assigned') && isProducer);

    if (!canEdit) {
      return {
        statusCode: 403,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: 'Forbidden: Cannot update this show' })
      };
    }

    // Build update expression
    const timestamp = new Date().toISOString();
    let updateExpression = 'SET updatedAt = :updatedAt';
    let expressionAttributeNames = {};
    let expressionAttributeValues = {
      ':updatedAt': timestamp
    };

    // Update allowed fields
    const allowedFields = [
      'name', 'description', 'category', 'genre', 'format',
      'frequency', 'duration', 'language', 'status'
    ];

    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        updateExpression += `, #${field} = :${field}`;
        expressionAttributeNames[`#${field}`] = field;
        expressionAttributeValues[`:${field}`] = updateData[field];
      }
    });

    const params = {
      TableName: TABLE_NAME,
      Key: {
        PK: `SHOW#${showId}`,
        SK: `SHOW#${showId}`
      },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW'
    };

    const result = await dynamodb.update(params).promise();

    // Broadcast real-time update
    await broadcastShowUpdate(showId, 'updated', result.Attributes, user.userId, user.role);

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify(result.Attributes)
    };
  } catch (error) {
    console.error('Error updating show:', error);
    throw error;
  }
}

async function deleteShow(showId, user) {
  try {
    // Check permissions
    if (!hasPermission(user, 'shows.delete')) {
      return {
        statusCode: 403,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: 'Forbidden: Cannot delete shows' })
      };
    }

    // Get show to clean up related entries
    const show = await getShowData(showId);
    if (!show) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: 'Show not found' })
      };
    }

    // Delete show
    await dynamodb.delete({
      TableName: TABLE_NAME,
      Key: {
        PK: `SHOW#${showId}`,
        SK: `SHOW#${showId}`
      }
    }).promise();

    // TODO: Clean up related entries (episodes, assignments, etc.)

    // Broadcast real-time update
    await broadcastShowUpdate(showId, 'deleted', { id: showId }, user.userId, user.role);

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: 'Show deleted successfully' })
    };
  } catch (error) {
    console.error('Error deleting show:', error);
    throw error;
  }
}

// Helper functions
async function getShowData(showId) {
  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: `SHOW#${showId}`,
      SK: `SHOW#${showId}`
    }
  };

  const result = await dynamodb.get(params).promise();
  return result.Item;
}

async function getShowAdditionalData(showId) {
  const additionalData = {
    episodes: [],
    analytics: {}
  };

  // Get episodes
  try {
    const episodesParams = {
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `SHOW#${showId}`,
        ':sk': 'EPISODE#'
      }
    };

    const episodesResult = await dynamodb.query(episodesParams).promise();
    additionalData.episodes = episodesResult.Items;
  } catch (error) {
    console.error('Error fetching episodes:', error);
  }

  return additionalData;
}

// Export handler with auth middleware
exports.handler = requireAuth(mainHandler);