const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

const { requireAuth } = require('./authMiddleware');
const { validateRequest, schemas } = require('./validation');
const {
  errorHandler,
  ValidationError,
  NotFoundError,
  ConflictError,
  DatabaseError,
  ExternalAPIError,
  retryWithBackoff,
  CircuitBreaker,
  recoveryStrategies
} = require('./errorHandler');

// Circuit breaker for external API
const externalAPICircuit = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeout: 60000
});

// Example Lambda handler with comprehensive error handling
const mainHandler = async (event, context) => {
  const { httpMethod, pathParameters, body } = event;
  
  // Handle OPTIONS for CORS
  if (httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
      },
      body: ''
    };
  }

  switch (httpMethod) {
    case 'GET':
      if (pathParameters?.id) {
        return await getResourceById(pathParameters.id);
      }
      return await listResources(event.queryStringParameters);
      
    case 'POST':
      return await createResource(JSON.parse(body), event.user);
      
    case 'PUT':
      return await updateResource(pathParameters.id, JSON.parse(body), event.user);
      
    case 'DELETE':
      return await deleteResource(pathParameters.id, event.user);
      
    default:
      throw new ValidationError('Invalid HTTP method');
  }
};

// Get resource by ID with error handling
async function getResourceById(id) {
  if (!id) {
    throw new ValidationError('Resource ID is required');
  }

  try {
    // Try to get from database
    const result = await retryWithBackoff(async () => {
      return await dynamodb.get({
        TableName: process.env.TABLE_NAME,
        Key: { PK: `RESOURCE#${id}`, SK: 'METADATA' }
      }).promise();
    });

    if (!result.Item) {
      throw new NotFoundError('Resource', id);
    }

    // Try to enrich with external API data
    let enrichedData = result.Item;
    try {
      const externalData = await externalAPICircuit.execute(async () => {
        return await fetchExternalData(id);
      });
      enrichedData = { ...enrichedData, external: externalData };
    } catch (error) {
      // Log but don't fail - use fallback strategy
      console.warn('Failed to fetch external data, using cached version:', error);
      enrichedData.external = result.Item.cachedExternalData || null;
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(enrichedData)
    };
  } catch (error) {
    // Database errors are critical - convert to proper error type
    if (error.code === 'ResourceNotFoundException') {
      throw new DatabaseError('get', error);
    }
    throw error;
  }
}

// Create resource with conflict detection
async function createResource(data, user) {
  // Validate data
  if (!data.name) {
    throw new ValidationError('Resource name is required', {
      field: 'name',
      provided: data.name
    });
  }

  const resourceId = generateId();
  
  try {
    // Check if resource already exists
    const existing = await dynamodb.get({
      TableName: process.env.TABLE_NAME,
      Key: { PK: `RESOURCE#NAME#${data.name}`, SK: 'METADATA' }
    }).promise();

    if (existing.Item) {
      throw new ConflictError('Resource with this name already exists', {
        name: data.name,
        existingId: existing.Item.resourceId
      });
    }

    // Create resource with conditional write
    await dynamodb.put({
      TableName: process.env.TABLE_NAME,
      Item: {
        PK: `RESOURCE#${resourceId}`,
        SK: 'METADATA',
        resourceId,
        name: data.name,
        createdBy: user.userId,
        createdAt: new Date().toISOString(),
        ...data
      },
      ConditionExpression: 'attribute_not_exists(PK)'
    }).promise();

    // Also create name index
    await dynamodb.put({
      TableName: process.env.TABLE_NAME,
      Item: {
        PK: `RESOURCE#NAME#${data.name}`,
        SK: 'METADATA',
        resourceId
      }
    }).promise();

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        resourceId,
        message: 'Resource created successfully'
      })
    };
  } catch (error) {
    if (error.code === 'ConditionalCheckFailedException') {
      throw new ConflictError('Resource already exists');
    }
    if (error.code === 'ProvisionedThroughputExceededException') {
      // Queue for later processing
      return await recoveryStrategies.queue(
        { action: 'create', data },
        error,
        process.env.RETRY_QUEUE_URL
      );
    }
    throw new DatabaseError('create', error);
  }
}

