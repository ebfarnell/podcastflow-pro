const AWS = require('aws-sdk');
const { requireAuth, hasPermission } = require('../shared/authMiddleware');
const { v4: uuidv4 } = require('uuid');
const zlib = require('zlib');
const { promisify } = require('util');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();
const eventBridge = new AWS.EventBridge();

const TABLE_NAME = process.env.TABLE_NAME || 'PodcastFlowPro';
const BACKUP_BUCKET = process.env.BACKUP_BUCKET || 'podcastflowpro-backups';
const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
};

// Entity types to backup
const BACKUP_ENTITIES = [
  'USER',
  'CAMPAIGN',
  'SHOW',
  'EPISODE',
  'CLIENT',
  'NOTIFICATION',
  'ACTIVITY',
  'PERMISSION',
  'ROLE',
  'APIKEY',
  'ACCOUNT_TEAM'
];

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

  // Handle EventBridge scheduled backups
  if (event.source === 'aws.events') {
    return await handleScheduledBackup(event);
  }

  try {
    const { httpMethod, pathParameters, body, queryStringParameters } = event;
    const user = event.user;

    switch (httpMethod) {
      case 'GET':
        if (pathParameters?.backupId) {
          if (pathParameters.action === 'download') {
            return await downloadBackup(pathParameters.backupId, user);
          }
          return await getBackup(pathParameters.backupId, user);
        }
        return await listBackups(user, queryStringParameters);

      case 'POST':
        const requestBody = JSON.parse(body);
        if (pathParameters?.action === 'restore') {
          return await restoreBackup(requestBody, user);
        }
        return await createBackup(requestBody, user);

      case 'PUT':
        if (pathParameters?.backupId) {
          return await updateBackup(pathParameters.backupId, JSON.parse(body), user);
        } else if (pathParameters?.action === 'schedule') {
          return await updateBackupSchedule(JSON.parse(body), user);
        }
        break;

      case 'DELETE':
        if (pathParameters?.backupId) {
          return await deleteBackup(pathParameters.backupId, user);
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

// Create manual backup
async function createBackup(backupData, user) {
  try {
    // Check permissions
    if (!hasPermission(user, 'backups.create')) {
      return {
        statusCode: 403,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: 'Forbidden: Cannot create backups' })
      };
    }

    const backupId = uuidv4();
    const timestamp = new Date().toISOString();

    // Create backup metadata
    const backupMetadata = {
      PK: `BACKUP#${backupId}`,
      SK: 'METADATA',
      GSI1PK: 'BACKUP',
      GSI1SK: timestamp,
      backupId,
      name: backupData.name || `Backup ${new Date().toLocaleString()}`,
      description: backupData.description || '',
      type: 'manual',
      status: 'in_progress',
      entities: backupData.entities || BACKUP_ENTITIES,
      createdBy: user.userId,
      createdByName: user.name || user.email,
      organizationId: user.organizationId,
      timestamp,
      createdAt: timestamp
    };

    // Save metadata
    await dynamodb.put({
      TableName: TABLE_NAME,
      Item: backupMetadata
    }).promise();

    // Start backup process asynchronously
    await performBackup(backupId, backupMetadata.entities);

    return {
      statusCode: 201,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        backupId,
        message: 'Backup initiated successfully',
        status: 'in_progress'
      })
    };
  } catch (error) {
    console.error('Error creating backup:', error);
    throw error;
  }
}

