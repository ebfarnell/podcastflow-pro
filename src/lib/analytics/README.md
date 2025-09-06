# Real-Time Analytics Pipeline

## Overview
Comprehensive real-time analytics system for campaign tracking, event processing, and live dashboard updates.

## Components

### 1. Real-Time Analytics Pipeline (`real-time-pipeline.ts`)
Core service that processes analytics events and updates metrics in real-time.

#### Key Features:
- **Event Ingestion** - Single events and batch processing
- **Buffer Management** - Efficient event batching and flushing
- **Real-Time Metrics** - Live calculation of campaign performance
- **Database Integration** - Automatic CampaignAnalytics updates
- **Validation** - Event validation and error handling

#### Event Types:
- `impression` - Ad impressions
- `click` - User clicks
- `conversion` - Goal completions
- `view` - Video/audio playbacks
- `engagement` - User interactions
- `completion` - Full content completion
- `skip` - Content skipped

### 2. Analytics Event Simulator (`event-simulator.ts`)
Testing and demonstration tool for generating realistic analytics events.

#### Simulation Types:
- **Continuous Simulation** - Ongoing event generation
- **Event Bursts** - Bulk event generation
- **User Journeys** - Complete user interaction flows
- **Realistic Data** - Device types, locations, user agents

### 3. WebSocket Service (`websocket-service.ts`)
Real-time notification system using Server-Sent Events (SSE).

#### Features:
- **Subscription Management** - Track active connections
- **Update Broadcasting** - Real-time metric updates
- **Queue Management** - Buffer updates for clients
- **Automatic Cleanup** - Remove inactive subscriptions

## API Endpoints

### Core Analytics
- `POST /api/analytics/real-time` - Ingest events
- `GET /api/analytics/real-time` - Get pipeline status

### Campaign-Specific
- `GET /api/campaigns/[id]/analytics/real-time` - Campaign metrics
- `POST /api/campaigns/[id]/analytics/real-time` - Campaign events

### Dashboard
- `GET /api/analytics/real-time/dashboard` - Live dashboard metrics

### Subscriptions (SSE)
- `POST /api/analytics/real-time/subscribe` - Create subscription
- `DELETE /api/analytics/real-time/subscribe` - Remove subscription
- `GET /api/analytics/real-time/updates` - Get live updates

### Simulation
- `POST /api/analytics/real-time/simulate` - Control simulation
- `GET /api/analytics/real-time/simulate` - Simulation status

## Usage Examples

### 1. Ingest Analytics Event
```typescript
// Single event
const response = await fetch('/api/analytics/real-time', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    event: {
      eventType: 'click',
      campaignId: 'camp_123',
      organizationId: 'org_456',
      metadata: {
        sessionId: 'session_abc',
        deviceType: 'mobile',
        location: 'New York, NY'
      },
      value: 1.50 // Cost per click
    }
  })
})
```

### 2. Batch Event Ingestion
```typescript
// Multiple events
const response = await fetch('/api/analytics/real-time', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    events: [
      {
        eventType: 'impression',
        campaignId: 'camp_123',
        organizationId: 'org_456'
      },
      {
        eventType: 'click',
        campaignId: 'camp_123',
        organizationId: 'org_456',
        value: 1.50
      }
    ]
  })
})
```

### 3. Get Real-Time Metrics
```typescript
// Campaign metrics
const response = await fetch('/api/campaigns/camp_123/analytics/real-time?timeWindow=3600')
const data = await response.json()

console.log(data.metrics)
// {
//   impressions: 1500,
//   clicks: 45,
//   conversions: 3,
//   ctr: 3.0,
//   conversionRate: 6.7,
//   totalSpent: 67.50
// }
```

### 4. Real-Time Dashboard
```typescript
// Organization dashboard
const response = await fetch('/api/analytics/real-time/dashboard?organizationId=org_456&timeWindow=3600')
const data = await response.json()

console.log(data.summary)
// {
//   totalImpressions: 15000,
//   totalClicks: 450,
//   activeCampaigns: 5,
//   overallCtr: 3.0,
//   totalSpent: 675.00
// }
```

### 5. Server-Sent Events Subscription
```typescript
// Subscribe to real-time updates
const subscribeResponse = await fetch('/api/analytics/real-time/subscribe', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    organizationId: 'org_456',
    campaignIds: ['camp_123', 'camp_124']
  })
})

const { subscription } = await subscribeResponse.json()

// Connect to live updates
const eventSource = new EventSource(
  `/api/analytics/real-time/updates?subscriptionId=${subscription.id}&format=sse`
)

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data)
  
  if (data.type === 'update') {
    console.log('Real-time update:', data.data)
    // Update dashboard in real-time
  }
}
```

## Analytics Event Structure

