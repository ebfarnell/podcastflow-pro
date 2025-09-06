const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const cognito = new AWS.CognitoIdentityServiceProvider();
const ses = new AWS.SES();

const TABLE_NAME = process.env.TABLE_NAME;
const USER_POOL_ID = process.env.USER_POOL_ID;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
};

// Helper to get user from token
async function getUserFromToken(token) {
  try {
    const user = await cognito.getUser({
      AccessToken: token.replace('Bearer ', '')
    }).promise();
    
    const email = user.UserAttributes.find(attr => attr.Name === 'email').Value;
    const userRecord = await dynamodb.query({
      TableName: TABLE_NAME,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK = :sk',
      ExpressionAttributeValues: {
        ':pk': 'USER',
        ':sk': email
      }
    }).promise();
    
    return userRecord.Items[0];
  } catch (error) {
    console.error('Error getting user:', error);
    return null;
  }
}

// Send invitation email
async function sendInvitationEmail(organization, adminEmail, adminName, tempPassword) {
  const params = {
    Source: 'noreply@podcastflow.pro',
    Destination: {
      ToAddresses: [adminEmail]
    },
    Message: {
      Subject: {
        Data: `You're invited to join PodcastFlow Pro`
      },
      Body: {
        Html: {
          Data: `
            <h2>Welcome to PodcastFlow Pro!</h2>
            <p>Hi ${adminName},</p>
            <p>${organization.name} has been set up on PodcastFlow Pro, and you've been designated as the administrator.</p>
            <p><strong>Your login credentials:</strong></p>
            <ul>
              <li>Email: ${adminEmail}</li>
              <li>Temporary Password: ${tempPassword}</li>
            </ul>
            <p>Please login at <a href="https://podcastflow.pro/login">https://podcastflow.pro/login</a> and change your password.</p>
            <p>As the administrator, you can:</p>
            <ul>
              <li>Add users to your organization</li>
              <li>Manage campaigns, shows, and episodes</li>
              <li>Configure permissions for different roles</li>
              <li>Access analytics and reports</li>
            </ul>
            <p>If you have any questions, please contact our support team.</p>
            <p>Best regards,<br>The PodcastFlow Pro Team</p>
          `
        }
      }
    }
  };
  
  try {
    await ses.sendEmail(params).promise();
  } catch (error) {
    console.error('Error sending email:', error);
    // Don't fail the request if email fails
  }
}

