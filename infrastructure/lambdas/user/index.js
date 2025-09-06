const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'podcastflow-pro';

exports.handler = async (event) => {
    const { httpMethod, path, body, requestContext } = event;
    
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
    
    // Extract user ID from JWT token (in real implementation)
    const userId = requestContext?.authorizer?.claims?.sub || 'demo-user';
    
    try {
        if (path.includes('/profile')) {
            switch (httpMethod) {
                case 'GET':
                    return await getProfile(userId, headers);
                case 'PUT':
                    return await updateProfile(userId, JSON.parse(body), headers);
                default:
                    return {
                        statusCode: 405,
                        headers,
                        body: JSON.stringify({ error: 'Method not allowed' })
                    };
            }
        } else if (path.includes('/preferences')) {
            switch (httpMethod) {
                case 'GET':
                    return await getPreferences(userId, headers);
                case 'PUT':
                    return await updatePreferences(userId, JSON.parse(body), headers);
                default:
                    return {
                        statusCode: 405,
                        headers,
                        body: JSON.stringify({ error: 'Method not allowed' })
                    };
            }
        }
        
        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Not found' })
        };
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};

async function getProfile(userId, headers) {
    const params = {
        TableName: TABLE_NAME,
        Key: {
            PK: `USER#${userId}`,
            SK: 'PROFILE'
        }
    };
    
    const result = await dynamodb.get(params).promise();
    
    if (!result.Item) {
        // Return default profile
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                userId,
                name: 'Michael Unfricht',
                email: 'Michael@unfy.com',
                phone: '',
                timezone: 'America/New_York',
                language: 'en',
                avatar: null
            })
        };
    }
    
    return {
        statusCode: 200,
        headers,
        body: JSON.stringify(result.Item)
    };
}

async function updateProfile(userId, data, headers) {
    const now = new Date().toISOString();
    
    const item = {
        PK: `USER#${userId}`,
        SK: 'PROFILE',
        userId,
        ...data,
        updatedAt: now
    };
    
    // Don't allow email changes through this endpoint
    delete item.email;
    
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

async function getPreferences(userId, headers) {
    const params = {
        TableName: TABLE_NAME,
        Key: {
            PK: `USER#${userId}`,
            SK: 'PREFERENCES'
        }
    };
    
    const result = await dynamodb.get(params).promise();
    
    if (!result.Item) {
        // Return default preferences
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                notifications: {
                    email: true,
                    browser: true,
                    mobile: false,
                    campaignUpdates: true,
                    weeklyReports: true,
                    budgetAlerts: true
                },
                display: {
                    theme: 'light',
                    density: 'comfortable',
                    showTutorials: true
                }
            })
        };
    }
    
    return {
        statusCode: 200,
        headers,
        body: JSON.stringify(result.Item)
    };
}

async function updatePreferences(userId, data, headers) {
    const now = new Date().toISOString();
    
    const item = {
        PK: `USER#${userId}`,
        SK: 'PREFERENCES',
        userId,
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