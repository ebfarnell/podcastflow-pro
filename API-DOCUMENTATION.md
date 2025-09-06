# PodcastFlow Pro API Documentation

## Base URL
```
https://9uiib4zrdb.execute-api.us-east-1.amazonaws.com/prod
```

## Authentication
All API endpoints require JWT authentication token in the Authorization header:
```
Authorization: Bearer <JWT_TOKEN>
```

To obtain a token, authenticate through AWS Cognito using the login endpoint.

---

## Endpoints

### Campaigns

#### List Campaigns
```
GET /campaigns
```

Query Parameters:
- `status` (optional): Filter by status (active, paused, draft, completed, archived)
- `limit` (optional): Number of results (default: 50)
- `lastKey` (optional): Pagination cursor

Response:
```json
{
  "Items": [
    {
      "id": "string",
      "name": "string",
      "client": "string",
      "status": "string",
      "startDate": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD",
      "budget": number,
      "spent": number,
      "impressions": number,
      "clicks": number,
      "conversions": number,
      "createdAt": "ISO8601",
      "updatedAt": "ISO8601"
    }
  ],
  "Count": number,
  "LastKey": "string"
}
```

#### Get Campaign
```
GET /campaigns/{id}
```

Response:
```json
{
  "id": "string",
  "name": "string",
  "client": "string",
  "status": "string",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "budget": number,
  "spent": number,
  "impressions": number,
  "clicks": number,
  "conversions": number,
  "targetAudience": "string",
  "industry": "string",
  "description": "string",
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601"
}
```

#### Create Campaign
```
POST /campaigns
```

Request Body:
```json
{
  "name": "string",
  "client": "string",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "budget": number,
  "targetImpressions": number,
  "targetAudience": "string",
  "industry": "string",
  "description": "string",
  "adFormats": ["string"]
}
```

Response: Created campaign object with generated ID

#### Update Campaign
```
PUT /campaigns/{id}
```

Request Body: Any campaign fields to update
```json
{
  "status": "active|paused|completed|archived",
  "budget": number,
  "endDate": "YYYY-MM-DD"
}
```

Response: Updated campaign object

#### Delete Campaign
```
DELETE /campaigns/{id}
```

Response: 204 No Content

---

### Analytics

#### Dashboard Metrics
```
GET /analytics/dashboard
```

Query Parameters:
- `startDate`: YYYY-MM-DD
- `endDate`: YYYY-MM-DD

Response:
```json
{
  "totalRevenue": number,
  "activeCampaigns": number,
  "totalImpressions": number,
  "totalClicks": number,
  "averageCTR": number,
  "uniqueListeners": number
}
```

#### Campaign Metrics
```
GET /analytics/campaigns/{campaignId}
```

Query Parameters:
- `range`: 7d|30d|90d|custom
- `startDate`: YYYY-MM-DD (if range=custom)
- `endDate`: YYYY-MM-DD (if range=custom)
- `metrics`: comma-separated list (impressions,clicks,conversions,cost)

Response:
```json
{
  "campaignId": "string",
  "range": "string",
  "data": [
    {
      "date": "YYYY-MM-DD",
      "impressions": number,
      "clicks": number,
      "conversions": number,
      "cost": number
    }
  ]
}
```

#### Export Analytics
```
POST /analytics/export/{type}
```

Path Parameters:
- `type`: csv|json|pdf

Request Body:
```json
{
  "campaignIds": ["string"],
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "metrics": ["impressions", "clicks", "conversions", "cost"]
}
```

Response:
```json
{
  "downloadUrl": "string",
  "expiresAt": "ISO8601"
}
```

---

### File Uploads

#### Get Upload URL
```
POST /uploads/presigned-url
```

Request Body:
```json
{
  "fileName": "string",
  "fileType": "string",
  "fileSize": number,
  "campaignId": "string"
}
```

Response:
```json
{
  "uploadUrl": "string",
  "viewUrl": "string",
  "key": "string"
}
```

Allowed file types:
- Images: image/jpeg, image/png, image/gif
- Audio: audio/mpeg, audio/mp3
- Documents: application/pdf

Max file size: 50MB

---

### User Profile

#### Get Profile
```
GET /auth/profile
```

Response:
```json
{
  "userId": "string",
  "email": "string",
  "name": "string",
  "organization": "string",
  "role": "string",
  "createdAt": "ISO8601"
}
```

#### Update Profile
```
PUT /auth/profile
```

Request Body:
```json
{
  "name": "string",
  "phone": "string",
  "timezone": "string",
  "notifications": {
    "email": boolean,
    "sms": boolean
  }
}
```

---

## Error Responses

All error responses follow this format:
```json
{
  "error": "string",
  "message": "string",
  "code": "string"
}
```

Common HTTP Status Codes:
- 400: Bad Request - Invalid input
- 401: Unauthorized - Missing or invalid token
- 403: Forbidden - Insufficient permissions
- 404: Not Found - Resource doesn't exist
- 429: Too Many Requests - Rate limit exceeded
- 500: Internal Server Error

---

## Rate Limits

- 100 requests per minute per IP
- 1000 requests per hour per user
- Burst limit: 20 requests

---

## Webhook Events (Coming Soon)

Planned webhook events:
- `campaign.created`
- `campaign.updated`
- `campaign.completed`
- `threshold.reached`
- `budget.alert`

---

## SDK Examples

### JavaScript/TypeScript
```typescript
import { PodcastFlowClient } from '@podcastflow/sdk'

const client = new PodcastFlowClient({
  apiKey: 'your-api-key',
  region: 'us-east-1'
})

// List campaigns
const campaigns = await client.campaigns.list({ status: 'active' })

// Create campaign
const campaign = await client.campaigns.create({
  name: 'Summer Campaign',
  client: 'ACME Corp',
  budget: 10000,
  startDate: '2025-06-01',
  endDate: '2025-08-31'
})
```

### Python
```python
from podcastflow import Client

client = Client(api_key='your-api-key')

# List campaigns
campaigns = client.campaigns.list(status='active')

# Get analytics
metrics = client.analytics.campaign_metrics(
    campaign_id='123',
    range='30d'
)
```

---

## Changelog

### v1.0.0 (July 2025)
- Initial API release
- Campaign CRUD operations
- Basic analytics endpoints
- File upload support

### Planned Features
- Webhook support
- Batch operations
- GraphQL endpoint
- Advanced filtering
- Real-time analytics via WebSocket