#!/bin/bash

# Script to deploy Lambda functions with proper dependencies

set -e

# Configuration
REGION="${AWS_REGION:-us-east-1}"
ALLOWED_ORIGINS="https://app.podcastflow.pro,https://podcastflow.pro,http://localhost:3000"

echo "Deploying Lambda functions with AWS SDK v3..."
echo ""

# Create a temporary directory for Lambda deployment packages
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

cd "$TEMP_DIR"

# Create package.json with AWS SDK v3
cat > package.json << 'EOF'
{
  "name": "lambda-function",
  "version": "1.0.0",
  "main": "index.js"
}
EOF

# Create the Lambda handler for organization with AWS SDK v3
cat > index.js << 'EOF'
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'podcastflow-pro';

// CORS helper function
const getCORSHeaders = (event) => {
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',').map(o => o.trim());
    const origin = event.headers?.origin || event.headers?.Origin || '';
    const isAllowed = allowedOrigins.includes(origin);
    
    return {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': isAllowed ? origin : allowedOrigins[0],
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-User-Email,X-Organization',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400'
    };
};

exports.handler = async (event) => {
    const { httpMethod } = event;
    const headers = getCORSHeaders(event);
    
    console.log('Event:', JSON.stringify(event, null, 2));
    console.log('Headers to return:', headers);
    
    // Handle preflight OPTIONS request
    if (httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ message: 'OK' })
        };
    }
    
    try {
        switch (httpMethod) {
            case 'GET':
                return await getOrganization(headers);
            case 'PUT':
                return await updateOrganization(JSON.parse(event.body || '{}'), headers);
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

async function getOrganization(headers) {
    try {
        const command = new GetCommand({
            TableName: TABLE_NAME,
            Key: {
                PK: 'ORGANIZATION',
                SK: 'SETTINGS'
            }
        });
        
        const result = await dynamodb.send(command);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(result.Item || {
                name: 'PodcastFlow Pro',
                plan: 'Professional',
                features: ['unlimited_campaigns', 'advanced_analytics', 'api_access']
            })
        };
    } catch (error) {
        console.error('Error getting organization:', error);
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                name: 'PodcastFlow Pro',
                plan: 'Professional',
                features: ['unlimited_campaigns', 'advanced_analytics', 'api_access']
            })
        };
    }
}

async function updateOrganization(data, headers) {
    try {
        const command = new PutCommand({
            TableName: TABLE_NAME,
            Item: {
                PK: 'ORGANIZATION',
                SK: 'SETTINGS',
                ...data,
                updatedAt: new Date().toISOString()
            }
        });
        
        await dynamodb.send(command);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ message: 'Organization updated successfully' })
        };
    } catch (error) {
        console.error('Error updating organization:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to update organization' })
        };
    }
}
EOF

# Install dependencies
echo "Installing dependencies..."
npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb

# Create deployment package
echo "Creating deployment package..."
zip -r lambda-function.zip index.js node_modules package.json package-lock.json

# Update the Lambda function
echo -n "Updating podcastflow-api-organization... "
if aws lambda update-function-code \
    --function-name podcastflow-api-organization \
    --zip-file fileb://lambda-function.zip \
    --region $REGION \
    --no-cli-pager > /dev/null 2>&1; then
    echo "SUCCESS"
    
    # Wait for the function to be updated
    sleep 3
    
    # Also update runtime to nodejs18.x if needed
    aws lambda update-function-configuration \
        --function-name podcastflow-api-organization \
        --runtime nodejs18.x \
        --environment "Variables={ALLOWED_ORIGINS=\"$ALLOWED_ORIGINS\",DYNAMODB_TABLE_NAME=\"podcastflow-pro\"}" \
        --region $REGION \
        --no-cli-pager > /dev/null 2>&1
else
    echo "FAILED"
fi

# Now create the user handler
cat > index.js << 'EOF'
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'podcastflow-pro';

