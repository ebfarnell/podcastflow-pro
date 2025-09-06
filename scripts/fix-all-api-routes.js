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

  // Skip if it already has the direct export pattern
  if (content.includes('// Use direct function export to fix production build issue')) {
    console.log(`✓ Already fixed: ${file}`);
    return;
  }

  // Check if it uses withApiProtection
  if (!content.includes('withApiProtection')) {
    console.log(`✗ No withApiProtection: ${file}`);
    return;
  }

  console.log(`Fixing ${file}...`);

  // Pattern to match export const GET/POST/PUT/DELETE = withApiProtection
  const exportPattern = /export const (GET|POST|PUT|DELETE) = withApiProtection\(([\s\S]*?)\n\}\)/g;
  
  // Replace each export with direct function export
  content = content.replace(exportPattern, (match, method, innerContent) => {
    modified = true;
    
    // Extract the handler function name
    const handlerMatch = innerContent.match(/async \(request.*?\) => {\s*return (\w+Handler)\(/);
    const handlerName = handlerMatch ? handlerMatch[1] : 'handler';
    
    // Check if it's a dynamic route (has params)
    const hasParams = file.includes('[');
    const paramsType = hasParams ? ', context: { params: { [key: string]: string } }' : '';
    const paramsArg = hasParams ? ', context' : '';
    
    return `// Use direct function export to fix production build issue
export const ${method} = async (request: NextRequest${paramsType}) => {
  const authToken = request.cookies.get('auth-token')
  if (!authToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // Validate session and get user
  const user = await UserService.validateSession(authToken.value)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // Add user to request
  const authenticatedRequest = request as AuthenticatedRequest
  authenticatedRequest.user = user
  
  return ${handlerName}(authenticatedRequest${paramsArg})
}`;
  });

  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`✓ Fixed ${file}`);
    fixedCount++;
  }
});

console.log(`\nDone! Fixed ${fixedCount} files.`);
console.log('\nNow run: npm run build && pm2 restart podcastflow-pro');