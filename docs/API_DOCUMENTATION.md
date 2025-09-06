# PodcastFlow Pro API Documentation

## Overview

The PodcastFlow Pro API provides programmatic access to manage podcast advertising campaigns, shows, episodes, clients, and more. All API endpoints are RESTful and return JSON responses.

## Base URL

```
https://6a2opgfepf.execute-api.us-east-1.amazonaws.com/prod
```

## Authentication

All API requests require JWT authentication. Include the JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Common Headers

```
Content-Type: application/json
Accept: application/json
```

## Common Response Codes

- `200 OK` - Request succeeded
- `201 Created` - Resource created successfully
- `400 Bad Request` - Invalid request parameters
- `401 Unauthorized` - Missing or invalid authentication
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

## Validation Errors

Validation errors return a 400 status code with the following format:

```json
{
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

---

## Endpoints

### Users

#### List Users
```
GET /users
```

Query Parameters:
- `role` (string, optional) - Filter by role (admin, seller, producer, talent, client)
- `limit` (number, optional) - Number of results (default: 50, max: 100)
- `offset` (number, optional) - Pagination offset

Response:
```json
{
  "users": [
    {
      "userId": "string",
      "email": "string",
      "name": "string",
      "role": "string",
      "organizationId": "string",
      "createdAt": "string",
      "updatedAt": "string"
    }
  ],
  "count": 0,
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 100
  }
}
```

#### Get User
```
GET /users/{userId}
```

Response: User object

#### Create User
```
POST /users
```

Request Body:
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "name": "John Doe",
  "role": "seller",
  "organizationId": "org-123",
  "phone": "+1234567890"
}
```

Response: Created user object

#### Update User
```
PUT /users/{userId}
```

Request Body:
```json
{
  "name": "Updated Name",
  "phone": "+1234567890",
  "avatar": "https://example.com/avatar.jpg",
  "bio": "Updated bio",
  "preferences": {
    "emailNotifications": true,
    "smsNotifications": false,
    "timezone": "America/New_York"
  }
}
```

Response: Updated user object

#### Delete User
```
DELETE /users/{userId}
```

Response: 
```json
{
  "message": "User deleted successfully"
}
```

---

### Campaigns

#### List Campaigns
```
GET /campaigns
```

Query Parameters:
- `status` (string, optional) - Filter by status (draft, active, paused, completed, cancelled)
- `clientId` (string, optional) - Filter by client
- `startDate` (string, optional) - Filter by start date (YYYY-MM-DD)
- `endDate` (string, optional) - Filter by end date (YYYY-MM-DD)
- `limit` (number, optional) - Number of results
- `offset` (number, optional) - Pagination offset

Response:
```json
{
  "campaigns": [
    {
      "id": "string",
      "name": "string",
      "client": "string",
      "agency": "string",
      "description": "string",
      "status": "active",
      "startDate": "2024-01-01",
      "endDate": "2024-12-31",
      "budget": 50000,
      "spent": 25000,
      "impressions": 1000000,
      "targetImpressions": 2000000,
      "clicks": 50000,
      "conversions": 1000,
      "industry": "string",
      "targetAudience": "string",
      "accountTeam": [
        {
          "userId": "string",
          "teamRole": "account_manager",
          "permissions": ["view", "edit"]
        }
      ],
      "createdAt": "string",
      "updatedAt": "string"
    }
  ],
  "count": 0
}
```

#### Get Campaign
```
GET /campaigns/{campaignId}
```

Response: Campaign object

#### Create Campaign
```
POST /campaigns
```

Request Body:
```json
{
  "name": "Summer Campaign 2024",
  "client": "Tech Corp",
  "agency": "Creative Agency",
  "description": "Summer podcast advertising campaign",
  "status": "draft",
  "startDate": "2024-06-01",
  "endDate": "2024-08-31",
  "budget": 50000,
  "targetImpressions": 2000000,
  "industry": "Technology",
  "targetAudience": "Tech professionals 25-45",
  "accountTeam": [
    {
      "userId": "user-123",
      "teamRole": "account_manager",
      "permissions": ["view", "edit", "delete"]
    }
  ]
}
```

Response: Created campaign object

#### Update Campaign
```
PUT /campaigns/{campaignId}
```

Request Body: Same as create, all fields optional

Response: Updated campaign object

