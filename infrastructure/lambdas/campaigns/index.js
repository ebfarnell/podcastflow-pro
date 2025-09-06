const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

const CAMPAIGNS_TABLE = process.env.CAMPAIGNS_TABLE;

exports.handler = async (event) => {
    console.log('Event:', JSON.stringify(event, null, 2));
    
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
    };
    
    try {
        const httpMethod = event.httpMethod;
        const pathParameters = event.pathParameters || {};
        const queryStringParameters = event.queryStringParameters || {};
        
        switch (httpMethod) {
            case 'GET':
                if (pathParameters.id) {
                    // Get single campaign
                    return await getCampaign(pathParameters.id, headers);
                } else {
                    // List campaigns
                    return await listCampaigns(queryStringParameters, headers);
                }
                
            case 'POST':
                // Create new campaign
                const createBody = JSON.parse(event.body);
                return await createCampaign(createBody, headers);
                
            case 'PUT':
                // Update campaign
                const updateBody = JSON.parse(event.body);
                return await updateCampaign(pathParameters.id, updateBody, headers);
                
            case 'DELETE':
                // Delete campaign
                return await deleteCampaign(pathParameters.id, headers);
                
            default:
                return {
                    statusCode: 405,
                    headers,
                    body: JSON.stringify({ message: 'Method not allowed' })
                };
        }
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                message: 'Internal server error',
                error: error.message 
            })
        };
    }
};

async function listCampaigns(queryParams, headers) {
    const { status, limit = 20, lastEvaluatedKey } = queryParams;
    
    const params = {
        TableName: CAMPAIGNS_TABLE,
        Limit: parseInt(limit)
    };
    
    if (lastEvaluatedKey) {
        params.ExclusiveStartKey = JSON.parse(decodeURIComponent(lastEvaluatedKey));
    }
    
    if (status) {
        params.FilterExpression = '#status = :status';
        params.ExpressionAttributeNames = { '#status': 'status' };
        params.ExpressionAttributeValues = { ':status': status };
    }
    
    const result = await dynamodb.scan(params).promise();
    
    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            campaigns: result.Items,
            lastEvaluatedKey: result.LastEvaluatedKey ? 
                encodeURIComponent(JSON.stringify(result.LastEvaluatedKey)) : null
        })
    };
}

async function getCampaign(id, headers) {
    const params = {
        TableName: CAMPAIGNS_TABLE,
        Key: { id }
    };
    
    const result = await dynamodb.get(params).promise();
    
    if (!result.Item) {
        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ message: 'Campaign not found' })
        };
    }
    
    return {
        statusCode: 200,
        headers,
        body: JSON.stringify(result.Item)
    };
}

async function createCampaign(campaign, headers) {
    const timestamp = new Date().toISOString();
    const id = generateId();
    
    const item = {
        id,
        ...campaign,
        status: campaign.status || 'draft',
        createdAt: timestamp,
        updatedAt: timestamp
    };
    
    const params = {
        TableName: CAMPAIGNS_TABLE,
        Item: item
    };
    
    await dynamodb.put(params).promise();
    
    return {
        statusCode: 201,
        headers,
        body: JSON.stringify(item)
    };
}

async function updateCampaign(id, updates, headers) {
    const timestamp = new Date().toISOString();
    
    // First check if campaign exists
    const getParams = {
        TableName: CAMPAIGNS_TABLE,
        Key: { id }
    };
    
    const existing = await dynamodb.get(getParams).promise();
    
    if (!existing.Item) {
        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ message: 'Campaign not found' })
        };
    }
    
    // Build update expression
    const updateExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};
    
    Object.keys(updates).forEach(key => {
        if (key !== 'id') {
            updateExpressions.push(`#${key} = :${key}`);
            expressionAttributeNames[`#${key}`] = key;
            expressionAttributeValues[`:${key}`] = updates[key];
        }
    });
    
    updateExpressions.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = timestamp;
    
    const params = {
        TableName: CAMPAIGNS_TABLE,
        Key: { id },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW'
    };
    
    const result = await dynamodb.update(params).promise();
    
    return {
        statusCode: 200,
        headers,
        body: JSON.stringify(result.Attributes)
    };
}

async function deleteCampaign(id, headers) {
    const params = {
        TableName: CAMPAIGNS_TABLE,
        Key: { id }
    };
    
    await dynamodb.delete(params).promise();
    
    return {
        statusCode: 204,
        headers,
        body: ''
    };
}

function generateId() {
    return 'campaign-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}