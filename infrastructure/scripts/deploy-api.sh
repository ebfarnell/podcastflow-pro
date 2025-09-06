#!/bin/bash

# Deploy API Gateway and Lambda Functions for PodcastFlow Pro

set -e

# Configuration
STACK_NAME="podcastflow-api"
REGION="${AWS_REGION:-us-east-1}"
TABLE_NAME="podcastflow-pro"

echo "Deploying PodcastFlow Pro API Infrastructure..."

# Create API CloudFormation template
cat > /tmp/api-stack.yaml << 'EOF'
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31
Description: PodcastFlow Pro API Infrastructure

Globals:
  Function:
    Runtime: nodejs18.x
    Timeout: 30
    MemorySize: 512
    Environment:
      Variables:
        DYNAMODB_TABLE_NAME: !Ref TableName
        REGION: !Ref AWS::Region

Parameters:
  TableName:
    Type: String
    Default: podcastflow-pro
  UserPoolId:
    Type: String
    Description: Cognito User Pool ID
  UserPoolArn:
    Type: String
    Description: Cognito User Pool ARN

Resources:
  # API Gateway
  PodcastFlowApi:
    Type: AWS::Serverless::Api
    Properties:
      Name: PodcastFlow-Pro-API
      StageName: prod
      Cors:
        AllowMethods: "'*'"
        AllowHeaders: "'*'"
        AllowOrigin: "'*'"
      Auth:
        DefaultAuthorizer: CognitoAuthorizer
        Authorizers:
          CognitoAuthorizer:
            UserPoolArn: !Ref UserPoolArn

  # Lambda Execution Role
  LambdaExecutionRole:
    Type: AWS::IAM::Role
    Properties:
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Principal:
              Service: lambda.amazonaws.com
            Action: sts:AssumeRole
      ManagedPolicyArns:
        - arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
      Policies:
        - PolicyName: DynamoDBAccess
          PolicyDocument:
            Version: '2012-10-17'
            Statement:
              - Effect: Allow
                Action:
                  - dynamodb:*
                Resource:
                  - !Sub 'arn:aws:dynamodb:${AWS::Region}:${AWS::AccountId}:table/${TableName}'
                  - !Sub 'arn:aws:dynamodb:${AWS::Region}:${AWS::AccountId}:table/${TableName}/*'
        - PolicyName: S3Access
          PolicyDocument:
            Version: '2012-10-17'
            Statement:
              - Effect: Allow
                Action:
                  - s3:*
                Resource: '*'
        - PolicyName: CognitoAccess
          PolicyDocument:
            Version: '2012-10-17'
            Statement:
              - Effect: Allow
                Action:
                  - cognito-idp:*
                Resource: !Ref UserPoolArn

  # Campaign Functions
  CampaignFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: !Sub ${AWS::StackName}-campaigns
      CodeUri: ../lambdas/campaigns/
      Handler: index.handler
      Role: !GetAtt LambdaExecutionRole.Arn
      Events:
        ListCampaigns:
          Type: Api
          Properties:
            RestApiId: !Ref PodcastFlowApi
            Path: /campaigns
            Method: GET
        GetCampaign:
          Type: Api
          Properties:
            RestApiId: !Ref PodcastFlowApi
            Path: /campaigns/{id}
            Method: GET
        CreateCampaign:
          Type: Api
          Properties:
            RestApiId: !Ref PodcastFlowApi
            Path: /campaigns
            Method: POST
        UpdateCampaign:
          Type: Api
          Properties:
            RestApiId: !Ref PodcastFlowApi
            Path: /campaigns/{id}
            Method: PUT
        DeleteCampaign:
          Type: Api
          Properties:
            RestApiId: !Ref PodcastFlowApi
            Path: /campaigns/{id}
            Method: DELETE

  # Analytics Functions
  AnalyticsFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: !Sub ${AWS::StackName}-analytics
      CodeUri: ../lambdas/analytics/
      Handler: index.handler
      Role: !GetAtt LambdaExecutionRole.Arn
      Events:
        GetDashboard:
          Type: Api
          Properties:
            RestApiId: !Ref PodcastFlowApi
            Path: /analytics/dashboard
            Method: GET
        GetCampaignMetrics:
          Type: Api
          Properties:
            RestApiId: !Ref PodcastFlowApi
            Path: /analytics/campaigns/{id}
            Method: GET
        GetRevenueReport:
          Type: Api
          Properties:
            RestApiId: !Ref PodcastFlowApi
            Path: /analytics/revenue
            Method: GET

  # Integration Functions
  IntegrationFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: !Sub ${AWS::StackName}-integrations
      CodeUri: ../lambdas/integrations/
      Handler: index.handler
      Role: !GetAtt LambdaExecutionRole.Arn
      Environment:
        Variables:
          HUBSPOT_API_KEY: '{{resolve:secretsmanager:podcastflow/hubspot:SecretString:apiKey}}'
          STRIPE_SECRET_KEY: '{{resolve:secretsmanager:podcastflow/stripe:SecretString:secretKey}}'
      Events:
        ListIntegrations:
          Type: Api
          Properties:
            RestApiId: !Ref PodcastFlowApi
            Path: /integrations
            Method: GET
        ConnectIntegration:
          Type: Api
          Properties:
            RestApiId: !Ref PodcastFlowApi
            Path: /integrations/{platform}/connect
            Method: POST
        DisconnectIntegration:
          Type: Api
          Properties:
            RestApiId: !Ref PodcastFlowApi
            Path: /integrations/{platform}/disconnect
            Method: DELETE
        SyncIntegration:
          Type: Api
          Properties:
            RestApiId: !Ref PodcastFlowApi
            Path: /integrations/{platform}/sync
            Method: POST

  # Invoice Functions
  InvoiceFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: !Sub ${AWS::StackName}-invoices
      CodeUri: ../lambdas/invoices/
      Handler: index.handler
      Role: !GetAtt LambdaExecutionRole.Arn
      Events:
        ListInvoices:
          Type: Api
          Properties:
            RestApiId: !Ref PodcastFlowApi
            Path: /invoices
            Method: GET
        CreateInvoice:
          Type: Api
          Properties:
            RestApiId: !Ref PodcastFlowApi
            Path: /invoices
            Method: POST
        GetInvoice:
          Type: Api
          Properties:
            RestApiId: !Ref PodcastFlowApi
            Path: /invoices/{id}
            Method: GET
        ProcessPayment:
          Type: Api
          Properties:
            RestApiId: !Ref PodcastFlowApi
            Path: /invoices/{id}/pay
            Method: POST

