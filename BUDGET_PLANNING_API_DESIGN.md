# Budget Planning API Endpoints Design

## Overview
New API endpoints to support hierarchical budget management with Advertiser/Agency/Seller relationships, monthly granularity, and rollup calculations.

## Core API Endpoints

### 1. Hierarchical Budget Management

#### GET /api/budget/hierarchical
**Purpose**: Fetch hierarchical budget data with filtering and rollup calculations
**Parameters**:
- `year` (required): Budget year
- `month` (optional): Specific month filter
- `sellerId` (optional): Filter by specific seller
- `entityType` (optional): Filter by entity type (advertiser, agency, seller)
- `includeInactive` (optional): Include inactive entities

**Response**:
```json
{
  "budgets": [
    {
      "id": "budget_123",
      "entityType": "advertiser",
      "entityId": "adv_456", 
      "entityName": "Acme Corp",
      "year": 2025,
      "month": 1,
      "budgetAmount": 50000,
      "actualAmount": 45000,
      "previousYearActual": 40000,
      "sellerId": "user_789",
      "sellerName": "John Seller",
      "agencyId": "agency_321",
      "agencyName": "Big Agency",
      "variance": -5000,
      "variancePercent": -10.0,
      "yearOverYearGrowth": 12.5,
      "notes": "Q1 campaign focus",
      "lastUpdated": "2025-01-15T10:30:00Z"
    }
  ],
  "rollups": {
    "sellerTotals": {
      "user_789": {
        "sellerName": "John Seller",
        "totalBudget": 150000,
        "totalActual": 140000,
        "advertiserBudget": 100000,
        "agencyBudget": 50000,
        "isOnTarget": false,
        "variance": -10000,
        "previousYearTotal": 120000,
        "yearOverYearGrowth": 16.7
      }
    },
    "grandTotals": {
      "totalBudget": 500000,
      "totalActual": 480000,
      "variance": -20000,
      "variancePercent": -4.0
    }
  },
  "metadata": {
    "year": 2025,
    "month": 1,
    "totalSellers": 5,
    "totalEntities": 45,
    "lastCacheUpdate": "2025-01-15T10:30:00Z"
  }
}
```

#### POST /api/budget/hierarchical
**Purpose**: Create new budget entry
**Body**:
```json
{
  "entityType": "advertiser",
  "entityId": "adv_456",
  "year": 2025,
  "month": 1,
  "budgetAmount": 50000,
  "notes": "Q1 campaign focus"
}
```

#### PUT /api/budget/hierarchical/[id]
**Purpose**: Update existing budget entry
**Body**:
```json
{
  "budgetAmount": 55000,
  "actualAmount": 50000,
  "notes": "Updated based on Q1 performance"
}
```

#### PUT /api/budget/hierarchical/batch
**Purpose**: Batch update multiple budget entries for inline editing
**Body**:
```json
{
  "updates": [
    {
      "id": "budget_123",
      "budgetAmount": 55000,
      "actualAmount": 50000
    },
    {
      "id": "budget_124", 
      "budgetAmount": 75000
    }
  ]
}
```

### 2. Entity Management for Budget Assignment

#### GET /api/budget/entities
**Purpose**: Get all entities (advertisers, agencies, sellers) for budget assignment
**Parameters**:
- `type` (optional): Filter by entity type
- `sellerId` (optional): Filter by seller assignment

**Response**:
```json
{
  "sellers": [
    {
      "id": "user_789",
      "name": "John Seller", 
      "email": "john@company.com",
      "isActive": true
    }
  ],
  "agencies": [
    {
      "id": "agency_321",
      "name": "Big Agency",
      "sellerId": "user_789",
      "sellerName": "John Seller",
      "isActive": true,
      "advertiserCount": 5
    }
  ],
  "advertisers": [
    {
      "id": "adv_456",
      "name": "Acme Corp",
      "sellerId": "user_789", 
      "sellerName": "John Seller",
      "agencyId": "agency_321",
      "agencyName": "Big Agency",
      "isActive": true
    }
  ]
}
```

