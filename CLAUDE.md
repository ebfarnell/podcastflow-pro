# PodcastFlow Pro - Complete System Documentation for Claude

## CRITICAL PRODUCTION REQUIREMENTS
- **NO MOCK DATA EVER** - Everything must use real database connections
- **PRODUCTION READY** - This is a commercial application in active use
- **NEVER GO BACKWARDS** - Don't revert working features or reintroduce mock data
- **DEFENSIVE ERROR HANDLING** - Use `safeQuerySchema` for all data queries
- **BUILD TIMEOUT** - Always use 10-minute timeout for builds: `npm run build` with timeout: 600000

## System Overview
PodcastFlow Pro is a production podcast advertising management platform running on AWS EC2.

### URLs
- Production App: https://app.podcastflow.pro
- Local Development: http://localhost:3000

### Server Details
- Platform: AWS EC2 (Amazon Linux 2023)
- Instance: ip-172-31-28-124.ec2.internal
- PM2 Process: podcastflow-pro (runs on port 3000)
- Nginx: Reverse proxy on ports 80/443 with SSL
- PM2 Restarts: 286 (as of July 29, 2025)

## Technology Stack

### Frontend
- Next.js 15.4.3 with App Router
- TypeScript 5.7.2
- Material-UI (MUI) 6.3.0 for components
- TailwindCSS 3.4.17 for styling
- React Query (@tanstack/react-query 6.0.0) for data fetching
- Zustand 5.0.2 for state management
- Recharts 2.15.0 for data visualization

### Backend
- Next.js API Routes (App Router style)
- Prisma ORM 6.1.0 with PostgreSQL
- bcryptjs 2.4.3 for password hashing
- JWT for API authentication
- Session-based auth with cookies (8-hour sessions)

### Database
- PostgreSQL 15.13 (on x86_64-amazon-linux-gnu)
- Database: podcastflow_production
- User: podcastflow
- Password: PodcastFlow2025Prod
- Connection: postgresql://podcastflow:PodcastFlow2025Prod@localhost:5432/podcastflow_production

### Database Architecture

#### Public Schema (Shared Data)
Contains only platform-wide shared data:
- User (with roles: master, admin, sales, producer, talent, client)
- Organization (multi-tenant definitions)
- Session (auth sessions)
- BillingPlan (subscription plans)
- MonitoringAlert, SystemMetric, SystemLog (platform monitoring)
- ServiceHealth, UsageRecord (platform tracking)

#### Organization Schemas (org_*)
Each organization has its own schema with complete data isolation:
- Show (podcast shows)
- Episode (podcast episodes)  
- Campaign (advertising campaigns)
- Advertiser, Agency
- Order, Invoice, Payment, Contract
- AdApproval
- All analytics tables (40+ tables total per org)
- All other business data

**IMPORTANT**: All business data APIs use organization schemas via `safeQuerySchema()`, NOT the public schema.

## Authentication System

### Test Accounts (All use real database)
1. **Master**: michael@unfy.com / EMunfy2025
2. **Admin**: admin@podcastflow.pro / admin123
3. **Sales**: seller@podcastflow.pro / seller123 (Note: role is 'sales' not 'seller')
4. **Producer**: producer@podcastflow.pro / producer123
5. **Talent**: talent@podcastflow.pro / talent123
6. **Client**: client@podcastflow.pro / client123

### Auth Flow
1. POST /api/auth/login with email/password
2. Server validates with bcrypt
3. Creates session in database
4. Returns auth-token cookie (httpOnly, 8 hours)
5. All API routes check session validity

## Directory Structure
```
/home/ec2-user/podcastflow-pro/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── api/               # API routes
│   │   ├── admin/             # Admin pages
│   │   ├── master/            # Master admin pages
│   │   └── (auth pages, etc)
│   ├── components/            # React components
│   ├── lib/                   # Utilities and services
│   │   ├── auth/             # Authentication utilities
│   │   └── db/               # Database connection
│   └── services/             # API service layer
├── prisma/
│   └── schema.prisma         # Database schema
├── public/                   # Static assets
├── .env                      # Environment variables
├── .env.production          # Production environment
├── server.js                # Standalone server entry
└── ecosystem.config.js      # PM2 configuration
```

## Deployment Configuration

### PM2 Process Management
```bash
# Start: pm2 start ecosystem.config.js
# Restart: pm2 restart podcastflow-pro
# Logs: pm2 logs podcastflow-pro
# Status: pm2 status
```

**IMPORTANT**: PM2 must use `./server.js` not `.next/standalone/server.js` in ecosystem.config.js

