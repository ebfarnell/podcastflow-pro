# Post-Sale Migration Archive

**Date Archived**: January 27, 2025  
**Reason**: Pages replaced by unified Post-Sale Management dashboard

## Archived Pages

This directory contains the original page components that were replaced by the new Post-Sale Management dashboard (`/src/app/post-sale`).

### Pages Archived:
1. **Creative Library** (`/src/app/creatives`)
   - Managed creative assets (audio, video, scripts)
   - Now accessible via Post-Sale Management > Creative Management tab

2. **Orders** (`/src/app/orders`)
   - Order management system
   - Now accessible via Post-Sale Management > Orders tab

3. **Contracts & IOs** (`/src/app/contracts`)
   - Contract and Insertion Order management
   - Now accessible via Post-Sale Management > Contracts & IOs tab

4. **Ad Approvals** (`/src/app/ad-approvals`)
   - Ad approval workflow
   - Now accessible via Post-Sale Management > Creative Management > Approvals view

## Migration Details

### Feature Flag
The migration is controlled by a feature flag in `/src/lib/feature-flags.ts`:
- Flag: `POST_SALE_MIGRATION`
- Enabled for: master, admin, sales roles
- Rollout: 100%

### Redirect Configuration
Redirects are configured in `/src/middleware.ts`:
- `/creatives` → `/post-sale?tab=creative`
- `/orders` → `/post-sale?tab=orders`
- `/contracts` → `/post-sale?tab=contracts`
- `/ad-approvals` → `/post-sale?tab=creative&view=approvals`

### To Restore
If you need to restore these pages:

1. Copy the archived pages back to their original locations
2. Remove Post-Sale Management from the navigation menu in `DashboardLayout.tsx`
3. Disable the feature flag in `/src/lib/feature-flags.ts`
4. Remove migration notices from the pages
5. Update internal links to point back to original pages
6. Rebuild and deploy

### Related Components
Some components are still in use by the Post-Sale Management dashboard:
- `/src/components/creatives/` - Creative-related components
- `/src/components/orders/` - Order-related components
- `/src/components/contracts/` - Contract-related components
- `/src/components/ad-approvals/` - Ad approval components

These components were NOT archived as they're still actively used.

## Post-Migration Checklist
- [x] Pages moved to Post-Sale Management
- [x] Navigation updated
- [x] Internal links updated
- [x] Migration notices added
- [x] Feature flag implemented
- [x] Testing documentation created
- [x] Pages archived
- [ ] Auto-redirect enabled (when ready)
- [ ] User communication sent
- [ ] Documentation updated