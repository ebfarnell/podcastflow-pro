#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Get all page files
const appDir = '/home/ec2-user/podcastflow-pro/src/app';

function findPageFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && !item.startsWith('api')) {
      files.push(...findPageFiles(fullPath));
    } else if (item === 'page.tsx') {
      files.push(fullPath);
    }
  }
  
  return files;
}

// Mapping of page paths to permissions
const pagePermissionMap = {
  '/contracts': 'CONTRACTS_VIEW',
  '/orders': 'ORDERS_VIEW',
  '/campaigns': 'CAMPAIGNS_VIEW',
  '/shows': 'SHOWS_VIEW',
  '/episodes': 'EPISODES_VIEW',
  '/advertisers': 'ADVERTISERS_VIEW',
  '/agencies': 'AGENCIES_VIEW',
  '/ad-approvals': 'APPROVALS_VIEW',
  '/dashboard': 'DASHBOARD_VIEW',
  '/analytics': 'DASHBOARD_ANALYTICS',
  '/reports': 'REPORTS_VIEW',
  '/budget': 'BUDGET_VIEW',
  '/executive/reports': 'EXECUTIVE_REPORTS_VIEW',
  '/quickbooks': 'QUICKBOOKS_VIEW',
  '/settings': 'SETTINGS_VIEW',
  '/admin/users': 'USERS_VIEW',
  '/admin/permissions': 'SETTINGS_ADMIN',
  '/admin/deletion-requests': 'USERS_DELETE',
  '/master': 'MASTER_VIEW_ALL',
  '/master/organizations': 'MASTER_MANAGE_ORGS',
  '/master/analytics': 'MASTER_VIEW_ALL',
  '/producer': 'EPISODES_CREATE',
  '/talent': 'EPISODES_TALENT_MANAGE',
  '/seller': 'CAMPAIGNS_VIEW'
};

function updatePageFile(filePath) {
  console.log(`Updating ${filePath}...`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Skip if already uses RouteProtection
  if (content.includes('RouteProtection')) {
    console.log(`  ✅ Already updated`);
    return;
  }
  
  // Skip login and other special pages
  if (filePath.includes('/login/') || 
      filePath.includes('/register/') ||
      filePath.includes('/(auth)') ||
      filePath.includes('/not-found') ||
      filePath.includes('/error')) {
    console.log(`  ⏭️  Skipping special page`);
    return;
  }
  
  // Get relative path for permission mapping
  const relativePath = filePath
    .replace('/home/ec2-user/podcastflow-pro/src/app', '')
    .replace('/page.tsx', '')
    .replace(/\/\[[\w-]+\]/g, '') // Remove dynamic segments
    .replace(/\/\([\w-]+\)/g, ''); // Remove groups
  
  const permission = pagePermissionMap[relativePath];
  if (!permission) {
    console.log(`  ⚠️  No permission defined for ${relativePath}`);
    return;
  }
  
  // Add imports
  if (!content.includes('RouteProtection')) {
    content = content.replace(
      /'use client'/,
      `'use client'\n\nimport { RouteProtection } from '@/components/auth/RouteProtection'\nimport { PERMISSIONS } from '@/types/auth'`
    );
  }
  
  // Find the main return statement and wrap with RouteProtection
  const returnMatch = content.match(/return \(\s*<([^>]+)>/);
  if (returnMatch) {
    const componentName = returnMatch[1].split(' ')[0];
    
    // Wrap the return content
    content = content.replace(
      /return \(\s*</,
      `return (\n    <RouteProtection requiredPermission={PERMISSIONS.${permission}}>\n      <`
    );
    
    // Find the closing tag and add RouteProtection close
    const lines = content.split('\n');
    let openTags = 0;
    let foundReturn = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.includes('return (') && line.includes('<RouteProtection')) {
        foundReturn = true;
        continue;
      }
      
      if (foundReturn) {
        // Count opening and closing tags
        const openMatches = line.match(/<[^/>][^>]*>/g) || [];
        const closeMatches = line.match(/<\/[^>]+>/g) || [];
        const selfCloseMatches = line.match(/<[^>]*\/>/g) || [];
        
        openTags += openMatches.length - selfCloseMatches.length;
        openTags -= closeMatches.length;
        
        // If we're back to 0 open tags, this is likely the end
        if (openTags === 0 && (line.includes('>') || line.includes('/>'))) {
          lines[i] = line + '\n    </RouteProtection>';
          break;
        }
      }
    }
    
    content = lines.join('\n');
  }
  
  fs.writeFileSync(filePath, content);
  console.log(`  ✅ Updated with RouteProtection`);
}

function main() {
  const pageFiles = findPageFiles(appDir);
  console.log(`Found ${pageFiles.length} page files to check`);
  
  for (const file of pageFiles) {
    try {
      updatePageFile(file);
    } catch (error) {
      console.error(`❌ Error updating ${file}:`, error.message);
    }
  }
  
  console.log('\n🎉 Page permission update complete!');
  console.log('\nNext steps:');
  console.log('1. Review the updated files');
  console.log('2. Test each page with different user roles');
  console.log('3. Run npm run build to check for errors');
}

if (require.main === module) {
  main();
}