### Nginx Configuration
Location: /etc/nginx/conf.d/podcastflow.conf
- Proxies to internal IP: 172.31.28.124:3000
- SSL certificates via Let's Encrypt
- Handles static file caching

### Build Process
```bash
npm run build          # Creates standalone Next.js build (use 10-min timeout)
pm2 restart podcastflow-pro  # Restart with new build
```

## Recent Fixes Applied (July 26-29, 2025)

### Analytics API Defensive Error Handling
- Fixed all analytics endpoints to use `safeQuerySchema` pattern:
  - `/api/analytics` 
  - `/api/analytics/shows`
  - `/api/analytics/kpis`
  - `/api/analytics/revenue`
- Prevents 500 errors by returning empty data on query failures

### Admin Approvals Permission Fix
- Fixed session property mismatch: `session.userRole` → `session.role`
- Path: `/src/app/api/admin/approvals/route.ts`

### Performance Analytics UI Fix
- Moved page title above date filters and export button
- Path: `/src/app/analytics/page.tsx`

### Schedule Builder Enhancements (July 29, 2025)
- Removed "Mixed demographics" line from show cards
- Made show names display on two lines without truncation (WebKit line clamp)
- Added placement selection dialog when multiple placements are available for a date
- Implemented responsive chip layout in calendar (1 column up to 4 shows, then 2 columns, then 3)
- Added show-specific analytics panel with color-coded border
- Implemented per-show rate adjustments for campaigns (campaign-specific, not global)
- Fixed bottom bar spacing to account for sidebar (added left padding)
- Increased calendar box height to 150px to accommodate more shows

### API Improvements
- Fixed OrganizationContext to prevent duplicate API calls
- Added `hasFetchedOrg` flag to ensure single fetch per user session
- Updated API logger to skip undefined URL requests from Next.js prefetching

## Environment Variables (.env.production)
```
DATABASE_URL="postgresql://podcastflow:PodcastFlow2025Prod@localhost:5432/podcastflow_production"
NEXTAUTH_SECRET="CjFNT8NrYwFemEEU7eV2BxRb9zBNwoCuJXTy9ZTcJms="
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://app.podcastflow.pro
AWS_REGION=us-west-2
S3_BUCKET_NAME=podcastflow-pro-uploads
ENABLE_MOCK_DATA=false
AWS_ACCESS_KEY_ID=<your-key>
AWS_SECRET_ACCESS_KEY=<your-secret>
```

## Common Commands

### Database
```bash
# Connect to database
PGPASSWORD=PodcastFlow2025Prod psql -U podcastflow -h localhost -d podcastflow_production

# Run Prisma migrations
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate
```

### Deployment
```bash
# Full rebuild and deploy (with 10-minute timeout)
npm run build && pm2 restart podcastflow-pro

# Check logs
pm2 logs podcastflow-pro --lines 100

# Restart Nginx
sudo systemctl restart nginx
```

### Backup
```bash
# Create full backup
cd /home/ec2-user && tar -czf podcastflow-backup-$(date +%Y%m%d-%H%M%S).tar.gz \
  --exclude='podcastflow-pro/node_modules' \
  --exclude='podcastflow-pro/.next' \
  --exclude='podcastflow-pro/.git' \
  podcastflow-pro/

# Database backup
PGPASSWORD=PodcastFlow2025Prod pg_dump -U podcastflow -h localhost podcastflow_production > backup.sql
```

## API Patterns & Best Practices

### Defensive Error Handling
All data endpoints should use `safeQuerySchema` for multi-tenant queries:
```javascript
import { safeQuerySchema } from '@/lib/db/schema-db'

const { data, error } = await safeQuerySchema(orgSlug, query, params)
if (error) {
  console.error('Query failed:', error)
  return NextResponse.json([]) // Return empty data, not 500 error
}
```

### Session Validation Pattern
```javascript
import { getSessionFromCookie } from '@/lib/auth/session-helper'

const session = await getSessionFromCookie(request)
if (!session) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

// Check roles (note: it's session.role not session.userRole)
if (!['admin', 'master'].includes(session.role)) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
```

## IMPORTANT REMINDERS
1. **Always check database schema** before making changes
2. **Never use mock data** - all data comes from PostgreSQL
3. **Test with real accounts** listed above
4. **Use string literals** for status fields, not enums in API responses
5. **Check PM2 logs** for server-side errors
6. **Browser console** shows client-side errors
7. **Run build with 10-minute timeout** after code changes
8. **Use safeQuerySchema** for all organization data queries
9. **Session has .role not .userRole** property

## Current System State (July 29, 2025)