// CORS helper function
const getCORSHeaders = (event) => {
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',').map(o => o.trim());
    const origin = event.headers?.origin || event.headers?.Origin || '';
    const isAllowed = allowedOrigins.includes(origin);
    
    return {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': isAllowed ? origin : allowedOrigins[0],
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-User-Email,X-Organization',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400'
    };
};

exports.handler = async (event) => {
    const { httpMethod, path, body, requestContext, pathParameters } = event;
    const headers = getCORSHeaders(event);
    
    console.log('Event:', JSON.stringify(event, null, 2));
    console.log('Headers to return:', headers);
    
    // Handle preflight OPTIONS request
    if (httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ message: 'OK' })
        };
    }
    
    // Extract user ID from path or JWT token
    const userId = pathParameters?.userId || requestContext?.authorizer?.claims?.sub || 'demo-user';
    
    try {
        // Handle /users/{userId} endpoint
        if (path.includes('/users/') && pathParameters?.userId) {
            switch (httpMethod) {
                case 'GET':
                    return await getUser(pathParameters.userId, headers);
                case 'PUT':
                    return await updateUser(pathParameters.userId, JSON.parse(body || '{}'), headers);
                default:
                    return {
                        statusCode: 405,
                        headers,
                        body: JSON.stringify({ error: 'Method not allowed' })
                    };
            }
        }
        
        if (path.includes('/profile')) {
            switch (httpMethod) {
                case 'GET':
                    return await getProfile(userId, headers);
                case 'PUT':
                    return await updateProfile(userId, JSON.parse(body || '{}'), headers);
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
                    return await updatePreferences(userId, JSON.parse(body || '{}'), headers);
                default:
                    return {
                        statusCode: 405,
                        headers,
                        body: JSON.stringify({ error: 'Method not allowed' })
                    };
            }
        } else {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ error: 'Not found' })
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

async function getUser(userId, headers) {
    try {
        const command = new GetCommand({
            TableName: TABLE_NAME,
            Key: {
                PK: `USER#${userId}`,
                SK: 'PROFILE'
            }
        });
        
        const result = await dynamodb.send(command);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(result.Item || {
                userId,
                email: 'user@example.com',
                role: 'user'
            })
        };
    } catch (error) {
        console.error('Error getting user:', error);
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                userId,
                email: 'user@example.com',
                role: 'user'
            })
        };
    }
}

async function updateUser(userId, data, headers) {
    try {
        const command = new PutCommand({
            TableName: TABLE_NAME,
            Item: {
                PK: `USER#${userId}`,
                SK: 'PROFILE',
                ...data,
                updatedAt: new Date().toISOString()
            }
        });
        
        await dynamodb.send(command);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ message: 'User updated successfully' })
        };
    } catch (error) {
        console.error('Error updating user:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to update user' })
        };
    }
}

async function getProfile(userId, headers) {
    return getUser(userId, headers);
}

async function updateProfile(userId, profileData, headers) {
    return updateUser(userId, profileData, headers);
}

async function getPreferences(userId, headers) {
    try {
        const command = new GetCommand({
            TableName: TABLE_NAME,
            Key: {
                PK: `USER#${userId}`,
                SK: 'PREFERENCES'
            }
        });
        
        const result = await dynamodb.send(command);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(result.Item || {
                notifications: true,
                theme: 'light'
            })
        };
    } catch (error) {
        console.error('Error getting preferences:', error);
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                notifications: true,
                theme: 'light'
            })
        };
    }
}

async function updatePreferences(userId, preferences, headers) {
    try {
        const command = new PutCommand({
            TableName: TABLE_NAME,
            Item: {
                PK: `USER#${userId}`,
                SK: 'PREFERENCES',
                ...preferences,
                updatedAt: new Date().toISOString()
            }
        });
        
        await dynamodb.send(command);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ message: 'Preferences updated successfully' })
        };
    } catch (error) {
        console.error('Error updating preferences:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to update preferences' })
        };
    }
}
EOF

