const fs = require('fs');
const path = require('path');

// Critical routes to fix first (most commonly accessed)
const criticalRoutes = [
  'src/app/api/ad-approvals/[id]/route.ts',
  'src/app/api/users/[userId]/route.ts', 
  'src/app/api/notifications/[notificationId]/route.ts',
  'src/app/api/organizations/[organizationId]/route.ts',
  'src/app/api/episodes/[episodeId]/route.ts',
  'src/app/api/agencies/[id]/route.ts',
  'src/app/api/creatives/[id]/route.ts',
  'src/app/api/files/[id]/route.ts',
  'src/app/api/tasks/[id]/route.ts',
  'src/app/api/orders/[id]/route.ts'
];

function fixRouteFile(filePath) {
  console.log(`Fixing: ${filePath}`);
  
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Replace parameter type declarations
    const oldPattern = /\{ params \}: \{ params: \{ ([^}]+) \} \}/g;
    if (content.match(oldPattern)) {
      content = content.replace(oldPattern, '{ params }: { params: Promise<{ $1 }> }');
      modified = true;
    }
    
    // Add await params destructuring - be very careful with this
    // Only add if the pattern doesn't already exist
    if (modified && !content.includes('await params')) {
      // Look for function signatures that need params awaiting
      const functionPattern = /(async function [^(]+\([^)]*\{ params \}[^)]*\) \{[\s\n]*)(try \{)/g;
      content = content.replace(functionPattern, (match, funcStart, tryBlock) => {
        // Extract parameter names from the function signature
        const paramMatch = funcStart.match(/Promise<\{ ([^}]+) \}>/);
        if (paramMatch) {
          const paramDefs = paramMatch[1];
          // Simple case: single id parameter
          if (paramDefs.includes('id: string')) {
            return `${funcStart}${tryBlock}\n    // Await async params in Next.js 14.1.0\n    const { id } = await params\n    `;
          }
          // More complex cases would need specific handling
        }
        return match;
      });
    }
    
    // Replace all params.id with just id (only if we added the destructuring)
    if (content.includes('await params')) {
      content = content.replace(/params\.id/g, 'id');
    }
    
    if (modified) {
      fs.writeFileSync(filePath, content);
      console.log(`✅ Fixed: ${filePath}`);
    } else {
      console.log(`⚪ No changes needed: ${filePath}`);
    }
    
  } catch (error) {
    console.error(`❌ Error fixing ${filePath}:`, error.message);
  }
}

// Fix critical routes
criticalRoutes.forEach(routePath => {
  const fullPath = path.join(__dirname, routePath);
  if (fs.existsSync(fullPath)) {
    fixRouteFile(fullPath);
  } else {
    console.log(`⚠️  File not found: ${fullPath}`);
  }
});

console.log('\n🎉 Batch fix completed!');