#### Delete Campaign
```
DELETE /campaigns/{campaignId}
```

Response:
```json
{
  "message": "Campaign deleted successfully"
}
```

#### Add Team Member
```
POST /campaigns/{campaignId}/team
```

Request Body:
```json
{
  "userId": "user-123",
  "teamRole": "creative_director",
  "permissions": ["view", "edit"]
}
```

Response: Updated campaign object

#### Remove Team Member
```
DELETE /campaigns/{campaignId}/team/{userId}
```

Response: Updated campaign object

---

### Shows

#### List Shows
```
GET /shows
```

Query Parameters:
- `producerId` (string, optional) - Filter by producer
- `network` (string, optional) - Filter by network
- `genre` (string, optional) - Filter by genre
- `format` (string, optional) - Filter by format (audio, video, both)
- `limit` (number, optional) - Number of results
- `offset` (number, optional) - Pagination offset

Response:
```json
{
  "shows": [
    {
      "showId": "string",
      "name": "string",
      "description": "string",
      "network": "string",
      "genre": "string",
      "format": "audio",
      "frequency": "weekly",
      "averageListeners": 50000,
      "demographics": {
        "ageRange": "25-45",
        "gender": "all",
        "interests": ["technology", "business"]
      },
      "producerId": "string",
      "producerName": "string",
      "talentIds": ["string"],
      "createdAt": "string",
      "updatedAt": "string"
    }
  ],
  "count": 0
}
```

#### Get Show
```
GET /shows/{showId}
```

Response: Show object

#### Create Show
```
POST /shows
```

Request Body:
```json
{
  "name": "Tech Talk Podcast",
  "description": "Weekly technology discussions",
  "network": "Podcast Network",
  "genre": "Technology",
  "format": "audio",
  "frequency": "weekly",
  "averageListeners": 50000,
  "demographics": {
    "ageRange": "25-45",
    "gender": "all",
    "interests": ["technology", "startups", "innovation"]
  },
  "producerId": "producer-123",
  "talentIds": ["talent-456", "talent-789"]
}
```

Response: Created show object

#### Update Show
```
PUT /shows/{showId}
```

Request Body: Same as create, all fields optional

Response: Updated show object

#### Delete Show
```
DELETE /shows/{showId}
```

Response:
```json
{
  "message": "Show deleted successfully"
}
```

#### Assign Producer
```
POST /shows/{showId}/assignments
```

Request Body:
```json
{
  "producerId": "producer-123"
}
```

Response: Updated show object

#### Assign Talent
```
POST /shows/{showId}/assignments
```

Request Body:
```json
{
  "talentIds": ["talent-456", "talent-789"]
}
```

Response: Updated show object

---

### Episodes

#### List Episodes
```
GET /episodes
```

Query Parameters:
- `showId` (string, optional) - Filter by show
- `status` (string, optional) - Filter by status (draft, scheduled, recording, editing, published)
- `talentId` (string, optional) - Filter by assigned talent
- `startDate` (string, optional) - Filter by air date start
- `endDate` (string, optional) - Filter by air date end
- `limit` (number, optional) - Number of results
- `offset` (number, optional) - Pagination offset

Response:
```json
{
  "episodes": [
    {
      "episodeId": "string",
      "showId": "string",
      "showName": "string",
      "title": "string",
      "description": "string",
      "episodeNumber": 1,
      "seasonNumber": 1,
      "airDate": "2024-01-01",
      "duration": 3600,
      "status": "scheduled",
      "talentId": "string",
      "talentName": "string",
      "adSlots": [
        {
          "position": "pre-roll",
          "duration": 30,
          "price": 500,
          "available": true
        }
      ],
      "createdAt": "string",
      "updatedAt": "string"
    }
  ],
  "count": 0
}
```

#### Get Episode
```
GET /episodes/{episodeId}
```

Response: Episode object

#### Create Episode
```
POST /episodes
```

Request Body:
```json
{
  "showId": "show-123",
  "title": "Episode 1: Introduction to AI",
  "description": "An introduction to artificial intelligence",
  "episodeNumber": 1,
  "seasonNumber": 1,
  "airDate": "2024-01-15",
  "duration": 3600,
  "status": "scheduled",
  "talentId": "talent-456",
  "adSlots": [
    {
      "position": "pre-roll",
      "duration": 30,
      "price": 500,
      "available": true
    },
    {
      "position": "mid-roll",
      "duration": 60,
      "price": 1000,
      "available": true
    }
  ]
}
```