// Perform the actual backup
async function performBackup(backupId, entities) {
  const backupData = {
    version: '1.0',
    timestamp: new Date().toISOString(),
    entities: {}
  };

  try {
    // Update status to running
    await updateBackupStatus(backupId, 'running', { startedAt: new Date().toISOString() });

    // Backup each entity type
    for (const entity of entities) {
      console.log(`Backing up ${entity} entities...`);
      const items = await scanEntity(entity);
      backupData.entities[entity] = items;
      
      // Update progress
      await updateBackupStatus(backupId, 'running', { 
        progress: Math.round((entities.indexOf(entity) + 1) / entities.length * 100)
      });
    }

    // Compress backup data
    const jsonData = JSON.stringify(backupData, null, 2);
    const compressed = await gzip(jsonData);

    // Calculate sizes
    const uncompressedSize = Buffer.byteLength(jsonData);
    const compressedSize = compressed.length;

    // Save to S3
    const s3Key = `backups/${backupId}/data.json.gz`;
    await s3.putObject({
      Bucket: BACKUP_BUCKET,
      Key: s3Key,
      Body: compressed,
      ContentType: 'application/gzip',
      ContentEncoding: 'gzip',
      Metadata: {
        'backup-id': backupId,
        'original-size': uncompressedSize.toString(),
        'compressed-size': compressedSize.toString()
      }
    }).promise();

    // Also save uncompressed JSON for download
    const downloadKey = `backups/${backupId}/data.json`;
    await s3.putObject({
      Bucket: BACKUP_BUCKET,
      Key: downloadKey,
      Body: jsonData,
      ContentType: 'application/json',
      Metadata: {
        'backup-id': backupId
      }
    }).promise();

    // Update backup metadata
    await updateBackupStatus(backupId, 'completed', {
      completedAt: new Date().toISOString(),
      s3Location: `s3://${BACKUP_BUCKET}/${s3Key}`,
      downloadLocation: `s3://${BACKUP_BUCKET}/${downloadKey}`,
      size: uncompressedSize,
      compressedSize: compressedSize,
      entityCount: Object.keys(backupData.entities).reduce((sum, key) => sum + backupData.entities[key].length, 0),
      progress: 100
    });

    // Log activity
    await logActivity('backup_created', backupId);

  } catch (error) {
    console.error('Backup failed:', error);
    await updateBackupStatus(backupId, 'failed', {
      failedAt: new Date().toISOString(),
      error: error.message
    });
    throw error;
  }
}

// Scan entity from DynamoDB
async function scanEntity(entityType) {
  const items = [];
  let lastEvaluatedKey = null;

  do {
    const params = {
      TableName: TABLE_NAME,
      FilterExpression: 'begins_with(PK, :pk)',
      ExpressionAttributeValues: {
        ':pk': entityType
      }
    };

    if (lastEvaluatedKey) {
      params.ExclusiveStartKey = lastEvaluatedKey;
    }

    const result = await dynamodb.scan(params).promise();
    items.push(...result.Items);
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return items;
}

// Update backup status
async function updateBackupStatus(backupId, status, additionalData = {}) {
  const updateExpression = ['SET #status = :status'];
  const expressionAttributeNames = { '#status': 'status' };
  const expressionAttributeValues = { ':status': status };

  Object.entries(additionalData).forEach(([key, value]) => {
    updateExpression.push(`#${key} = :${key}`);
    expressionAttributeNames[`#${key}`] = key;
    expressionAttributeValues[`:${key}`] = value;
  });

  await dynamodb.update({
    TableName: TABLE_NAME,
    Key: {
      PK: `BACKUP#${backupId}`,
      SK: 'METADATA'
    },
    UpdateExpression: updateExpression.join(', '),
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues
  }).promise();
}

// Restore from backup
async function restoreBackup(restoreData, user) {
  try {
    // Check permissions
    if (!hasPermission(user, 'backups.restore')) {
      return {
        statusCode: 403,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: 'Forbidden: Cannot restore backups' })
      };
    }

    const { backupId, uploadedData, entities: entitiesToRestore } = restoreData;
    let backupData;

    // Get backup data either from S3 or uploaded file
    if (backupId) {
      // Restore from saved backup
      const backup = await getBackupMetadata(backupId);
      if (!backup) {
        return {
          statusCode: 404,
          headers: CORS_HEADERS,
          body: JSON.stringify({ message: 'Backup not found' })
        };
      }

      // Download from S3
      const s3Key = `backups/${backupId}/data.json.gz`;
      const s3Object = await s3.getObject({
        Bucket: BACKUP_BUCKET,
        Key: s3Key
      }).promise();

      const decompressed = await gunzip(s3Object.Body);
      backupData = JSON.parse(decompressed.toString());
    } else if (uploadedData) {
      // Restore from uploaded file
      backupData = typeof uploadedData === 'string' ? JSON.parse(uploadedData) : uploadedData;
    } else {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: 'Either backupId or uploadedData must be provided' })
      };
    }

    // Create restore record
    const restoreId = uuidv4();
    const timestamp = new Date().toISOString();
    
    await dynamodb.put({
      TableName: TABLE_NAME,
      Item: {
        PK: `RESTORE#${restoreId}`,
        SK: 'METADATA',
        GSI1PK: 'RESTORE',
        GSI1SK: timestamp,
        restoreId,
        backupId: backupId || 'uploaded',
        status: 'in_progress',
        entities: entitiesToRestore || Object.keys(backupData.entities),
        restoredBy: user.userId,
        restoredByName: user.name || user.email,
        timestamp,
        createdAt: timestamp
      }
    }).promise();

    // Perform restore asynchronously
    await performRestore(restoreId, backupData, entitiesToRestore);

    return {
      statusCode: 201,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        restoreId,
        message: 'Restore initiated successfully',
        status: 'in_progress'
      })
    };
  } catch (error) {
    console.error('Error restoring backup:', error);
    throw error;
  }
}

