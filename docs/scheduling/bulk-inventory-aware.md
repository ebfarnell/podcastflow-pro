# Bulk Scheduling with Inventory Awareness

## Overview

The Bulk Placement (Inventory-Aware) feature enables users to schedule multiple advertising spots across podcast episodes while respecting real-time inventory availability, existing reservations, and organizational constraints.

## Key Features

### 1. Real-Time Inventory Checking
- Validates availability before placement
- Respects existing reservations and holds
- Prevents double-booking of sold inventory
- Checks episode-specific placement slots

### 2. Flexible Placement Strategies

#### Strict Mode (Default)
- Only places spots where exactly requested
- Skips unavailable dates/shows
- No automatic substitutions

#### Relaxed Mode
- Attempts alternative dates within same shows
- Maintains proximity to requested dates
- Respects show preferences

#### Fill Anywhere Mode
- Maximum flexibility to meet spot count
- Can place across any available inventory
- Best for maximizing placement rate

### 3. Multi-Spot Control
- **Single Spot per Show/Day** (Default): Maximum 1 spot per show per day
- **Multiple Spots Allowed**: Configure max spots per show per day (1-10)
- Prevents oversaturation while maximizing reach

## User Interface

### Configuration Panel
1. **Date Range**: Select campaign start/end dates
2. **Active Days**: Choose which weekdays to include (Mon-Sun)
3. **Placement Types**: Select pre-roll, mid-roll, post-roll
4. **Spots Configuration**: 
   - Total spots requested OR
   - Spots per week (for even distribution)
5. **Show Selection**: Choose participating shows
6. **Fallback Strategy**: Select strict/relaxed/fill_anywhere

### Preview Mode
- Dry-run simulation without database changes
- Shows exactly what would be placed
- Identifies conflicts with reasons
- Provides distribution summary by:
  - Placement type
  - Show
  - Week

### Conflict Resolution
When spots cannot be placed, the system provides:
- Detailed conflict reasons:
  - `sold`: Inventory already sold
  - `held`: Reserved by another party
  - `no_inventory`: No episodes on that date
  - `max_spots_reached`: Daily limit hit
- Resolution options:
  - "Try Relaxed Placement" - Loosens date constraints
  - "Fill Any Available" - Maximum flexibility

## API Endpoints

### POST /api/schedules/bulk/preview
Simulates placement without committing to database.

**Request:**
```json
{
  "campaignId": "string",
  "advertiserId": "string",
  "showIds": ["show1", "show2"],
  "dateRange": {
    "start": "2025-01-01",
    "end": "2025-01-31"
  },
  "weekdays": [1, 2, 3, 4, 5],
  "placementTypes": ["pre-roll", "mid-roll"],
  "spotsRequested": 20,
  "allowMultiplePerShowPerDay": false,
  "fallbackStrategy": "strict"
}
```

**Response:**
```json
{
  "wouldPlace": [...],
  "conflicts": [...],
  "summary": {
    "requested": 20,
    "placeable": 18,
    "unplaceable": 2
  }
}
```

### POST /api/schedules/bulk/commit
Commits the bulk schedule with transactional integrity.

Features:
- Idempotency support (prevents duplicate commits)
- Atomic transaction (all or nothing)
- Re-validates availability before insert
- Logs rate card deltas

## Settings & Defaults

Organization-level defaults (future enhancement):
- `defaultBulkFallbackStrategy`: Default placement strategy
- `defaultAllowMultiplePerShowPerDay`: Multi-spot default
- `maxSpotsPerShowPerDay`: Organization-wide limit
- `generateHeldReservationsOnSchedule`: Auto-create holds
- `minSpotsForAutoReservation`: Threshold for auto-holds

## Allocation Algorithm

### Phase 1: Primary Placement
1. Build candidate list (show × date × placement)
2. Sort by date, then show order, then placement type
3. Round-robin allocation for even distribution
4. Respect per-week limits if specified
5. Check inventory availability for each candidate
6. Place if available, skip if not (based on strategy)

### Phase 2: Fallback Handling
If spots remain unplaced and strategy allows:
1. **Relaxed**: Try alternative dates in same shows
2. **Fill Anywhere**: Expand to any available inventory
3. Sort alternatives by date proximity
4. Continue placement until target met or exhausted

## Database Schema

### BulkScheduleIdempotency
Prevents duplicate commits within 24-hour window:
```sql
CREATE TABLE "BulkScheduleIdempotency" (
  "id" TEXT PRIMARY KEY,
  "key" TEXT NOT NULL UNIQUE,
  "result" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL
);
```

### Inventory Tables
- `EpisodeInventory`: Tracks available slots per episode
- `Reservation`: Manages holds and reservations
- `ReservationItem`: Individual reserved spots
- `ScheduledSpot`: Committed schedule items
- `RateCardDelta`: Price variance tracking

## Workflow Integration

### Automatic Advancement
- First valid schedule advances campaign to 35%
- Preserves existing approval workflows
- Maintains rate card delta logging

### Concurrency Handling
- Uses SELECT FOR UPDATE during commit
- Prevents race conditions
- Ensures inventory integrity

## Performance Considerations

### Optimizations
- Batch inventory queries
- Indexed lookups on (showId, date, placementType)
- Cached rate card information
- Efficient round-robin allocation

### Limits
- Maximum 1000 spots per request
- 24-hour idempotency window
- Transaction timeout: 30 seconds

## Error Handling

### Validation Errors
- Invalid date ranges
- Non-existent shows
- Missing advertiser
- Invalid placement types

### Inventory Errors
- Insufficient availability
- Reservation conflicts
- Episode not found
- Rate card missing

### Recovery Options
- Adjust date range
- Change fallback strategy
- Reduce spot count
- Select different shows

## Best Practices

1. **Start with Preview**: Always preview before committing
2. **Use Appropriate Strategy**: 
   - Strict for premium placements
   - Relaxed for flexible campaigns
   - Fill anywhere for maximum reach
3. **Monitor Conflicts**: Review conflict reasons to improve future planning
4. **Set Realistic Targets**: Consider show schedules and existing bookings
5. **Use Weekly Distribution**: For consistent presence across campaign duration

## Security

- Role-based access control (admin, sales, producer)
- Audit logging of all bulk operations
- Tenant isolation via schema separation
- SQL injection prevention via parameterized queries

## Monitoring

Activity logs capture:
- User performing action
- Spots requested vs placed
- Strategy used
- Timestamp and organization

## Future Enhancements

1. **Competitive Separation**: Prevent competitor adjacency
2. **Audience Targeting**: Place based on demographic match
3. **Budget Optimization**: Maximize value within budget
4. **Template System**: Save and reuse placement patterns
5. **Bulk Modification**: Edit multiple placed spots at once