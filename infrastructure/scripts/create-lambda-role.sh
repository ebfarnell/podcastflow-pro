#!/bin/bash

# Create IAM Role for Lambda Functions
# This script creates the necessary IAM role and policies for the Lambda functions

set -e

echo "Creating IAM Role for Lambda Functions..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

ROLE_NAME="PodcastFlowProLambdaRole"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=${AWS_REGION:-us-east-1}

# Check if role already exists
if aws iam get-role --role-name $ROLE_NAME 2>/dev/null; then
    echo -e "${YELLOW}Role $ROLE_NAME already exists${NC}"
else
    echo -e "${GREEN}Creating IAM role: $ROLE_NAME${NC}"
    
    # Create trust policy
    cat > trust-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

    # Create role
    aws iam create-role \
        --role-name $ROLE_NAME \
        --assume-role-policy-document file://trust-policy.json \
        --description "Role for PodcastFlow Pro Lambda functions"
    
    rm trust-policy.json
fi

# Create and attach policy
POLICY_NAME="PodcastFlowProLambdaPolicy"

echo -e "${GREEN}Creating IAM policy: $POLICY_NAME${NC}"

# Create policy document
cat > lambda-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:${REGION}:${ACCOUNT_ID}:*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan"
      ],
      "Resource": [
        "arn:aws:dynamodb:${REGION}:${ACCOUNT_ID}:table/PodcastFlowPro",
        "arn:aws:dynamodb:${REGION}:${ACCOUNT_ID}:table/PodcastFlowPro/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::podcastflow-*/*",
        "arn:aws:s3:::podcastflow-*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "cognito-idp:AdminGetUser",
        "cognito-idp:AdminSetUserPassword",
        "cognito-idp:AdminUpdateUserAttributes"
      ],
      "Resource": "arn:aws:cognito-idp:${REGION}:${ACCOUNT_ID}:userpool/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ses:SendEmail",
        "ses:SendRawEmail"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "apigateway:GET",
        "apigateway:POST",
        "apigateway:PUT",
        "apigateway:DELETE"
      ],
      "Resource": "arn:aws:apigateway:${REGION}::/restapis/*/apikeys/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "events:PutRule",
        "events:DeleteRule",
        "events:PutTargets",
        "events:RemoveTargets",
        "events:DisableRule",
        "events:EnableRule"
      ],
      "Resource": "arn:aws:events:${REGION}:${ACCOUNT_ID}:rule/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "states:StartExecution"
      ],
      "Resource": "arn:aws:states:${REGION}:${ACCOUNT_ID}:stateMachine:*"
    }
  ]
}
EOF

# Check if policy exists
POLICY_ARN="arn:aws:iam::${ACCOUNT_ID}:policy/${POLICY_NAME}"
if aws iam get-policy --policy-arn $POLICY_ARN 2>/dev/null; then
    echo -e "${YELLOW}Policy already exists, creating new version${NC}"
    # Create new policy version
    aws iam create-policy-version \
        --policy-arn $POLICY_ARN \
        --policy-document file://lambda-policy.json \
        --set-as-default
else
    # Create policy
    aws iam create-policy \
        --policy-name $POLICY_NAME \
        --policy-document file://lambda-policy.json \
        --description "Policy for PodcastFlow Pro Lambda functions"
fi

# Attach policy to role
echo -e "${GREEN}Attaching policy to role${NC}"
aws iam attach-role-policy \
    --role-name $ROLE_NAME \
    --policy-arn $POLICY_ARN

# Attach AWS managed policy for basic Lambda execution
aws iam attach-role-policy \
    --role-name $ROLE_NAME \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

rm lambda-policy.json

echo -e "\n${GREEN}IAM role created successfully!${NC}"
echo "Role ARN: arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"