### Organizations
1. **PodcastFlow Pro** (org_podcastflow_pro)
   - 14 active shows
   - 262 future episodes
   - Complete inventory tracking
   - Revenue projections configured
   - Schedule builder with enhanced UI

2. **Unfy** (org_unfy)
   - Clean schema (no test data)
   - Ready for production use

### Key Features Implemented
- Multi-tenant architecture with complete data isolation
- Financial management (expenses, invoices, payments)
- Analytics system with real event tracking
- Episode inventory management
- CRM features (advertisers, agencies)
- Customizable sidebar with drag-and-drop
- Revenue projections per show
- Defensive error handling on all critical endpoints
- Enhanced schedule builder with visual calendar
- Show-specific analytics and rate adjustments
- Placement selection dialog for multi-show scheduling
- **Hierarchical Budget Management System** with monthly granularity and seller rollups

### Performance & Security
- Database indexes on all foreign keys
- Pagination on all list endpoints
- bcrypt password hashing (10 rounds)
- HttpOnly session cookies
- SQL injection prevention via Prisma
- Rate limiting on critical endpoints
- Audit logging for sensitive operations

## Latest Comprehensive Backup

### July 29, 2025 Backup (Most Recent)
- **Location**: `/home/ec2-user/backups/podcastflow-backup-20250729-081453/`
- **Archive**: `/home/ec2-user/backups/podcastflow-backup-20250729-081453.tar.gz`
- **Size**: 701MB compressed
- **Checksum**: `19ae762c3c0983b9cf1cd8baa5d1f95e001fd2d400373c72ff709cddbe05c2c6`
- **Contents**: 
  - source-code.tar.gz - Complete application code
  - source-checksums.txt - SHA256 checksums for 10,444 files
  - database-full-backup.dump - Complete database backup
  - api-endpoints.yaml - 290 API endpoints mapped
  - DISASTER_RECOVERY_GUIDE.md - Complete recovery instructions
  - INFRASTRUCTURE_MAP.md - Full infrastructure documentation
  - SYSTEM_VERSIONS.md - All component versions
  - Configuration files (PM2, nginx, package.json)

### July 26, 2025 Backup (Previous)
- **Location**: `/home/ec2-user/backups/comprehensive-backup-20250726-050954/`
- **Archive**: `/home/ec2-user/backups/podcastflow-comprehensive-backup-20250726-050954.tar.gz`
- **Size**: 697MB compressed
- **Checksum**: `dd04780348810da53b3563880d291c5023512aa833940fd29ef736f09368c273`

### Quick Restoration
```bash
# Extract latest backup
cd /home/ec2-user
tar -xzf backups/podcastflow-backup-20250729-081453.tar.gz

# Follow the DISASTER_RECOVERY_GUIDE.md in the backup folder
```

## Emergency Recovery
If the application goes down:
1. Check PM2: `pm2 status` and `pm2 logs podcastflow-pro`
2. Restart app: `pm2 restart podcastflow-pro`
3. Check Nginx: `sudo systemctl status nginx`
4. Check database: `sudo systemctl status postgresql`
5. Review logs: `pm2 logs podcastflow-pro --lines 200`
6. Check disk space: `df -h`
7. Rebuild if needed: `npm run build && pm2 restart podcastflow-pro` (10-min timeout)

