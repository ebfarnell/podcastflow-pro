#!/bin/bash

# Create Lambda functions for all new modules

# 1. Insertion Orders Lambda
cat > insertion-orders/index.js << 'EOF'
const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

const TABLE_NAME = process.env.TABLE_NAME || 'PodcastFlowPro';
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
        if (pathParameters?.orderId) {
          return await getOrder(pathParameters.orderId);
        }
        return await listOrders();

      case 'POST':
        return await createOrder(JSON.parse(body));

      case 'PUT':
        if (pathParameters?.orderId) {
          return await updateOrder(pathParameters.orderId, JSON.parse(body));
        }
        break;

      case 'DELETE':
        if (pathParameters?.orderId) {
          return await deleteOrder(pathParameters.orderId);
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

async function listOrders() {
  const params = {
    TableName: TABLE_NAME,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: {
      ':pk': 'INSERTION_ORDER'
    }
  };

  const result = await dynamodb.query(params).promise();
  
  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(result.Items)
  };
}

async function getOrder(orderId) {
  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: `ORDER#${orderId}`,
      SK: `ORDER#${orderId}`
    }
  };

  const result = await dynamodb.get(params).promise();
  
  if (!result.Item) {
    return {
      statusCode: 404,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: 'Order not found' })
    };
  }

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(result.Item)
  };
}

async function createOrder(orderData) {
  const orderId = `IO-${Date.now()}`;
  const timestamp = new Date().toISOString();

  const item = {
    PK: `ORDER#${orderId}`,
    SK: `ORDER#${orderId}`,
    GSI1PK: 'INSERTION_ORDER',
    GSI1SK: timestamp,
    id: orderId,
    ...orderData,
    createdAt: timestamp,
    updatedAt: timestamp
  };

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

async function updateOrder(orderId, updateData) {
  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: `ORDER#${orderId}`,
      SK: `ORDER#${orderId}`
    },
    UpdateExpression: 'SET #data = :data, updatedAt = :updatedAt',
    ExpressionAttributeNames: {
      '#data': 'data'
    },
    ExpressionAttributeValues: {
      ':data': updateData,
      ':updatedAt': new Date().toISOString()
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

async function deleteOrder(orderId) {
  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: `ORDER#${orderId}`,
      SK: `ORDER#${orderId}`
    }
  };

  await dynamodb.delete(params).promise();

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({ message: 'Order deleted successfully' })
  };
}
EOF

# 2. Agencies Lambda
cat > agencies/index.js << 'EOF'
const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

const TABLE_NAME = process.env.TABLE_NAME || 'PodcastFlowPro';
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

    switch (httpMethod) {
      case 'GET':
        if (pathParameters?.agencyId) {
          return await getAgency(pathParameters.agencyId);
        }
        return await listAgencies();

      case 'POST':
        return await createAgency(JSON.parse(body));

      case 'PUT':
        if (pathParameters?.agencyId) {
          return await updateAgency(pathParameters.agencyId, JSON.parse(body));
        }
        break;

      case 'DELETE':
        if (pathParameters?.agencyId) {
          return await deleteAgency(pathParameters.agencyId);
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

async function listAgencies() {
  const params = {
    TableName: TABLE_NAME,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: {
      ':pk': 'AGENCY'
    }
  };

  const result = await dynamodb.query(params).promise();
  
  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(result.Items)
  };
}

async function getAgency(agencyId) {
  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: `AGENCY#${agencyId}`,
      SK: `AGENCY#${agencyId}`
    }
  };

  const result = await dynamodb.get(params).promise();
  
  if (!result.Item) {
    return {
      statusCode: 404,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: 'Agency not found' })
    };
  }

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(result.Item)
  };
}

async function createAgency(agencyData) {
  const agencyId = `AGN-${Date.now()}`;
  const timestamp = new Date().toISOString();

  const item = {
    PK: `AGENCY#${agencyId}`,
    SK: `AGENCY#${agencyId}`,
    GSI1PK: 'AGENCY',
    GSI1SK: agencyData.name,
    id: agencyId,
    ...agencyData,
    status: 'pending',
    createdAt: timestamp,
    updatedAt: timestamp
  };

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

async function updateAgency(agencyId, updateData) {
  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: `AGENCY#${agencyId}`,
      SK: `AGENCY#${agencyId}`
    },
    UpdateExpression: 'SET #data = :data, updatedAt = :updatedAt',
    ExpressionAttributeNames: {
      '#data': 'data'
    },
    ExpressionAttributeValues: {
      ':data': updateData,
      ':updatedAt': new Date().toISOString()
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

async function deleteAgency(agencyId) {
  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: `AGENCY#${agencyId}`,
      SK: `AGENCY#${agencyId}`
    }
  };

  await dynamodb.delete(params).promise();

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({ message: 'Agency deleted successfully' })
  };
}
EOF

