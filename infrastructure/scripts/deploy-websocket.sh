#!/bin/bash

# WebSocket deployment script for PodcastFlow Pro

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}Deploying WebSocket infrastructure...${NC}"

# Configuration
STACK_NAME="podcastflow-websocket-stack"
REGION="us-east-1"
LAMBDA_BUCKET="podcastflow-lambda-deployments"
RUNTIME="nodejs18.x"
MEMORY_SIZE="256"
TIMEOUT="30"

# Create deployment package
echo -e "${YELLOW}Creating deployment package...${NC}"
cd /home/ec2-user/podcastflow-pro/infrastructure/lambdas/websocket
zip -r websocket-function.zip index.js

# Upload to S3
echo -e "${YELLOW}Uploading to S3...${NC}"
aws s3 cp websocket-function.zip s3://$LAMBDA_BUCKET/websocket-function.zip

# Create CloudFormation template
cat > /tmp/websocket-stack.yaml << 'EOF'
AWSTemplateFormatVersion: '2010-09-09'
Description: 'WebSocket API for PodcastFlow Pro real-time updates'

Parameters:
  LambdaBucket:
    Type: String
    Description: S3 bucket containing Lambda deployment packages
  UserPoolId:
    Type: String
    Description: Cognito User Pool ID

Resources:
  # DynamoDB Tables
  ConnectionsTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: WebSocketConnections
      BillingMode: PAY_PER_REQUEST
      AttributeDefinitions:
        - AttributeName: connectionId
          AttributeType: S
      KeySchema:
        - AttributeName: connectionId
          KeyType: HASH
      TimeToLiveSpecification:
        AttributeName: ttl
        Enabled: true

  SubscriptionsTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: WebSocketSubscriptions
      BillingMode: PAY_PER_REQUEST
      AttributeDefinitions:
        - AttributeName: subscriptionKey
          AttributeType: S
        - AttributeName: connectionId
          AttributeType: S
      KeySchema:
        - AttributeName: subscriptionKey
          KeyType: HASH
        - AttributeName: connectionId
          KeyType: RANGE
      GlobalSecondaryIndexes:
        - IndexName: connectionId-index
          KeySchema:
            - AttributeName: connectionId
              KeyType: HASH
          Projection:
            ProjectionType: ALL
      TimeToLiveSpecification:
        AttributeName: ttl
        Enabled: true

  # Lambda Execution Role
  WebSocketLambdaRole:
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
        - PolicyName: WebSocketPolicy
          PolicyDocument:
            Version: '2012-10-17'
            Statement:
              - Effect: Allow
                Action:
                  - dynamodb:GetItem
                  - dynamodb:PutItem
                  - dynamodb:DeleteItem
                  - dynamodb:Query
                  - dynamodb:Scan
                Resource:
                  - !GetAtt ConnectionsTable.Arn
                  - !GetAtt SubscriptionsTable.Arn
                  - !Sub '${SubscriptionsTable.Arn}/index/*'
              - Effect: Allow
                Action:
                  - execute-api:ManageConnections
                Resource: !Sub 'arn:aws:execute-api:${AWS::Region}:${AWS::AccountId}:${WebSocketApi}/*'

  # Lambda Function
  WebSocketLambda:
    Type: AWS::Lambda::Function
    Properties:
      FunctionName: podcastflow-websocket-handler
      Runtime: nodejs18.x
      Handler: index.handler
      Code:
        S3Bucket: !Ref LambdaBucket
        S3Key: websocket-function.zip
      MemorySize: 256
      Timeout: 30
      Role: !GetAtt WebSocketLambdaRole.Arn
      Environment:
        Variables:
          CONNECTIONS_TABLE_NAME: !Ref ConnectionsTable
          SUBSCRIPTIONS_TABLE_NAME: !Ref SubscriptionsTable
          WEBSOCKET_ENDPOINT: !Sub 'https://${WebSocketApi}.execute-api.${AWS::Region}.amazonaws.com/prod'

  # Lambda Permission for WebSocket
  WebSocketLambdaPermission:
    Type: AWS::Lambda::Permission
    Properties:
      FunctionName: !Ref WebSocketLambda
      Action: lambda:InvokeFunction
      Principal: apigateway.amazonaws.com
      SourceArn: !Sub 'arn:aws:execute-api:${AWS::Region}:${AWS::AccountId}:${WebSocketApi}/*'

  # WebSocket API
  WebSocketApi:
    Type: AWS::ApiGatewayV2::Api
    Properties:
      Name: PodcastFlowWebSocketAPI
      ProtocolType: WEBSOCKET
      RouteSelectionExpression: '$request.body.action'

  # Authorizer
  WebSocketAuthorizer:
    Type: AWS::ApiGatewayV2::Authorizer
    Properties:
      Name: WebSocketAuthorizer
      ApiId: !Ref WebSocketApi
      AuthorizerType: REQUEST
      AuthorizerUri: !Sub 'arn:aws:apigateway:${AWS::Region}:lambda:path/2015-03-31/functions/${WebSocketLambda.Arn}/invocations'
      IdentitySource:
        - 'route.request.header.Authorization'

  # Routes
  ConnectRoute:
    Type: AWS::ApiGatewayV2::Route
    Properties:
      ApiId: !Ref WebSocketApi
      RouteKey: '$connect'
      AuthorizationType: NONE
      Target: !Sub 'integrations/${ConnectIntegration}'

  DisconnectRoute:
    Type: AWS::ApiGatewayV2::Route
    Properties:
      ApiId: !Ref WebSocketApi
      RouteKey: '$disconnect'
      AuthorizationType: NONE
      Target: !Sub 'integrations/${DisconnectIntegration}'

  SubscribeRoute:
    Type: AWS::ApiGatewayV2::Route
    Properties:
      ApiId: !Ref WebSocketApi
      RouteKey: 'subscribe'
      AuthorizationType: NONE
      Target: !Sub 'integrations/${SubscribeIntegration}'

  UnsubscribeRoute:
    Type: AWS::ApiGatewayV2::Route
    Properties:
      ApiId: !Ref WebSocketApi
      RouteKey: 'unsubscribe'
      AuthorizationType: NONE
      Target: !Sub 'integrations/${UnsubscribeIntegration}'

  BroadcastRoute:
    Type: AWS::ApiGatewayV2::Route
    Properties:
      ApiId: !Ref WebSocketApi
      RouteKey: 'broadcast'
      AuthorizationType: NONE
      Target: !Sub 'integrations/${BroadcastIntegration}'

  # Integrations
  ConnectIntegration:
    Type: AWS::ApiGatewayV2::Integration
    Properties:
      ApiId: !Ref WebSocketApi
      IntegrationType: AWS_PROXY
      IntegrationUri: !Sub 'arn:aws:apigateway:${AWS::Region}:lambda:path/2015-03-31/functions/${WebSocketLambda.Arn}/invocations'

  DisconnectIntegration:
    Type: AWS::ApiGatewayV2::Integration
    Properties:
      ApiId: !Ref WebSocketApi
      IntegrationType: AWS_PROXY
      IntegrationUri: !Sub 'arn:aws:apigateway:${AWS::Region}:lambda:path/2015-03-31/functions/${WebSocketLambda.Arn}/invocations'

  SubscribeIntegration:
    Type: AWS::ApiGatewayV2::Integration
    Properties:
      ApiId: !Ref WebSocketApi
      IntegrationType: AWS_PROXY
      IntegrationUri: !Sub 'arn:aws:apigateway:${AWS::Region}:lambda:path/2015-03-31/functions/${WebSocketLambda.Arn}/invocations'

  UnsubscribeIntegration:
    Type: AWS::ApiGatewayV2::Integration
    Properties:
      ApiId: !Ref WebSocketApi
      IntegrationType: AWS_PROXY
      IntegrationUri: !Sub 'arn:aws:apigateway:${AWS::Region}:lambda:path/2015-03-31/functions/${WebSocketLambda.Arn}/invocations'

  BroadcastIntegration:
    Type: AWS::ApiGatewayV2::Integration
    Properties:
      ApiId: !Ref WebSocketApi
      IntegrationType: AWS_PROXY
      IntegrationUri: !Sub 'arn:aws:apigateway:${AWS::Region}:lambda:path/2015-03-31/functions/${WebSocketLambda.Arn}/invocations'

  # Deployment
  WebSocketDeployment:
    Type: AWS::ApiGatewayV2::Deployment
    DependsOn:
      - ConnectRoute
      - DisconnectRoute
      - SubscribeRoute
      - UnsubscribeRoute
      - BroadcastRoute
    Properties:
      ApiId: !Ref WebSocketApi

  # Stage
  WebSocketStage:
    Type: AWS::ApiGatewayV2::Stage
    Properties:
      StageName: prod
      ApiId: !Ref WebSocketApi
      DeploymentId: !Ref WebSocketDeployment

