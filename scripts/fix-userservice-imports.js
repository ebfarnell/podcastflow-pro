#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Find all route.ts files in the API directory
const apiDir = path.join(__dirname, '../src/app/api');
const routeFiles = glob.sync('**/route.ts', { cwd: apiDir });

console.log(`Found ${routeFiles.length} route files to check...`);

let fixedCount = 0;

routeFiles.forEach(file => {
  const filePath = path.join(apiDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Check if file uses UserService.validateSession but doesn't import UserService
  if (content.includes('UserService.validateSession') && !content.includes('import { UserService }') && !content.includes('import { UserService,')) {
    console.log(`Fixing ${file}...`);
    
    // Find where to insert the import
    if (content.includes("import { PERMISSIONS }")) {
      // Add after PERMISSIONS import
      content = content.replace(
        /import { PERMISSIONS } from '@\/types\/auth'/,
        "import { PERMISSIONS } from '@/types/auth'\nimport { UserService } from '@/lib/auth/user-service'"
      );
      modified = true;
    } else if (content.includes("import { withApiProtection")) {
      // Add after withApiProtection import
      content = content.replace(
        /import { withApiProtection.*?} from '@\/lib\/auth\/api-protection'/,
        (match) => match + "\nimport { UserService } from '@/lib/auth/user-service'"
      );
      modified = true;
    } else if (content.includes("import { NextRequest")) {
      // Add after NextRequest import
      content = content.replace(
        /import { NextRequest.*?} from 'next\/server'/,
        (match) => match + "\nimport { UserService } from '@/lib/auth/user-service'"
      );
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`✓ Fixed ${file}`);
    fixedCount++;
  }
});

console.log(`\nDone! Fixed ${fixedCount} files.`);
console.log('\nNow run: npm run build && pm2 restart podcastflow-pro');