# 3. Advertisers Lambda
cat > advertisers/index.js << 'EOF'
const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

const TABLE_NAME = process.env.TABLE_NAME || 'PodcastFlowPro';
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

    switch (httpMethod) {
      case 'GET':
        if (pathParameters?.advertiserId) {
          return await getAdvertiser(pathParameters.advertiserId);
        }
        return await listAdvertisers();

      case 'POST':
        return await createAdvertiser(JSON.parse(body));

      case 'PUT':
        if (pathParameters?.advertiserId) {
          return await updateAdvertiser(pathParameters.advertiserId, JSON.parse(body));
        }
        break;

      case 'DELETE':
        if (pathParameters?.advertiserId) {
          return await deleteAdvertiser(pathParameters.advertiserId);
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

async function listAdvertisers() {
  const params = {
    TableName: TABLE_NAME,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: {
      ':pk': 'ADVERTISER'
    }
  };

  const result = await dynamodb.query(params).promise();
  
  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(result.Items)
  };
}

async function getAdvertiser(advertiserId) {
  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: `ADVERTISER#${advertiserId}`,
      SK: `ADVERTISER#${advertiserId}`
    }
  };

  const result = await dynamodb.get(params).promise();
  
  if (!result.Item) {
    return {
      statusCode: 404,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: 'Advertiser not found' })
    };
  }

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(result.Item)
  };
}

async function createAdvertiser(advertiserData) {
  const advertiserId = `ADV-${Date.now()}`;
  const timestamp = new Date().toISOString();

  const item = {
    PK: `ADVERTISER#${advertiserId}`,
    SK: `ADVERTISER#${advertiserId}`,
    GSI1PK: 'ADVERTISER',
    GSI1SK: advertiserData.name,
    id: advertiserId,
    ...advertiserData,
    status: 'active',
    createdAt: timestamp,
    updatedAt: timestamp
  };

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

async function updateAdvertiser(advertiserId, updateData) {
  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: `ADVERTISER#${advertiserId}`,
      SK: `ADVERTISER#${advertiserId}`
    },
    UpdateExpression: 'SET #data = :data, updatedAt = :updatedAt',
    ExpressionAttributeNames: {
      '#data': 'data'
    },
    ExpressionAttributeValues: {
      ':data': updateData,
      ':updatedAt': new Date().toISOString()
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

async function deleteAdvertiser(advertiserId) {
  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: `ADVERTISER#${advertiserId}`,
      SK: `ADVERTISER#${advertiserId}`
    }
  };

  await dynamodb.delete(params).promise();

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({ message: 'Advertiser deleted successfully' })
  };
}
EOF

# 4. Shows Lambda
cat > shows/index.js << 'EOF'
const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

const TABLE_NAME = process.env.TABLE_NAME || 'PodcastFlowPro';
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

    switch (httpMethod) {
      case 'GET':
        if (pathParameters?.showId) {
          return await getShow(pathParameters.showId);
        }
        return await listShows();

      case 'POST':
        return await createShow(JSON.parse(body));

      case 'PUT':
        if (pathParameters?.showId) {
          return await updateShow(pathParameters.showId, JSON.parse(body));
        }
        break;

      case 'DELETE':
        if (pathParameters?.showId) {
          return await deleteShow(pathParameters.showId);
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

async function listShows() {
  const params = {
    TableName: TABLE_NAME,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: {
      ':pk': 'SHOW'
    }
  };

  const result = await dynamodb.query(params).promise();
  
  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(result.Items)
  };
}

async function getShow(showId) {
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

  // Get episodes for this show
  const episodesParams = {
    TableName: TABLE_NAME,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': `SHOW#${showId}`,
      ':sk': 'EPISODE#'
    }
  };

  const episodesResult = await dynamodb.query(episodesParams).promise();
  result.Item.episodes = episodesResult.Items;

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(result.Item)
  };
}

async function createShow(showData) {
  const showId = `SHW-${Date.now()}`;
  const timestamp = new Date().toISOString();

  const item = {
    PK: `SHOW#${showId}`,
    SK: `SHOW#${showId}`,
    GSI1PK: 'SHOW',
    GSI1SK: showData.name,
    id: showId,
    ...showData,
    status: 'active',
    episodes: 0,
    subscribers: 0,
    createdAt: timestamp,
    updatedAt: timestamp
  };

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

async function updateShow(showId, updateData) {
  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: `SHOW#${showId}`,
      SK: `SHOW#${showId}`
    },
    UpdateExpression: 'SET #data = :data, updatedAt = :updatedAt',
    ExpressionAttributeNames: {
      '#data': 'data'
    },
    ExpressionAttributeValues: {
      ':data': updateData,
      ':updatedAt': new Date().toISOString()
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

async function deleteShow(showId) {
  // Delete show and all its episodes
  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: `SHOW#${showId}`,
      SK: `SHOW#${showId}`
    }
  };

  await dynamodb.delete(params).promise();

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({ message: 'Show deleted successfully' })
  };
}
EOF

