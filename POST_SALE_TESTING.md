# Post-Sale Management Testing Guide

## Test Accounts

### Master Admin
- Email: michael@unfy.com
- Password: EMunfy2025
- Expected: Full access to Post-Sale Management

### Admin
- Email: admin@podcastflow.pro  
- Password: admin123
- Expected: Full access to Post-Sale Management

### Sales
- Email: seller@podcastflow.pro
- Password: seller123
- Expected: Full access to Post-Sale Management (feature flag enabled)

### Producer
- Email: producer@podcastflow.pro
- Password: producer123
- Expected: NO access to Post-Sale Management menu item

### Talent
- Email: talent@podcastflow.pro
- Password: talent123
- Expected: NO access to Post-Sale Management menu item

### Client
- Email: client@podcastflow.pro
- Password: client123
- Expected: NO access to Post-Sale Management menu item

## Testing Checklist

### 1. Menu Visibility
- [ ] Master: Post-Sale Management visible in Sales & Campaigns section
- [ ] Admin: Post-Sale Management visible in Sales & Campaigns section  
- [ ] Sales: Post-Sale Management visible in Sales Management section
- [ ] Producer: Post-Sale Management NOT visible
- [ ] Talent: Post-Sale Management NOT visible
- [ ] Client: Post-Sale Management NOT visible

### 2. Direct Access Test
Test accessing `/post-sale` directly for each role:
- [ ] Master: Access granted
- [ ] Admin: Access granted
- [ ] Sales: Access granted
- [ ] Producer: Access restricted message shown
- [ ] Talent: Access restricted message shown
- [ ] Client: Access restricted message shown

### 3. Tab Navigation
For roles with access, verify all tabs work:
- [ ] Orders tab loads correctly
- [ ] Contracts & IOs tab loads correctly
- [ ] Creative Management tab loads correctly
- [ ] Billing tab loads correctly
- [ ] Timeline tab loads correctly
- [ ] Automations tab loads correctly

### 4. Deep Linking
Test URL parameters work correctly:
- [ ] `/post-sale?tab=orders` opens Orders tab
- [ ] `/post-sale?tab=contracts` opens Contracts tab
- [ ] `/post-sale?tab=creative` opens Creative Management tab
- [ ] `/post-sale?tab=creative&view=approvals` opens Creative tab with approvals view

### 5. Migration Notices
For roles with access:
- [ ] `/creatives` shows migration notice
- [ ] `/orders` shows migration notice
- [ ] `/contracts` shows migration notice
- [ ] `/ad-approvals` shows migration notice
- [ ] Dismissing notice persists (refresh page to verify)
- [ ] "Try New Interface" button navigates to correct tab

### 6. Internal Links
- [ ] Campaign Ad Creative "Create New" button navigates to Post-Sale Creative tab
- [ ] Ad Submission Form success redirects to Post-Sale approvals view
- [ ] Seller dashboard "Pending Approvals" card navigates correctly

### 7. Feature Flag Testing
Modify feature flag in `/src/lib/feature-flags.ts`:
- [ ] Disable for sales role - verify menu item disappears
- [ ] Set rolloutPercentage to 50 - verify partial rollout works
- [ ] Re-enable for all roles - verify it appears again

## Known Issues / TODOs
1. CreativeManagementSection "Upload Creative" button needs upload dialog implementation
2. Auto-redirect is currently disabled in middleware (set to true for forced migration)
3. Old pages still accessible during migration period (by design)

## Testing Steps

1. **Clear browser cache and localStorage** before testing each role
2. **Login** with test account
3. **Check menu** for Post-Sale Management visibility
4. **Navigate** through all tabs if accessible
5. **Test deep links** by entering URLs directly
6. **Check migration notices** on old pages
7. **Test internal navigation** from other pages
8. **Log out** and repeat for next role

## Post-Migration Checklist
Once all testing is complete and migration is approved:
1. Set `shouldAutoRedirect = true` in middleware.ts
2. Remove migration notices from old pages
3. Archive old page components to `/archived` folder
4. Update documentation
5. Notify users of the change