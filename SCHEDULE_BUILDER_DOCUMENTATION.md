# PodcastFlow Pro - Enhanced Schedule Builder Documentation

## Overview
The Enhanced Schedule Builder is a comprehensive tool that allows Admin and Sales users to efficiently create, review, and export multi-show, multi-campaign podcast ad schedules for advertisers. This feature provides deep integration with campaigns, advertisers, agencies, shows, user permissions, and approval workflows.

## Database Schema

### New Tables Created

#### 1. ShowConfiguration
Stores multiple episode configurations per show (e.g., 15-minute vs 2-hour episodes)
- `id`: Unique identifier
- `showId`: Reference to Show
- `name`: Configuration name (e.g., "Standard Episode", "Short Episode")
- `episodeLength`: Duration in minutes
- `adLoadType`: standard, premium, or custom
- `preRollSlots`, `midRollSlots`, `postRollSlots`: Number of available slots
- `preRollDuration`, `midRollDuration`, `postRollDuration`: Duration in seconds
- `releaseDays`: Array of release days
- `releaseTime`: Typical release time
- `isActive`: Whether configuration is active

#### 2. RateCard
Episode configuration-specific pricing
- `showConfigurationId`: Reference to ShowConfiguration
- `effectiveDate`, `expiryDate`: Date range for rate card validity
- `preRollBaseRate`, `midRollBaseRate`, `postRollBaseRate`: Base prices
- `volumeDiscounts`: JSON array of volume discount tiers
- `seasonalMultipliers`: Quarterly pricing multipliers
- `dayOfWeekMultipliers`: Day-specific pricing adjustments
- `status`: draft, active, or expired

#### 3. ShowRestriction
Category and advertiser restrictions per show
- `showId`: Reference to Show
- `restrictionType`: category_exclusive, category_blocked, advertiser_blocked
- `category`: Category name (e.g., 'automotive', 'finance')
- `advertiserId`: Specific advertiser to block
- `startDate`, `endDate`: Restriction date range

#### 4. ScheduleBuilder
Main schedule entity
- `name`: Schedule name
- `campaignId`: Optional campaign reference
- `advertiserId`, `agencyId`: Advertiser and agency references
- `status`: draft, pending_approval, approved, active, completed
- `startDate`, `endDate`: Schedule date range
- `totalBudget`: Optional budget cap
- `totalSpots`, `totalImpressions`: Calculated totals
- `rateCardValue`, `discountAmount`, `valueAddAmount`, `netAmount`: Financial totals

#### 5. ScheduleBuilderItem
Individual ad placements
- `scheduleId`: Reference to ScheduleBuilder
- `showId`, `showConfigurationId`: Show and configuration references
- `episodeId`: Optional specific episode
- `airDate`: Placement date
- `placementType`: pre-roll, mid-roll, or post-roll
- `slotNumber`: Which slot (for multiple slots of same type)
- `rateCardPrice`, `negotiatedPrice`: Pricing details
- `conflictStatus`, `conflictDetails`: Competitive conflict information

#### 6. InventoryReservation
Tracks slot reservations to prevent double-booking
- `episodeId`, `placementType`, `slotNumber`: Slot identifier
- `scheduleId`, `scheduleItemId`: Schedule references
- `status`: reserved, confirmed, or released
- `expiresAt`: Expiration for temporary holds

#### 7. CampaignCategory
Categories for competitive blocking
- `campaignId`: Reference to Campaign
- `category`: Category name
- `isPrimary`: Whether this is the primary category
- `exclusivityLevel`: none, episode, show, or network

#### 8. ScheduleTemplate
Reusable schedule templates
- `name`, `description`: Template details
- `showCriteria`: JSON criteria for show selection
- `budgetRange`: Min/max budget range
- `defaultPattern`: weekly, biweekly, monthly, custom
- `defaultPlacements`: Default placement types

#### 9. ScheduleApproval
Approval workflow tracking
- `scheduleId`: Reference to ScheduleBuilder
- `approvalType`: rate_exception, value_add, or standard
- `rateCardPercent`: Percentage of rate card achieved
- `status`: pending, approved, or rejected

## API Endpoints

### Schedule Management

#### GET /api/schedules
List schedules with filters
- Query params: `status`, `advertiserId`, `campaignId`, `startDate`, `endDate`
- Returns: Array of schedules with counts

#### POST /api/schedules
Create new schedule
- Body: `name`, `campaignId`, `advertiserId`, `agencyId`, `startDate`, `endDate`, `totalBudget`
- Returns: Created schedule

#### GET /api/schedules/[id]
Get schedule details with items and approvals
- Returns: Schedule object with items[] and approvals[]

#### PUT /api/schedules/[id]
Update schedule
- Body: Any schedule fields to update
- Returns: Updated schedule

#### DELETE /api/schedules/[id]
Delete draft schedule
- Returns: Success status

### Schedule Items

#### GET /api/schedules/[id]/items
List schedule items with filters
- Query params: `showId`, `startDate`, `endDate`
- Returns: Array of schedule items with full details