# 5. Episodes Lambda
cat > episodes/index.js << 'EOF'
const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

const TABLE_NAME = process.env.TABLE_NAME || 'PodcastFlowPro';
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
    const { httpMethod, pathParameters, body, queryStringParameters } = event;

    switch (httpMethod) {
      case 'GET':
        if (pathParameters?.episodeId) {
          return await getEpisode(pathParameters.showId, pathParameters.episodeId);
        }
        return await listEpisodes(queryStringParameters);

      case 'POST':
        return await createEpisode(JSON.parse(body));

      case 'PUT':
        if (pathParameters?.episodeId) {
          return await updateEpisode(pathParameters.showId, pathParameters.episodeId, JSON.parse(body));
        }
        break;

      case 'DELETE':
        if (pathParameters?.episodeId) {
          return await deleteEpisode(pathParameters.showId, pathParameters.episodeId);
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

async function listEpisodes(queryParams) {
  const showId = queryParams?.showId;
  
  let params;
  if (showId) {
    // Get episodes for specific show
    params = {
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `SHOW#${showId}`,
        ':sk': 'EPISODE#'
      }
    };
  } else {
    // Get all recent episodes
    params = {
      TableName: TABLE_NAME,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: {
        ':pk': 'EPISODE'
      },
      ScanIndexForward: false,
      Limit: 50
    };
  }

  const result = await dynamodb.query(params).promise();
  
  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(result.Items)
  };
}

async function getEpisode(showId, episodeId) {
  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: `SHOW#${showId}`,
      SK: `EPISODE#${episodeId}`
    }
  };

  const result = await dynamodb.get(params).promise();
  
  if (!result.Item) {
    return {
      statusCode: 404,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: 'Episode not found' })
    };
  }

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(result.Item)
  };
}

async function createEpisode(episodeData) {
  const episodeId = `EP-${Date.now()}`;
  const timestamp = new Date().toISOString();

  const item = {
    PK: `SHOW#${episodeData.showId}`,
    SK: `EPISODE#${episodeId}`,
    GSI1PK: 'EPISODE',
    GSI1SK: timestamp,
    id: episodeId,
    ...episodeData,
    status: 'draft',
    downloads: 0,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  const params = {
    TableName: TABLE_NAME,
    Item: item
  };

  await dynamodb.put(params).promise();

  // Update show episode count
  await dynamodb.update({
    TableName: TABLE_NAME,
    Key: {
      PK: `SHOW#${episodeData.showId}`,
      SK: `SHOW#${episodeData.showId}`
    },
    UpdateExpression: 'SET episodes = episodes + :inc',
    ExpressionAttributeValues: {
      ':inc': 1
    }
  }).promise();

  return {
    statusCode: 201,
    headers: CORS_HEADERS,
    body: JSON.stringify(item)
  };
}

async function updateEpisode(showId, episodeId, updateData) {
  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: `SHOW#${showId}`,
      SK: `EPISODE#${episodeId}`
    },
    UpdateExpression: 'SET #data = :data, updatedAt = :updatedAt',
    ExpressionAttributeNames: {
      '#data': 'data'
    },
    ExpressionAttributeValues: {
      ':data': updateData,
      ':updatedAt': new Date().toISOString()
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

async function deleteEpisode(showId, episodeId) {
  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: `SHOW#${showId}`,
      SK: `EPISODE#${episodeId}`
    }
  };

  await dynamodb.delete(params).promise();

  // Update show episode count
  await dynamodb.update({
    TableName: TABLE_NAME,
    Key: {
      PK: `SHOW#${showId}`,
      SK: `SHOW#${showId}`
    },
    UpdateExpression: 'SET episodes = episodes - :dec',
    ExpressionAttributeValues: {
      ':dec': 1
    }
  }).promise();

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({ message: 'Episode deleted successfully' })
  };
}
EOF

# 6. Availability Lambda
cat > availability/index.js << 'EOF'
const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

