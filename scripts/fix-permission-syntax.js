#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

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

function fixPageFile(filePath) {
  console.log(`Fixing ${filePath}...`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Skip if doesn't have RouteProtection imports
  if (!content.includes('RouteProtection')) {
    console.log(`  ⏭️  No RouteProtection found`);
    return;
  }
  
  // Check if imports are incorrectly placed
  const lines = content.split('\n');
  let hasIncorrectImports = false;
  let useClientIndex = -1;
  let routeProtectionImportIndex = -1;
  let permissionsImportIndex = -1;
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("'use client'")) {
      useClientIndex = i;
    }
    if (lines[i].includes('RouteProtection') && lines[i].includes('import')) {
      routeProtectionImportIndex = i;
    }
    if (lines[i].includes('PERMISSIONS') && lines[i].includes('import')) {
      permissionsImportIndex = i;
    }
  }
  
  // If imports are at the top (before other imports), we need to move them
  if (routeProtectionImportIndex >= 0 && routeProtectionImportIndex <= 5) {
    hasIncorrectImports = true;
  }
  
  if (hasIncorrectImports) {
    // Remove the incorrectly placed imports
    content = content.replace(/import \{ RouteProtection \} from '@\/components\/auth\/RouteProtection'\n/g, '');
    content = content.replace(/import \{ PERMISSIONS \} from '@\/types\/auth'\n/g, '');
    
    // Find the DashboardLayout import and add our imports after it
    content = content.replace(
      /import \{ DashboardLayout \} from '@\/components\/layout\/DashboardLayout'/,
      `import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { RouteProtection } from '@/components/auth/RouteProtection'
import { PERMISSIONS } from '@/types/auth'`
    );
  }
  
  // Check if the return statement wrapping is correct
  if (content.includes('<RouteProtection') && !content.includes('</RouteProtection>')) {
    // Find the last return statement and its closing
    const returnMatch = content.match(/return \(\s*<RouteProtection[^>]*>\s*<([^>]+)>/);
    if (returnMatch) {
      const componentName = returnMatch[1].split(' ')[0];
      
      // Find the corresponding closing tag
      const regex = new RegExp(`</${componentName}>`);
      const match = regex.exec(content);
      if (match) {
        const index = match.index + match[0].length;
        content = content.slice(0, index) + '\n    </RouteProtection>' + content.slice(index);
      }
    }
  }
  
  fs.writeFileSync(filePath, content);
  console.log(`  ✅ Fixed`);
}

function main() {
  const appDir = '/home/ec2-user/podcastflow-pro/src/app';
  const pageFiles = findPageFiles(appDir);
  
  console.log(`Found ${pageFiles.length} page files to check`);
  
  for (const file of pageFiles) {
    try {
      fixPageFile(file);
    } catch (error) {
      console.error(`❌ Error fixing ${file}:`, error.message);
    }
  }
  
  console.log('\n🎉 Permission syntax fix complete!');
}

if (require.main === module) {
  main();
}