exports.handler = async (event) => {
  const { httpMethod, path, headers, body, pathParameters } = event;
  const authorization = headers.Authorization || headers.authorization;
  
  // Handle CORS preflight
  if (httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }
  
  // Check authentication
  if (!authorization) {
    return {
      statusCode: 401,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Unauthorized' })
    };
  }
  
  // Get user from token
  const user = await getUserFromToken(authorization);
  if (!user) {
    return {
      statusCode: 401,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Invalid token' })
    };
  }
  
  // Only master users can manage organizations
  if (user.role !== 'master' && httpMethod !== 'GET') {
    return {
      statusCode: 403,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Forbidden: Master access required' })
    };
  }
  
  try {
    // GET /organizations - List all organizations
    if (httpMethod === 'GET' && path === '/organizations') {
      const params = {
        TableName: TABLE_NAME,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk',
        ExpressionAttributeValues: {
          ':pk': 'ORGANIZATION'
        }
      };
      
      const result = await dynamodb.query(params).promise();
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(result.Items)
      };
    }
    
    // GET /organizations/{id} - Get single organization
    if (httpMethod === 'GET' && pathParameters?.id) {
      const params = {
        TableName: TABLE_NAME,
        Key: {
          PK: `ORG#${pathParameters.id}`,
          SK: `ORG#${pathParameters.id}`
        }
      };
      
      const result = await dynamodb.get(params).promise();
      
      if (!result.Item) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Organization not found' })
        };
      }
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(result.Item)
      };
    }
    
    // POST /organizations - Create new organization
    if (httpMethod === 'POST' && path === '/organizations') {
      const data = JSON.parse(body);
      const orgId = `org-${uuidv4()}`;
      const tempPassword = `Temp${Math.random().toString(36).slice(2, 10)}!`;
      
      // Create organization
      const organization = {
        PK: `ORG#${orgId}`,
        SK: `ORG#${orgId}`,
        GSI1PK: 'ORGANIZATION',
        GSI1SK: data.name,
        id: orgId,
        name: data.name,
        domain: data.domain || null,
        plan: data.plan,
        status: 'active',
        features: [...new Set([...(data.customFeatures || []), ...(getDefaultFeatures(data.plan))])],
        limits: data.limits,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: user.id
      };
      
      await dynamodb.put({
        TableName: TABLE_NAME,
        Item: organization
      }).promise();
      
      // Create admin user in Cognito
      const adminUserId = await cognito.adminCreateUser({
        UserPoolId: USER_POOL_ID,
        Username: data.adminEmail,
        UserAttributes: [
          { Name: 'email', Value: data.adminEmail },
          { Name: 'name', Value: data.adminName },
          { Name: 'email_verified', Value: 'true' }
        ],
        TemporaryPassword: tempPassword,
        MessageAction: 'SUPPRESS'
      }).promise().then(res => res.User.Username);
      
      // Create admin user in DynamoDB
      const adminUser = {
        PK: `USER#${adminUserId}`,
        SK: `USER#${adminUserId}`,
        GSI1PK: 'USER',
        GSI1SK: data.adminEmail,
        GSI2PK: `ORG#${orgId}`,
        GSI2SK: `USER#admin`,
        id: adminUserId,
        email: data.adminEmail,
        name: data.adminName,
        role: 'admin',
        organizationId: orgId,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await dynamodb.put({
        TableName: TABLE_NAME,
        Item: adminUser
      }).promise();
      
      // Send invitation email
      await sendInvitationEmail(organization, data.adminEmail, data.adminName, tempPassword);
      
      return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify({
          organization,
          message: 'Organization created and invitation sent'
        })
      };
    }
    
    // PUT /organizations/{id}/status - Update organization status
    if (httpMethod === 'PUT' && path.includes('/status')) {
      const data = JSON.parse(body);
      const orgId = pathParameters.id;
      
      await dynamodb.update({
        TableName: TABLE_NAME,
        Key: {
          PK: `ORG#${orgId}`,
          SK: `ORG#${orgId}`
        },
        UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':status': data.status,
          ':updatedAt': new Date().toISOString()
        }
      }).promise();
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Status updated successfully' })
      };
    }
    
    // PUT /organizations/{id}/features - Update organization features
    if (httpMethod === 'PUT' && path.includes('/features')) {
      const data = JSON.parse(body);
      const orgId = pathParameters.id;
      
      await dynamodb.update({
        TableName: TABLE_NAME,
        Key: {
          PK: `ORG#${orgId}`,
          SK: `ORG#${orgId}`
        },
        UpdateExpression: 'SET features = :features, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':features': data.features,
          ':updatedAt': new Date().toISOString()
        }
      }).promise();
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Features updated successfully' })
      };
    }
    
    // PUT /organizations/{id} - Update organization details
    if (httpMethod === 'PUT' && pathParameters?.id) {
      const data = JSON.parse(body);
      const orgId = pathParameters.id;
      
      const updateExpression = [];
      const expressionAttributeNames = {};
      const expressionAttributeValues = {
        ':updatedAt': new Date().toISOString()
      };
      
      if (data.name !== undefined) {
        updateExpression.push('#name = :name');
        expressionAttributeNames['#name'] = 'name';
        expressionAttributeValues[':name'] = data.name;
      }
      
      if (data.domain !== undefined) {
        updateExpression.push('domain = :domain');
        expressionAttributeValues[':domain'] = data.domain;
      }
      
      if (data.plan !== undefined) {
        updateExpression.push('#plan = :plan');
        expressionAttributeNames['#plan'] = 'plan';
        expressionAttributeValues[':plan'] = data.plan;
      }
      
      if (data.limits !== undefined) {
        updateExpression.push('limits = :limits');
        expressionAttributeValues[':limits'] = data.limits;
      }
      
      updateExpression.push('updatedAt = :updatedAt');
      
      await dynamodb.update({
        TableName: TABLE_NAME,
        Key: {
          PK: `ORG#${orgId}`,
          SK: `ORG#${orgId}`
        },
        UpdateExpression: `SET ${updateExpression.join(', ')}`,
        ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
        ExpressionAttributeValues
      }).promise();
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Organization updated successfully' })
      };
    }
    
    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Not found' })
    };
    
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        message: 'Internal server error',
        error: error.message 
      })
    };
  }
};

function getDefaultFeatures(plan) {
  const features = {
    starter: [
      'campaigns',
      'shows',
      'episodes',
      'ad_approvals',
      'analytics',
      'billing'
    ],
    professional: [
      'campaigns',
      'shows',
      'episodes',
      'ad_approvals',
      'analytics',
      'advanced_analytics',
      'billing',
      'integrations',
      'api_access',
      'audit_logs',
      'backups'
    ],
    enterprise: [
      'campaigns',
      'shows',
      'episodes',
      'ad_approvals',
      'analytics',
      'advanced_analytics',
      'billing',
      'integrations',
      'api_access',
      'webhooks',
      'custom_branding',
      'sso',
      'audit_logs',
      'backups',
      'priority_support'
    ]
  };
  
  return features[plan] || features.starter;
}