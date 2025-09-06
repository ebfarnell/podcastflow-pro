#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get all API route files
const apiDir = '/home/ec2-user/podcastflow-pro/src/app/api';

function findApiFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      files.push(...findApiFiles(fullPath));
    } else if (item === 'route.ts') {
      files.push(fullPath);
    }
  }
  
  return files;
}

// Mapping of API paths to permissions
const permissionMap = {
  '/api/campaigns': { GET: 'CAMPAIGNS_VIEW', POST: 'CAMPAIGNS_CREATE' },
  '/api/campaigns/[id]': { GET: 'CAMPAIGNS_VIEW', PUT: 'CAMPAIGNS_UPDATE', DELETE: 'CAMPAIGNS_DELETE' },
  '/api/orders': { GET: 'ORDERS_VIEW', POST: 'ORDERS_CREATE' },
  '/api/orders/[id]': { GET: 'ORDERS_VIEW', PUT: 'ORDERS_UPDATE', DELETE: 'ORDERS_DELETE' },
  '/api/shows': { GET: 'SHOWS_VIEW', POST: 'SHOWS_CREATE' },
  '/api/shows/[id]': { GET: 'SHOWS_VIEW', PUT: 'SHOWS_UPDATE', DELETE: 'SHOWS_DELETE' },
  '/api/episodes': { GET: 'EPISODES_VIEW', POST: 'EPISODES_CREATE' },
  '/api/episodes/[id]': { GET: 'EPISODES_VIEW', PUT: 'EPISODES_UPDATE', DELETE: 'EPISODES_DELETE' },
  '/api/advertisers': { GET: 'ADVERTISERS_VIEW', POST: 'ADVERTISERS_CREATE' },
  '/api/advertisers/[id]': { GET: 'ADVERTISERS_VIEW', PUT: 'ADVERTISERS_UPDATE', DELETE: 'ADVERTISERS_DELETE' },
  '/api/agencies': { GET: 'AGENCIES_VIEW', POST: 'AGENCIES_CREATE' },
  '/api/agencies/[id]': { GET: 'AGENCIES_VIEW', PUT: 'AGENCIES_UPDATE', DELETE: 'AGENCIES_DELETE' },
  '/api/ad-approvals': { GET: 'APPROVALS_VIEW', POST: 'APPROVALS_CREATE' },
  '/api/ad-approvals/[id]': { GET: 'APPROVALS_VIEW', PUT: 'APPROVALS_UPDATE' },
  '/api/dashboard': { GET: 'DASHBOARD_VIEW' },
  '/api/analytics': { GET: 'DASHBOARD_ANALYTICS' },
  '/api/reports': { GET: 'REPORTS_VIEW', POST: 'REPORTS_CREATE' },
  '/api/budget': { GET: 'BUDGET_VIEW', POST: 'BUDGET_CREATE' },
  '/api/executive/reports': { GET: 'EXECUTIVE_REPORTS_VIEW' },
  '/api/quickbooks': { GET: 'QUICKBOOKS_VIEW', POST: 'QUICKBOOKS_SYNC' },
  '/api/settings': { GET: 'SETTINGS_VIEW', PUT: 'SETTINGS_UPDATE' }
};

function updateApiFile(filePath) {
  console.log(`Updating ${filePath}...`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Skip if already uses withApiProtection
  if (content.includes('withApiProtection')) {
    console.log(`  ✅ Already updated`);
    return;
  }
  
  // Skip auth routes and other special cases
  if (filePath.includes('/api/auth/') || 
      filePath.includes('/api/test-') ||
      filePath.includes('/api/images/')) {
    console.log(`  ⏭️  Skipping special route`);
    return;
  }
  
  // Get relative path for permission mapping
  const relativePath = filePath
    .replace('/home/ec2-user/podcastflow-pro/src/app', '')
    .replace('/route.ts', '')
    .replace(/\/\[[\w-]+\]/g, '/[id]'); // Normalize dynamic segments
  
  const permissions = permissionMap[relativePath];
  if (!permissions) {
    console.log(`  ⚠️  No permissions defined for ${relativePath}`);
    return;
  }
  
  // Add imports
  if (!content.includes('withApiProtection')) {
    content = content.replace(
      /(import.*from.*)/,
      `$1\nimport { withApiProtection, AuthenticatedRequest } from '@/lib/auth/api-protection'\nimport { PERMISSIONS } from '@/types/auth'`
    );
  }
  
  // Convert handlers and add exports
  const methods = ['GET', 'POST', 'PUT', 'DELETE'];
  
  for (const method of methods) {
    const permission = permissions[method];
    if (!permission) continue;
    
    const regex = new RegExp(`export async function ${method}\\(([^)]+)\\)`, 'g');
    const match = regex.exec(content);
    
    if (match) {
      // Convert to handler function
      const handlerName = `${method.toLowerCase()}Handler`;
      content = content.replace(
        `export async function ${method}(`,
        `async function ${handlerName}(`
      );
      
      // Replace parameter type
      content = content.replace(
        /request: NextRequest/g,
        'request: AuthenticatedRequest'
      );
      
      // Remove auth validation code
      content = content.replace(
        /\/\/ Get session and verify authentication[\s\S]*?if \(!user\) \{[\s\S]*?\}/g,
        'const user = request.user!'
      );
      
      // Add export with protection
      content += `\n\nexport const ${method} = withApiProtection(${handlerName}, {\n  requiredPermission: PERMISSIONS.${permission}\n})`;
    }
  }
  
  fs.writeFileSync(filePath, content);
  console.log(`  ✅ Updated with permissions`);
}

function main() {
  const apiFiles = findApiFiles(apiDir);
  console.log(`Found ${apiFiles.length} API route files to check`);
  
  for (const file of apiFiles) {
    try {
      updateApiFile(file);
    } catch (error) {
      console.error(`❌ Error updating ${file}:`, error.message);
    }
  }
  
  console.log('\n🎉 API permission update complete!');
  console.log('\nNext steps:');
  console.log('1. Review the updated files');
  console.log('2. Test each endpoint');
  console.log('3. Run npm run build to check for errors');
}

if (require.main === module) {
  main();
}