#### POST /api/schedules/[id]/items
Add items to schedule
- Body: `items[]` array of placements
- Returns: Created items and any conflicts

### Show Configurations

#### GET /api/shows/[id]/configurations
Get show configurations with active rate cards
- Returns: Array of configurations with rate card details

#### POST /api/shows/[id]/configurations
Create new configuration
- Body: Configuration details and optional rate card
- Returns: Created configuration

### Enhanced Inventory

#### GET /api/inventory/enhanced
Get available inventory with advanced filtering
- Query params: `showIds`, `startDate`, `endDate`, `categories`, `minImpressions`, `maxPrice`
- Returns: Detailed inventory with availability and pricing

### Rate Cards

#### GET /api/rate-cards
List rate cards
- Query params: `showConfigurationId`, `showId`, `status`, `effectiveDate`
- Returns: Array of rate cards with show details

#### POST /api/rate-cards
Create new rate card
- Body: Rate card details
- Returns: Created rate card

#### PUT /api/rate-cards
Update rate card multipliers
- Body: `id` and fields to update
- Returns: Updated rate card

## Frontend Components

### Enhanced Hooks

#### useEnhancedScheduleBuilder
Main hook for schedule builder functionality
```typescript
const {
  selectedShows,
  selectedItems,
  inventory,
  loading,
  schedule,
  filters,
  addShow,
  removeShow,
  loadInventory,
  addItem,
  removeItem,
  updateItemPrice,
  setFilters,
  saveSchedule,
  exportSchedule,
  getTotals,
  getVolumeDiscount
} = useEnhancedScheduleBuilder(scheduleId?)
```

### Components

#### EnhancedInventoryCalendar
Calendar view with drag-and-drop support
- Shows available inventory by date
- Visual indicators for placement types
- Interactive details drawer
- Real-time price editing
- Conflict warnings

## Features

### 1. Multi-Show Support
- Select multiple shows for a single schedule
- Different configurations per show (15min vs 2hr episodes)
- Show-specific restrictions and rate cards

### 2. Advanced Pricing
- Base rate cards with automatic adjustments
- Seasonal multipliers (Q1-Q4)
- Day-of-week multipliers
- Volume discounts based on total slots
- Value-add tracking

### 3. Inventory Management
- Real-time availability checking
- Prevents double-booking
- Temporary reservations (24-hour hold)
- Visual calendar interface

### 4. Competitive Blocking
- Category-based exclusivity
- Episode, show, or network-level blocking
- Automatic conflict detection
- Override capability for admins

### 5. Approval Workflow
- Rate exception approvals
- Value-add justification
- Admin-only approval rights
- Audit trail

### 6. Export Capabilities
- PDF export for client proposals
- XLSX export for detailed analysis
- Customizable export templates
- Professional formatting

## User Workflows

### Creating a New Schedule

1. **Initial Setup**
   - Enter campaign name and budget
   - Select advertiser and agency
   - Choose date range

2. **Show Selection**
   - Browse and filter available shows
   - View show metrics and configurations
   - Add multiple shows to schedule

3. **Inventory Selection**
   - Calendar view shows available slots
   - Drag-and-drop to build schedule
   - Real-time pricing updates
   - Conflict warnings

4. **Review & Approval**
   - Summary view with totals
   - Rate card achievement percentage
   - Submit for approval if needed

5. **Export & Share**
   - Generate PDF proposal
   - Export detailed XLSX
   - Email to stakeholders

### Approval Process

1. Sales creates schedule with discounts
2. System calculates rate card percentage
3. If below threshold, approval required
4. Admin reviews and approves/rejects
5. Schedule becomes bookable order

## Integration Points

### Campaign Integration
- Schedules can be linked to campaigns
- Campaign budget constraints enforced
- Category information inherited

### Show Integration
- Pulls inventory from episodes
- Respects show restrictions
- Uses show-specific rate cards

### Organization Isolation
- All data is organization-specific
- No cross-organization data leakage
- Secure multi-tenant architecture

## Performance Optimizations

- Efficient inventory queries with indexes
- Real-time updates via Server-Sent Events
- Pagination for large result sets
- Caching of rate card calculations

## Security

- Role-based access (Admin/Sales only)
- Organization-specific data isolation
- Audit logging for all changes
- Secure pricing negotiations

## Future Enhancements

1. **AI-Powered Optimization**
   - Automatic schedule suggestions
   - Budget optimization
   - Audience targeting

2. **Advanced Templates**
   - Industry-specific templates
   - Seasonal campaign patterns
   - A/B testing support

3. **Integration Enhancements**
   - Direct integration with ad servers
   - Automated creative assignment
   - Performance tracking

## Testing

The system includes comprehensive testing for:
- Organization data isolation
- Permission enforcement
- Conflict detection accuracy
- Pricing calculations
- Export functionality

## Migration Notes

- Existing Schedule/ScheduleItem tables renamed to Legacy versions
- New enhanced tables use ScheduleBuilder prefix
- All existing data preserved
- Backward compatibility maintained