Outputs:
  WebSocketEndpoint:
    Description: WebSocket API endpoint
    Value: !Sub 'wss://${WebSocketApi}.execute-api.${AWS::Region}.amazonaws.com/prod'
  ConnectionsTableName:
    Description: DynamoDB table for WebSocket connections
    Value: !Ref ConnectionsTable
  SubscriptionsTableName:
    Description: DynamoDB table for WebSocket subscriptions
    Value: !Ref SubscriptionsTable
EOF

# Get User Pool ID
USER_POOL_ID=$(aws cognito-idp list-user-pools --max-results 10 --query "UserPools[?Name=='PodcastFlowUserPool'].Id | [0]" --output text)

# Deploy CloudFormation stack
echo -e "${YELLOW}Deploying CloudFormation stack...${NC}"
aws cloudformation deploy \
  --template-file /tmp/websocket-stack.yaml \
  --stack-name $STACK_NAME \
  --parameter-overrides \
    LambdaBucket=$LAMBDA_BUCKET \
    UserPoolId=$USER_POOL_ID \
  --capabilities CAPABILITY_IAM \
  --region $REGION

# Get outputs
WEBSOCKET_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query "Stacks[0].Outputs[?OutputKey=='WebSocketEndpoint'].OutputValue" \
  --output text)

echo -e "${GREEN}WebSocket deployment complete!${NC}"
echo -e "${GREEN}WebSocket Endpoint: $WEBSOCKET_ENDPOINT${NC}"

# Clean up
rm -f websocket-function.zip
rm -f /tmp/websocket-stack.yaml