### Basic Event
```typescript
interface AnalyticsEvent {
  eventType: 'impression' | 'click' | 'conversion' | 'view' | 'engagement' | 'completion' | 'skip'
  campaignId: string
  organizationId: string
  timestamp?: Date
  value?: number
  metadata?: {
    sessionId?: string
    userAgent?: string
    deviceType?: string
    location?: string
    duration?: number
    position?: number
    // ... other fields
  }
}
```

### Real-Time Metrics
```typescript
interface RealTimeMetrics {
  campaignId: string
  timestamp: Date
  impressions: number
  clicks: number
  conversions: number
  ctr: number
  conversionRate: number
  totalSpent: number
  cpc: number
  cpa: number
  engagementRate: number
  averageViewTime: number
  bounceRate: number
  adPlaybacks: number
  completionRate: number
  skipRate: number
}
```

## Testing & Simulation

### Start Continuous Simulation
```typescript
const response = await fetch('/api/analytics/real-time/simulate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'start',
    campaignIds: ['camp_123', 'camp_124'],
    organizationId: 'org_456',
    options: {
      eventsPerMinute: 120,
      duration: 30, // minutes
      impressionRate: 0.7,
      clickRate: 0.25,
      conversionRate: 0.05
    }
  })
})
```

### Generate Event Burst
```typescript
const response = await fetch('/api/analytics/real-time/simulate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'burst',
    campaignIds: ['camp_123'],
    organizationId: 'org_456',
    options: {
      count: 500
    }
  })
})
```

### Simulate User Journey
```typescript
const response = await fetch('/api/analytics/real-time/simulate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'journey',
    campaignIds: ['camp_123'],
    organizationId: 'org_456'
  })
})
```

## Configuration

### Pipeline Settings
```typescript
// Real-time pipeline configuration
const pipeline = new RealTimeAnalyticsPipeline()
pipeline.bufferSize = 100        // Events before flush
pipeline.flushInterval = 5000    // Flush every 5 seconds
```

### WebSocket Settings
```typescript
// WebSocket service configuration
const webSocket = new AnalyticsWebSocketService()
webSocket.maxQueueSize = 100     // Max updates per subscription
```

## Database Integration

### CampaignAnalytics Model
The pipeline automatically updates the `CampaignAnalytics` table:

```prisma
model CampaignAnalytics {
  id              String    @id @default(cuid())
  campaignId      String
  organizationId  String
  date            DateTime  @default(now())
  impressions     Int       @default(0)
  clicks          Int       @default(0)
  conversions     Int       @default(0)
  ctr             Float     @default(0)
  conversionRate  Float     @default(0)
  spent           Float     @default(0)
  cpc             Float     @default(0)
  cpa             Float     @default(0)
  // ... other metrics
  
  @@unique([campaignId, date])
}
```

### Upsert Strategy
Events are aggregated by campaign and date, with metrics calculated in real-time:
- Incremental updates for counters (impressions, clicks, conversions)
- Recalculated averages (CTR, conversion rate, CPC, CPA)
- Real-time notification to subscribers

## Monitoring

### Pipeline Status
```typescript
const status = realTimeAnalytics.getStatus()
console.log(status)
// {
//   bufferSize: 25,
//   isProcessing: false,
//   lastFlush: "2025-07-15T12:30:00.000Z"
// }
```

### WebSocket Statistics
```typescript
const stats = analyticsWebSocket.getStats()
console.log(stats)
// {
//   activeSubscriptions: 3,
//   totalQueuedUpdates: 15,
//   subscriptionsByOrganization: {
//     "org_456": 2,
//     "org_789": 1
//   }
// }
```

## Performance Considerations

### Event Processing
- Events are buffered and processed in batches
- Database upserts are used to prevent duplicates
- Automatic cleanup of inactive subscriptions

### Real-Time Updates
- Server-Sent Events for browser compatibility
- Heartbeat messages to keep connections alive
- Automatic subscription cleanup after 30 minutes

### Scalability
- Event simulation for load testing
- Configurable buffer sizes and intervals
- Queue management for high-volume events

## Future Enhancements

### Planned Features
- Redis integration for distributed processing
- WebSocket support for Node.js environments
- Advanced filtering and aggregation options
- Historical trend analysis
- Alerting and notification system

### Integration Opportunities
- Google Analytics integration
- Custom metric definitions
- A/B testing framework
- Machine learning predictions
- Real-time bidding optimization

## Error Handling

### Event Validation
- Required fields validation
- Event type verification
- Campaign existence checks
- Organization access validation

### Processing Errors
- Automatic retry logic
- Error logging and monitoring
- Graceful degradation
- Buffer overflow protection

### Connection Management
- Automatic reconnection for SSE
- Subscription cleanup on errors
- Timeout handling
- Memory leak prevention