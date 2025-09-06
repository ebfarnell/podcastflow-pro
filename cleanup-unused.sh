#!/bin/bash

# Cleanup script for PodcastFlow Pro
# Removes unused dependencies and dead code

echo "🧹 Starting cleanup of unused dependencies and dead code..."

# 1. Remove backup files
echo "Removing backup files..."
rm -f src/app/shows/[id]/page.tsx.backup
rm -f src/components/layout/DashboardLayout-backup.tsx
rm -f src/app/api/campaigns/route.ts.backup
rm -f src/app/api/campaigns/route.ts.broken
echo "✅ Backup files removed"

# 2. Remove old backup documentation
echo "Removing old backup documentation..."
rm -f BACKUP_SUMMARY.md
rm -f BACKUP-MANIFEST-20250701.md
rm -f BACKUP_STATUS_20250704.md
rm -f BACKUP_STATUS_20250708.md
rm -f dynamodb-backup-20250701.json
echo "✅ Old backup documentation removed"

# 3. Remove potentially unused library files
echo "Removing unused library files..."
if [ -f "src/lib/amplify-config.ts" ]; then
    echo "  - Removing amplify-config.ts (not imported anywhere)"
    rm -f src/lib/amplify-config.ts
fi
if [ -f "src/lib/analytics/seed-analytics-data.ts" ]; then
    echo "  - Removing seed-analytics-data.ts (not imported anywhere)"
    rm -f src/lib/analytics/seed-analytics-data.ts
fi
echo "✅ Unused library files removed"

# 4. Remove temporary infrastructure scripts
echo "Removing temporary scripts..."
rm -f infrastructure/scripts/temp-http-access.sh
echo "✅ Temporary scripts removed"

# 5. Remove unused dependencies from package.json
echo "Removing unused npm dependencies..."
npm uninstall @aws-amplify/ui-react @aws-sdk/client-cognito-identity-provider @aws-sdk/client-lambda chart.js react-chartjs-2

# 6. Clean up node_modules and reinstall
echo "Cleaning node_modules and reinstalling dependencies..."
rm -rf node_modules package-lock.json
npm install

echo "✅ Cleanup complete!"
echo ""
echo "Summary of removed items:"
echo "- 4 backup source files"
echo "- 5 old backup documentation files"
echo "- 2 unused library files"
echo "- 1 temporary infrastructure script"
echo "- 5 unused npm dependencies"
echo ""
echo "Next steps:"
echo "1. Run 'npm run build' to ensure everything still builds"
echo "2. Test the application thoroughly"
echo "3. Commit these changes to version control"