const TABLE_NAME = process.env.TABLE_NAME || 'PodcastFlowPro';
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
    const { httpMethod, pathParameters, body, queryStringParameters } = event;

    switch (httpMethod) {
      case 'GET':
        if (pathParameters?.slotId) {
          return await getSlot(pathParameters.slotId);
        }
        return await listAvailableSlots(queryStringParameters);

      case 'POST':
        if (event.path.includes('/reserve')) {
          return await reserveSlot(JSON.parse(body));
        }
        return await createSlot(JSON.parse(body));

      case 'PUT':
        if (pathParameters?.slotId) {
          return await updateSlot(pathParameters.slotId, JSON.parse(body));
        }
        break;

      case 'DELETE':
        if (pathParameters?.slotId) {
          return await deleteSlot(pathParameters.slotId);
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

async function listAvailableSlots(queryParams) {
  const status = queryParams?.status || 'available';
  
  const params = {
    TableName: TABLE_NAME,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk',
    FilterExpression: '#status = :status',
    ExpressionAttributeNames: {
      '#status': 'status'
    },
    ExpressionAttributeValues: {
      ':pk': 'AD_SLOT',
      ':status': status
    }
  };

  const result = await dynamodb.query(params).promise();
  
  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(result.Items)
  };
}

async function getSlot(slotId) {
  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: `SLOT#${slotId}`,
      SK: `SLOT#${slotId}`
    }
  };

  const result = await dynamodb.get(params).promise();
  
  if (!result.Item) {
    return {
      statusCode: 404,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: 'Slot not found' })
    };
  }

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(result.Item)
  };
}

async function createSlot(slotData) {
  const slotId = `SLOT-${Date.now()}`;
  const timestamp = new Date().toISOString();

  const item = {
    PK: `SLOT#${slotId}`,
    SK: `SLOT#${slotId}`,
    GSI1PK: 'AD_SLOT',
    GSI1SK: `${slotData.publishDate}#${slotId}`,
    id: slotId,
    ...slotData,
    status: 'available',
    createdAt: timestamp,
    updatedAt: timestamp
  };

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

async function reserveSlot(reservationData) {
  const { slotId, advertiserId, campaignId } = reservationData;
  
  // Update slot status to reserved
  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: `SLOT#${slotId}`,
      SK: `SLOT#${slotId}`
    },
    UpdateExpression: 'SET #status = :status, advertiserId = :advertiserId, campaignId = :campaignId, reservedAt = :timestamp',
    ExpressionAttributeNames: {
      '#status': 'status'
    },
    ExpressionAttributeValues: {
      ':status': 'reserved',
      ':advertiserId': advertiserId,
      ':campaignId': campaignId,
      ':timestamp': new Date().toISOString()
    },
    ConditionExpression: '#status = :available',
    ReturnValues: 'ALL_NEW'
  };

  try {
    const result = await dynamodb.update(params).promise();
    
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify(result.Attributes)
    };
  } catch (error) {
    if (error.code === 'ConditionalCheckFailedException') {
      return {
        statusCode: 409,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: 'Slot is no longer available' })
      };
    }
    throw error;
  }
}

async function updateSlot(slotId, updateData) {
  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: `SLOT#${slotId}`,
      SK: `SLOT#${slotId}`
    },
    UpdateExpression: 'SET #data = :data, updatedAt = :updatedAt',
    ExpressionAttributeNames: {
      '#data': 'data'
    },
    ExpressionAttributeValues: {
      ':data': updateData,
      ':updatedAt': new Date().toISOString()
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

async function deleteSlot(slotId) {
  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: `SLOT#${slotId}`,
      SK: `SLOT#${slotId}`
    }
  };

  await dynamodb.delete(params).promise();

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({ message: 'Slot deleted successfully' })
  };
}
EOF

# 7. Ad Approvals Lambda
cat > ad-approvals/index.js << 'EOF'
const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

const TABLE_NAME = process.env.TABLE_NAME || 'PodcastFlowPro';
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
        if (pathParameters?.approvalId) {
          return await getApproval(pathParameters.approvalId);
        }
        return await listApprovals();

      case 'POST':
        if (path.includes('/approve')) {
          return await approveAd(pathParameters.approvalId, JSON.parse(body));
        } else if (path.includes('/reject')) {
          return await rejectAd(pathParameters.approvalId, JSON.parse(body));
        } else if (path.includes('/revision')) {
          return await requestRevision(pathParameters.approvalId, JSON.parse(body));
        }
        return await createApproval(JSON.parse(body));

      case 'PUT':
        if (pathParameters?.approvalId) {
          return await updateApproval(pathParameters.approvalId, JSON.parse(body));
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

async function listApprovals() {
  const params = {
    TableName: TABLE_NAME,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: {
      ':pk': 'AD_APPROVAL'
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

async function getApproval(approvalId) {
  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: `APPROVAL#${approvalId}`,
      SK: `APPROVAL#${approvalId}`
    }
  };

  const result = await dynamodb.get(params).promise();
  
  if (!result.Item) {
    return {
      statusCode: 404,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: 'Approval not found' })
    };
  }

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(result.Item)
  };
}

