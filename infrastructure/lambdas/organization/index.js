const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'podcastflow-pro';

exports.handler = async (event) => {
    const { httpMethod, body } = event;
    
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS'
    };
    
    // Handle preflight OPTIONS request
    if (httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ message: 'OK' })
        };
    }
    
    // In production, get org ID from user context
    const orgId = 'default';
    
    try {
        switch (httpMethod) {
            case 'GET':
                return await getOrganization(orgId, headers);
            case 'PUT':
                return await updateOrganization(orgId, JSON.parse(body), headers);
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
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};

async function getOrganization(orgId, headers) {
    const params = {
        TableName: TABLE_NAME,
        Key: {
            PK: `ORG#${orgId}`,
            SK: 'SETTINGS'
        }
    };
    
    const result = await dynamodb.get(params).promise();
    
    if (!result.Item) {
        // Return default organization
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                orgId,
                organizationName: 'PodcastFlow Pro',
                primaryContact: event.requestContext?.authorizer?.claims?.email || 'admin@' + orgId + '.com',
                website: 'https://podcastflow.pro',
                address: '',
                phone: '',
                taxId: '',
                plan: 'enterprise',
                features: ['advanced-analytics', 'unlimited-campaigns', 'api-access', 'white-label']
            })
        };
    }
    
    return {
        statusCode: 200,
        headers,
        body: JSON.stringify(result.Item)
    };
}

async function updateOrganization(orgId, data, headers) {
    const now = new Date().toISOString();
    
    const item = {
        PK: `ORG#${orgId}`,
        SK: 'SETTINGS',
        orgId,
        ...data,
        updatedAt: now
    };
    
    await dynamodb.put({
        TableName: TABLE_NAME,
        Item: item
    }).promise();
    
    return {
        statusCode: 200,
        headers,
        body: JSON.stringify(item)
    };
}