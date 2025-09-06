# PodcastFlow Pro API Endpoints

Base URL: `https://9uiib4zrdb.execute-api.us-east-1.amazonaws.com/production`

## Authentication

All endpoints (except auth endpoints and OPTIONS) require a JWT token in the Authorization header:
```
Authorization: Bearer <JWT_TOKEN>
```

## Endpoints

### User Management

#### Get All Users
- **GET** `/users`
- **Permissions Required**: `users.view`
- **Response**: List of all users

#### Get User by ID
- **GET** `/users/{userId}`
- **Permissions Required**: `users.view` or own user ID
- **Response**: User details

#### Create User
- **POST** `/users`
- **Permissions Required**: `users.create`
- **Body**: 
  ```json
  {
    "email": "user@example.com",
    "name": "User Name",
    "role": "seller|producer|talent|client",
    "password": "password123"
  }
  ```

#### Update User
- **PUT** `/users/{userId}`
- **Permissions Required**: `users.update` or own user ID
- **Body**: User fields to update

#### Delete User
- **DELETE** `/users/{userId}`
- **Permissions Required**: `users.delete`

### Role Management

#### Assign Role
- **POST** `/users/{userId}/role`
- **Permissions Required**: `users.manage.roles`
- **Body**:
  ```json
  {
    "role": "admin|seller|producer|talent|client",
    "organizationId": "optional-org-id"
  }
  ```

#### Get User Role
- **GET** `/users/{userId}/role`
- **Permissions Required**: `users.manage.roles`
- **Response**: Current role and role history

#### Update Role
- **PUT** `/users/{userId}/role`
- **Permissions Required**: `users.manage.roles`
- **Body**: Same as assign role

### Permissions

#### Get Current User Permissions
- **GET** `/permissions`
- **Query Parameters**: 
  - `permission` (optional): Check specific permission
- **Response**: List of permissions or specific permission check

#### Get User Permissions
- **GET** `/users/{userId}/permissions`
- **Permissions Required**: `users.view` or own user ID
- **Query Parameters**: 
  - `permission` (optional): Check specific permission

### Show Assignments

#### Assign User to Show
- **POST** `/shows/{showId}/assignments`
- **Permissions Required**: `shows.manage.assignments`
- **Body**:
  ```json
  {
    "userId": "user-id",
    "role": "producer|talent"
  }
  ```

#### Get Show Assignments
- **GET** `/shows/{showId}/assignments`
- **Response**: List of producers and talent assigned to show

#### Remove User from Show
- **DELETE** `/shows/{showId}/assignments/{userId}`
- **Permissions Required**: `shows.manage.assignments`

#### Get User Assignments
- **GET** `/assignments`
- **Query Parameters**:
  - `userId` (optional): Get assignments for specific user
- **Response**: List of shows assigned to user

### Ad Approvals

#### List Ad Approvals
- **GET** `/ad-approvals`
- **Permissions**: Based on role (admins see all, others see assigned)
- **Response**: List of ad approvals

#### Get Ad Approval
- **GET** `/ad-approvals/{approvalId}`
- **Response**: Ad approval details

#### Create Ad Approval
- **POST** `/ad-approvals`
- **Permissions Required**: `approvals.submit`
- **Body**:
  ```json
  {
    "title": "Ad Title",
    "advertiserId": "advertiser-id",
    "campaignId": "campaign-id",
    "showId": "show-id",
    "type": "host-read|pre-produced",
    "duration": 30,
    "script": "Ad script content",
    "talkingPoints": ["point1", "point2"],
    "targetEpisodes": ["episode1", "episode2"],
    "startDate": "2024-01-01",
    "endDate": "2024-12-31",
    "legalDisclaimer": "Disclaimer text",
    "restrictedTerms": ["term1", "term2"],
    "priority": "high|medium|low",
    "deadline": "2024-01-15",
    "notes": "Additional notes",
    "submittedBy": "user-id"
  }
  ```

#### Update Ad Approval
- **PUT** `/ad-approvals/{approvalId}`
- **Permissions Required**: `approvals.manage`
- **Body**: Fields to update

#### Approve Ad
- **POST** `/ad-approvals/{approvalId}/approve`
- **Permissions Required**: `approvals.review`
- **Body**:
  ```json
  {
    "approvedBy": "user-id",
    "feedback": "Optional feedback"
  }
  ```

#### Reject Ad
- **POST** `/ad-approvals/{approvalId}/reject`
- **Permissions Required**: `approvals.review`
- **Body**:
  ```json
  {
    "rejectedBy": "user-id",
    "reason": "Rejection reason"
  }
  ```

#### Request Revision
- **POST** `/ad-approvals/{approvalId}/revision`
- **Permissions Required**: `approvals.review`
- **Body**:
  ```json
  {
    "requestedBy": "user-id",
    "feedback": "Revision feedback"
  }
  ```

### Billing

#### Get Billing Overview
- **GET** `/billing/overview`
- **Permissions Required**: `billing.view`
- **Response**: Billing metrics (total revenue, monthly revenue, pending invoices, etc.)

### Deals/Pipeline

#### List Deals
- **GET** `/deals`
- **Permissions Required**: `deals.view`
- **Query Parameters**:
  - `stage` (optional): Filter by stage
  - `sellerId` (optional): Filter by seller
- **Response**: List of deals

#### Get Deal Pipeline
- **GET** `/deals/pipeline`
- **Permissions Required**: `deals.view`
- **Response**: Deals grouped by stage with metrics

#### Create Deal
- **POST** `/deals`
- **Permissions Required**: `deals.create`
- **Body**:
  ```json
  {
    "name": "Deal Name",
    "clientId": "client-id",
    "value": 10000,
    "stage": "prospecting|qualification|proposal|negotiation|closed-won|closed-lost",
    "probability": 50,
    "expectedCloseDate": "2024-03-01",
    "notes": "Deal notes"
  }
  ```

#### Get Deal
- **GET** `/deals/{dealId}`
- **Permissions Required**: `deals.view`
- **Response**: Deal details with activities

#### Update Deal
- **PUT** `/deals/{dealId}`
- **Permissions Required**: `deals.update`
- **Body**: Fields to update

#### Delete Deal
- **DELETE** `/deals/{dealId}`
- **Permissions Required**: `deals.delete`

## Role Permissions

### Admin
- All permissions

### Seller
- `campaigns.*` (all campaign operations)
- `deals.*` (all deal operations)
- `clients.view.own`, `clients.create`, `clients.update.own`
- `billing.view`, `invoices.create`, `invoices.view.own`
- `approvals.submit`
- `analytics.view.campaigns`

### Producer
- `shows.view.assigned`, `shows.edit.assigned`
- `episodes.manage.assigned`
- `approvals.review`, `approvals.manage`
- `analytics.view.shows`

### Talent
- `episodes.view.assigned`
- `recordings.manage`
- `approvals.view.assigned`
- `schedule.view.own`

### Client
- `campaigns.view.own`
- `billing.view`
- `analytics.view.own`

## Error Responses

All endpoints return standard error responses:

```json
{
  "message": "Error description",
  "error": "Detailed error message (in development)"
}
```

Common status codes:
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error