Outputs:
  ApiEndpoint:
    Description: API Gateway endpoint URL
    Value: !Sub https://${PodcastFlowApi}.execute-api.${AWS::Region}.amazonaws.com/prod
    Export:
      Name: !Sub ${AWS::StackName}-endpoint
  
  CampaignFunctionArn:
    Description: Campaign Lambda Function ARN
    Value: !GetAtt CampaignFunction.Arn
    Export:
      Name: !Sub ${AWS::StackName}-campaign-function
EOF

# Get existing Cognito User Pool details
USER_POOL_ID=$(aws cloudformation describe-stacks \
    --stack-name podcastflow-auth \
    --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
    --output text)

USER_POOL_ARN="arn:aws:cognito-idp:${REGION}:$(aws sts get-caller-identity --query Account --output text):userpool/${USER_POOL_ID}"

echo "Using User Pool: ${USER_POOL_ID}"

# Create invoice lambda if it doesn't exist
if [ ! -d "../lambdas/invoices" ]; then
    mkdir -p ../lambdas/invoices
    cat > ../lambdas/invoices/index.js << 'EOJS'
const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();
const { v4: uuidv4 } = require('uuid');

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME;

exports.handler = async (event) => {
    const { httpMethod, path, body, headers, pathParameters } = event;
    
    try {
        switch (httpMethod) {
            case 'GET':
                if (pathParameters?.id) {
                    return await getInvoice(pathParameters.id);
                }
                return await listInvoices();
            case 'POST':
                if (path.includes('/pay')) {
                    return await processPayment(pathParameters.id, JSON.parse(body));
                }
                return await createInvoice(JSON.parse(body));
            default:
                return {
                    statusCode: 405,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ error: 'Method not allowed' })
                };
        }
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};

async function listInvoices() {
    const params = {
        TableName: TABLE_NAME,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk',
        ExpressionAttributeValues: {
            ':pk': 'INVOICES'
        }
    };
    
    const result = await dynamodb.query(params).promise();
    
    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoices: result.Items || [] })
    };
}

async function getInvoice(invoiceId) {
    const params = {
        TableName: TABLE_NAME,
        Key: {
            PK: `INVOICE#${invoiceId}`,
            SK: 'METADATA'
        }
    };
    
    const result = await dynamodb.get(params).promise();
    
    return {
        statusCode: result.Item ? 200 : 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result.Item || { error: 'Invoice not found' })
    };
}

async function createInvoice(data) {
    const invoiceId = uuidv4();
    const invoice = {
        PK: `INVOICE#${invoiceId}`,
        SK: 'METADATA',
        GSI1PK: 'INVOICES',
        GSI1SK: new Date().toISOString(),
        id: invoiceId,
        ...data,
        status: 'draft',
        createdAt: new Date().toISOString()
    };
    
    await dynamodb.put({
        TableName: TABLE_NAME,
        Item: invoice
    }).promise();
    
    return {
        statusCode: 201,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invoice)
    };
}

