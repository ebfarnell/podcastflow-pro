const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();
const { v4: uuidv4 } = require('uuid');

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME;

exports.handler = async (event) => {
    const { httpMethod, pathParameters, body, queryStringParameters, resource } = event;
    
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGINS || '*',
        'Access-Control-Allow-Headers': '*'
    };
    
    try {
        const path = resource || event.routeKey || '';
        
        switch (true) {
            // Get upcoming deadlines
            case httpMethod === 'GET' && path === '/deadlines/upcoming':
                return await getUpcomingDeadlines(queryStringParameters, headers);
            
            // Get deadlines for a specific campaign
            case httpMethod === 'GET' && path.includes('/campaigns/') && path.includes('/deadlines'):
                return await getCampaignDeadlines(pathParameters.campaignId, headers);
            
            // Get all deadlines
            case httpMethod === 'GET' && !pathParameters?.id:
                return await listDeadlines(queryStringParameters, headers);
            
            // Get specific deadline
            case httpMethod === 'GET' && pathParameters?.id:
                return await getDeadline(pathParameters.id, headers);
            
            // Create deadline
            case httpMethod === 'POST':
                return await createDeadline(JSON.parse(body), headers);
            
            // Update deadline
            case httpMethod === 'PUT' && pathParameters?.id:
                return await updateDeadline(pathParameters.id, JSON.parse(body), headers);
            
            // Delete deadline
            case httpMethod === 'DELETE' && pathParameters?.id:
                return await deleteDeadline(pathParameters.id, headers);
            
            // Mark deadline as complete
            case httpMethod === 'POST' && path.includes('/complete'):
                return await completeDeadline(pathParameters.id, headers);
            
            default:
                return {
                    statusCode: 405,
                    headers,
                    body: JSON.stringify({ error: 'Method not allowed' })
                };
        }
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal server error', message: error.message })
        };
    }
};

async function getUpcomingDeadlines(params, headers) {
    const daysAhead = parseInt(params?.days) || 7;
    const limit = parseInt(params?.limit) || 10;
    const priority = params?.priority;
    
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);
    
    let queryParams = {
        TableName: TABLE_NAME,
        IndexName: 'GSI2',
        KeyConditionExpression: 'GSI2PK = :pk AND GSI2SK BETWEEN :start AND :end',
        ExpressionAttributeValues: {
            ':pk': 'DEADLINES',
            ':start': now.toISOString(),
            ':end': futureDate.toISOString()
        },
        Limit: limit
    };
    
    if (priority) {
        queryParams.FilterExpression = 'priority = :priority';
        queryParams.ExpressionAttributeValues[':priority'] = priority;
    }
    
    const result = await dynamodb.query(queryParams).promise();
    
    // Sort by due date
    const deadlines = (result.Items || []).sort((a, b) => 
        new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    );
    
    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            deadlines,
            count: deadlines.length
        })
    };
}

async function getCampaignDeadlines(campaignId, headers) {
    const params = {
        TableName: TABLE_NAME,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk',
        ExpressionAttributeValues: {
            ':pk': `CAMPAIGN#${campaignId}#DEADLINES`
        }
    };
    
    const result = await dynamodb.query(params).promise();
    
    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            campaignId,
            deadlines: result.Items || [],
            count: result.Count || 0
        })
    };
}

async function listDeadlines(params, headers) {
    const status = params?.status || 'all';
    const priority = params?.priority;
    const assignedTo = params?.assignedTo;
    
    let queryParams = {
        TableName: TABLE_NAME,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk',
        ExpressionAttributeValues: {
            ':pk': 'DEADLINES'
        }
    };
    
    // Build filter expressions
    let filterExpressions = [];
    
    if (status !== 'all') {
        filterExpressions.push('#status = :status');
        queryParams.ExpressionAttributeNames = queryParams.ExpressionAttributeNames || {};
        queryParams.ExpressionAttributeNames['#status'] = 'status';
        queryParams.ExpressionAttributeValues[':status'] = status;
    }
    
    if (priority) {
        filterExpressions.push('priority = :priority');
        queryParams.ExpressionAttributeValues[':priority'] = priority;
    }
    
    if (assignedTo) {
        filterExpressions.push('assignedTo = :assignedTo');
        queryParams.ExpressionAttributeValues[':assignedTo'] = assignedTo;
    }
    
    if (filterExpressions.length > 0) {
        queryParams.FilterExpression = filterExpressions.join(' AND ');
    }
    
    const result = await dynamodb.query(queryParams).promise();
    
    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            deadlines: result.Items || [],
            count: result.Count || 0
        })
    };
}

async function getDeadline(deadlineId, headers) {
    const params = {
        TableName: TABLE_NAME,
        Key: {
            PK: `DEADLINE#${deadlineId}`,
            SK: 'METADATA'
        }
    };
    
    const result = await dynamodb.get(params).promise();
    
    if (!result.Item) {
        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Deadline not found' })
        };
    }
    
    return {
        statusCode: 200,
        headers,
        body: JSON.stringify(result.Item)
    };
}

