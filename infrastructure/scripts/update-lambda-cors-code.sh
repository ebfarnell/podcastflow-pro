#!/bin/bash

# Script to update Lambda function code with proper CORS handling
# This updates the Lambda functions to use dynamic CORS based on origin

set -e

# Configuration
REGION="${AWS_REGION:-us-east-1}"
ALLOWED_ORIGINS="https://app.podcastflow.pro,https://podcastflow.pro,http://localhost:3000"

echo "Updating Lambda function code for proper CORS handling..."
echo "Allowed origins: $ALLOWED_ORIGINS"
echo ""

# Create a temporary directory for Lambda deployment packages
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# Create the updated Lambda handler code
cat > "$TEMP_DIR/index.js" << 'EOF'
const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

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
        const result = await dynamodb.get({
            TableName: TABLE_NAME,
            Key: {
                PK: `USER#${userId}`,
                SK: 'PROFILE'
            }
        }).promise();
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(result.Item || {})
        };
    } catch (error) {
        console.error('Error getting user:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to get user' })
        };
    }
}

async function updateUser(userId, data, headers) {
    try {
        await dynamodb.put({
            TableName: TABLE_NAME,
            Item: {
                PK: `USER#${userId}`,
                SK: 'PROFILE',
                ...data,
                updatedAt: new Date().toISOString()
            }
        }).promise();
        
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
    try {
        const result = await dynamodb.get({
            TableName: TABLE_NAME,
            Key: {
                PK: `USER#${userId}`,
                SK: 'PROFILE'
            }
        }).promise();
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(result.Item || {})
        };
    } catch (error) {
        console.error('Error getting profile:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to get profile' })
        };
    }
}

async function updateProfile(userId, profileData, headers) {
    try {
        await dynamodb.put({
            TableName: TABLE_NAME,
            Item: {
                PK: `USER#${userId}`,
                SK: 'PROFILE',
                ...profileData,
                updatedAt: new Date().toISOString()
            }
        }).promise();
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ message: 'Profile updated successfully' })
        };
    } catch (error) {
        console.error('Error updating profile:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to update profile' })
        };
    }
}

async function getPreferences(userId, headers) {
    try {
        const result = await dynamodb.get({
            TableName: TABLE_NAME,
            Key: {
                PK: `USER#${userId}`,
                SK: 'PREFERENCES'
            }
        }).promise();
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(result.Item || {})
        };
    } catch (error) {
        console.error('Error getting preferences:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to get preferences' })
        };
    }
}

async function updatePreferences(userId, preferences, headers) {
    try {
        await dynamodb.put({
            TableName: TABLE_NAME,
            Item: {
                PK: `USER#${userId}`,
                SK: 'PREFERENCES',
                ...preferences,
                updatedAt: new Date().toISOString()
            }
        }).promise();
        
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

# Create package.json
cat > "$TEMP_DIR/package.json" << 'EOF'
{
  "name": "lambda-function",
  "version": "1.0.0",
  "description": "Lambda function with CORS support",
  "main": "index.js",
  "dependencies": {
    "aws-sdk": "^2.1404.0"
  }
}
EOF

# Package the Lambda function
cd "$TEMP_DIR"
zip -r lambda-function.zip index.js package.json

# Update the podcastflow-api-user Lambda function
echo -n "Updating podcastflow-api-user Lambda function code... "
if aws lambda update-function-code \
    --function-name podcastflow-api-user \
    --zip-file fileb://lambda-function.zip \
    --region $REGION \
    --no-cli-pager > /dev/null 2>&1; then
    echo "SUCCESS"
else
    echo "FAILED"
fi

# Also ensure environment variables are set
echo -n "Setting environment variables for podcastflow-api-user... "
if aws lambda update-function-configuration \
    --function-name podcastflow-api-user \
    --environment "Variables={ALLOWED_ORIGINS=\"$ALLOWED_ORIGINS\",DYNAMODB_TABLE_NAME=\"podcastflow-pro\"}" \
    --region $REGION \
    --no-cli-pager > /dev/null 2>&1; then
    echo "SUCCESS"
else
    echo "FAILED"
fi

echo ""
echo "================================"
echo "Lambda CORS Update Complete!"
echo "================================"
echo ""
echo "The podcastflow-api-user Lambda function has been updated with:"
echo "1. Dynamic CORS handling based on request origin"
echo "2. Support for /users/{userId} endpoints"
echo "3. Proper OPTIONS preflight handling"
echo "4. Environment variable: ALLOWED_ORIGINS=$ALLOWED_ORIGINS"
echo ""
echo "The API should now accept requests from:"
echo "- https://app.podcastflow.pro"
echo "- https://podcastflow.pro"
echo "- http://localhost:3000"