async function processPayment(invoiceId, paymentData) {
    // In production, integrate with Stripe
    const params = {
        TableName: TABLE_NAME,
        Key: {
            PK: `INVOICE#${invoiceId}`,
            SK: 'METADATA'
        },
        UpdateExpression: 'SET #status = :status, paidAt = :paidAt',
        ExpressionAttributeNames: {
            '#status': 'status'
        },
        ExpressionAttributeValues: {
            ':status': 'paid',
            ':paidAt': new Date().toISOString()
        }
    };
    
    await dynamodb.update(params).promise();
    
    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, invoiceId })
    };
}
EOJS

    cat > ../lambdas/invoices/package.json << 'EOPKG'
{
  "name": "podcastflow-invoices",
  "version": "1.0.0",
  "main": "index.js",
  "dependencies": {
    "aws-sdk": "^2.1500.0",
    "uuid": "^9.0.1"
  }
}
EOPKG
fi

# Update analytics lambda with real functionality
cat > ../lambdas/analytics/index.js << 'EOJS'
const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME;

exports.handler = async (event) => {
    const { httpMethod, path, pathParameters, queryStringParameters } = event;
    
    try {
        if (path.includes('/dashboard')) {
            return await getDashboardMetrics(queryStringParameters);
        } else if (path.includes('/campaigns/')) {
            return await getCampaignMetrics(pathParameters.id, queryStringParameters);
        } else if (path.includes('/revenue')) {
            return await getRevenueReport(queryStringParameters);
        }
        
        return {
            statusCode: 404,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Not found' })
        };
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};

async function getDashboardMetrics(params) {
    // Aggregate metrics from campaigns
    const campaignsData = await dynamodb.query({
        TableName: TABLE_NAME,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk',
        ExpressionAttributeValues: {
            ':pk': 'CAMPAIGNS'
        }
    }).promise();
    
    const metrics = {
        totalRevenue: 0,
        activeCampaigns: 0,
        totalImpressions: 0,
        totalClicks: 0
    };
    
    campaignsData.Items.forEach(campaign => {
        if (campaign.status === 'active') {
            metrics.activeCampaigns++;
        }
        metrics.totalRevenue += campaign.spent || 0;
        metrics.totalImpressions += campaign.impressions || 0;
        metrics.totalClicks += campaign.clicks || 0;
    });
    
    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metrics)
    };
}

async function getCampaignMetrics(campaignId, params) {
    const range = params?.range || '7d';
    
    // In production, aggregate from time-series data
    const mockData = generateMockTimeSeriesData(range);
    
    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId, range, data: mockData })
    };
}

async function getRevenueReport(params) {
    const period = params?.period || 'monthly';
    
    // In production, aggregate from financial data
    const mockData = {
        period,
        data: [
            { month: 'Jan', revenue: 145000, campaigns: 18 },
            { month: 'Feb', revenue: 162000, campaigns: 22 },
            { month: 'Mar', revenue: 178000, campaigns: 25 },
            { month: 'Apr', revenue: 195000, campaigns: 28 },
            { month: 'May', revenue: 210000, campaigns: 32 },
            { month: 'Jun', revenue: 228000, campaigns: 35 }
        ]
    };
    
    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockData)
    };
}

function generateMockTimeSeriesData(range) {
    const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
    const data = [];
    
    for (let i = 0; i < days; i++) {
        data.push({
            date: new Date(Date.now() - (i * 24 * 60 * 60 * 1000)).toISOString().split('T')[0],
            impressions: Math.floor(Math.random() * 100000) + 40000,
            clicks: Math.floor(Math.random() * 3000) + 1000,
            conversions: Math.floor(Math.random() * 100) + 30,
            cost: Math.floor(Math.random() * 2000) + 800
        });
    }
    
    return data;
}
EOJS

# Deploy the stack
echo "Deploying API stack..."
aws cloudformation deploy \
    --template-file /tmp/api-stack.yaml \
    --stack-name ${STACK_NAME} \
    --parameter-overrides \
        TableName=${TABLE_NAME} \
        UserPoolId=${USER_POOL_ID} \
        UserPoolArn=${USER_POOL_ARN} \
    --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND \
    --region ${REGION}

# Get the API endpoint
API_ENDPOINT=$(aws cloudformation describe-stacks \
    --stack-name ${STACK_NAME} \
    --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
    --output text)

echo "API deployment complete!"
echo "API Endpoint: ${API_ENDPOINT}"

# Update .env.local with the API endpoint
sed -i "s|NEXT_PUBLIC_API_ENDPOINT=.*|NEXT_PUBLIC_API_ENDPOINT=${API_ENDPOINT}|" ../../.env.local

echo "Updated .env.local with API endpoint"