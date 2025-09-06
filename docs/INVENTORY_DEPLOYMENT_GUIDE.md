# Inventory Integration Deployment Guide

## Deployment Completed: July 28, 2025

### Summary
Successfully integrated the Inventory system with Shows/Episodes, Schedule Builder, and Order system. All requirements have been implemented with full backward compatibility.

## What Was Implemented

### 1. **Dynamic Spot Assignment** ✅
- Episodes automatically calculate ad spots based on length
- Admin-configurable thresholds per show
- Default thresholds:
  - 0-15 min: 1 pre-roll only
  - 15-30 min: 1 pre, 1 mid, 1 post
  - 30-60 min: 1 pre, 2 mid, 1 post  
  - 60-120 min: 2 pre, 3 mid, 1 post

### 2. **Inventory Tracking** ✅
- Per-episode inventory with availability tracking
- Real-time updates when spots are held/booked
- 132 future episodes now have inventory records
- Retroactive population completed for all organizations

### 3. **Spot Hold & Reservation** ✅
- Order creation automatically creates 48-hour holds
- Admin approval converts holds to bookings
- Admin rejection releases holds back to available
- Transaction-safe to prevent double-booking

### 4. **Role-Based Visibility** ✅
- Admin/Master: Full inventory access
- Sales: All shows (unless blocked)
- Producer/Talent: Only assigned shows
- Custom visibility grants supported
- API endpoints enforce permissions

### 5. **Alerts & Notifications** ✅
- Overbooking alerts created automatically
- Deletion impact notifications
- Update conflict detection
- Admin and affected sellers notified

## Current System State

### Database Changes Applied
- ✅ Show table: Added spot configuration fields
- ✅ ShowConfiguration: Added threshold settings
- ✅ Episode: Added length field (default 30 min)
- ✅ EpisodeInventory: Enhanced with dynamic calculations
- ✅ InventoryReservation: Added hold workflow fields
- ✅ Order: Linked to ScheduleBuilder with approval workflow
- ✅ New tables: InventoryVisibility, InventoryChangeLog, InventoryAlert

### API Endpoints Created
- ✅ `/api/inventory/visibility` - Role-based access control
- ✅ `/api/inventory/holds` - Hold management
- ✅ `/api/inventory/alerts` - Alert system
- ✅ `/api/shows/spot-configuration` - Admin spot settings
- ✅ `/api/orders/schedule-integration` - Order creation from schedules

### Data Population Results
- **PodcastFlow Pro**: 132 episodes with inventory
- **Unfy**: Ready for inventory (no scheduled episodes yet)
- All future episodes have correct spot counts
- Existing bookings preserved

## Testing the Integration

### 1. Verify Inventory Calculation
```bash
# Check an episode's inventory
PGPASSWORD=PodcastFlow2025Prod psql -U podcastflow -h localhost -d podcastflow_production -c "
SELECT e.title, e.length, ei.\"preRollSlots\", ei.\"midRollSlots\", ei.\"postRollSlots\"
FROM org_podcastflow_pro.\"Episode\" e
JOIN org_podcastflow_pro.\"EpisodeInventory\" ei ON ei.\"episodeId\" = e.id
WHERE e.\"airDate\" > CURRENT_DATE
LIMIT 5;"
```

### 2. Test Spot Configuration Update
```bash
curl -X PUT http://localhost:3000/api/shows/spot-configuration \
  -H "Cookie: auth-token=YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "showId": "SHOW_ID",
    "enableDynamicSpots": true,
    "defaultSpotLoadType": "premium"
  }'
```

### 3. Test Order Creation with Holds
```bash
curl -X POST http://localhost:3000/api/orders/schedule-integration \
  -H "Cookie: auth-token=YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "scheduleId": "SCHEDULE_ID",
    "requiresClientApproval": false,
    "paymentTerms": "net30"
  }'
```

## Monitoring & Maintenance

### Check System Health
```bash
# View active alerts
PGPASSWORD=PodcastFlow2025Prod psql -U podcastflow -h localhost -d podcastflow_production -c "
SELECT alertType, severity, status, COUNT(*) 
FROM org_podcastflow_pro.\"InventoryAlert\" 
GROUP BY alertType, severity, status;"

# Check inventory utilization
PGPASSWORD=PodcastFlow2025Prod psql -U podcastflow -h localhost -d podcastflow_production -c "
SELECT 
  COUNT(*) as total_episodes,
  SUM(\"preRollSlots\" + \"midRollSlots\" + \"postRollSlots\") as total_slots,
  SUM(\"preRollAvailable\" + \"midRollAvailable\" + \"postRollAvailable\") as available_slots,
  SUM(\"preRollBooked\" + \"midRollBooked\" + \"postRollBooked\") as booked_slots
FROM org_podcastflow_pro.\"EpisodeInventory\"
WHERE \"airDate\" > CURRENT_DATE;"
```

### Clean Up Expired Holds
```bash
# Run periodically (e.g., daily cron)
curl -X DELETE http://localhost:3000/api/inventory/holds \
  -H "Cookie: auth-token=ADMIN_TOKEN"
```

## Rollback Procedure (If Needed)

### 1. Stop Application
```bash
pm2 stop podcastflow-pro
```

### 2. Restore Code Backup
```bash
cd /home/ec2-user
tar -xzf podcastflow-inventory-integration-backup-20250728-170627.tar.gz
```

### 3. Run Rollback Script
```bash
PGPASSWORD=PodcastFlow2025Prod psql -U podcastflow -h localhost -d podcastflow_production \
  -f scripts/rollback-inventory-integration.sql
```

### 4. Restart Application
```bash
npm run build
pm2 restart podcastflow-pro
```

## Known Issues & Workarounds

1. **Issue**: Some episodes might not have length set
   - **Workaround**: Default to 30 minutes, admin can update

2. **Issue**: Hold expiration not automatic
   - **Workaround**: Call DELETE endpoint periodically

3. **Issue**: Client approval UI not implemented
   - **Workaround**: Use API directly or admin portal

## Next Steps

1. **Implement Client Portal UI** for order approvals
2. **Add Bulk Operations** for inventory management
3. **Create Dashboard** for inventory analytics
4. **Set Up Automated Hold Cleanup** cron job

## Support Contacts

- **Technical Issues**: Check PM2 logs first
- **Database Issues**: Use rollback script if needed
- **API Issues**: Verify authentication and permissions

## Files Reference

- **Backup**: `/home/ec2-user/podcastflow-inventory-integration-backup-20250728-170627.tar.gz`
- **Migration**: `/home/ec2-user/podcastflow-pro/prisma/migrations/20250728_inventory_integration/`
- **API Code**: `/home/ec2-user/podcastflow-pro/src/app/api/inventory/`
- **Documentation**: `/home/ec2-user/podcastflow-pro/docs/INVENTORY_INTEGRATION_CHANGES.md`
- **Rollback**: `/home/ec2-user/podcastflow-pro/scripts/rollback-inventory-integration.sql`