## Critical Files for Backup
1. **Application Code**: /home/ec2-user/podcastflow-pro/
2. **Environment Files**: .env, .env.production
3. **Database**: PostgreSQL dump
4. **Nginx Config**: /etc/nginx/conf.d/podcastflow.conf
5. **SSL Certificates**: /etc/letsencrypt/ (backed up by Let's Encrypt)

## Monitoring Commands
```bash
# Application health
curl -I http://localhost:3000/api/health

# Database connections
PGPASSWORD=PodcastFlow2025Prod psql -U podcastflow -h localhost -d podcastflow_production -c "SELECT count(*) FROM pg_stat_activity;"

# PM2 monitoring
pm2 monit
```

### Campaign Deletion Fix (July 29, 2025)
- Fixed issue where approved campaign deletions were not actually deleting campaigns
- Root cause: DELETE queries were failing silently due to foreign key constraints
- Solution implemented:
  - Added cascade deletion of all related data before deleting campaign
  - Added verification that deletion was successful before marking as approved
  - Updated campaigns API to filter out campaigns with approved deletion requests
  - Prevents deletion request approval if the actual deletion fails
- Affected files:
  - `/src/app/api/deletion-requests/[id]/route.ts` - Enhanced deletion logic with cascade deletes
  - `/src/app/api/campaigns/route.ts` - Added filtering for approved deletions
- Manual cleanup performed: Deleted 16 campaigns that had approved deletion requests

### Hierarchical Budget Management System (July 29, 2025)
- **Complete overhaul of Budget Planning tab** for modern, granular budget management
- **Database Schema Enhancements**:
  - Added `sellerId` columns to `Advertiser` and `Agency` tables for hierarchical relationships
  - Created `HierarchicalBudget` table for monthly budget tracking with entity relationships
  - Created `BudgetRollupCache` table for performance-optimized rollup calculations
  - Added PostgreSQL functions for automatic cache updates and rollup calculations
  - Implemented triggers for real-time cache refresh on budget changes

- **New API Endpoints**:
  - `GET/POST /api/budget/hierarchical` - CRUD operations for hierarchical budgets
  - `PUT /api/budget/hierarchical/[id]` - Individual budget entry updates
  - `PUT /api/budget/hierarchical/batch` - Batch budget updates for inline editing
  - `GET /api/budget/entities` - Entity management for seller assignments
  - `PUT /api/budget/entities/assignments` - Bulk seller assignment updates
  - `GET /api/budget/comparison` - Historical budget vs actual comparison with YoY growth
  - `POST /api/budget/rollups/refresh` - Manual rollup cache refresh

- **Frontend Components**:
  - `HierarchicalBudgetGrid` - Modern data grid with expandable hierarchy and inline editing
  - `BudgetComparison` - Historical comparison with charts and trend analysis
  - Replaced old budget page with three-tab interface (Budget Planning, Revenue Projections, Analytics)

- **Key Features Implemented**:
  - **Monthly Granularity**: Budget entries at monthly level with annual rollups
  - **Hierarchical View**: Seller → Agency → Advertiser relationships with visual nesting
  - **Real-time Rollups**: Automatic aggregation from Advertiser/Agency to Seller level
  - **Variance Tracking**: Budget vs actual with color-coded status indicators
  - **Historical Comparison**: Previous year actuals with year-over-year growth analysis
  - **Inline Editing**: Batch updates with validation and optimistic updates
  - **Permission-based Access**: Sales users see only their assigned entities
  - **Performance Optimization**: Cached rollup calculations with trigger-based updates

- **Database Functions Created**:
  - `update_budget_rollup_cache()` - Calculates and caches rollup totals for performance
  - `trigger_update_budget_rollup_cache()` - Automatically updates cache on budget changes
  - Comprehensive constraint checking and data validation

- **Testing**:
  - Created comprehensive test suite in `/tests/budget/hierarchical-budget.test.js`
  - Tests for CRUD operations, permissions, validation, and batch updates
  - Integration tests for rollup calculations and cache management

- **Files Modified/Created**:
  - `budget_planning_migration.sql` - Database schema migration
  - `src/app/budget/page.tsx` - Completely redesigned budget page
  - `src/components/budget/HierarchicalBudgetGrid.tsx` - Main budget management component
  - `src/components/budget/BudgetComparison.tsx` - Historical comparison and analytics
  - All API routes for hierarchical budget management
  - Test files for comprehensive coverage

- **Business Impact**:
  - Enables precise monthly budget planning and tracking
  - Provides clear visibility into seller performance and rollup accuracy
  - Supports data-driven decision making with historical comparisons
  - Scales to handle complex organizational hierarchies
  - Maintains data integrity with automatic validation and rollup consistency

### Chip Alignment Fix in Budget Planning (July 30, 2025)
- **Issue**: Status chips (Pacing Ahead, On Pace, etc.) were misaligned across different row types
- **Root Cause**: Inconsistent wrapper elements - some chips had Box wrappers with flex styling
- **Solution**:
  - Removed all Box wrappers around Chip components
  - Placed chips directly in Grid items for consistent alignment
  - Ensured all Grid containers have `alignItems="center"` property
  - Standardized Grid item column widths (xs={1.3} for Pacing to Goal, xs={1.4} for Pacing vs PY)
- **Files Modified**: `src/components/budget/UnifiedBudgetPlanning.tsx`
- **Result**: Perfect vertical and horizontal alignment of all status chips across Seller, Agency, Advertiser, and Developmental rows

### Unified Budget Planning Interface (July 29, 2025)
- **Complete UI/UX refactor** to eliminate redundancy and improve user workflow
- **Single Budget Planning Tab** with integrated analytics, replacing the previous 3-tab system
- **Flexible View Switching** between Advertiser, Agency, and Seller perspectives
- **Live Data Integration** ensuring all entities are pulled directly from organization schema

- **Key Improvements**:
  - **Merged Analytics**: Summary cards from BudgetComparison integrated into main Budget Planning interface
  - **View Mode Toggle**: Users can switch between "By Seller", "By Agency", and "By Advertiser" views
  - **Dynamic Grouping**: Data automatically reorganizes based on selected view mode
  - **Unified Controls**: All filtering, editing, and analytics in one coherent interface
  - **Real-time Updates**: Live data ensures no duplicate or ghost entries

- **Technical Implementation**:
  - Created `UnifiedBudgetPlanning` component replacing separate HierarchicalBudgetGrid and BudgetComparison
  - Implemented flexible data grouping functions for different view modes
  - Maintained all existing API endpoints and data integrity
  - Preserved inline editing, batch updates, and permission-based access
  - Enhanced user experience with integrated analytics and cleaner navigation

- **Files Affected**:
  - `src/app/budget/page.tsx` - Removed redundant tabs, now uses 2-tab layout (Budget Planning + Revenue Projections)
  - `src/components/budget/UnifiedBudgetPlanning.tsx` - New unified component with view switching
  - Previous `HierarchicalBudgetGrid.tsx` and `BudgetComparison.tsx` components maintained for backward compatibility

- **User Experience Benefits**:
  - **Reduced Cognitive Load**: Single interface for all budget management tasks
  - **Improved Workflow**: No need to switch between tabs to see analytics
  - **Better Context**: Summary cards show key metrics while editing budgets
  - **Flexible Perspectives**: View data organized by the most relevant entity type
  - **Faster Navigation**: All features accessible from one screen

### Time-Based Pacing System Implementation (July 30, 2025)
- **Complete replacement** of variance-based "On Target/Off Target" and "On Track/Off Track" with time-based **"Pacing Ahead/On Pace/Pacing Behind"** system
- **Enhanced Status Determination** with 5% tolerance bands for more precise tracking (95%-105% = "On Pace")
- **Comprehensive Test Coverage** for pacing calculations including edge cases and different time periods

- **Pacing Calculation Logic**:
  - **Time-Aware Analysis**: Compares actual progress vs expected progress based on time elapsed
  - **Monthly Granularity**: For monthly budgets, calculates based on days elapsed in current month
  - **Annual Granularity**: For annual budgets, calculates based on months elapsed in current year
  - **Past Period Handling**: Past periods expect 100% completion, pacing based on actual achievement
  - **Future Period Handling**: Future periods expect 0% progress, showing early preparation

- **Status Criteria**:
  - **Pacing Ahead** (Green): ≥105% of expected timeline progress
  - **On Pace** (Blue): 95%-105% of expected timeline progress  
  - **Pacing Behind** (Orange): <95% of expected timeline progress
  - **No Budget** (Gray): Zero budget amount allocated

- **Technical Updates**:
  - Updated `getPacingStatus()` function in `UnifiedBudgetPlanning.tsx` with precise time-based calculations
  - Enhanced test suite in `/tests/budget/hierarchical-budget.test.js` with comprehensive pacing validation
  - All status chips throughout budget interface now use new pacing terminology
  - Maintained backward compatibility with existing API endpoints

- **Migration Validation**:
  - Created comprehensive rollback validation script (`validate_rollback_procedures.sql`)
  - Verified budget table migration integrity across org schemas
  - Confirmed rollback procedures preserve data and maintain referential integrity
  - Validated schema permissions and constraint compatibility for safe rollback operations

## Schedule Builder Component

### Overview
The PodcastCampaignScheduleBuilder is a visual calendar-based scheduling tool for podcast advertising campaigns.

### Key Features
- **Visual Calendar**: Month view with drag-and-drop spot placement
- **Multi-show Selection**: Select multiple shows and placement types (pre-roll, mid-roll, post-roll)
- **Show-specific Analytics**: Click show cards to view/edit show-specific rates and metrics
- **Responsive Chip Layout**: Calendar cells adapt to number of scheduled spots
- **Placement Selection Dialog**: When multiple placements are available, shows checkbox selection
- **Budget Tracking**: Real-time budget tracking with fixed bottom bar
- **Color Coding**: Each show has a unique color for easy identification

### State Management
- `selectedShowId`: Currently selected show for analytics
- `showSpecificRates`: Per-show rate overrides for the campaign
- `scheduledSpots`: Array of all scheduled advertising spots
- `selectedPlacements`: Currently selected show/placement combinations

### Recent Improvements (July 29, 2025)
- Removed demographics display from show cards
- Two-line show names with proper text wrapping
- Increased calendar cell height (150px)
- Responsive chip layout (1 column → 2 columns → 3 columns)
- Show-specific rate adjustments (campaign-specific, not global)
- Fixed spacing issues with sidebar-aware padding