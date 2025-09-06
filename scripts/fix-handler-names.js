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

  // Fix handler references
  // Pattern 1: return handler(authenticatedRequest)
  if (content.includes('return handler(authenticatedRequest)')) {
    console.log(`Fixing ${file}...`);
    
    // Check what handler functions exist in the file
    const hasGetHandler = content.includes('async function getHandler');
    const hasPostHandler = content.includes('async function postHandler');
    const hasPutHandler = content.includes('async function putHandler');
    const hasDeleteHandler = content.includes('async function deleteHandler');
    
    // Fix GET export
    if (hasGetHandler && content.includes('export const GET')) {
      content = content.replace(
        /export const GET = async[\s\S]*?return handler\(authenticatedRequest(.*?)\)\n\}/g,
        (match, args) => match.replace('return handler(authenticatedRequest' + args + ')', 'return getHandler(authenticatedRequest' + args + ')')
      );
      modified = true;
    }
    
    // Fix POST export
    if (hasPostHandler && content.includes('export const POST')) {
      content = content.replace(
        /export const POST = async[\s\S]*?return handler\(authenticatedRequest(.*?)\)\n\}/g,
        (match, args) => match.replace('return handler(authenticatedRequest' + args + ')', 'return postHandler(authenticatedRequest' + args + ')')
      );
      modified = true;
    }
    
    // Fix PUT export
    if (hasPutHandler && content.includes('export const PUT')) {
      content = content.replace(
        /export const PUT = async[\s\S]*?return handler\(authenticatedRequest(.*?)\)\n\}/g,
        (match, args) => match.replace('return handler(authenticatedRequest' + args + ')', 'return putHandler(authenticatedRequest' + args + ')')
      );
      modified = true;
    }
    
    // Fix DELETE export
    if (hasDeleteHandler && content.includes('export const DELETE')) {
      content = content.replace(
        /export const DELETE = async[\s\S]*?return handler\(authenticatedRequest(.*?)\)\n\}/g,
        (match, args) => match.replace('return handler(authenticatedRequest' + args + ')', 'return deleteHandler(authenticatedRequest' + args + ')')
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