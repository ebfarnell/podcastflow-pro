# CHANGELOG - v2 Pre-Sale Workflow Timing

## [2025-08-12] - Pre-Sale Workflow v2 Timing Implementation

### Added
- **Workflow Constants Module** (`src/lib/workflow/workflow-constants.ts`)
  - Central state machine definitions
  - State transitions and validation helpers
  - Feature flag support

- **10% Default Campaign Status**
  - New campaigns now start at 10% (Active Pre-Sale) instead of 35%
  - Schedule Builder immediately accessible at 10%
  - No UI gates blocking access based on probability

- **Auto-Advance to 35% on First Valid Schedule**
  - Campaigns automatically advance from 10% to 35% when first valid schedule is created
  - Valid schedule = has placements, dates, and positive budget
  - Only triggers once per campaign (subsequent schedules don't re-trigger)
  - Sends notification to campaign owner

- **Rate-Card Delta Collection** (Placeholder)
  - Framework added for capturing rate-card baseline when schedule created
  - Will track discounts/premiums vs standard rates
  - Implementation pending rate-card system completion

- **Feature Flag: v2PresaleTiming**
  - Organization-scoped setting in WorkflowSettings.metadata
  - Enables/disables new timing behavior
  - Default: true for all organizations

### Changed
- **Campaign Creation API** (`/api/campaigns`)
  - Default probability: 10% (was undefined/0)
  - Default status: 'active-presale' (was 'draft')

- **Schedule Creation API** (`/api/campaigns/[id]/schedule`)
  - Now triggers workflow automation on schedule creation
  - Returns `campaignAdvanced` flag when auto-advance occurs
  - Calculates totalValue and itemCount for validation

- **Workflow Service** (`campaign-workflow-service.ts`)
  - Added `getWorkflowSettings()` method for fetching org settings
  - Added `handleFirstValidSchedule()` for auto-advance logic
  - Added `startRateCardDeltaCollection()` placeholder

### Database
- Added `metadata` column to `WorkflowSettings` table
- Inserted workflow settings for both organizations
- Feature flag enabled by default

### Files Modified
1. `/src/lib/workflow/workflow-constants.ts` (NEW)
2. `/src/lib/workflow/campaign-workflow-service.ts`
3. `/src/app/api/campaigns/route.ts`
4. `/src/app/api/campaigns/[id]/schedule/route.ts`
5. `/migrations/add-v2-presale-workflow-fixed.sql` (NEW)

### Testing
- Created `/test-presale-workflow.sh` script for validation
- Tests cover:
  - 10% default on campaign creation
  - Schedule builder access at 10%
  - Auto-advance to 35% on first schedule
  - No re-trigger on subsequent schedules

### Rollback Plan
1. **Disable Feature Flag**:
   ```sql
   UPDATE public."WorkflowSettings" 
   SET metadata = jsonb_set(metadata, '{v2PresaleTiming}', 'false'::jsonb)
   WHERE "workflowType" = 'campaign_approval';
   ```

2. **Revert Default Status** (if needed):
   - Remove probability/status defaults from campaign creation API
   - Update existing 10% campaigns to previous state

3. **Remove Auto-Advance**:
   - Feature flag disables the behavior
   - No code removal needed

### Known Issues
- Rate-card delta collection is placeholder only
- RateCardBaseline table doesn't exist yet (logged but doesn't fail)

### Performance Impact
- Minimal - one additional query on schedule creation
- Workflow automation is non-blocking (errors don't fail schedule creation)

### Security
- All queries use multi-tenant isolation
- Feature flags scoped per organization
- Admin/Master roles still required for approval/rejection