Response: Created episode object

#### Update Episode
```
PUT /episodes/{episodeId}
```

Request Body: Same as create, all fields optional

Response: Updated episode object

#### Delete Episode
```
DELETE /episodes/{episodeId}
```

Response:
```json
{
  "message": "Episode deleted successfully"
}
```

#### Assign Talent
```
POST /episodes/{episodeId}/talent
```

Request Body:
```json
{
  "talentId": "talent-456"
}
```

Response: Updated episode object

#### Remove Talent
```
DELETE /episodes/{episodeId}/talent/{talentId}
```

Response: Updated episode object

---

### Clients

#### List Clients
```
GET /clients
```

Query Parameters:
- `search` (string, optional) - Search by name or contact
- `industry` (string, optional) - Filter by industry
- `assignedSeller` (string, optional) - Filter by assigned seller
- `limit` (number, optional) - Number of results
- `offset` (number, optional) - Pagination offset

Response:
```json
{
  "clients": [
    {
      "clientId": "string",
      "name": "string",
      "industry": "string",
      "contactName": "string",
      "contactEmail": "string",
      "contactPhone": "string",
      "website": "string",
      "address": {
        "street": "string",
        "city": "string",
        "state": "string",
        "zipCode": "string",
        "country": "string"
      },
      "assignedSeller": "string",
      "assignedSellerName": "string",
      "notes": "string",
      "createdAt": "string",
      "updatedAt": "string"
    }
  ],
  "count": 0
}
```

#### Get Client
```
GET /clients/{clientId}
```

Response: Client object

#### Create Client
```
POST /clients
```

Request Body:
```json
{
  "name": "Tech Innovations Inc",
  "industry": "Technology",
  "contactName": "John Smith",
  "contactEmail": "john@techinnovations.com",
  "contactPhone": "+1-555-0123",
  "website": "https://techinnovations.com",
  "address": {
    "street": "123 Tech Street",
    "city": "San Francisco",
    "state": "CA",
    "zipCode": "94105",
    "country": "USA"
  },
  "assignedSeller": "seller-123",
  "notes": "Interested in Q2 campaign"
}
```

Response: Created client object

#### Update Client
```
PUT /clients/{clientId}
```

Request Body: Same as create, all fields optional

Response: Updated client object

#### Delete Client
```
DELETE /clients/{clientId}
```

Response:
```json
{
  "message": "Client deleted successfully"
}
```

---

### Notifications

#### List Notifications
```
GET /notifications
```

Query Parameters:
- `type` (string, optional) - Filter by notification type
- `unreadOnly` (boolean, optional) - Show only unread notifications
- `limit` (number, optional) - Number of results (default: 10)

Response:
```json
{
  "notifications": [
    {
      "notificationId": "string",
      "type": "team_assignment",
      "title": "string",
      "message": "string",
      "read": false,
      "readAt": null,
      "priority": "normal",
      "data": {
        "campaignId": "string",
        "campaignName": "string"
      },
      "senderName": "string",
      "senderRole": "string",
      "createdAt": "string"
    }
  ],
  "unreadCount": 5
}
```

#### Get Notification
```
GET /notifications/{notificationId}
```

Response: Notification object

#### Create Notification
```
POST /notifications
```

Request Body:
```json
{
  "recipientId": "user-123",
  "type": "team_assignment",
  "title": "New Team Assignment",
  "message": "You have been assigned to Campaign XYZ",
  "priority": "high",
  "data": {
    "campaignId": "campaign-456",
    "campaignName": "Summer Campaign 2024"
  },
  "sendEmail": true
}
```

Response: Created notification object

#### Mark as Read
```
POST /notifications/{notificationId}/read
```

Response: Updated notification object

#### Mark Batch as Read
```
POST /notifications/batch-read
```

Request Body:
```json
{
  "notificationIds": ["notif-1", "notif-2", "notif-3"]
}
```

Response:
```json
{
  "message": "Notifications marked as read",
  "count": 3
}
```

#### Delete Batch
```
DELETE /notifications/batch-delete
```

Request Body:
```json
{
  "notificationIds": ["notif-1", "notif-2", "notif-3"]
}
```

