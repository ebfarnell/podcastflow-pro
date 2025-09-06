# Product Tracking Infrastructure

This directory contains the complete backend infrastructure for real-time product tracking with carrier API integrations.

## Overview

The product tracking system allows PodcastFlow Pro users to:
- Track products sent to podcast talent for campaigns
- Get real-time delivery status from UPS, FedEx, USPS, and DHL
- Receive automated tracking updates every 4 hours
- View delivery progress and estimated delivery dates
- Manage shipments through a comprehensive UI

## Architecture

### Components

1. **Tracking Service Lambda** (`index.js`)
   - Main API endpoints for shipment management
   - Handles creation, updates, and tracking requests
   - Integrates with carrier APIs

2. **Scheduled Tracker Lambda** (`scheduledTracker.js`)
   - Automated tracking updates every 4 hours
   - Batch processing for efficiency
   - Error handling and retry logic

3. **Carrier Integrations** (`carriers/`)
   - `ups.js` - UPS API integration
   - `fedex.js` - FedEx API integration
   - `usps.js` - USPS API integration
   - `dhl.js` - DHL API integration

4. **Core Service** (`trackingService.js`)
   - Business logic and data management
   - DynamoDB operations
   - Carrier API orchestration

### API Endpoints

#### Shipment Management
- `POST /campaigns/{campaignId}/shipments` - Create new shipment
- `GET /campaigns/{campaignId}/shipments` - Get campaign shipments
- `PUT /shipments/{shipmentId}/status` - Update shipment status
- `POST /shipments/{shipmentId}/track` - Force tracking update

#### Batch Operations
- `GET /shipments/active` - Get active shipments
- `POST /shipments/batch-track` - Batch update tracking

#### Webhooks
- `POST /webhooks/tracking` - Carrier webhook notifications

## Database Schema

### Shipment Record Structure
```javascript
{
  PK: "SHIPMENT#{shipmentId}",
  SK: "METADATA",
  GSI1PK: "CAMPAIGN#{campaignId}",
  GSI1SK: "SHIPMENT#{status}#{timestamp}",
  GSI2PK: "TRACKING_ACTIVE", // For active shipments only
  GSI2SK: "{carrier}#{timestamp}",
  
  // Shipment data
  id: "uuid",
  campaignId: "campaign-id",
  productName: "Product Name",
  carrier: "UPS|FedEx|USPS|DHL|Other",
  trackingNumber: "1Z999AA1234567890",
  recipientName: "Talent Name",
  recipientAddress: "Address",
  shippedDate: "2024-01-15",
  estimatedDelivery: "2024-01-20",
  actualDelivery: "2024-01-19",
  status: "shipped|in_transit|delivered|failed|returned",
  notes: "Optional notes",
  
  // Tracking metadata
  trackingData: { /* Carrier tracking response */ },
  lastTracked: "2024-01-17T10:00:00Z",
  trackingAttempts: 5,
  
  // Audit fields
  createdAt: "2024-01-15T09:00:00Z",
  updatedAt: "2024-01-17T10:00:00Z"
}
```

### Access Patterns
1. **Get campaign shipments**: GSI1PK = "CAMPAIGN#{id}"
2. **Get active shipments**: GSI2PK = "TRACKING_ACTIVE"
3. **Get shipments by carrier**: GSI2SK begins_with "{carrier}#"
4. **Get shipments by status**: GSI1SK begins_with "SHIPMENT#{status}#"

## Carrier API Integration

### UPS API
- **Authentication**: OAuth 2.0
- **Endpoint**: `/track/v1/details/{trackingNumber}`
- **Rate Limit**: 1000 requests/hour
- **Cost**: $0.10-0.50 per request
- **Features**: Real-time tracking, delivery confirmation, location updates

### FedEx API
- **Authentication**: OAuth 2.0
- **Endpoint**: `/track/v1/trackingnumbers`
- **Rate Limit**: 3000 requests/hour
- **Cost**: $0.05-0.25 per request
- **Features**: Batch tracking (up to 30), detailed scan events

### USPS API
- **Authentication**: Username/Password
- **Endpoint**: `/ShippingAPI.dll`
- **Rate Limit**: 5000 requests/hour
- **Cost**: Free for basic tracking
- **Features**: Domestic tracking, delivery confirmation

### DHL API
- **Authentication**: API Key
- **Endpoint**: `/track/shipments`
- **Rate Limit**: 1000 requests/hour
- **Cost**: $0.10-0.30 per request
- **Features**: International tracking, express delivery

## Environment Configuration

### Required Environment Variables
```bash
DYNAMODB_TABLE_NAME=podcastflow-pro
CARRIER_SECRETS_NAME=podcastflow-carrier-credentials
AWS_REGION=us-east-1
```