async function createApproval(approvalData) {
  const approvalId = `APR-${Date.now()}`;
  const timestamp = new Date().toISOString();

  const item = {
    PK: `APPROVAL#${approvalId}`,
    SK: `APPROVAL#${approvalId}`,
    GSI1PK: 'AD_APPROVAL',
    GSI1SK: timestamp,
    id: approvalId,
    ...approvalData,
    status: 'pending',
    revisionCount: 0,
    history: [],
    createdAt: timestamp,
    updatedAt: timestamp
  };

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

async function approveAd(approvalId, data) {
  const timestamp = new Date().toISOString();
  
  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: `APPROVAL#${approvalId}`,
      SK: `APPROVAL#${approvalId}`
    },
    UpdateExpression: 'SET #status = :status, approvedBy = :approvedBy, approvedAt = :timestamp, updatedAt = :timestamp, history = list_append(history, :history)',
    ExpressionAttributeNames: {
      '#status': 'status'
    },
    ExpressionAttributeValues: {
      ':status': 'approved',
      ':approvedBy': data.approvedBy,
      ':timestamp': timestamp,
      ':history': [{
        action: 'approved',
        by: data.approvedBy,
        at: timestamp,
        comment: data.comment
      }]
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

async function rejectAd(approvalId, data) {
  const timestamp = new Date().toISOString();
  
  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: `APPROVAL#${approvalId}`,
      SK: `APPROVAL#${approvalId}`
    },
    UpdateExpression: 'SET #status = :status, rejectedBy = :rejectedBy, rejectedAt = :timestamp, updatedAt = :timestamp, history = list_append(history, :history)',
    ExpressionAttributeNames: {
      '#status': 'status'
    },
    ExpressionAttributeValues: {
      ':status': 'rejected',
      ':rejectedBy': data.rejectedBy,
      ':timestamp': timestamp,
      ':history': [{
        action: 'rejected',
        by: data.rejectedBy,
        at: timestamp,
        reason: data.reason
      }]
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

async function requestRevision(approvalId, data) {
  const timestamp = new Date().toISOString();
  
  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: `APPROVAL#${approvalId}`,
      SK: `APPROVAL#${approvalId}`
    },
    UpdateExpression: 'SET #status = :status, revisionCount = revisionCount + :inc, updatedAt = :timestamp, history = list_append(history, :history)',
    ExpressionAttributeNames: {
      '#status': 'status'
    },
    ExpressionAttributeValues: {
      ':status': 'revision',
      ':inc': 1,
      ':timestamp': timestamp,
      ':history': [{
        action: 'revision_requested',
        by: data.requestedBy,
        at: timestamp,
        feedback: data.feedback
      }]
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

async function updateApproval(approvalId, updateData) {
  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: `APPROVAL#${approvalId}`,
      SK: `APPROVAL#${approvalId}`
    },
    UpdateExpression: 'SET #data = :data, updatedAt = :updatedAt',
    ExpressionAttributeNames: {
      '#data': 'data'
    },
    ExpressionAttributeValues: {
      ':data': updateData,
      ':updatedAt': new Date().toISOString()
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
EOF

# 8. Ad Copy Lambda
cat > ad-copy/index.js << 'EOF'
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
EOF

# 9. Contracts Lambda
cat > contracts/index.js << 'EOF'
const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

const TABLE_NAME = process.env.TABLE_NAME || 'PodcastFlowPro';
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

    switch (httpMethod) {
      case 'GET':
        if (pathParameters?.contractId) {
          return await getContract(pathParameters.contractId);
        }
        return await listContracts();

      case 'POST':
        return await createContract(JSON.parse(body));

      case 'PUT':
        if (pathParameters?.contractId) {
          return await updateContract(pathParameters.contractId, JSON.parse(body));
        }
        break;

      case 'DELETE':
        if (pathParameters?.contractId) {
          return await deleteContract(pathParameters.contractId);
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

async function listContracts() {
  const params = {
    TableName: TABLE_NAME,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: {
      ':pk': 'CONTRACT'
    }
  };

  const result = await dynamodb.query(params).promise();
  
  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(result.Items)
  };
}

async function getContract(contractId) {
  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: `CONTRACT#${contractId}`,
      SK: `CONTRACT#${contractId}`
    }
  };

  const result = await dynamodb.get(params).promise();
  
  if (!result.Item) {
    return {
      statusCode: 404,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: 'Contract not found' })
    };
  }

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(result.Item)
  };
}

async function createContract(contractData) {
  const contractId = `CTR-${Date.now()}`;
  const timestamp = new Date().toISOString();

  const item = {
    PK: `CONTRACT#${contractId}`,
    SK: `CONTRACT#${contractId}`,
    GSI1PK: 'CONTRACT',
    GSI1SK: contractData.startDate,
    id: contractId,
    ...contractData,
    status: 'draft',
    progress: 0,
    signedBy: [],
    createdAt: timestamp,
    updatedAt: timestamp
  };

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

async function updateContract(contractId, updateData) {
  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: `CONTRACT#${contractId}`,
      SK: `CONTRACT#${contractId}`
    },
    UpdateExpression: 'SET #data = :data, updatedAt = :updatedAt',
    ExpressionAttributeNames: {
      '#data': 'data'
    },
    ExpressionAttributeValues: {
      ':data': updateData,
      ':updatedAt': new Date().toISOString()
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

async function deleteContract(contractId) {
  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: `CONTRACT#${contractId}`,
      SK: `CONTRACT#${contractId}`
    }
  };

  await dynamodb.delete(params).promise();

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({ message: 'Contract deleted successfully' })
  };
}
EOF

