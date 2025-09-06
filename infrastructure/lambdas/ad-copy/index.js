const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();

const TABLE_NAME = process.env.TABLE_NAME || 'PodcastFlowPro';
const BUCKET_NAME = process.env.BUCKET_NAME || 'podcastflow-adcopy-590183844530';
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
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
    const path = event.path;

    switch (httpMethod) {
      case 'GET':
        if (pathParameters?.copyId) {
          if (path.includes('/download')) {
            return await getDownloadUrl(pathParameters.copyId);
          }
          return await getCopy(pathParameters.copyId);
        }
        return await listCopies();

      case 'POST':
        if (path.includes('/duplicate')) {
          return await duplicateCopy(pathParameters.copyId);
        }
        return await createCopy(JSON.parse(body));

      case 'PUT':
        if (pathParameters?.copyId) {
          return await updateCopy(pathParameters.copyId, JSON.parse(body));
        }
        break;

      case 'DELETE':
        if (pathParameters?.copyId) {
          return await deleteCopy(pathParameters.copyId);
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

async function listCopies() {
  const params = {
    TableName: TABLE_NAME,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: {
      ':pk': 'AD_COPY'
    },
    ScanIndexForward: false
  };

  const result = await dynamodb.query(params).promise();
  
  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(result.Items)
  };
}

async function getCopy(copyId) {
  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: `COPY#${copyId}`,
      SK: `COPY#${copyId}`
    }
  };

  const result = await dynamodb.get(params).promise();
  
  if (!result.Item) {
    return {
      statusCode: 404,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: 'Ad copy not found' })
    };
  }

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(result.Item)
  };
}

async function createCopy(copyData) {
  const copyId = `CPY-${Date.now()}`;
  const timestamp = new Date().toISOString();

  const item = {
    PK: `COPY#${copyId}`,
    SK: `COPY#${copyId}`,
    GSI1PK: 'AD_COPY',
    GSI1SK: timestamp,
    id: copyId,
    ...copyData,
    version: '1.0',
    status: 'draft',
    versions: [],
    createdAt: timestamp,
    updatedAt: timestamp
  };

  // If it's an audio or video file, generate S3 upload URL
  if (copyData.type === 'audio' || copyData.type === 'video') {
    const key = `ad-copy/${copyId}/${copyData.fileName}`;
    const uploadUrl = await s3.getSignedUrlPromise('putObject', {
      Bucket: BUCKET_NAME,
      Key: key,
      Expires: 3600
    });
    item.uploadUrl = uploadUrl;
    item.s3Key = key;
  }

  const params = {
    TableName: TABLE_NAME,
    Item: item
  };

  await dynamodb.put(params).promise();

  return {
    statusCode: 201,
    headers: CORS_HEADERS,
    body: JSON.stringify(item)
  };
}

async function updateCopy(copyId, updateData) {
  const timestamp = new Date().toISOString();
  
  // Get current copy to preserve versions
  const currentCopy = await dynamodb.get({
    TableName: TABLE_NAME,
    Key: {
      PK: `COPY#${copyId}`,
      SK: `COPY#${copyId}`
    }
  }).promise();

  if (!currentCopy.Item) {
    return {
      statusCode: 404,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: 'Ad copy not found' })
    };
  }

  // Create version history
  const newVersion = {
    version: currentCopy.Item.version,
    updatedAt: currentCopy.Item.updatedAt,
    updatedBy: currentCopy.Item.updatedBy
  };

  const versions = [...(currentCopy.Item.versions || []), newVersion];
  const newVersionNumber = parseFloat(currentCopy.Item.version) + 0.1;

  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: `COPY#${copyId}`,
      SK: `COPY#${copyId}`
    },
    UpdateExpression: 'SET #data = :data, version = :version, versions = :versions, updatedAt = :updatedAt',
    ExpressionAttributeNames: {
      '#data': 'data'
    },
    ExpressionAttributeValues: {
      ':data': updateData,
      ':version': newVersionNumber.toFixed(1),
      ':versions': versions,
      ':updatedAt': timestamp
    },
    ReturnValues: 'ALL_NEW'
  };

  const result = await dynamodb.update(params).promise();

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(result.Attributes)
  };
}

async function duplicateCopy(copyId) {
  // Get original copy
  const original = await dynamodb.get({
    TableName: TABLE_NAME,
    Key: {
      PK: `COPY#${copyId}`,
      SK: `COPY#${copyId}`
    }
  }).promise();

  if (!original.Item) {
    return {
      statusCode: 404,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: 'Ad copy not found' })
    };
  }

  // Create new copy
  const newCopyId = `CPY-${Date.now()}`;
  const timestamp = new Date().toISOString();

  const newItem = {
    ...original.Item,
    PK: `COPY#${newCopyId}`,
    SK: `COPY#${newCopyId}`,
    id: newCopyId,
    title: `${original.Item.title} (Copy)`,
    version: '1.0',
    versions: [],
    createdAt: timestamp,
    updatedAt: timestamp,
    duplicatedFrom: copyId
  };

  const params = {
    TableName: TABLE_NAME,
    Item: newItem
  };

  await dynamodb.put(params).promise();

  return {
    statusCode: 201,
    headers: CORS_HEADERS,
    body: JSON.stringify(newItem)
  };
}

async function getDownloadUrl(copyId) {
  // Get copy details
  const copy = await dynamodb.get({
    TableName: TABLE_NAME,
    Key: {
      PK: `COPY#${copyId}`,
      SK: `COPY#${copyId}`
    }
  }).promise();

  if (!copy.Item || !copy.Item.s3Key) {
    return {
      statusCode: 404,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: 'File not found' })
    };
  }

  const downloadUrl = await s3.getSignedUrlPromise('getObject', {
    Bucket: BUCKET_NAME,
    Key: copy.Item.s3Key,
    Expires: 3600
  });

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({ downloadUrl })
  };
}

async function deleteCopy(copyId) {
  // Get copy to check if we need to delete S3 file
  const copy = await dynamodb.get({
    TableName: TABLE_NAME,
    Key: {
      PK: `COPY#${copyId}`,
      SK: `COPY#${copyId}`
    }
  }).promise();

  if (copy.Item && copy.Item.s3Key) {
    // Delete S3 file
    await s3.deleteObject({
      Bucket: BUCKET_NAME,
      Key: copy.Item.s3Key
    }).promise();
  }

  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: `COPY#${copyId}`,
      SK: `COPY#${copyId}`
    }
  };

  await dynamodb.delete(params).promise();

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({ message: 'Ad copy deleted successfully' })
  };
}