### Carrier Credentials (AWS Secrets Manager)
```json
{
  "ups": {
    "client_id": "your-ups-client-id",
    "client_secret": "your-ups-client-secret",
    "sandbox": false
  },
  "fedex": {
    "api_key": "your-fedex-api-key",
    "secret_key": "your-fedex-secret-key",
    "sandbox": false
  },
  "usps": {
    "username": "your-usps-username",
    "password": "your-usps-password",
    "sandbox": false
  },
  "dhl": {
    "api_key": "your-dhl-api-key",
    "sandbox": false
  }
}
```

## Deployment

### Prerequisites
1. AWS CLI configured
2. Node.js 18.x runtime
3. Lambda execution role with permissions:
   - DynamoDB: GetItem, PutItem, UpdateItem, Query, Scan
   - Secrets Manager: GetSecretValue
   - Lambda: InvokeFunction

### Quick Deploy
```bash
# Setup carrier credentials
./scripts/setup-carrier-credentials.sh

# Deploy complete infrastructure
./scripts/deploy-tracking-infrastructure.sh
```

### Manual Deploy Steps
1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Package Lambda functions**
   ```bash
   zip -r tracking-lambda.zip . -x "*.git*" "node_modules/.cache/*"
   ```

3. **Deploy to AWS Lambda**
   ```bash
   aws lambda create-function \
     --function-name podcastflow-tracking \
     --runtime nodejs18.x \
     --role arn:aws:iam::ACCOUNT:role/lambda-execution-role \
     --handler index.handler \
     --zip-file fileb://tracking-lambda.zip \
     --timeout 300 \
     --memory-size 512
   ```

4. **Setup scheduled tracking**
   ```bash
   ./scripts/setup-scheduled-tracking.sh
   ```

## Monitoring and Debugging

### CloudWatch Logs
- Tracking service: `/aws/lambda/podcastflow-tracking`
- Scheduler: `/aws/lambda/podcastflow-tracking-scheduler`

### Key Metrics
- Lambda invocations and errors
- Tracking success/failure rates
- Carrier API response times
- DynamoDB read/write capacity

### Common Issues

1. **Authentication Failures**
   - Check carrier credentials in Secrets Manager
   - Verify API keys are not expired
   - Ensure sandbox vs production settings

2. **Rate Limiting**
   - Implement exponential backoff
   - Distribute requests across time
   - Consider upgrading carrier API plans

3. **Tracking Not Found**
   - Verify tracking number format
   - Check if package is in carrier system
   - Some carriers have delayed tracking activation

### Testing

#### Manual Testing
```bash
# Test tracking service
aws lambda invoke \
  --function-name podcastflow-tracking \
  --payload '{"httpMethod":"GET","resource":"/shipments/active"}' \
  response.json

# Test scheduler
aws lambda invoke \
  --function-name podcastflow-tracking-scheduler \
  response.json
```

#### Integration Testing
1. Create test shipment with real tracking number
2. Verify tracking data retrieval
3. Test status updates
4. Confirm scheduled updates work

## Security Considerations

1. **API Keys Protection**
   - Store in AWS Secrets Manager
   - Rotate regularly
   - Use least privilege principles

2. **Data Privacy**
   - Encrypt sensitive data
   - Limit tracking data retention
   - Comply with privacy regulations

3. **Rate Limiting**
   - Implement request throttling
   - Monitor API usage
   - Set up alerts for unusual activity

## Cost Optimization

### Carrier API Costs
- UPS: ~$0.30 avg per request
- FedEx: ~$0.15 avg per request  
- USPS: Free
- DHL: ~$0.20 avg per request

### Estimated Monthly Costs (100 shipments)
- Carrier APIs: $15-30
- Lambda: $5-10
- DynamoDB: $5-10
- **Total: $25-50/month**

### Optimization Strategies
1. Use USPS when possible (free)
2. Batch tracking requests
3. Cache tracking data
4. Implement intelligent retry logic
5. Archive old shipment data

## Future Enhancements

1. **Advanced Features**
   - Delivery exceptions handling
   - Custom delivery instructions
   - Photo confirmation
   - SMS/email notifications

2. **Carrier Expansion**
   - Canada Post
   - Royal Mail
   - Deutsche Post
   - Regional carriers

3. **Analytics**
   - Delivery performance metrics
   - Carrier comparison
   - Cost analysis
   - Delivery time predictions

## Support

For issues and questions:
1. Check CloudWatch logs
2. Review carrier API documentation
3. Test with known good tracking numbers
4. Contact carrier support if needed

## API Reference

### Error Responses
```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": { /* Additional context */ }
}
```

### Success Responses
```json
{
  "data": { /* Response data */ },
  "meta": {
    "timestamp": "2024-01-17T10:00:00Z",
    "version": "1.0"
  }
}
```