# 10. Reports Lambda
cat > reports/index.js << 'EOF'
const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

const TABLE_NAME = process.env.TABLE_NAME || 'PodcastFlowPro';
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
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
    const { httpMethod, queryStringParameters } = event;
    const path = event.path;

    switch (httpMethod) {
      case 'GET':
        if (path.includes('/revenue')) {
          return await getRevenueReport(queryStringParameters);
        } else if (path.includes('/performance')) {
          return await getPerformanceReport(queryStringParameters);
        } else if (path.includes('/audience')) {
          return await getAudienceReport(queryStringParameters);
        } else if (path.includes('/campaigns')) {
          return await getCampaignReport(queryStringParameters);
        }
        return await getReportsSummary();

      case 'POST':
        if (path.includes('/schedule')) {
          return await scheduleReport(JSON.parse(event.body));
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

async function getReportsSummary() {
  // Get key metrics
  const metrics = {
    totalRevenue: 1250000,
    totalImpressions: 15200000,
    avgCTR: 3.8,
    activeCampaigns: 48,
    monthlyGrowth: 23,
    topPerformingShow: 'The Tech Review Show',
    topAdvertiser: 'TechCorp Inc.'
  };

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(metrics)
  };
}

async function getRevenueReport(queryParams) {
  const dateRange = queryParams?.dateRange || 'last30days';
  
  // Generate mock revenue data
  const revenueData = {
    total: 1250000,
    byMonth: [
      { month: 'Jan', revenue: 145000, target: 150000 },
      { month: 'Feb', revenue: 162000, target: 160000 },
      { month: 'Mar', revenue: 178000, target: 170000 },
      { month: 'Apr', revenue: 195000, target: 180000 },
      { month: 'May', revenue: 210000, target: 190000 },
      { month: 'Jun', revenue: 225000, target: 200000 }
    ],
    bySource: [
      { source: 'Direct Advertisers', amount: 650000, percentage: 52 },
      { source: 'Agency Partners', amount: 425000, percentage: 34 },
      { source: 'Programmatic', amount: 175000, percentage: 14 }
    ],
    topCampaigns: [
      { campaign: 'Q1 Tech Launch', advertiser: 'TechCorp', revenue: 45000 },
      { campaign: 'Winter Wellness', advertiser: 'HealthPlus', revenue: 38000 },
      { campaign: 'Auto Safety 2024', advertiser: 'AutoDrive', revenue: 32000 }
    ]
  };

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(revenueData)
  };
}

async function getPerformanceReport(queryParams) {
  const showId = queryParams?.showId;
  
  const performanceData = {
    shows: [
      { name: 'Tech Review Show', revenue: 45230, impressions: 892000, ctr: 4.2 },
      { name: 'Business Insights', revenue: 38150, impressions: 743000, ctr: 3.8 },
      { name: 'Health & Wellness', revenue: 32890, impressions: 651000, ctr: 3.5 }
    ],
    impressionsTrend: [
      { date: '2024-01-01', impressions: 450000 },
      { date: '2024-01-02', impressions: 480000 },
      { date: '2024-01-03', impressions: 520000 },
      { date: '2024-01-04', impressions: 510000 },
      { date: '2024-01-05', impressions: 550000 }
    ],
    conversionMetrics: {
      totalClicks: 578000,
      totalConversions: 23120,
      conversionRate: 4.0
    }
  };

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(performanceData)
  };
}

async function getAudienceReport(queryParams) {
  const audienceData = {
    demographics: {
      ageGroups: [
        { range: '18-24', percentage: 15 },
        { range: '25-34', percentage: 35 },
        { range: '35-44', percentage: 28 },
        { range: '45-54', percentage: 15 },
        { range: '55+', percentage: 7 }
      ],
      gender: [
        { type: 'Male', percentage: 58 },
        { type: 'Female', percentage: 40 },
        { type: 'Other', percentage: 2 }
      ],
      locations: [
        { location: 'United States', percentage: 65 },
        { location: 'Canada', percentage: 15 },
        { location: 'United Kingdom', percentage: 10 },
        { location: 'Australia', percentage: 5 },
        { location: 'Other', percentage: 5 }
      ]
    },
    interests: [
      { category: 'Technology', score: 92 },
      { category: 'Business', score: 78 },
      { category: 'Health & Fitness', score: 65 },
      { category: 'Entertainment', score: 54 },
      { category: 'Sports', score: 42 }
    ],
    engagement: {
      avgListenDuration: '32:45',
      completionRate: 78,
      shareRate: 12,
      subscriptionRate: 24
    }
  };

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(audienceData)
  };
}