#### PUT /api/budget/entities/assignments
**Purpose**: Update seller assignments for advertisers/agencies
**Body**:
```json
{
  "assignments": [
    {
      "entityType": "advertiser",
      "entityId": "adv_456",
      "sellerId": "user_789"
    },
    {
      "entityType": "agency", 
      "entityId": "agency_321",
      "sellerId": "user_789"
    }
  ]
}
```

### 3. Historical Comparison & Analytics

#### GET /api/budget/comparison
**Purpose**: Get budget vs actual vs previous year comparison
**Parameters**:
- `year` (required): Current year
- `compareYear` (optional): Year to compare against (defaults to year-1)
- `sellerId` (optional): Filter by seller
- `groupBy` (optional): Group by month, quarter, or year

**Response**:
```json
{
  "comparison": [
    {
      "period": "2025-01",
      "currentBudget": 100000,
      "currentActual": 95000,
      "previousActual": 85000,
      "budgetVariance": -5000,
      "budgetVariancePercent": -5.0,
      "yearOverYearGrowth": 11.8,
      "isOnTarget": true
    }
  ],
  "summary": {
    "totalCurrentBudget": 1200000,
    "totalCurrentActual": 1150000,
    "totalPreviousActual": 1000000,
    "overallVariance": -50000,
    "overallYoYGrowth": 15.0,
    "sellersOnTarget": 4,
    "sellersOffTarget": 1
  }
}
```

### 4. Rollup Cache Management

#### POST /api/budget/rollups/refresh
**Purpose**: Manually refresh rollup cache for specific periods
**Body**:
```json
{
  "year": 2025,
  "month": 1,
  "sellerId": "user_789" // optional, refreshes all if omitted
}
```

#### GET /api/budget/rollups/health
**Purpose**: Check rollup cache health and last update times
**Response**:
```json
{
  "cacheHealth": {
    "totalRecords": 500,
    "oldestUpdate": "2025-01-14T10:00:00Z",
    "newestUpdate": "2025-01-15T10:30:00Z",
    "staleRecords": 5,
    "errorCount": 0
  },
  "byPeriod": [
    {
      "year": 2025,
      "month": 1, 
      "recordCount": 45,
      "lastUpdated": "2025-01-15T10:30:00Z",
      "isStale": false
    }
  ]
}
```

### 5. Budget Validation & Constraints

#### POST /api/budget/validate
**Purpose**: Validate budget entries against business rules
**Body**:
```json
{
  "budgets": [
    {
      "entityType": "advertiser",
      "entityId": "adv_456",
      "year": 2025,
      "month": 1,
      "budgetAmount": 50000
    }
  ]
}
```

**Response**:
```json
{
  "validation": {
    "isValid": false,
    "errors": [
      {
        "budgetId": "temp_1",
        "field": "budgetAmount", 
        "message": "Budget exceeds seller's allocated limit",
        "severity": "error"
      }
    ],
    "warnings": [
      {
        "budgetId": "temp_1",
        "message": "Budget is 50% higher than previous year",
        "severity": "warning"
      }
    ]
  }
}
```

## Authentication & Authorization

All endpoints require:
- Valid session token (auth-token cookie)
- User role: `master`, `admin`, or `sales`
- Organization membership validation

Additional role-specific access:
- `sales` users can only access their own assigned entities
- `admin` users can access all org data but cannot modify seller assignments  
- `master` users have full access including seller assignment changes

## Error Handling

Standard HTTP status codes with consistent error format:
```json
{
  "error": "Validation failed",
  "code": "BUDGET_VALIDATION_ERROR",
  "details": {
    "field": "budgetAmount",
    "reason": "Must be positive number"
  },
  "timestamp": "2025-01-15T10:30:00Z"
}
```

## Rate Limiting

- GET endpoints: 100 requests/minute per user
- POST/PUT endpoints: 30 requests/minute per user  
- Batch operations: 10 requests/minute per user

## Caching Strategy

- Budget data cached for 5 minutes on read-heavy endpoints
- Rollup cache updated via triggers on write operations
- Manual cache refresh available for immediate consistency
- ETags for conditional requests on frequently accessed data