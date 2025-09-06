# Inventory Integration Changes Documentation

## Overview
This document describes all changes made to integrate the Inventory system with Shows/Episodes, Schedule Builder, and Order system. Implementation date: July 28, 2025.

## Summary of Changes

### 1. Database Schema Changes

#### New Tables Added
- **InventoryVisibility** - Role-based access control for inventory viewing
- **InventoryChangeLog** - Audit trail for all inventory changes
- **InventoryAlert** - Overbooking and deletion impact notifications

#### Modified Tables
- **Show** - Added: `spotConfiguration`, `defaultSpotLoadType`, `enableDynamicSpots`
- **ShowConfiguration** - Added: `spotThresholds`, `customSpotRules`
- **Episode** - Added: `length` (if missing)
- **EpisodeInventory** - Added: `calculatedFromLength`, `spotConfiguration`, `lastSyncedAt`, `holdExpiresAt`
- **InventoryReservation** - Added: `holdType`, `orderId`, `approvalStatus`, `approvedBy`, `approvedAt`, `rejectionReason`
- **Order** - Added: `scheduleId`, `requiresClientApproval`, `clientApprovedAt`, `clientApprovedBy`, `approvalWorkflow`, `contractTerms`, `paymentTerms`, `specialInstructions`

### 2. New Database Functions
- **calculate_episode_spots()** - Calculates ad spots based on episode length and show configuration
- **update_episode_inventory()** - Trigger function to auto-update inventory when episodes change
- **create_inventory_hold()** - Creates inventory holds from orders with conflict detection

### 3. New API Endpoints

#### Inventory Visibility
- `GET /api/inventory/visibility` - Get inventory based on user role and permissions
- `POST /api/inventory/visibility` - Grant/update inventory visibility
- `DELETE /api/inventory/visibility` - Remove visibility grants

#### Inventory Holds
- `GET /api/inventory/holds` - List inventory holds with filtering
- `POST /api/inventory/holds` - Create holds from orders
- `PUT /api/inventory/holds` - Approve/reject holds
- `DELETE /api/inventory/holds` - Clean up expired holds

#### Inventory Alerts
- `GET /api/inventory/alerts` - View system alerts for overbooking/conflicts
- `POST /api/inventory/alerts` - Create new alerts (system use)
- `PUT /api/inventory/alerts` - Acknowledge/resolve alerts

#### Show Spot Configuration
- `GET /api/shows/spot-configuration` - Get spot settings for a show
- `PUT /api/shows/spot-configuration` - Update spot configuration
- `POST /api/shows/spot-configuration/threshold` - Add custom length thresholds

#### Order-Schedule Integration
- `POST /api/orders/schedule-integration` - Create order from approved schedule
- `PUT /api/orders/schedule-integration/:orderId/approve` - Approve/reject orders

### 4. Business Logic Implementation

#### Dynamic Spot Assignment
- Episodes automatically calculate ad spots based on their length
- Default thresholds:
  - 0-15 minutes: 1 pre-roll, 0 mid-roll, 0 post-roll
  - 15-30 minutes: 1 pre-roll, 1 mid-roll, 1 post-roll
  - 30-60 minutes: 1 pre-roll, 2 mid-roll, 1 post-roll
  - 60-120 minutes: 2 pre-roll, 3 mid-roll, 1 post-roll
- Admins can customize thresholds per show

#### Inventory Hold Workflow
1. Schedule created and approved
2. Order created from schedule
3. Inventory holds automatically created (48-hour expiration)
4. Admin approves/rejects order
5. Approved: Holds convert to bookings
6. Rejected: Holds released back to available inventory

#### Role-Based Visibility
- **Admin/Master**: Full access to all inventory
- **Sales**: View all shows (unless specifically blocked)
- **Producer/Talent**: Only shows they're assigned to
- **Client**: No direct inventory access
- Custom grants can override default permissions

#### Conflict Detection
- Prevents double-booking of same inventory slot
- Alerts created for overbooking scenarios
- Notifications sent when changes impact existing orders

### 5. Data Migration
- Created sync script: `/scripts/sync-episode-inventory.ts`
- Retroactively populates inventory for all future scheduled episodes
- Respects existing bookings (won't override)
- Safe to run multiple times

### 6. Files Created/Modified

#### New Files
- `/prisma/migrations/20250728_inventory_integration/migration.sql`
- `/scripts/sync-episode-inventory.ts`
- `/src/app/api/inventory/visibility/route.ts`
- `/src/app/api/inventory/holds/route.ts`
- `/src/app/api/inventory/alerts/route.ts`
- `/src/app/api/shows/spot-configuration/route.ts`
- `/src/app/api/orders/schedule-integration/route.ts`
- `/src/__tests__/inventory-integration.test.ts`
- `/docs/INVENTORY_INTEGRATION_CHANGES.md`
- `/scripts/rollback-inventory-integration.sql`

#### Modified Files
- Database schema (via migration)
- No existing API endpoints were modified (backward compatible)

## Backward Compatibility

All changes are backward compatible:
- New fields are nullable or have defaults
- Existing APIs continue to work unchanged
- New features are opt-in via configuration
- No breaking changes to existing workflows

## Testing

Comprehensive test suite created covering:
- Dynamic spot calculation
- Inventory hold creation and release
- Permission enforcement
- Double-booking prevention
- Alert generation
- Retroactive data population

Run tests with: `npm test src/__tests__/inventory-integration.test.ts`

## Deployment Steps

1. **Backup** (Already completed)
   ```bash
   tar -czf backup-pre-inventory.tar.gz podcastflow-pro/
   pg_dump podcastflow_production > backup-pre-inventory.sql
   ```

2. **Run Database Migration**
   ```bash
   cd /home/ec2-user/podcastflow-pro
   npx prisma migrate deploy
   ```

3. **Sync Existing Data**
   ```bash
   npm run ts-node scripts/sync-episode-inventory.ts
   ```

4. **Deploy Code**
   ```bash
   npm run build
   pm2 restart podcastflow-pro
   ```

5. **Verify**
   - Check PM2 logs: `pm2 logs podcastflow-pro`
   - Test new endpoints
   - Verify inventory calculations

## Rollback Procedure

If rollback is needed:

1. **Restore Code**
   ```bash
   cd /home/ec2-user
   tar -xzf podcastflow-inventory-integration-backup-20250728-170627.tar.gz
   ```

2. **Run Rollback Script**
   ```bash
   psql -U podcastflow -d podcastflow_production -f scripts/rollback-inventory-integration.sql
   ```

3. **Restart Application**
   ```bash
   npm run build
   pm2 restart podcastflow-pro
   ```

## Known Limitations

1. **Spot Recalculation**: When spot configuration changes, only episodes without bookings are updated
2. **Hold Expiration**: Currently set to 48 hours, not configurable per organization
3. **Bulk Operations**: No bulk hold creation/approval yet
4. **Client Portal**: Client approval workflow exists but UI not implemented

## Future Enhancements

1. Configurable hold expiration times
2. Bulk inventory operations
3. Advanced conflict resolution UI
4. Inventory forecasting based on historical data
5. API rate limiting for inventory endpoints

## Support

For issues or questions:
- Check logs: `pm2 logs podcastflow-pro --lines 1000`
- Database queries: Use `safeQuerySchema()` for all org data
- Permission issues: Verify role assignments in User table
- Inventory conflicts: Check InventoryAlert table

## Security Considerations

- All endpoints require authentication
- Role-based access enforced at API level
- Audit trail maintained for all changes
- No direct inventory manipulation allowed
- Transaction-safe operations prevent race conditions