// Update with optimistic locking
async function updateResource(id, updates, user) {
  if (!id) {
    throw new ValidationError('Resource ID is required');
  }

  try {
    // Get current version
    const current = await dynamodb.get({
      TableName: process.env.TABLE_NAME,
      Key: { PK: `RESOURCE#${id}`, SK: 'METADATA' }
    }).promise();

    if (!current.Item) {
      throw new NotFoundError('Resource', id);
    }

    // Check permissions
    if (current.Item.createdBy !== user.userId && user.role !== 'admin') {
      throw new AuthorizationError('You can only update your own resources');
    }

    const version = current.Item.version || 0;
    
    // Update with version check
    await dynamodb.update({
      TableName: process.env.TABLE_NAME,
      Key: { PK: `RESOURCE#${id}`, SK: 'METADATA' },
      UpdateExpression: 'SET #data = :data, version = :newVersion, updatedAt = :updatedAt, updatedBy = :updatedBy',
      ExpressionAttributeNames: {
        '#data': 'data'
      },
      ExpressionAttributeValues: {
        ':data': updates,
        ':newVersion': version + 1,
        ':currentVersion': version,
        ':updatedAt': new Date().toISOString(),
        ':updatedBy': user.userId
      },
      ConditionExpression: 'version = :currentVersion',
      ReturnValues: 'ALL_NEW'
    }).promise();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        message: 'Resource updated successfully',
        version: version + 1
      })
    };
  } catch (error) {
    if (error.code === 'ConditionalCheckFailedException') {
      throw new ConflictError('Resource was modified by another user. Please refresh and try again.');
    }
    throw new DatabaseError('update', error);
  }
}

// Delete with cascade handling
async function deleteResource(id, user) {
  if (!id) {
    throw new ValidationError('Resource ID is required');
  }

  try {
    // Get resource to check permissions
    const resource = await dynamodb.get({
      TableName: process.env.TABLE_NAME,
      Key: { PK: `RESOURCE#${id}`, SK: 'METADATA' }
    }).promise();

    if (!resource.Item) {
      throw new NotFoundError('Resource', id);
    }

    // Check permissions
    if (resource.Item.createdBy !== user.userId && user.role !== 'admin') {
      throw new AuthorizationError('You can only delete your own resources');
    }

    // Delete in transaction to ensure consistency
    await dynamodb.transactWrite({
      TransactItems: [
        {
          Delete: {
            TableName: process.env.TABLE_NAME,
            Key: { PK: `RESOURCE#${id}`, SK: 'METADATA' }
          }
        },
        {
          Delete: {
            TableName: process.env.TABLE_NAME,
            Key: { PK: `RESOURCE#NAME#${resource.Item.name}`, SK: 'METADATA' }
          }
        }
      ]
    }).promise();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        message: 'Resource deleted successfully'
      })
    };
  } catch (error) {
    throw new DatabaseError('delete', error);
  }
}

// List resources with pagination
async function listResources(queryParams = {}) {
  const limit = Math.min(parseInt(queryParams.limit) || 20, 100);
  const nextToken = queryParams.nextToken;

  try {
    const params = {
      TableName: process.env.TABLE_NAME,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: {
        ':pk': 'RESOURCE'
      },
      Limit: limit
    };

    if (nextToken) {
      params.ExclusiveStartKey = JSON.parse(Buffer.from(nextToken, 'base64').toString());
    }

    const result = await dynamodb.query(params).promise();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        resources: result.Items,
        nextToken: result.LastEvaluatedKey 
          ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
          : null
      })
    };
  } catch (error) {
    throw new DatabaseError('list', error);
  }
}

// Mock external API call
async function fetchExternalData(id) {
  // Simulate external API call
  const response = await fetch(`https://api.example.com/resources/${id}`);
  
  if (!response.ok) {
    throw new ExternalAPIError('ExampleAPI', new Error(`Status: ${response.status}`));
  }
  
  return response.json();
}

// Helper to generate unique IDs
function generateId() {
  return `res_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Export handler with all middleware applied
exports.handler = requireAuth(
  errorHandler(mainHandler)
);

// Also export individual handlers for testing
module.exports = {
  handler: exports.handler,
  getResourceById,
  createResource,
  updateResource,
  deleteResource,
  listResources
};