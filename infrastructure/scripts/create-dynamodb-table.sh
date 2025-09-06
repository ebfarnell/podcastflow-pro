#!/bin/bash

# Create DynamoDB table for PodcastFlow Pro

set -e

TABLE_NAME="podcastflow-pro"
REGION="${AWS_REGION:-us-east-1}"

echo "Creating DynamoDB table: ${TABLE_NAME}"

# Check if table already exists
TABLE_EXISTS=$(aws dynamodb list-tables --query "TableNames[?@=='${TABLE_NAME}']" --output text || echo "")

if [ -n "$TABLE_EXISTS" ]; then
    echo "Table ${TABLE_NAME} already exists!"
else
    # Create DynamoDB table with single-table design
    aws dynamodb create-table \
        --table-name ${TABLE_NAME} \
        --attribute-definitions \
            AttributeName=PK,AttributeType=S \
            AttributeName=SK,AttributeType=S \
            AttributeName=GSI1PK,AttributeType=S \
            AttributeName=GSI1SK,AttributeType=S \
            AttributeName=GSI2PK,AttributeType=S \
            AttributeName=GSI2SK,AttributeType=S \
        --key-schema \
            AttributeName=PK,KeyType=HASH \
            AttributeName=SK,KeyType=RANGE \
        --global-secondary-indexes \
            '[
                {
                    "IndexName": "GSI1",
                    "KeySchema": [
                        {"AttributeName": "GSI1PK", "KeyType": "HASH"},
                        {"AttributeName": "GSI1SK", "KeyType": "RANGE"}
                    ],
                    "Projection": {"ProjectionType": "ALL"},
                    "ProvisionedThroughput": {"ReadCapacityUnits": 5, "WriteCapacityUnits": 5}
                },
                {
                    "IndexName": "GSI2",
                    "KeySchema": [
                        {"AttributeName": "GSI2PK", "KeyType": "HASH"},
                        {"AttributeName": "GSI2SK", "KeyType": "RANGE"}
                    ],
                    "Projection": {"ProjectionType": "ALL"},
                    "ProvisionedThroughput": {"ReadCapacityUnits": 5, "WriteCapacityUnits": 5}
                }
            ]' \
        --provisioned-throughput \
            ReadCapacityUnits=5,WriteCapacityUnits=5 \
        --region ${REGION}

    echo "Waiting for table to be created..."
    aws dynamodb wait table-exists --table-name ${TABLE_NAME} --region ${REGION}
    echo "Table created successfully!"
fi

# Add some sample data
echo "Adding sample data..."

# Add sample campaigns
aws dynamodb put-item \
    --table-name ${TABLE_NAME} \
    --item '{
        "PK": {"S": "CAMPAIGN#1"},
        "SK": {"S": "METADATA"},
        "GSI1PK": {"S": "CAMPAIGNS"},
        "GSI1SK": {"S": "2024-06-01T00:00:00Z"},
        "id": {"S": "1"},
        "name": {"S": "Summer Podcast Campaign 2024"},
        "client": {"S": "Tech Innovators Inc"},
        "status": {"S": "active"},
        "startDate": {"S": "2024-06-01"},
        "endDate": {"S": "2024-08-31"},
        "budget": {"N": "50000"},
        "spent": {"N": "32500"},
        "impressions": {"N": "1250000"},
        "clicks": {"N": "35000"},
        "conversions": {"N": "1200"},
        "createdAt": {"S": "2024-05-15T10:00:00Z"},
        "updatedAt": {"S": "2024-07-01T14:30:00Z"}
    }' \
    --region ${REGION}

aws dynamodb put-item \
    --table-name ${TABLE_NAME} \
    --item '{
        "PK": {"S": "CAMPAIGN#2"},
        "SK": {"S": "METADATA"},
        "GSI1PK": {"S": "CAMPAIGNS"},
        "GSI1SK": {"S": "2024-11-15T00:00:00Z"},
        "id": {"S": "2"},
        "name": {"S": "Holiday Special Promotion"},
        "client": {"S": "Retail Giants Co"},
        "status": {"S": "paused"},
        "startDate": {"S": "2024-11-15"},
        "endDate": {"S": "2024-12-31"},
        "budget": {"N": "75000"},
        "spent": {"N": "12000"},
        "impressions": {"N": "450000"},
        "clicks": {"N": "12000"},
        "conversions": {"N": "450"},
        "createdAt": {"S": "2024-10-01T09:00:00Z"},
        "updatedAt": {"S": "2024-11-20T16:45:00Z"}
    }' \
    --region ${REGION}

# Add organization settings
aws dynamodb put-item \
    --table-name ${TABLE_NAME} \
    --item '{
        "PK": {"S": "ORG#default"},
        "SK": {"S": "SETTINGS"},
        "organizationName": {"S": "PodcastFlow Pro"},
        "primaryContact": {"S": "Michael@unfy.com"},
        "plan": {"S": "enterprise"},
        "features": {"L": [
            {"S": "advanced-analytics"},
            {"S": "unlimited-campaigns"},
            {"S": "api-access"},
            {"S": "white-label"}
        ]},
        "createdAt": {"S": "2024-01-01T00:00:00Z"}
    }' \
    --region ${REGION}

echo "Sample data added successfully!"

# Create backup plan for the table
echo "Setting up automated backups..."
aws dynamodb update-continuous-backups \
    --table-name ${TABLE_NAME} \
    --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true \
    --region ${REGION} || echo "Backup setup skipped (may require additional permissions)"

echo ""
echo "DynamoDB table setup complete!"
echo "Table name: ${TABLE_NAME}"
echo "Region: ${REGION}"
echo ""
echo "Table access patterns:"
echo "- Primary Key: PK (Partition) + SK (Sort)"
echo "- GSI1: For listing campaigns, integrations, etc."
echo "- GSI2: For time-based queries and analytics"