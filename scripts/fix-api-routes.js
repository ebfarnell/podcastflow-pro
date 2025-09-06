#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Find all route.ts files in the API directory
const apiDir = path.join(__dirname, '../src/app/api');
const routeFiles = glob.sync('**/route.ts', { cwd: apiDir });

console.log(`Found ${routeFiles.length} route files to check...`);

routeFiles.forEach(file => {
  const filePath = path.join(apiDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Pattern to match export const GET/POST/PUT/DELETE = withApiProtection
  const exportPattern = /export const (GET|POST|PUT|DELETE) = withApiProtection\((.*?)\n\}\)/gs;
  
  if (exportPattern.test(content)) {
    console.log(`Fixing ${file}...`);
    
    // Replace each export with direct function export
    content = content.replace(exportPattern, (match, method, innerContent) => {
      modified = true;
      return `// Use direct function export to fix production build issue
export const ${method} = async (request: NextRequest${method !== 'GET' && method !== 'POST' ? ', context: { params: { [key: string]: string } }' : ''}) => {
  const authToken = request.cookies.get('auth-token')
  if (!authToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  return ${innerContent.match(/(\w+Handler)/)?.[1] || 'handler'}(request as AuthenticatedRequest${method !== 'GET' && method !== 'POST' ? ', context' : ''})
}`;
    });

    if (modified) {
      fs.writeFileSync(filePath, content);
      console.log(`✓ Fixed ${file}`);
    }
  }
});

console.log('Done!');