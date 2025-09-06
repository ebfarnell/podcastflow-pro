#!/bin/bash

# Create DynamoDB table for PodcastFlow Pro with correct naming

set -e

TABLE_NAME="PodcastFlowPro"
REGION="${AWS_REGION:-us-east-1}"

echo "Creating DynamoDB table: ${TABLE_NAME}"

# Check if table already exists
TABLE_EXISTS=$(aws dynamodb list-tables --query "TableNames[?@=='${TABLE_NAME}']" --output text --region ${REGION} || echo "")

if [ -n "$TABLE_EXISTS" ]; then
    echo "Table ${TABLE_NAME} already exists!"
    aws dynamodb describe-table --table-name ${TABLE_NAME} --region ${REGION} --query "Table.{TableName:TableName,Status:TableStatus,ItemCount:ItemCount,GlobalSecondaryIndexes:GlobalSecondaryIndexes[*].{IndexName:IndexName,Status:IndexStatus}}" --output table
else
    # Create DynamoDB table with single-table design
    echo "Creating table with single-table design..."
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

# Add sample data for new modules
echo "Adding sample data for new modules..."

# Add sample insertion orders
aws dynamodb put-item \
    --table-name ${TABLE_NAME} \
    --item '{
        "PK": {"S": "ORDER#IO001"},
        "SK": {"S": "ORDER#IO001"},
        "GSI1PK": {"S": "INSERTION_ORDER"},
        "GSI1SK": {"S": "2024-07-01T00:00:00Z"},
        "id": {"S": "IO001"},
        "campaignId": {"S": "CAMP001"},
        "advertiserId": {"S": "ADV001"},
        "agencyId": {"S": "AGE001"},
        "name": {"S": "Summer Campaign IO"},
        "status": {"S": "active"},
        "budget": {"N": "25000"},
        "spent": {"N": "15000"},
        "startDate": {"S": "2024-07-01"},
        "endDate": {"S": "2024-08-31"},
        "createdAt": {"S": "2024-06-15T10:00:00Z"},
        "updatedAt": {"S": "2024-07-01T14:30:00Z"}
    }' \
    --region ${REGION}

# Add sample agency
aws dynamodb put-item \
    --table-name ${TABLE_NAME} \
    --item '{
        "PK": {"S": "AGENCY#AGE001"},
        "SK": {"S": "AGENCY#AGE001"},
        "GSI1PK": {"S": "AGENCY"},
        "GSI1SK": {"S": "2024-01-15T00:00:00Z"},
        "id": {"S": "AGE001"},
        "name": {"S": "Digital Marketing Partners"},
        "email": {"S": "contact@digitalmp.com"},
        "phone": {"S": "+1-555-0123"},
        "website": {"S": "https://digitalmp.com"},
        "status": {"S": "active"},
        "commissionRate": {"N": "15"},
        "createdAt": {"S": "2024-01-15T09:00:00Z"},
        "updatedAt": {"S": "2024-07-01T16:45:00Z"}
    }' \
    --region ${REGION}

# Add sample advertiser
aws dynamodb put-item \
    --table-name ${TABLE_NAME} \
    --item '{
        "PK": {"S": "ADVERTISER#ADV001"},
        "SK": {"S": "ADVERTISER#ADV001"},
        "GSI1PK": {"S": "ADVERTISER"},
        "GSI1SK": {"S": "2024-02-01T00:00:00Z"},
        "id": {"S": "ADV001"},
        "name": {"S": "Tech Innovators Inc"},
        "email": {"S": "marketing@techinnovators.com"},
        "phone": {"S": "+1-555-0456"},
        "website": {"S": "https://techinnovators.com"},
        "industry": {"S": "Technology"},
        "status": {"S": "active"},
        "agencyId": {"S": "AGE001"},
        "createdAt": {"S": "2024-02-01T11:00:00Z"},
        "updatedAt": {"S": "2024-07-01T18:20:00Z"}
    }' \
    --region ${REGION}

# Add sample show
aws dynamodb put-item \
    --table-name ${TABLE_NAME} \
    --item '{
        "PK": {"S": "SHOW#SH001"},
        "SK": {"S": "SHOW#SH001"},
        "GSI1PK": {"S": "SHOW"},
        "GSI1SK": {"S": "2024-01-01T00:00:00Z"},
        "id": {"S": "SH001"},
        "name": {"S": "Tech Talk Weekly"},
        "description": {"S": "Weekly discussions about the latest in technology"},
        "host": {"S": "Sarah Johnson"},
        "category": {"S": "Technology"},
        "averageListeners": {"N": "15000"},
        "episodeLength": {"N": "45"},
        "frequency": {"S": "weekly"},
        "status": {"S": "active"},
        "createdAt": {"S": "2024-01-01T12:00:00Z"},
        "updatedAt": {"S": "2024-07-01T09:15:00Z"}
    }' \
    --region ${REGION}

