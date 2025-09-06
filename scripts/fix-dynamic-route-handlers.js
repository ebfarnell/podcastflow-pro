#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// List of files that need fixing
const filesToFix = [
  'shows/[id]/route.ts',
  'ad-approvals/[id]/route.ts',
  'advertisers/[id]/route.ts',
  'agencies/[id]/route.ts',
  'episodes/[episodeId]/route.ts',
  'orders/[id]/route.ts'
];

const apiDir = path.join(__dirname, '../src/app/api');

filesToFix.forEach(file => {
  const filePath = path.join(apiDir, file);
  
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${file}`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  console.log(`Checking ${file}...`);
  
  // Fix GET handler
  if (content.includes('async function getHandler') && content.includes('export const GET')) {
    content = content.replace(
      /return handler\(authenticatedRequest, context\)/g,
      'return getHandler(authenticatedRequest, context)'
    );
    modified = true;
  }
  
  // Fix PUT handler
  if (content.includes('async function putHandler') && content.includes('export const PUT')) {
    content = content.replace(
      /export const PUT = async[\s\S]*?return handler\(authenticatedRequest, context\)/g,
      (match) => match.replace('return handler(authenticatedRequest, context)', 'return putHandler(authenticatedRequest, context)')
    );
    modified = true;
  }
  
  // Fix DELETE handler
  if (content.includes('async function deleteHandler') && content.includes('export const DELETE')) {
    content = content.replace(
      /export const DELETE = async[\s\S]*?return handler\(authenticatedRequest, context\)/g,
      (match) => match.replace('return handler(authenticatedRequest, context)', 'return deleteHandler(authenticatedRequest, context)')
    );
    modified = true;
  }
  
  // Fix POST handler
  if (content.includes('async function postHandler') && content.includes('export const POST')) {
    content = content.replace(
      /export const POST = async[\s\S]*?return handler\(authenticatedRequest, context\)/g,
      (match) => match.replace('return handler(authenticatedRequest, context)', 'return postHandler(authenticatedRequest, context)')
    );
    modified = true;
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`✓ Fixed ${file}`);
  } else {
    console.log(`✗ No changes needed for ${file}`);
  }
});

console.log('\nDone! Now run: npm run build && pm2 restart podcastflow-pro');