// Perform the actual restore
async function performRestore(restoreId, backupData, entitiesToRestore) {
  try {
    const entities = entitiesToRestore || Object.keys(backupData.entities);
    let restoredCount = 0;

    for (const entity of entities) {
      if (!backupData.entities[entity]) continue;

      const items = backupData.entities[entity];
      console.log(`Restoring ${items.length} ${entity} items...`);

      // Batch write items
      for (let i = 0; i < items.length; i += 25) {
        const batch = items.slice(i, i + 25);
        const putRequests = batch.map(item => ({
          PutRequest: { Item: item }
        }));

        await dynamodb.batchWrite({
          RequestItems: {
            [TABLE_NAME]: putRequests
          }
        }).promise();

        restoredCount += batch.length;
      }

      // Update progress
      await dynamodb.update({
        TableName: TABLE_NAME,
        Key: {
          PK: `RESTORE#${restoreId}`,
          SK: 'METADATA'
        },
        UpdateExpression: 'SET #status = :status, progress = :progress',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':status': 'running',
          ':progress': Math.round((entities.indexOf(entity) + 1) / entities.length * 100)
        }
      }).promise();
    }

    // Update restore record
    await dynamodb.update({
      TableName: TABLE_NAME,
      Key: {
        PK: `RESTORE#${restoreId}`,
        SK: 'METADATA'
      },
      UpdateExpression: 'SET #status = :status, completedAt = :completedAt, restoredCount = :count, progress = :progress',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':status': 'completed',
        ':completedAt': new Date().toISOString(),
        ':count': restoredCount,
        ':progress': 100
      }
    }).promise();

    // Log activity
    await logActivity('backup_restored', restoreId);

  } catch (error) {
    console.error('Restore failed:', error);
    
    await dynamodb.update({
      TableName: TABLE_NAME,
      Key: {
        PK: `RESTORE#${restoreId}`,
        SK: 'METADATA'
      },
      UpdateExpression: 'SET #status = :status, failedAt = :failedAt, error = :error',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':status': 'failed',
        ':failedAt': new Date().toISOString(),
        ':error': error.message
      }
    }).promise();
    
    throw error;
  }
}

// List backups
async function listBackups(user, queryParams) {
  try {
    // Check permissions
    if (!hasPermission(user, 'backups.view')) {
      return {
        statusCode: 403,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: 'Forbidden: Cannot view backups' })
      };
    }

    const limit = parseInt(queryParams?.limit) || 20;
    const type = queryParams?.type; // manual, scheduled
    const status = queryParams?.status; // completed, failed, in_progress

    let params = {
      TableName: TABLE_NAME,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: {
        ':pk': 'BACKUP'
      },
      ScanIndexForward: false, // Newest first
      Limit: limit
    };

    // Add filters
    const filters = [];
    if (type) {
      filters.push('#type = :type');
      params.ExpressionAttributeNames = { ...params.ExpressionAttributeNames, '#type': 'type' };
      params.ExpressionAttributeValues[':type'] = type;
    }
    if (status) {
      filters.push('#status = :status');
      params.ExpressionAttributeNames = { ...params.ExpressionAttributeNames, '#status': 'status' };
      params.ExpressionAttributeValues[':status'] = status;
    }

    if (filters.length > 0) {
      params.FilterExpression = filters.join(' AND ');
    }

    const result = await dynamodb.query(params).promise();

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        backups: result.Items,
        count: result.Items.length,
        lastEvaluatedKey: result.LastEvaluatedKey
      })
    };
  } catch (error) {
    console.error('Error listing backups:', error);
    throw error;
  }
}

// Get backup details
async function getBackup(backupId, user) {
  try {
    // Check permissions
    if (!hasPermission(user, 'backups.view')) {
      return {
        statusCode: 403,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: 'Forbidden: Cannot view backups' })
      };
    }

    const backup = await getBackupMetadata(backupId);
    
    if (!backup) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: 'Backup not found' })
      };
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify(backup)
    };
  } catch (error) {
    console.error('Error getting backup:', error);
    throw error;
  }
}