async function createDeadline(data, headers) {
    const deadlineId = uuidv4();
    const now = new Date().toISOString();
    
    const deadline = {
        PK: `DEADLINE#${deadlineId}`,
        SK: 'METADATA',
        GSI1PK: 'DEADLINES',
        GSI1SK: now,
        GSI2PK: 'DEADLINES',
        GSI2SK: data.dueDate, // For querying by due date
        id: deadlineId,
        title: data.title,
        description: data.description || '',
        dueDate: data.dueDate,
        priority: data.priority || 'medium',
        status: 'pending',
        type: data.type || 'task', // task, milestone, deliverable
        assignedTo: data.assignedTo || null,
        assignedBy: data.assignedBy || null,
        tags: data.tags || [],
        attachments: data.attachments || [],
        completedAt: null,
        completedBy: null,
        createdAt: now,
        updatedAt: now
    };
    
    // If associated with a campaign
    if (data.campaignId) {
        deadline.campaignId = data.campaignId;
        deadline.campaignName = data.campaignName;
        deadline.GSI1PK = `CAMPAIGN#${data.campaignId}#DEADLINES`;
    }
    
    // If associated with a show
    if (data.showId) {
        deadline.showId = data.showId;
        deadline.showName = data.showName;
    }
    
    // Add reminder settings
    if (data.reminders) {
        deadline.reminders = data.reminders; // Array of reminder settings
    }
    
    await dynamodb.put({
        TableName: TABLE_NAME,
        Item: deadline
    }).promise();
    
    return {
        statusCode: 201,
        headers,
        body: JSON.stringify(deadline)
    };
}

async function updateDeadline(deadlineId, data, headers) {
    const updateExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {
        ':updatedAt': new Date().toISOString()
    };
    
    // Build update expression dynamically
    Object.keys(data).forEach(key => {
        if (key !== 'id' && key !== 'PK' && key !== 'SK' && key !== 'createdAt') {
            updateExpressions.push(`#${key} = :${key}`);
            expressionAttributeNames[`#${key}`] = key;
            expressionAttributeValues[`:${key}`] = data[key];
        }
    });
    
    updateExpressions.push('updatedAt = :updatedAt');
    
    // If updating due date, also update GSI2SK for sorting
    if (data.dueDate) {
        updateExpressions.push('GSI2SK = :dueDate');
        expressionAttributeValues[':dueDate'] = data.dueDate;
    }
    
    const params = {
        TableName: TABLE_NAME,
        Key: {
            PK: `DEADLINE#${deadlineId}`,
            SK: 'METADATA'
        },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
        ExpressionAttributeValues,
        ReturnValues: 'ALL_NEW'
    };
    
    const result = await dynamodb.update(params).promise();
    
    return {
        statusCode: 200,
        headers,
        body: JSON.stringify(result.Attributes)
    };
}

async function deleteDeadline(deadlineId, headers) {
    const params = {
        TableName: TABLE_NAME,
        Key: {
            PK: `DEADLINE#${deadlineId}`,
            SK: 'METADATA'
        }
    };
    
    await dynamodb.delete(params).promise();
    
    return {
        statusCode: 204,
        headers,
        body: ''
    };
}

async function completeDeadline(deadlineId, headers) {
    const now = new Date().toISOString();
    
    const params = {
        TableName: TABLE_NAME,
        Key: {
            PK: `DEADLINE#${deadlineId}`,
            SK: 'METADATA'
        },
        UpdateExpression: 'SET #status = :status, completedAt = :completedAt, updatedAt = :updatedAt',
        ExpressionAttributeNames: {
            '#status': 'status'
        },
        ExpressionAttributeValues: {
            ':status': 'completed',
            ':completedAt': now,
            ':updatedAt': now
        },
        ReturnValues: 'ALL_NEW'
    };
    
    const result = await dynamodb.update(params).promise();
    
    return {
        statusCode: 200,
        headers,
        body: JSON.stringify(result.Attributes)
    };
}

// Batch operations
async function batchCreateDeadlines(deadlines, headers) {
    const items = deadlines.map(data => {
        const deadlineId = uuidv4();
        const now = new Date().toISOString();
        
        return {
            PutRequest: {
                Item: {
                    PK: `DEADLINE#${deadlineId}`,
                    SK: 'METADATA',
                    GSI1PK: data.campaignId ? `CAMPAIGN#${data.campaignId}#DEADLINES` : 'DEADLINES',
                    GSI1SK: now,
                    GSI2PK: 'DEADLINES',
                    GSI2SK: data.dueDate,
                    id: deadlineId,
                    ...data,
                    status: 'pending',
                    createdAt: now,
                    updatedAt: now
                }
            }
        };
    });
    
    // Batch write in chunks of 25
    const chunks = [];
    for (let i = 0; i < items.length; i += 25) {
        chunks.push(items.slice(i, i + 25));
    }
    
    for (const chunk of chunks) {
        await dynamodb.batchWrite({
            RequestItems: {
                [TABLE_NAME]: chunk
            }
        }).promise();
    }
    
    return {
        statusCode: 201,
        headers,
        body: JSON.stringify({
            message: `Created ${deadlines.length} deadlines`,
            count: deadlines.length
        })
    };
}