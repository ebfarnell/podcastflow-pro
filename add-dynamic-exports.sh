#!/bin/bash

# List of authenticated pages that need dynamic exports
PAGES=(
  "/home/ec2-user/podcastflow-pro/src/app/dashboard/page.tsx"
  "/home/ec2-user/podcastflow-pro/src/app/campaigns/page.tsx"
  "/home/ec2-user/podcastflow-pro/src/app/campaigns/[id]/page.tsx"
  "/home/ec2-user/podcastflow-pro/src/app/campaigns/[id]/edit/page.tsx"
  "/home/ec2-user/podcastflow-pro/src/app/campaigns/[id]/schedule/page.tsx"
  "/home/ec2-user/podcastflow-pro/src/app/campaigns/[id]/approval/page.tsx"
  "/home/ec2-user/podcastflow-pro/src/app/campaigns/[id]/versions/page.tsx"
  "/home/ec2-user/podcastflow-pro/src/app/campaigns/new-simple/page.tsx"
  "/home/ec2-user/podcastflow-pro/src/app/analytics/page.tsx"
  "/home/ec2-user/podcastflow-pro/src/app/integrations/page.tsx"
  "/home/ec2-user/podcastflow-pro/src/app/integrations/megaphone/page.tsx"
  "/home/ec2-user/podcastflow-pro/src/app/integrations/youtube/page.tsx"
  "/home/ec2-user/podcastflow-pro/src/app/settings/page.tsx"
  "/home/ec2-user/podcastflow-pro/src/app/shows/page.tsx"
  "/home/ec2-user/podcastflow-pro/src/app/episodes/page.tsx"
  "/home/ec2-user/podcastflow-pro/src/app/advertisers/page.tsx"
  "/home/ec2-user/podcastflow-pro/src/app/agencies/page.tsx"
  "/home/ec2-user/podcastflow-pro/src/app/users/page.tsx"
  "/home/ec2-user/podcastflow-pro/src/app/budget/page.tsx"
  "/home/ec2-user/podcastflow-pro/src/app/inventory/page.tsx"
  "/home/ec2-user/podcastflow-pro/src/app/contracts/page.tsx"
  "/home/ec2-user/podcastflow-pro/src/app/invoices/page.tsx"
  "/home/ec2-user/podcastflow-pro/src/app/payments/page.tsx"
)

echo "Adding dynamic exports to authenticated pages..."

for page in "${PAGES[@]}"; do
  if [ -f "$page" ]; then
    echo "Processing: $page"
    
    # Check if it already has a dynamic export
    if grep -q "export const dynamic" "$page"; then
      echo "  ✓ Already has dynamic export"
    else
      # Check if it's a client component
      if grep -q "'use client'" "$page"; then
        # Add dynamic export after 'use client'
        sed -i "/'use client'/a\\
\\
// Force dynamic rendering - this page uses authentication and dynamic data\\
export const dynamic = 'force-dynamic'" "$page"
        echo "  ✓ Added dynamic export to client component"
      else
        # Add dynamic export at the top
        sed -i "1i\\
// Force dynamic rendering - this page uses authentication and dynamic data\\
export const dynamic = 'force-dynamic'\\
" "$page"
        echo "  ✓ Added dynamic export to server component"
      fi
    fi
  else
    echo "  ⚠ File not found: $page"
  fi
done

echo "Done!"