// Download backup file
async function downloadBackup(backupId, user) {
  try {
    // Check permissions
    if (!hasPermission(user, 'backups.download')) {
      return {
        statusCode: 403,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: 'Forbidden: Cannot download backups' })
      };
    }

    const backup = await getBackupMetadata(backupId);
    
    if (!backup || backup.status !== 'completed') {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: 'Backup not found or not ready' })
      };
    }

    // Generate presigned URL for download
    const downloadKey = `backups/${backupId}/data.json`;
    const presignedUrl = await s3.getSignedUrlPromise('getObject', {
      Bucket: BACKUP_BUCKET,
      Key: downloadKey,
      Expires: 3600, // 1 hour
      ResponseContentDisposition: `attachment; filename="podcastflow-backup-${backup.timestamp.split('T')[0]}.json"`
    });

    // Log download activity
    await logActivity('backup_downloaded', backupId);

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        downloadUrl: presignedUrl,
        filename: `podcastflow-backup-${backup.timestamp.split('T')[0]}.json`,
        size: backup.size,
        expiresIn: 3600
      })
    };
  } catch (error) {
    console.error('Error downloading backup:', error);
    throw error;
  }
}

// Delete backup
async function deleteBackup(backupId, user) {
  try {
    // Check permissions
    if (!hasPermission(user, 'backups.delete')) {
      return {
        statusCode: 403,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: 'Forbidden: Cannot delete backups' })
      };
    }

    const backup = await getBackupMetadata(backupId);
    
    if (!backup) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: 'Backup not found' })
      };
    }

    // Delete from S3
    const objects = [
      { Key: `backups/${backupId}/data.json.gz` },
      { Key: `backups/${backupId}/data.json` }
    ];

    await s3.deleteObjects({
      Bucket: BACKUP_BUCKET,
      Delete: { Objects: objects }
    }).promise();

    // Delete metadata
    await dynamodb.delete({
      TableName: TABLE_NAME,
      Key: {
        PK: `BACKUP#${backupId}`,
        SK: 'METADATA'
      }
    }).promise();

    // Log activity
    await logActivity('backup_deleted', backupId);

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: 'Backup deleted successfully' })
    };
  } catch (error) {
    console.error('Error deleting backup:', error);
    throw error;
  }
}

// Update backup schedule
async function updateBackupSchedule(scheduleData, user) {
  try {
    // Check permissions
    if (!hasPermission(user, 'backups.schedule')) {
      return {
        statusCode: 403,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: 'Forbidden: Cannot manage backup schedules' })
      };
    }

    const { frequency, time, enabled, entities } = scheduleData;
    
    // Validate schedule
    if (!['daily', 'weekly', 'monthly'].includes(frequency)) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: 'Invalid frequency. Must be daily, weekly, or monthly' })
      };
    }

    // Create or update EventBridge rule
    const ruleName = `PodcastFlowPro-Backup-${frequency}`;
    const scheduleExpression = getScheduleExpression(frequency, time);

    if (enabled) {
      // Create/update rule
      await eventBridge.putRule({
        Name: ruleName,
        Description: `Automated ${frequency} backup for PodcastFlow Pro`,
        ScheduleExpression: scheduleExpression,
        State: 'ENABLED'
      }).promise();

      // Add Lambda target
      await eventBridge.putTargets({
        Rule: ruleName,
        Targets: [{
          Id: '1',
          Arn: process.env.AWS_LAMBDA_FUNCTION_ARN,
          Input: JSON.stringify({
            type: 'scheduled',
            frequency,
            entities: entities || BACKUP_ENTITIES
          })
        }]
      }).promise();
    } else {
      // Disable rule
      try {
        await eventBridge.disableRule({ Name: ruleName }).promise();
      } catch (error) {
        // Rule might not exist
        console.log('Rule not found, nothing to disable');
      }
    }

    // Save schedule configuration
    await dynamodb.put({
      TableName: TABLE_NAME,
      Item: {
        PK: 'BACKUP_SCHEDULE',
        SK: frequency.toUpperCase(),
        frequency,
        time,
        enabled,
        entities: entities || BACKUP_ENTITIES,
        updatedBy: user.userId,
        updatedAt: new Date().toISOString()
      }
    }).promise();

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        message: `Backup schedule ${enabled ? 'enabled' : 'disabled'} successfully`,
        schedule: {
          frequency,
          time,
          enabled,
          entities: entities || BACKUP_ENTITIES,
          nextRun: enabled ? getNextRunTime(frequency, time) : null
        }
      })
    };
  } catch (error) {
    console.error('Error updating backup schedule:', error);
    throw error;
  }
}