async function getCampaignReport(queryParams) {
  const campaignId = queryParams?.campaignId;
  
  const campaignData = {
    campaigns: [
      {
        id: '1',
        name: 'Q1 Tech Launch',
        advertiser: 'TechCorp',
        status: 'active',
        impressions: 2500000,
        clicks: 95000,
        ctr: 3.8,
        conversions: 3800,
        revenue: 45000,
        roi: 285,
        startDate: '2024-01-01',
        endDate: '2024-03-31'
      },
      {
        id: '2',
        name: 'Winter Wellness',
        advertiser: 'HealthPlus',
        status: 'active',
        impressions: 1800000,
        clicks: 72000,
        ctr: 4.0,
        conversions: 2880,
        revenue: 38000,
        roi: 310,
        startDate: '2024-01-15',
        endDate: '2024-02-28'
      }
    ],
    summary: {
      totalCampaigns: 48,
      activeCampaigns: 35,
      completedCampaigns: 10,
      scheduledCampaigns: 3,
      avgROI: 287,
      totalRevenue: 1250000
    }
  };

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(campaignData)
  };
}

async function scheduleReport(scheduleData) {
  const reportId = `RPT-${Date.now()}`;
  const timestamp = new Date().toISOString();

  const item = {
    PK: `REPORT#${reportId}`,
    SK: `REPORT#${reportId}`,
    GSI1PK: 'SCHEDULED_REPORT',
    GSI1SK: scheduleData.nextRun,
    id: reportId,
    ...scheduleData,
    status: 'scheduled',
    createdAt: timestamp,
    updatedAt: timestamp
  };

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
EOF

# 11. Financials Lambda
cat > financials/index.js << 'EOF'
const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

const TABLE_NAME = process.env.TABLE_NAME || 'PodcastFlowPro';
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS'
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
    const { httpMethod, queryStringParameters, body } = event;
    const path = event.path;

    switch (httpMethod) {
      case 'GET':
        if (path.includes('/transactions')) {
          return await getTransactions(queryStringParameters);
        } else if (path.includes('/invoices')) {
          return await getInvoices(queryStringParameters);
        } else if (path.includes('/payments')) {
          return await getPayments(queryStringParameters);
        } else if (path.includes('/cashflow')) {
          return await getCashFlow(queryStringParameters);
        }
        return await getFinancialsSummary();

      case 'POST':
        if (path.includes('/invoices')) {
          return await createInvoice(JSON.parse(body));
        } else if (path.includes('/payments')) {
          return await recordPayment(JSON.parse(body));
        }
        break;

      case 'PUT':
        if (path.includes('/invoices')) {
          return await updateInvoice(JSON.parse(body));
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

async function getFinancialsSummary() {
  const summary = {
    totalRevenue: 1250000,
    totalExpenses: 750000,
    netProfit: 500000,
    profitMargin: 40,
    outstandingInvoices: 75500,
    monthlyRecurring: 185000,
    cashOnHand: 425000,
    accountsReceivable: 125000,
    accountsPayable: 45000
  };

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(summary)
  };
}

async function getTransactions(queryParams) {
  const dateRange = queryParams?.dateRange || 'thisMonth';
  
  const transactions = [
    {
      id: 'TXN-001',
      date: '2024-01-08',
      description: 'Payment from TechCorp - Q1 Campaign',
      type: 'income',
      category: 'advertising_revenue',
      amount: 45000,
      status: 'completed',
      client: 'TechCorp Inc.',
      invoiceId: 'INV-1234'
    },
    {
      id: 'TXN-002',
      date: '2024-01-07',
      description: 'Commission to Digital Media Agency',
      type: 'expense',
      category: 'commission',
      amount: 6750,
      status: 'completed',
      vendor: 'Digital Media Agency'
    },
    {
      id: 'TXN-003',
      date: '2024-01-06',
      description: 'Payment from HealthPlus - January',
      type: 'income',
      category: 'advertising_revenue',
      amount: 38000,
      status: 'pending',
      client: 'HealthPlus',
      invoiceId: 'INV-1235'
    }
  ];

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(transactions)
  };
}

async function getInvoices(queryParams) {
  const status = queryParams?.status || 'all';
  
  const invoices = [
    {
      id: 'INV-001',
      number: 'INV-2024-001',
      client: 'TechCorp Inc.',
      clientId: 'ADV-001',
      amount: 45000,
      issueDate: '2024-01-01',
      dueDate: '2024-01-31',
      status: 'paid',
      paidDate: '2024-01-08',
      items: [
        { description: 'Q1 Campaign - Tech Review Show', amount: 25000 },
        { description: 'Q1 Campaign - Business Insights', amount: 20000 }
      ]
    },
    {
      id: 'INV-002',
      number: 'INV-2024-002',
      client: 'HealthPlus',
      clientId: 'ADV-002',
      amount: 38000,
      issueDate: '2024-01-05',
      dueDate: '2024-02-05',
      status: 'sent',
      items: [
        { description: 'Winter Wellness Campaign', amount: 38000 }
      ]
    }
  ];

  const filtered = status === 'all' ? invoices : invoices.filter(inv => inv.status === status);

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(filtered)
  };
}

