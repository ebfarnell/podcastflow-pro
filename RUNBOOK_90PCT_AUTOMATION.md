# 90% Campaign Automation Runbook

## Overview
This runbook describes the automated workflow that triggers when a campaign's probability is set to 90% in PodcastFlow Pro.

## Architecture

### Components
1. **Frontend**: Campaign edit form (`/campaigns/[id]/edit`)
2. **API Route**: PUT `/api/campaigns/[id]`
3. **Workflow Service**: `src/lib/workflow/campaign-workflow-service.ts`
4. **Database Tables**:
   - `Campaign` (with `reservationId`, `approvalRequestId` fields)
   - `CampaignApproval` (approval requests)
   - `ScheduledSpot` (campaign spot scheduling)
   - `InventoryReservation` (inventory holds)
   - `CampaignTimeline` (event tracking)

## Normal Flow (Happy Path)

### 1. User Sets Campaign to 90%
- Sales user edits campaign via UI
- Sets probability dropdown to "90% - Verbal Agreement"
- Submits form

### 2. API Processing
```
PUT /api/campaigns/{id}
Body: { probability: 90, ... }
```
- Validates user permissions
- Checks probability change (old != 90, new == 90)
- Triggers workflow service

### 3. Workflow Automation
The `campaignWorkflowService.handleCampaignStatusUpdate()` performs:

#### a. Inventory Reservation
- Queries `ScheduledSpot` table for campaign spots
- Groups by show/date
- Creates `InventoryReservation` records
- Sets 72-hour auto-expiry
- Updates Campaign with `reservationId`

#### b. Admin Approval Request
- Analyzes rate discrepancies vs rate cards
- Creates `CampaignApproval` record (status: 'pending')
- Updates Campaign with `approvalRequestId`

#### c. Notifications
- Notifies all admin/master users
- Creates in-app notifications
- Logs to `CampaignTimeline`

### 4. Admin Review
Admins see pending approvals at:
- Dashboard notifications
- `/admin/approvals` page (TBD)
- API: `GET /api/campaigns/approvals?status=pending`

### 5a. Approval Path
```
PUT /api/campaigns/approvals/{id}
Body: { action: 'approve', notes: '...' }
```
- Updates `CampaignApproval` status → 'approved'
- Moves Campaign to 100% probability
- Creates `Order` from Campaign
- Triggers post-sale workflows:
  - Ad requests to producers/talent
  - Creative requests to seller
  - Contract generation
  - Invoice schedule initialization

### 5b. Rejection Path
```
PUT /api/campaigns/approvals/{id}
Body: { action: 'reject', reason: '...' }
```
- Updates `CampaignApproval` status → 'rejected'
- Releases all inventory reservations
- Moves Campaign back to 65% probability
- Clears `reservationId` and `approvalRequestId`
- Notifies seller of rejection

## Troubleshooting

### Campaign stuck at 90% with no approval request
1. Check if workflow is enabled:
```sql
SELECT "workflowSettings" FROM public."Organization" 
WHERE id = '{org_id}';
```

2. Check for errors in PM2 logs:
```bash
pm2 logs podcastflow-pro --lines 100 | grep -i workflow
```

3. Verify tables exist:
```sql
\dt org_podcastflow_pro.*approval*
\dt org_podcastflow_pro.*reservation*
```

### Inventory not reserving
1. Check if `ScheduledSpot` records exist:
```sql
SELECT COUNT(*) FROM org_podcastflow_pro."ScheduledSpot" 
WHERE "campaignId" = '{campaign_id}';
```

2. Check reservation table:
```sql
SELECT * FROM org_podcastflow_pro."InventoryReservation" 
WHERE "campaignId" = '{campaign_id}';
```

### Notifications not sending
1. Check notification service logs
2. Verify admin users exist and are active:
```sql
SELECT * FROM public."User" 
WHERE "organizationId" = '{org_id}' 
AND role IN ('admin', 'master') 
AND "isActive" = true;
```

## Manual Recovery

### Re-trigger 90% automation for a campaign
```sql
-- First, clear any existing automation state
UPDATE org_podcastflow_pro."Campaign" 
SET "reservationId" = NULL, 
    "approvalRequestId" = NULL,
    probability = 65
WHERE id = '{campaign_id}';

-- Then set back to 90% to re-trigger
UPDATE org_podcastflow_pro."Campaign" 
SET probability = 90
WHERE id = '{campaign_id}';
```

### Manually release stuck inventory
```sql
DELETE FROM org_podcastflow_pro."InventoryReservation" 
WHERE "campaignId" = '{campaign_id}';

UPDATE org_podcastflow_pro."Campaign" 
SET "reservationId" = NULL 
WHERE id = '{campaign_id}';
```

### Cancel pending approval
```sql
UPDATE org_podcastflow_pro."CampaignApproval" 
SET status = 'cancelled' 
WHERE "campaignId" = '{campaign_id}' 
AND status = 'pending';
```

## Configuration

### Enable/Disable Features
Organization-level settings in `workflowSettings` JSON:
- `autoReserveAt90`: Enable inventory reservation (default: true)
- `requireAdminApprovalAt90`: Require admin approval (default: true)
- `notifyOnStatusChange`: Send notifications (default: true)
- `autoExpireReservations`: Hours until reservation expires (default: 72)

### Update Settings
```sql
UPDATE public."Organization" 
SET "workflowSettings" = jsonb_set(
  "workflowSettings", 
  '{autoReserveAt90}', 
  'false'
)
WHERE id = '{org_id}';
```

## Monitoring

### Key Metrics
- Campaigns at 90%: Count in pipeline
- Pending approvals: Count awaiting admin action
- Reserved inventory: Active reservations
- Approval turnaround: Time from request to decision

### Health Checks
```sql
-- Campaigns at 90% without approval
SELECT COUNT(*) as stuck_campaigns FROM org_podcastflow_pro."Campaign" 
WHERE probability = 90 
AND "approvalRequestId" IS NULL;

-- Expired reservations not cleaned
SELECT COUNT(*) as expired_reservations 
FROM org_podcastflow_pro."InventoryReservation" 
WHERE "autoExpireAt" < NOW() 
AND status = 'held';

-- Pending approvals age
SELECT id, "campaignId", 
  EXTRACT(HOURS FROM NOW() - "createdAt") as hours_pending
FROM org_podcastflow_pro."CampaignApproval" 
WHERE status = 'pending'
ORDER BY "createdAt";
```

## Security & Permissions

### Role Requirements
- **Setting 90%**: sales, admin, master roles
- **Viewing approvals**: admin, master roles only
- **Approving/Rejecting**: admin, master roles only

### Multi-tenant Isolation
- All queries use `querySchema()` with org-specific schema
- No cross-organization data access
- Master role access is logged via `accessLogger`

## Testing

### Test 90% Automation
1. Create test campaign with budget and dates
2. Set probability to 90%
3. Verify:
   - Approval request created
   - Inventory reserved (if spots scheduled)
   - Admin notifications sent
   - Timeline events logged

### Test Approval
1. Find pending approval via API
2. Approve with notes
3. Verify:
   - Campaign at 100%
   - Order created
   - Inventory still reserved

### Test Rejection
1. Create another test at 90%
2. Reject with reason
3. Verify:
   - Campaign back at 65%
   - Inventory released
   - Seller notified

## Related Documentation
- [Campaign Management Guide](./docs/campaigns.md)
- [Inventory System](./docs/inventory.md)
- [Approval Workflows](./docs/approvals.md)
- [Multi-tenant Architecture](./CLAUDE.md#database-architecture)