// Handle scheduled backup from EventBridge
async function handleScheduledBackup(event) {
  try {
    const { type, frequency, entities } = JSON.parse(event.detail || '{}');
    
    const backupId = uuidv4();
    const timestamp = new Date().toISOString();

    // Create backup metadata
    const backupMetadata = {
      PK: `BACKUP#${backupId}`,
      SK: 'METADATA',
      GSI1PK: 'BACKUP',
      GSI1SK: timestamp,
      backupId,
      name: `Scheduled ${frequency} backup - ${new Date().toLocaleString()}`,
      description: `Automated ${frequency} backup`,
      type: 'scheduled',
      frequency,
      status: 'in_progress',
      entities: entities || BACKUP_ENTITIES,
      createdBy: 'SYSTEM',
      createdByName: 'Automated Backup',
      timestamp,
      createdAt: timestamp
    };

    // Save metadata
    await dynamodb.put({
      TableName: TABLE_NAME,
      Item: backupMetadata
    }).promise();

    // Perform backup
    await performBackup(backupId, backupMetadata.entities);

    // Clean up old backups
    await cleanupOldBackups(frequency);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Scheduled backup completed successfully' })
    };
  } catch (error) {
    console.error('Scheduled backup failed:', error);
    throw error;
  }
}

// Utility functions
async function getBackupMetadata(backupId) {
  const result = await dynamodb.get({
    TableName: TABLE_NAME,
    Key: {
      PK: `BACKUP#${backupId}`,
      SK: 'METADATA'
    }
  }).promise();
  
  return result.Item;
}

function getScheduleExpression(frequency, time) {
  const [hour, minute] = time.split(':');
  
  switch (frequency) {
    case 'daily':
      return `cron(${minute} ${hour} * * ? *)`;
    case 'weekly':
      return `cron(${minute} ${hour} ? * SUN *)`;
    case 'monthly':
      return `cron(${minute} ${hour} 1 * ? *)`;
    default:
      throw new Error('Invalid frequency');
  }
}

function getNextRunTime(frequency, time) {
  const [hour, minute] = time.split(':').map(Number);
  const now = new Date();
  const next = new Date();
  
  next.setHours(hour, minute, 0, 0);
  
  switch (frequency) {
    case 'daily':
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }
      break;
    case 'weekly':
      next.setDate(next.getDate() + (7 - next.getDay()));
      if (next <= now) {
        next.setDate(next.getDate() + 7);
      }
      break;
    case 'monthly':
      next.setDate(1);
      if (next <= now) {
        next.setMonth(next.getMonth() + 1);
      }
      break;
  }
  
  return next.toISOString();
}

async function cleanupOldBackups(frequency) {
  // Keep different retention periods based on frequency
  const retentionDays = {
    daily: 7,
    weekly: 30,
    monthly: 365
  };
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays[frequency]);
  
  // Query old backups
  const oldBackups = await dynamodb.query({
    TableName: TABLE_NAME,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK < :cutoff',
    FilterExpression: '#type = :type AND frequency = :frequency',
    ExpressionAttributeNames: { '#type': 'type' },
    ExpressionAttributeValues: {
      ':pk': 'BACKUP',
      ':cutoff': cutoffDate.toISOString(),
      ':type': 'scheduled',
      ':frequency': frequency
    }
  }).promise();
  
  // Delete old backups
  for (const backup of oldBackups.Items) {
    await deleteBackup(backup.backupId, { userId: 'SYSTEM', role: 'admin' });
  }
}

async function logActivity(action, entityId) {
  try {
    await dynamodb.put({
      TableName: TABLE_NAME,
      Item: {
        PK: `ACTIVITY#${new Date().toISOString().split('T')[0]}`,
        SK: `ACTIVITY#${new Date().toISOString()}#${uuidv4()}`,
        GSI1PK: 'ACTIVITY',
        GSI1SK: new Date().toISOString(),
        type: 'backup_activity',
        action,
        entityType: 'backup',
        entityId,
        timestamp: new Date().toISOString(),
        ttl: Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60)
      }
    }).promise();
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
}

// Export handler with auth middleware
exports.handler = requireAuth(mainHandler);