#!/bin/bash

# Setup carrier API credentials in AWS Secrets Manager
# This script creates the secrets needed for product tracking integration

set -e

SECRET_NAME="podcastflow-carrier-credentials"
REGION="${AWS_REGION:-us-east-1}"

echo "Setting up carrier API credentials in AWS Secrets Manager..."

# Create the secret with placeholder values
# Users will need to update these with real API credentials
SECRET_VALUE='{
  "ups": {
    "client_id": "YOUR_UPS_CLIENT_ID",
    "client_secret": "YOUR_UPS_CLIENT_SECRET",
    "sandbox": true
  },
  "fedex": {
    "api_key": "YOUR_FEDEX_API_KEY",
    "secret_key": "YOUR_FEDEX_SECRET_KEY",
    "sandbox": true
  },
  "usps": {
    "username": "YOUR_USPS_USERNAME",
    "password": "YOUR_USPS_PASSWORD",
    "sandbox": true
  },
  "dhl": {
    "api_key": "YOUR_DHL_API_KEY",
    "sandbox": true
  }
}'

# Check if secret already exists
SECRET_EXISTS=$(aws secretsmanager describe-secret --secret-id "${SECRET_NAME}" --region "${REGION}" 2>/dev/null || echo "")

if [ -n "$SECRET_EXISTS" ]; then
    echo "Secret ${SECRET_NAME} already exists. Updating..."
    aws secretsmanager update-secret \
        --secret-id "${SECRET_NAME}" \
        --secret-string "${SECRET_VALUE}" \
        --region "${REGION}"
else
    echo "Creating new secret ${SECRET_NAME}..."
    aws secretsmanager create-secret \
        --name "${SECRET_NAME}" \
        --description "Carrier API credentials for product tracking" \
        --secret-string "${SECRET_VALUE}" \
        --region "${REGION}"
fi

echo ""
echo "✅ Carrier credentials secret created/updated: ${SECRET_NAME}"
echo ""
echo "⚠️  IMPORTANT: Update the secret with your real API credentials:"
echo ""
echo "1. UPS API:"
echo "   - Sign up at: https://developer.ups.com/"
echo "   - Get OAuth 2.0 client credentials"
echo "   - Update: client_id, client_secret"
echo ""
echo "2. FedEx API:"
echo "   - Sign up at: https://developer.fedex.com/"
echo "   - Get API key and secret"
echo "   - Update: api_key, secret_key"
echo ""
echo "3. USPS API:"
echo "   - Sign up at: https://www.usps.com/business/web-tools-apis/"
echo "   - Get Web Tools credentials"
echo "   - Update: username, password"
echo ""
echo "4. DHL API:"
echo "   - Sign up at: https://developer.dhl.com/"
echo "   - Get API key"
echo "   - Update: api_key"
echo ""
echo "To update credentials:"
echo "aws secretsmanager update-secret --secret-id ${SECRET_NAME} --secret-string 'NEW_JSON'"
echo ""
echo "Set sandbox: false for production use"

# Create environment variables file for local development
cat > ../lambdas/tracking/.env.example << EOF
# Environment variables for tracking service
DYNAMODB_TABLE_NAME=podcastflow-pro
CARRIER_SECRETS_NAME=podcastflow-carrier-credentials
AWS_REGION=us-east-1

# For local development, you can also set these directly:
# UPS_CLIENT_ID=your_ups_client_id
# UPS_CLIENT_SECRET=your_ups_client_secret
# FEDEX_API_KEY=your_fedex_api_key
# FEDEX_SECRET_KEY=your_fedex_secret_key
# USPS_USERNAME=your_usps_username
# USPS_PASSWORD=your_usps_password
# DHL_API_KEY=your_dhl_api_key
EOF

echo "📄 Created environment example file: ../lambdas/tracking/.env.example"
echo ""
echo "🚀 Carrier credentials setup complete!"