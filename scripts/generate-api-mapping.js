#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Function to recursively find all route files
function findRouteFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      findRouteFiles(filePath, fileList);
    } else if (file === 'route.ts' || file === 'route.js') {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// Function to extract HTTP methods from route file
function extractMethods(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const methods = [];
  
  // Match export async function GET/POST/PUT/DELETE/PATCH etc
  const methodRegex = /export\s+(?:async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)/g;
  let match;
  
  while ((match = methodRegex.exec(content)) !== null) {
    methods.push(match[1]);
  }
  
  return methods;
}

// Function to convert file path to API route
function filePathToRoute(filePath) {
  // Remove base path and route.ts
  let route = filePath
    .replace(/.*\/app\/api/, '/api')
    .replace(/\/route\.(ts|js)$/, '');
  
  // Handle root API route
  if (route === '/api') {
    route = '/api/';
  }
  
  return route;
}

// Main function
function generateApiMapping() {
  const apiDir = path.join(__dirname, '../src/app/api');
  const routeFiles = findRouteFiles(apiDir);
  const apiEndpoints = [];
  
  routeFiles.forEach(file => {
    const methods = extractMethods(file);
    const route = filePathToRoute(file);
    
    if (methods.length > 0) {
      methods.forEach(method => {
        apiEndpoints.push({
          method,
          path: route,
          file: file.replace(/.*\/src/, 'src')
        });
      });
    }
  });
  
  // Sort by path and then by method
  apiEndpoints.sort((a, b) => {
    if (a.path === b.path) {
      return a.method.localeCompare(b.method);
    }
    return a.path.localeCompare(b.path);
  });
  
  return apiEndpoints;
}

// Generate the mapping
const endpoints = generateApiMapping();

// Create markdown output
let markdown = '# PodcastFlow API Endpoints\n\n';
markdown += `Generated on: ${new Date().toISOString()}\n\n`;
markdown += `Total endpoints: ${endpoints.length}\n\n`;

markdown += '## Endpoints by Path\n\n';
markdown += '| Method | Path | Source File |\n';
markdown += '|--------|------|-------------|\n';

endpoints.forEach(endpoint => {
  markdown += `| ${endpoint.method} | ${endpoint.path} | ${endpoint.file} |\n`;
});

// Group by path for better readability
markdown += '\n## Endpoints Grouped by Resource\n\n';

const groupedEndpoints = {};
endpoints.forEach(endpoint => {
  const pathParts = endpoint.path.split('/').filter(p => p);
  const resource = pathParts[1] || 'root';
  
  if (!groupedEndpoints[resource]) {
    groupedEndpoints[resource] = [];
  }
  
  groupedEndpoints[resource].push(endpoint);
});

Object.keys(groupedEndpoints).sort().forEach(resource => {
  markdown += `### ${resource}\n\n`;
  groupedEndpoints[resource].forEach(endpoint => {
    markdown += `- **${endpoint.method}** ${endpoint.path}\n`;
  });
  markdown += '\n';
});

// Save outputs
const backupDir = process.argv[2] || '.';

// Save as markdown
fs.writeFileSync(path.join(backupDir, 'api-endpoints.md'), markdown);

// Save as JSON
fs.writeFileSync(
  path.join(backupDir, 'api-endpoints.json'), 
  JSON.stringify(endpoints, null, 2)
);

console.log(`API mapping generated: ${endpoints.length} endpoints found`);
console.log(`Saved to: ${backupDir}/api-endpoints.md and api-endpoints.json`);