#!/bin/bash

# Simple API deployment script that uses inline Lambda code

set -e

STACK_NAME="podcastflow-api"
REGION="${AWS_REGION:-us-east-1}"
TABLE_NAME="podcastflow-pro"

echo "Deploying PodcastFlow Pro API Infrastructure..."

# Get existing Cognito User Pool details
USER_POOL_ID=$(aws cloudformation describe-stacks \
    --stack-name podcastflow-auth \
    --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
    --output text)

USER_POOL_ARN="arn:aws:cognito-idp:${REGION}:$(aws sts get-caller-identity --query Account --output text):userpool/${USER_POOL_ID}"

echo "Using User Pool: ${USER_POOL_ID}"

# Create simple API stack with inline Lambda code
cat > /tmp/api-stack-simple.yaml << 'EOF'
AWSTemplateFormatVersion: '2010-09-09'
Description: PodcastFlow Pro API Infrastructure

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
    Type: AWS::ApiGateway::RestApi
    Properties:
      Name: PodcastFlow-Pro-API
      Description: PodcastFlow Pro API
      EndpointConfiguration:
        Types:
          - REGIONAL

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

  # Campaigns Lambda Function
  CampaignFunction:
    Type: AWS::Lambda::Function
    Properties:
      FunctionName: !Sub ${AWS::StackName}-campaigns
      Runtime: nodejs18.x
      Handler: index.handler
      Role: !GetAtt LambdaExecutionRole.Arn
      Timeout: 30
      Environment:
        Variables:
          DYNAMODB_TABLE_NAME: !Ref TableName
      Code:
        ZipFile: |
          const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME;
          
          exports.handler = async (event) => {
              const headers = {
                  'Content-Type': 'application/json',
                  'Access-Control-Allow-Origin': '*',
                  'Access-Control-Allow-Headers': '*'
              };
              
              try {
                  // Mock implementation for now
                  const mockCampaigns = [
                      {
                          id: '1',
                          name: 'Summer Podcast Campaign 2024',
                          client: 'Tech Innovators Inc',
                          status: 'active',
                          budget: 50000,
                          spent: 32500,
                          impressions: 1250000,
                          clicks: 35000
                      }
                  ];
                  
                  return {
                      statusCode: 200,
                      headers,
                      body: JSON.stringify({
                          Items: mockCampaigns,
                          Count: mockCampaigns.length
                      })
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

  # Analytics Lambda Function
  AnalyticsFunction:
    Type: AWS::Lambda::Function
    Properties:
      FunctionName: !Sub ${AWS::StackName}-analytics
      Runtime: nodejs18.x
      Handler: index.handler
      Role: !GetAtt LambdaExecutionRole.Arn
      Timeout: 30
      Environment:
        Variables:
          DYNAMODB_TABLE_NAME: !Ref TableName
      Code:
        ZipFile: |
          exports.handler = async (event) => {
              const headers = {
                  'Content-Type': 'application/json',
                  'Access-Control-Allow-Origin': '*',
                  'Access-Control-Allow-Headers': '*'
              };
              
              try {
                  const mockMetrics = {
                      totalRevenue: 1230000,
                      activeCampaigns: 42,
                      totalImpressions: 15200000,
                      totalClicks: 425000,
                      uniqueListeners: 892000
                  };
                  
                  return {
                      statusCode: 200,
                      headers,
                      body: JSON.stringify(mockMetrics)
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

  # API Gateway Deployment
  ApiDeployment:
    Type: AWS::ApiGateway::Deployment
    DependsOn:
      - CampaignGetMethod
      - CampaignListMethod
      - AnalyticsMethod
    Properties:
      RestApiId: !Ref PodcastFlowApi
      StageName: prod

  # Campaign Resources
  CampaignResource:
    Type: AWS::ApiGateway::Resource
    Properties:
      RestApiId: !Ref PodcastFlowApi
      ParentId: !GetAtt PodcastFlowApi.RootResourceId
      PathPart: campaigns

  CampaignListMethod:
    Type: AWS::ApiGateway::Method
    Properties:
      RestApiId: !Ref PodcastFlowApi
      ResourceId: !Ref CampaignResource
      HttpMethod: GET
      AuthorizationType: NONE
      Integration:
        Type: AWS_PROXY
        IntegrationHttpMethod: POST
        Uri: !Sub 'arn:aws:apigateway:${AWS::Region}:lambda:path/2015-03-31/functions/${CampaignFunction.Arn}/invocations'
      MethodResponses:
        - StatusCode: 200
          ResponseParameters:
            method.response.header.Access-Control-Allow-Origin: true

  CampaignIdResource:
    Type: AWS::ApiGateway::Resource
    Properties:
      RestApiId: !Ref PodcastFlowApi
      ParentId: !Ref CampaignResource
      PathPart: '{id}'

  CampaignGetMethod:
    Type: AWS::ApiGateway::Method
    Properties:
      RestApiId: !Ref PodcastFlowApi
      ResourceId: !Ref CampaignIdResource
      HttpMethod: GET
      AuthorizationType: NONE
      Integration:
        Type: AWS_PROXY
        IntegrationHttpMethod: POST
        Uri: !Sub 'arn:aws:apigateway:${AWS::Region}:lambda:path/2015-03-31/functions/${CampaignFunction.Arn}/invocations'

  # Analytics Resources
  AnalyticsResource:
    Type: AWS::ApiGateway::Resource
    Properties:
      RestApiId: !Ref PodcastFlowApi
      ParentId: !GetAtt PodcastFlowApi.RootResourceId
      PathPart: analytics

  AnalyticsDashboardResource:
    Type: AWS::ApiGateway::Resource
    Properties:
      RestApiId: !Ref PodcastFlowApi
      ParentId: !Ref AnalyticsResource
      PathPart: dashboard

  AnalyticsMethod:
    Type: AWS::ApiGateway::Method
    Properties:
      RestApiId: !Ref PodcastFlowApi
      ResourceId: !Ref AnalyticsDashboardResource
      HttpMethod: GET
      AuthorizationType: NONE
      Integration:
        Type: AWS_PROXY
        IntegrationHttpMethod: POST
        Uri: !Sub 'arn:aws:apigateway:${AWS::Region}:lambda:path/2015-03-31/functions/${AnalyticsFunction.Arn}/invocations'

  # Lambda Permissions
  CampaignLambdaPermission:
    Type: AWS::Lambda::Permission
    Properties:
      FunctionName: !Ref CampaignFunction
      Action: lambda:InvokeFunction
      Principal: apigateway.amazonaws.com
      SourceArn: !Sub 'arn:aws:execute-api:${AWS::Region}:${AWS::AccountId}:${PodcastFlowApi}/*/*'

  AnalyticsLambdaPermission:
    Type: AWS::Lambda::Permission
    Properties:
      FunctionName: !Ref AnalyticsFunction
      Action: lambda:InvokeFunction
      Principal: apigateway.amazonaws.com
      SourceArn: !Sub 'arn:aws:execute-api:${AWS::Region}:${AWS::AccountId}:${PodcastFlowApi}/*/*'

  # CORS Configuration
  CampaignOptionsMethod:
    Type: AWS::ApiGateway::Method
    Properties:
      RestApiId: !Ref PodcastFlowApi
      ResourceId: !Ref CampaignResource
      HttpMethod: OPTIONS
      AuthorizationType: NONE
      Integration:
        Type: MOCK
        IntegrationResponses:
          - StatusCode: 200
            ResponseParameters:
              method.response.header.Access-Control-Allow-Headers: "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
              method.response.header.Access-Control-Allow-Methods: "'GET,POST,PUT,DELETE,OPTIONS'"
              method.response.header.Access-Control-Allow-Origin: "'*'"
            ResponseTemplates:
              application/json: ''
        RequestTemplates:
          application/json: '{"statusCode": 200}'
      MethodResponses:
        - StatusCode: 200
          ResponseParameters:
            method.response.header.Access-Control-Allow-Headers: true
            method.response.header.Access-Control-Allow-Methods: true
            method.response.header.Access-Control-Allow-Origin: true

Outputs:
  ApiEndpoint:
    Description: API Gateway endpoint URL
    Value: !Sub https://${PodcastFlowApi}.execute-api.${AWS::Region}.amazonaws.com/prod
    Export:
      Name: !Sub ${AWS::StackName}-endpoint
EOF

# Deploy the stack
echo "Deploying API stack..."
aws cloudformation deploy \
    --template-file /tmp/api-stack-simple.yaml \
    --stack-name ${STACK_NAME} \
    --parameter-overrides \
        TableName=${TABLE_NAME} \
        UserPoolId=${USER_POOL_ID} \
        UserPoolArn=${USER_POOL_ARN} \
    --capabilities CAPABILITY_IAM \
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
echo ""
echo "Next steps:"
echo "1. The API is now deployed with basic mock functionality"
echo "2. You can enhance the Lambda functions later with full DynamoDB integration"
echo "3. The frontend will automatically use the real API endpoint"