# Add sample episode
aws dynamodb put-item \
    --table-name ${TABLE_NAME} \
    --item '{
        "PK": {"S": "EPISODE#EP001"},
        "SK": {"S": "EPISODE#EP001"},
        "GSI1PK": {"S": "EPISODE"},
        "GSI1SK": {"S": "2024-07-01T00:00:00Z"},
        "id": {"S": "EP001"},
        "showId": {"S": "SH001"},
        "title": {"S": "AI Revolution in 2024"},
        "description": {"S": "Exploring the latest AI developments and their impact"},
        "duration": {"N": "2700"},
        "publishDate": {"S": "2024-07-01"},
        "listenerCount": {"N": "18500"},
        "status": {"S": "published"},
        "adSlots": {"L": [
            {"M": {
                "position": {"S": "pre-roll"},
                "duration": {"N": "30"},
                "rate": {"N": "150"}
            }},
            {"M": {
                "position": {"S": "mid-roll"},
                "duration": {"N": "60"},
                "rate": {"N": "250"}
            }}
        ]},
        "createdAt": {"S": "2024-06-25T14:00:00Z"},
        "updatedAt": {"S": "2024-07-01T20:30:00Z"}
    }' \
    --region ${REGION}

# Add sample availability slot
aws dynamodb put-item \
    --table-name ${TABLE_NAME} \
    --item '{
        "PK": {"S": "AVAILABILITY#AV001"},
        "SK": {"S": "AVAILABILITY#AV001"},
        "GSI1PK": {"S": "AVAILABILITY"},
        "GSI1SK": {"S": "2024-07-15T00:00:00Z"},
        "id": {"S": "AV001"},
        "showId": {"S": "SH001"},
        "episodeId": {"S": "EP001"},
        "slotType": {"S": "mid-roll"},
        "duration": {"N": "60"},
        "startDate": {"S": "2024-07-15"},
        "endDate": {"S": "2024-07-22"},
        "rate": {"N": "250"},
        "status": {"S": "available"},
        "targetDemographics": {"L": [
            {"S": "tech-professionals"},
            {"S": "25-45-age-group"}
        ]},
        "createdAt": {"S": "2024-07-01T10:00:00Z"}
    }' \
    --region ${REGION}

# Add sample contract
aws dynamodb put-item \
    --table-name ${TABLE_NAME} \
    --item '{
        "PK": {"S": "CONTRACT#CT001"},
        "SK": {"S": "CONTRACT#CT001"},
        "GSI1PK": {"S": "CONTRACT"},
        "GSI1SK": {"S": "2024-06-01T00:00:00Z"},
        "id": {"S": "CT001"},
        "orderId": {"S": "IO001"},
        "advertiserId": {"S": "ADV001"},
        "agencyId": {"S": "AGE001"},
        "type": {"S": "insertion-order"},
        "status": {"S": "signed"},
        "value": {"N": "25000"},
        "startDate": {"S": "2024-07-01"},
        "endDate": {"S": "2024-08-31"},
        "terms": {"S": "Standard advertising terms and conditions"},
        "signedAt": {"S": "2024-06-15T15:30:00Z"},
        "createdAt": {"S": "2024-06-01T09:00:00Z"}
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
echo "Data model for new modules:"
echo "- Insertion Orders: PK=ORDER#{id}, GSI1PK=INSERTION_ORDER"
echo "- Agencies: PK=AGENCY#{id}, GSI1PK=AGENCY"
echo "- Advertisers: PK=ADVERTISER#{id}, GSI1PK=ADVERTISER"
echo "- Shows: PK=SHOW#{id}, GSI1PK=SHOW"
echo "- Episodes: PK=EPISODE#{id}, GSI1PK=EPISODE"
echo "- Availability: PK=AVAILABILITY#{id}, GSI1PK=AVAILABILITY"
echo "- Ad Approvals: PK=APPROVAL#{id}, GSI1PK=AD_APPROVAL"
echo "- Ad Copy: PK=COPY#{id}, GSI1PK=AD_COPY"
echo "- Contracts: PK=CONTRACT#{id}, GSI1PK=CONTRACT"
echo "- Reports: PK=REPORT#{id}, GSI1PK=REPORT"
echo "- Financials: PK=FINANCIAL#{id}, GSI1PK=FINANCIAL"