Response:
```json
{
  "message": "Notifications deleted",
  "count": 3
}
```

---

### Activities (Audit Log)

#### List Activities
```
GET /activities
```

Query Parameters:
- `entityType` (string, optional) - Filter by entity type (user, campaign, show, episode, client)
- `entityId` (string, optional) - Filter by specific entity ID
- `actorId` (string, optional) - Filter by actor (user who performed action)
- `type` (string, optional) - Filter by activity type
- `startDate` (string, optional) - Filter by date range start (YYYY-MM-DD)
- `endDate` (string, optional) - Filter by date range end (YYYY-MM-DD)
- `limit` (number, optional) - Number of results (default: 50)

Response:
```json
{
  "activities": [
    {
      "activityId": "string",
      "type": "campaign_created",
      "action": "created",
      "entityType": "campaign",
      "entityId": "string",
      "entityName": "string",
      "actorId": "string",
      "actorName": "string",
      "actorRole": "string",
      "details": {
        "additional": "context"
      },
      "previousValue": null,
      "newValue": {},
      "timestamp": "string",
      "createdAt": "string"
    }
  ],
  "count": 0,
  "lastEvaluatedKey": "string"
}
```

#### Get Activity
```
GET /activities/{activityId}
```

Response: Activity object

#### Log Activity
```
POST /activities
```

Request Body:
```json
{
  "type": "user_login",
  "action": "login",
  "entityType": "user",
  "entityId": "user-123",
  "entityName": "John Doe",
  "details": {
    "userAgent": "Mozilla/5.0...",
    "ipAddress": "192.168.1.1"
  }
}
```

Response: Created activity object

---

### Permissions

#### Get Role Permissions
```
GET /roles/{role}/permissions
```

Response:
```json
{
  "role": "seller",
  "permissions": [
    "campaigns.view",
    "campaigns.create",
    "campaigns.edit.own",
    "clients.view",
    "clients.create",
    "clients.edit.assigned"
  ]
}
```

#### Update Role Permissions
```
PUT /roles/{role}/permissions
```

Request Body:
```json
{
  "permissions": [
    "campaigns.view",
    "campaigns.create",
    "campaigns.edit.own",
    "campaigns.delete.own",
    "clients.view",
    "clients.create",
    "clients.edit.assigned",
    "clients.delete.assigned"
  ]
}
```

Response: Updated permissions object

---

## Rate Limiting

API requests are rate limited to prevent abuse:

- **Authenticated requests**: 1000 requests per hour per user
- **Unauthenticated requests**: 100 requests per hour per IP

Rate limit information is included in response headers:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200
```

## WebSocket API

For real-time updates, connect to our WebSocket API:

```
wss://your-websocket-url.execute-api.us-east-1.amazonaws.com/prod
```

### Connection
```javascript
const ws = new WebSocket('wss://your-websocket-url.execute-api.us-east-1.amazonaws.com/prod');

ws.onopen = () => {
  // Send authentication
  ws.send(JSON.stringify({
    action: 'auth',
    token: 'your-jwt-token'
  }));
};
```

### Subscribe to Updates
```javascript
// Subscribe to campaign updates
ws.send(JSON.stringify({
  action: 'subscribe',
  channel: 'updates',
  entityType: 'campaign',
  entityId: 'campaign-123' // Optional: for specific entity
}));
```

### Message Format
```json
{
  "type": "update",
  "entityType": "campaign",
  "entityId": "campaign-123",
  "action": "updated",
  "data": {
    // Updated entity data
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

## Error Handling

All errors follow a consistent format:

```json
{
  "message": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": {
    // Additional error context
  }
}
```

Common error codes:
- `VALIDATION_FAILED` - Request validation failed
- `UNAUTHORIZED` - Authentication required
- `FORBIDDEN` - Insufficient permissions
- `NOT_FOUND` - Resource not found
- `CONFLICT` - Resource conflict (e.g., duplicate)
- `RATE_LIMITED` - Too many requests
- `INTERNAL_ERROR` - Server error

## SDK Support

Official SDKs are available for:
- JavaScript/TypeScript
- Python
- Go
- Java

See individual SDK documentation for language-specific examples.

## Changelog

### v1.0.0 (2024-01-01)
- Initial API release
- Full CRUD operations for all entities
- WebSocket support for real-time updates
- Activity logging for audit trails
- Role-based permissions system