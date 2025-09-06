#!/bin/bash

# Setup script for PodcastFlow Pro Authentication

set -e

# Configuration
STACK_NAME="podcastflow-auth"
REGION="${AWS_REGION:-us-east-1}"
MASTER_EMAIL="${MASTER_EMAIL:-}"
MASTER_PASSWORD="${MASTER_PASSWORD:-}"

if [ -z "$MASTER_EMAIL" ] || [ -z "$MASTER_PASSWORD" ]; then
    echo "Error: MASTER_EMAIL and MASTER_PASSWORD environment variables must be set"
    echo "Usage: MASTER_EMAIL=admin@example.com MASTER_PASSWORD=SecurePass123! ./setup-auth.sh"
    exit 1
fi

echo "Setting up PodcastFlow Pro Authentication..."

# Deploy the CloudFormation stack without the user
cat > /tmp/auth-stack.yaml << 'EOF'
AWSTemplateFormatVersion: '2010-09-09'
Description: PodcastFlow Pro - Authentication Setup

Resources:
  UserPool:
    Type: AWS::Cognito::UserPool
    Properties:
      UserPoolName: podcastflow-pro-users
      UsernameAttributes:
        - email
      AutoVerifiedAttributes:
        - email
      Policies:
        PasswordPolicy:
          MinimumLength: 8
          RequireUppercase: true
          RequireLowercase: true
          RequireNumbers: true
          RequireSymbols: false
      AdminCreateUserConfig:
        AllowAdminCreateUserOnly: false
      Schema:
        - Name: email
          AttributeDataType: String
          Required: true
          Mutable: false

  UserPoolClient:
    Type: AWS::Cognito::UserPoolClient
    Properties:
      ClientName: podcastflow-pro-client
      UserPoolId: !Ref UserPool
      GenerateSecret: false
      ExplicitAuthFlows:
        - ALLOW_USER_PASSWORD_AUTH
        - ALLOW_REFRESH_TOKEN_AUTH
        - ALLOW_USER_SRP_AUTH
        - ALLOW_ADMIN_USER_PASSWORD_AUTH
      PreventUserExistenceErrors: ENABLED

  DynamoDBTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: podcastflow-pro
      BillingMode: PAY_PER_REQUEST
      AttributeDefinitions:
        - AttributeName: PK
          AttributeType: S
        - AttributeName: SK
          AttributeType: S
      KeySchema:
        - AttributeName: PK
          KeyType: HASH
        - AttributeName: SK
          KeyType: RANGE

Outputs:
  UserPoolId:
    Value: !Ref UserPool
    Export:
      Name: PodcastFlow-UserPoolId
  UserPoolClientId:
    Value: !Ref UserPoolClient
    Export:
      Name: PodcastFlow-UserPoolClientId
  TableName:
    Value: !Ref DynamoDBTable
    Export:
      Name: PodcastFlow-TableName
EOF

# Deploy the stack
echo "Deploying authentication infrastructure..."
aws cloudformation deploy \
    --template-file /tmp/auth-stack.yaml \
    --stack-name ${STACK_NAME} \
    --capabilities CAPABILITY_IAM \
    --region ${REGION}

# Get the outputs
echo "Getting stack outputs..."
USER_POOL_ID=$(aws cloudformation describe-stacks \
    --stack-name ${STACK_NAME} \
    --region ${REGION} \
    --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
    --output text)

USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks \
    --stack-name ${STACK_NAME} \
    --region ${REGION} \
    --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' \
    --output text)

TABLE_NAME=$(aws cloudformation describe-stacks \
    --stack-name ${STACK_NAME} \
    --region ${REGION} \
    --query 'Stacks[0].Outputs[?OutputKey==`TableName`].OutputValue' \
    --output text)

echo "User Pool ID: ${USER_POOL_ID}"
echo "User Pool Client ID: ${USER_POOL_CLIENT_ID}"
echo "DynamoDB Table: ${TABLE_NAME}"

# Create the master user
echo "Creating master user..."
aws cognito-idp admin-create-user \
    --user-pool-id ${USER_POOL_ID} \
    --username ${MASTER_EMAIL} \
    --user-attributes Name=email,Value=${MASTER_EMAIL} Name=email_verified,Value=true \
    --message-action SUPPRESS \
    --region ${REGION} || echo "User might already exist"

# Set permanent password
echo "Setting master user password..."
aws cognito-idp admin-set-user-password \
    --user-pool-id ${USER_POOL_ID} \
    --username ${MASTER_EMAIL} \
    --password "${MASTER_PASSWORD}" \
    --permanent \
    --region ${REGION}

# Create .env.local file with the values
echo "Creating .env.local file..."
cat > ../../.env.local << EOF
# AWS Configuration
NEXT_PUBLIC_AWS_REGION=${REGION}
NEXT_PUBLIC_USER_POOL_ID=${USER_POOL_ID}
NEXT_PUBLIC_USER_POOL_CLIENT_ID=${USER_POOL_CLIENT_ID}
NEXT_PUBLIC_API_ENDPOINT=https://api.podcastflowpro.com

# Database
DYNAMODB_TABLE_NAME=${TABLE_NAME}

# Master User Credentials
# Email: ${MASTER_EMAIL}
# Password: ${MASTER_PASSWORD}
EOF

echo "Setup complete!"
echo ""
echo "Master user credentials:"
echo "Email: ${MASTER_EMAIL}"
echo "Password: ${MASTER_PASSWORD}"
echo ""
echo "Environment variables have been saved to .env.local"