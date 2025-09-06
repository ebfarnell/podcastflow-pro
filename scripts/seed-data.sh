#!/bin/bash

# Seed test advertisers and agencies using AWS CLI

TABLE_NAME="podcastflow-pro"

echo "🌱 Seeding test advertisers and agencies..."

# Function to generate UUID (simplified)
generate_uuid() {
    echo $(uuidgen | tr '[:upper:]' '[:lower:]')
}

# Function to get current timestamp
get_timestamp() {
    echo $(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")
}

# Seed Advertisers
echo "📈 Creating test advertisers..."

ADVERTISER_ID1=$(generate_uuid)
TIMESTAMP=$(get_timestamp)
aws dynamodb put-item \
    --table-name $TABLE_NAME \
    --item '{
        "PK": {"S": "ADVERTISER#'$ADVERTISER_ID1'"},
        "SK": {"S": "ADVERTISER#'$ADVERTISER_ID1'"},
        "GSI1PK": {"S": "ADVERTISERS"},
        "GSI1SK": {"S": "'$TIMESTAMP'"},
        "id": {"S": "'$ADVERTISER_ID1'"},
        "name": {"S": "TechCorp Solutions"},
        "industry": {"S": "technology"},
        "email": {"S": "contact@techcorp.com"},
        "contactPerson": {"S": "John Smith"},
        "status": {"S": "active"},
        "createdAt": {"S": "'$TIMESTAMP'"},
        "updatedAt": {"S": "'$TIMESTAMP'"}
    }' > /dev/null && echo "✅ Created: TechCorp Solutions"

ADVERTISER_ID2=$(generate_uuid)
TIMESTAMP=$(get_timestamp)
aws dynamodb put-item \
    --table-name $TABLE_NAME \
    --item '{
        "PK": {"S": "ADVERTISER#'$ADVERTISER_ID2'"},
        "SK": {"S": "ADVERTISER#'$ADVERTISER_ID2'"},
        "GSI1PK": {"S": "ADVERTISERS"},
        "GSI1SK": {"S": "'$TIMESTAMP'"},
        "id": {"S": "'$ADVERTISER_ID2'"},
        "name": {"S": "Retail Giant Inc"},
        "industry": {"S": "retail"},
        "email": {"S": "marketing@retailgiant.com"},
        "contactPerson": {"S": "Sarah Johnson"},
        "status": {"S": "active"},
        "createdAt": {"S": "'$TIMESTAMP'"},
        "updatedAt": {"S": "'$TIMESTAMP'"}
    }' > /dev/null && echo "✅ Created: Retail Giant Inc"

ADVERTISER_ID3=$(generate_uuid)
TIMESTAMP=$(get_timestamp)
aws dynamodb put-item \
    --table-name $TABLE_NAME \
    --item '{
        "PK": {"S": "ADVERTISER#'$ADVERTISER_ID3'"},
        "SK": {"S": "ADVERTISER#'$ADVERTISER_ID3'"},
        "GSI1PK": {"S": "ADVERTISERS"},
        "GSI1SK": {"S": "'$TIMESTAMP'"},
        "id": {"S": "'$ADVERTISER_ID3'"},
        "name": {"S": "HealthPlus Medical"},
        "industry": {"S": "healthcare"},
        "email": {"S": "ads@healthplus.com"},
        "contactPerson": {"S": "Dr. Mike Chen"},
        "status": {"S": "active"},
        "createdAt": {"S": "'$TIMESTAMP'"},
        "updatedAt": {"S": "'$TIMESTAMP'"}
    }' > /dev/null && echo "✅ Created: HealthPlus Medical"

# Seed Agencies
echo "🏢 Creating test agencies..."

AGENCY_ID1=$(generate_uuid)
TIMESTAMP=$(get_timestamp)
aws dynamodb put-item \
    --table-name $TABLE_NAME \
    --item '{
        "PK": {"S": "AGENCY#'$AGENCY_ID1'"},
        "SK": {"S": "AGENCY#'$AGENCY_ID1'"},
        "GSI1PK": {"S": "AGENCIES"},
        "GSI1SK": {"S": "'$TIMESTAMP'"},
        "id": {"S": "'$AGENCY_ID1'"},
        "name": {"S": "Creative Media Agency"},
        "contactPerson": {"S": "Jennifer Roberts"},
        "email": {"S": "hello@creativemedia.com"},
        "phone": {"S": "+1-555-0123"},
        "website": {"S": "https://creativemedia.com"},
        "status": {"S": "active"},
        "rating": {"N": "4.8"},
        "createdAt": {"S": "'$TIMESTAMP'"},
        "updatedAt": {"S": "'$TIMESTAMP'"}
    }' > /dev/null && echo "✅ Created: Creative Media Agency"

AGENCY_ID2=$(generate_uuid)
TIMESTAMP=$(get_timestamp)
aws dynamodb put-item \
    --table-name $TABLE_NAME \
    --item '{
        "PK": {"S": "AGENCY#'$AGENCY_ID2'"},
        "SK": {"S": "AGENCY#'$AGENCY_ID2'"},
        "GSI1PK": {"S": "AGENCIES"},
        "GSI1SK": {"S": "'$TIMESTAMP'"},
        "id": {"S": "'$AGENCY_ID2'"},
        "name": {"S": "Digital Marketing Solutions"},
        "contactPerson": {"S": "Mark Thompson"},
        "email": {"S": "info@digitalms.com"},
        "phone": {"S": "+1-555-0456"},
        "website": {"S": "https://digitalms.com"},
        "status": {"S": "active"},
        "rating": {"N": "4.5"},
        "createdAt": {"S": "'$TIMESTAMP'"},
        "updatedAt": {"S": "'$TIMESTAMP'"}
    }' > /dev/null && echo "✅ Created: Digital Marketing Solutions"

AGENCY_ID3=$(generate_uuid)
TIMESTAMP=$(get_timestamp)
aws dynamodb put-item \
    --table-name $TABLE_NAME \
    --item '{
        "PK": {"S": "AGENCY#'$AGENCY_ID3'"},
        "SK": {"S": "AGENCY#'$AGENCY_ID3'"},
        "GSI1PK": {"S": "AGENCIES"},
        "GSI1SK": {"S": "'$TIMESTAMP'"},
        "id": {"S": "'$AGENCY_ID3'"},
        "name": {"S": "Brand Boost Agency"},
        "contactPerson": {"S": "Emily Davis"},
        "email": {"S": "contact@brandboost.com"},
        "phone": {"S": "+1-555-0789"},
        "website": {"S": "https://brandboost.com"},
        "status": {"S": "pending"},
        "rating": {"N": "4.2"},
        "createdAt": {"S": "'$TIMESTAMP'"},
        "updatedAt": {"S": "'$TIMESTAMP'"}
    }' > /dev/null && echo "✅ Created: Brand Boost Agency"

echo "✅ Test data seeding completed successfully!"
echo ""
echo "📊 Created:"
echo "   • 3 test advertisers"
echo "   • 3 test agencies"
echo ""
echo "🔗 You can now use the advertiser and agency selectors in campaign forms!"