# Create new deployment package
echo "Creating user Lambda deployment package..."
zip -r lambda-function-user.zip index.js node_modules package.json package-lock.json

# Update the user Lambda function
echo -n "Updating podcastflow-api-user... "
if aws lambda update-function-code \
    --function-name podcastflow-api-user \
    --zip-file fileb://lambda-function-user.zip \
    --region $REGION \
    --no-cli-pager > /dev/null 2>&1; then
    echo "SUCCESS"
    
    # Wait for the function to be updated
    sleep 3
    
    # Also update runtime to nodejs18.x if needed
    aws lambda update-function-configuration \
        --function-name podcastflow-api-user \
        --runtime nodejs18.x \
        --environment "Variables={ALLOWED_ORIGINS=\"$ALLOWED_ORIGINS\",DYNAMODB_TABLE_NAME=\"podcastflow-pro\"}" \
        --region $REGION \
        --no-cli-pager > /dev/null 2>&1
else
    echo "FAILED"
fi

# Create the analytics/dashboard handler
cat > index.js << 'EOF'
const getCORSHeaders = (event) => {
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',').map(o => o.trim());
    const origin = event.headers?.origin || event.headers?.Origin || '';
    const isAllowed = allowedOrigins.includes(origin);
    
    return {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': isAllowed ? origin : allowedOrigins[0],
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-User-Email,X-Organization',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400'
    };
};

exports.handler = async (event) => {
    const headers = getCORSHeaders(event);
    
    console.log('Event:', JSON.stringify(event, null, 2));
    console.log('Headers to return:', headers);
    
    // Handle preflight OPTIONS request
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ message: 'OK' })
        };
    }
    
    try {
        // Mock dashboard data
        const dashboardData = {
            activeCampaigns: 12,
            pendingCampaigns: 5,
            scheduledCampaigns: 8,
            monthlyRevenue: 125000,
            totalRevenue: 1500000,
            newClients: 15,
            activeShows: 45,
            totalEpisodes: 234,
            recentActivity: [
                { type: 'campaign_created', message: 'New campaign for Tech Talk Podcast', timestamp: new Date().toISOString() },
                { type: 'payment_received', message: 'Payment received from ABC Corp - $5,000', timestamp: new Date().toISOString() },
                { type: 'episode_published', message: 'Episode 45 of Marketing Masters published', timestamp: new Date().toISOString() }
            ]
        };
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(dashboardData)
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
EOF

# Create analytics deployment package (no need for AWS SDK)
echo "Creating analytics Lambda deployment package..."
zip lambda-function-analytics.zip index.js

# Update the analytics Lambda function
echo -n "Updating podcastflow-api-analytics... "
if aws lambda update-function-code \
    --function-name podcastflow-api-analytics \
    --zip-file fileb://lambda-function-analytics.zip \
    --region $REGION \
    --no-cli-pager > /dev/null 2>&1; then
    echo "SUCCESS"
    
    # Wait for the function to be updated
    sleep 3
    
    # Also update runtime to nodejs18.x if needed
    aws lambda update-function-configuration \
        --function-name podcastflow-api-analytics \
        --runtime nodejs18.x \
        --environment "Variables={ALLOWED_ORIGINS=\"$ALLOWED_ORIGINS\"}" \
        --region $REGION \
        --no-cli-pager > /dev/null 2>&1
else
    echo "FAILED"
fi

echo ""
echo "================================"
echo "Lambda Functions Updated!"
echo "================================"
echo ""
echo "Updated Lambda functions with:"
echo "✓ AWS SDK v3 (for DynamoDB access)"
echo "✓ Proper CORS headers based on request origin"
echo "✓ Node.js 18.x runtime"
echo "✓ Environment variables for allowed origins"
echo ""
echo "The API should now properly handle CORS for:"
echo "- https://app.podcastflow.pro"
echo "- https://podcastflow.pro"
echo "- http://localhost:3000"