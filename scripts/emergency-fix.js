#!/usr/bin/env node

const fs = require('fs');

const filesToFix = [
  '/home/ec2-user/podcastflow-pro/src/app/campaigns/[id]/page.tsx',
  '/home/ec2-user/podcastflow-pro/src/app/episodes/page.tsx', 
  '/home/ec2-user/podcastflow-pro/src/app/executive/reports/page.tsx',
  '/home/ec2-user/podcastflow-pro/src/app/orders/[id]/page.tsx',
  '/home/ec2-user/podcastflow-pro/src/app/orders/page.tsx'
];

function fixFile(filePath) {
  console.log(`Fixing ${filePath}...`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Remove RouteProtection from TabPanel functions  
  content = content.replace(
    /function TabPanel\(props: TabPanelProps\) \{[\s\S]*?return \(\s*<RouteProtection[^>]*>\s*<div/g,
    'function TabPanel(props: TabPanelProps) {\n  const { children, value, index, ...other } = props\n  return (\n    <div'
  );
  
  // Remove RouteProtection from inline return statements
  content = content.replace(
    /return \(\s*<RouteProtection[^>]*>\s*<Chip/g,
    'return (\n          <Chip'
  );
  
  // Remove corresponding closing RouteProtection tags from TabPanel
  content = content.replace(
    /(<\/div>\s*<\/RouteProtection>\s*\)\s*\}\s*function)/g,
    '</div>\n  )\n}\n\nfunction'
  );
  
  // Remove RouteProtection closing tags from Chip returns
  content = content.replace(
    /(<\/Chip>\s*<\/RouteProtection>\s*\))/g,
    '</Chip>\n        )'
  );
  
  fs.writeFileSync(filePath, content);
  console.log(`  ✅ Fixed`);
}

for (const file of filesToFix) {
  try {
    if (fs.existsSync(file)) {
      fixFile(file);
    }
  } catch (error) {
    console.error(`❌ Error fixing ${file}:`, error.message);
  }
}

console.log('\n🎉 Emergency fixes applied!');