async function getPayments(queryParams) {
  const payments = [
    {
      id: 'PAY-001',
      date: '2024-01-08',
      amount: 45000,
      method: 'wire_transfer',
      status: 'completed',
      client: 'TechCorp Inc.',
      invoiceId: 'INV-001',
      reference: 'WT-123456'
    },
    {
      id: 'PAY-002',
      date: '2024-01-15',
      amount: 32000,
      method: 'ach',
      status: 'pending',
      client: 'AutoDrive',
      invoiceId: 'INV-003',
      reference: 'ACH-789012'
    }
  ];

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(payments)
  };
}

async function getCashFlow(queryParams) {
  const period = queryParams?.period || 'monthly';
  
  const cashFlow = {
    period: period,
    data: [
      { month: 'Jan', income: 145000, expenses: 92000, net: 53000 },
      { month: 'Feb', income: 162000, expenses: 98000, net: 64000 },
      { month: 'Mar', income: 178000, expenses: 105000, net: 73000 },
      { month: 'Apr', income: 195000, expenses: 112000, net: 83000 },
      { month: 'May', income: 210000, expenses: 118000, net: 92000 },
      { month: 'Jun', income: 225000, expenses: 125000, net: 100000 }
    ],
    projections: {
      nextMonth: { income: 240000, expenses: 130000, net: 110000 },
      nextQuarter: { income: 750000, expenses: 400000, net: 350000 }
    }
  };

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(cashFlow)
  };
}

async function createInvoice(invoiceData) {
  const invoiceId = `INV-${Date.now()}`;
  const invoiceNumber = `INV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
  const timestamp = new Date().toISOString();

  const item = {
    PK: `INVOICE#${invoiceId}`,
    SK: `INVOICE#${invoiceId}`,
    GSI1PK: 'INVOICE',
    GSI1SK: invoiceData.dueDate,
    id: invoiceId,
    number: invoiceNumber,
    ...invoiceData,
    status: 'draft',
    createdAt: timestamp,
    updatedAt: timestamp
  };

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

async function recordPayment(paymentData) {
  const paymentId = `PAY-${Date.now()}`;
  const timestamp = new Date().toISOString();

  const item = {
    PK: `PAYMENT#${paymentId}`,
    SK: `PAYMENT#${paymentId}`,
    GSI1PK: 'PAYMENT',
    GSI1SK: timestamp,
    id: paymentId,
    ...paymentData,
    status: 'processing',
    createdAt: timestamp,
    updatedAt: timestamp
  };

  const params = {
    TableName: TABLE_NAME,
    Item: item
  };

  await dynamodb.put(params).promise();

  // Update invoice status if payment is for an invoice
  if (paymentData.invoiceId) {
    await dynamodb.update({
      TableName: TABLE_NAME,
      Key: {
        PK: `INVOICE#${paymentData.invoiceId}`,
        SK: `INVOICE#${paymentData.invoiceId}`
      },
      UpdateExpression: 'SET #status = :status, paidDate = :paidDate, paymentId = :paymentId',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':status': 'paid',
        ':paidDate': timestamp,
        ':paymentId': paymentId
      }
    }).promise();
  }

  return {
    statusCode: 201,
    headers: CORS_HEADERS,
    body: JSON.stringify(item)
  };
}

async function updateInvoice(updateData) {
  const { invoiceId, ...data } = updateData;
  
  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: `INVOICE#${invoiceId}`,
      SK: `INVOICE#${invoiceId}`
    },
    UpdateExpression: 'SET #data = :data, updatedAt = :updatedAt',
    ExpressionAttributeNames: {
      '#data': 'data'
    },
    ExpressionAttributeValues: {
      ':data': data,
      ':updatedAt': new Date().toISOString()
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
EOF

echo "All Lambda functions created successfully!"