const AWS = require('aws-sdk');
const { requireAuth, hasPermission } = require('../shared/authMiddleware');
const dynamodb = new AWS.DynamoDB.DocumentClient();

const TABLE_NAME = process.env.TABLE_NAME || 'PodcastFlowPro';
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
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
    const { httpMethod, pathParameters, body } = event;
    const path = event.path;
    const user = event.user; // Added by auth middleware

    switch (httpMethod) {
      case 'GET':
        if (pathParameters?.approvalId) {
          return await getApproval(pathParameters.approvalId);
        }
        return await listApprovals();

      case 'POST':
        if (pathParameters?.approvalId) {
          // Handle action endpoints
          if (path.includes('/approve')) {
            return await approveAd(pathParameters.approvalId, JSON.parse(body));
          } else if (path.includes('/reject')) {
            return await rejectAd(pathParameters.approvalId, JSON.parse(body));
          } else if (path.includes('/revision')) {
            return await requestRevision(pathParameters.approvalId, JSON.parse(body));
          }
        }
        // Create new approval
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

  // Extract advertiser and show information
  const advertiserInfo = await getAdvertiserInfo(approvalData.advertiserId);
  const showInfo = await getShowInfo(approvalData.showId);
  const campaignInfo = await getCampaignInfo(approvalData.campaignId);

  const item = {
    PK: `APPROVAL#${approvalId}`,
    SK: `APPROVAL#${approvalId}`,
    GSI1PK: 'AD_APPROVAL',
    GSI1SK: timestamp,
    GSI2PK: `SHOW#${approvalData.showId}`,
    GSI2SK: `APPROVAL#${approvalId}`,
    id: approvalId,
    // Core fields
    title: approvalData.title,
    advertiserId: approvalData.advertiserId,
    advertiserName: advertiserInfo?.name || 'Unknown Advertiser',
    campaignId: approvalData.campaignId,
    campaignName: campaignInfo?.name || 'Unknown Campaign',
    showId: approvalData.showId,
    showName: showInfo?.name || 'Unknown Show',
    // Ad details
    type: approvalData.type || 'host-read',
    duration: approvalData.duration || 30,
    script: approvalData.script,
    talkingPoints: approvalData.talkingPoints || [],
    // Scheduling
    targetEpisodes: approvalData.targetEpisodes || [],
    startDate: approvalData.startDate,
    endDate: approvalData.endDate,
    // Compliance
    legalDisclaimer: approvalData.legalDisclaimer,
    restrictedTerms: approvalData.restrictedTerms || [],
    // Metadata
    priority: approvalData.priority || 'medium',
    deadline: approvalData.deadline,
    notes: approvalData.notes,
    submittedBy: approvalData.submittedBy,
    submittedAt: approvalData.submittedAt || timestamp,
    // Workflow
    status: approvalData.status || 'pending_review',
    revisionCount: 0,
    assignedProducers: showInfo?.producers || [],
    assignedTalent: showInfo?.talent || [],
    history: [{
      action: 'submitted',
      by: approvalData.submittedBy,
      at: timestamp,
      details: 'Initial submission'
    }],
    // Timestamps
    createdAt: timestamp,
    updatedAt: timestamp
  };

  const params = {
    TableName: TABLE_NAME,
    Item: item
  };

  await dynamodb.put(params).promise();

  // TODO: Send notifications to assigned producers/talent
  
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
      ':approvedBy': data.approvedBy || 'system',
      ':timestamp': timestamp,
      ':history': [{
        action: 'approved',
        by: data.approvedBy,
        at: timestamp,
        comment: data.feedback || data.comment || ''
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
      ':rejectedBy': data.rejectedBy || 'system',
      ':timestamp': timestamp,
      ':history': [{
        action: 'rejected',
        by: data.rejectedBy,
        at: timestamp,
        reason: data.feedback || data.reason || ''
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
        by: data.requestedBy || 'system',
        at: timestamp,
        feedback: data.feedback || ''
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
  const timestamp = new Date().toISOString();
  
  // Build update expression dynamically
  let updateExpression = 'SET updatedAt = :updatedAt';
  let expressionAttributeNames = {};
  let expressionAttributeValues = {
    ':updatedAt': timestamp
  };
  
  // Update specific fields if provided
  const allowedFields = [
    'title', 'script', 'talkingPoints', 'duration', 'priority',
    'deadline', 'notes', 'legalDisclaimer', 'restrictedTerms',
    'targetEpisodes', 'startDate', 'endDate'
  ];
  
  allowedFields.forEach(field => {
    if (updateData[field] !== undefined) {
      updateExpression += `, #${field} = :${field}`;
      expressionAttributeNames[`#${field}`] = field;
      expressionAttributeValues[`:${field}`] = updateData[field];
    }
  });
  
  // Add to history
  updateExpression += ', history = list_append(history, :history)';
  expressionAttributeValues[':history'] = [{
    action: 'updated',
    by: updateData.updatedBy || 'system',
    at: timestamp,
    changes: Object.keys(updateData).filter(k => allowedFields.includes(k))
  }];
  
  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: `APPROVAL#${approvalId}`,
      SK: `APPROVAL#${approvalId}`
    },
    UpdateExpression: updateExpression,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: 'ALL_NEW'
  };

  const result = await dynamodb.update(params).promise();

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(result.Attributes)
  };
}

// Helper functions
async function getAdvertiserInfo(advertiserId) {
  if (!advertiserId) return null;
  
  try {
    const params = {
      TableName: TABLE_NAME,
      Key: {
        PK: `ADVERTISER#${advertiserId}`,
        SK: `ADVERTISER#${advertiserId}`
      }
    };
    const result = await dynamodb.get(params).promise();
    return result.Item;
  } catch (error) {
    console.error('Error fetching advertiser:', error);
    return null;
  }
}

async function getShowInfo(showId) {
  if (!showId) return null;
  
  try {
    const params = {
      TableName: TABLE_NAME,
      Key: {
        PK: `SHOW#${showId}`,
        SK: `SHOW#${showId}`
      }
    };
    const result = await dynamodb.get(params).promise();
    return result.Item;
  } catch (error) {
    console.error('Error fetching show:', error);
    return null;
  }
}

async function getCampaignInfo(campaignId) {
  if (!campaignId) return null;
  
  try {
    const params = {
      TableName: TABLE_NAME,
      Key: {
        PK: `CAMPAIGN#${campaignId}`,
        SK: `CAMPAIGN#${campaignId}`
      }
    };
    const result = await dynamodb.get(params).promise();
    return result.Item;
  } catch (error) {
    console.error('Error fetching campaign:', error);
    return null;
  }
}

// Export handler with auth middleware
exports.handler = requireAuth(mainHandler, { permissions: ['approvals.manage', 'approvals.submit', 'approvals.review', 'approvals.view.assigned'] });
