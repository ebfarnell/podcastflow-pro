#!/usr/bin/env node

// Test script to verify episode data flows correctly through the system
const { execSync } = require('child_process');

console.log('🧪 Testing Episode Data Flow\n');

// Function to run SQL query
function runQuery(query) {
  try {
    const result = execSync(
      `export PGPASSWORD=PodcastFlow2025Prod && psql -U podcastflow -h localhost -d podcastflow_production -t -c "${query}"`,
      { encoding: 'utf8' }
    );
    return result.trim();
  } catch (error) {
    console.error('Query failed:', error.message);
    return null;
  }
}

// Test 1: Check that all ScheduleBuilderItems have episodes
console.log('Test 1: Checking ScheduleBuilderItems have episodes...');
const itemsWithoutEpisodes = runQuery(
  'SELECT COUNT(*) FROM org_podcastflow_pro.\\"ScheduleBuilderItem\\" WHERE \\"episodeId\\" IS NULL'
);
console.log(`  Items without episodes: ${itemsWithoutEpisodes || 0}`);
if (itemsWithoutEpisodes === '0') {
  console.log('  ✅ All ScheduleBuilderItems have episodes');
} else {
  console.log('  ⚠️ Some items still missing episodes');
}

// Test 2: Check that episodes have valid episode numbers
console.log('\nTest 2: Checking episodes have valid episode numbers...');
const episodesWithZeroNumber = runQuery(`
  SELECT COUNT(*) 
  FROM org_podcastflow_pro."Episode" 
  WHERE "episodeNumber" = 0 OR "episodeNumber" IS NULL
`);
console.log(`  Episodes with invalid numbers: ${episodesWithZeroNumber || 0}`);
if (episodesWithZeroNumber === '0') {
  console.log('  ✅ All episodes have valid episode numbers');
} else {
  console.log('  ⚠️ Some episodes have invalid episode numbers');
}

// Test 3: Check that episodes have titles
console.log('\nTest 3: Checking episodes have titles...');
const episodesWithoutTitles = runQuery(`
  SELECT COUNT(*) 
  FROM org_podcastflow_pro."Episode" 
  WHERE title IS NULL OR title = '' OR title = 'Unknown Episode'
`);
console.log(`  Episodes without proper titles: ${episodesWithoutTitles || 0}`);
if (episodesWithoutTitles === '0') {
  console.log('  ✅ All episodes have proper titles');
} else {
  console.log('  ⚠️ Some episodes missing proper titles');
}

// Test 4: Check EpisodeInventory exists for all episodes
console.log('\nTest 4: Checking EpisodeInventory records...');
const episodesWithoutInventory = runQuery(`
  SELECT COUNT(*) 
  FROM org_podcastflow_pro."Episode" e
  WHERE NOT EXISTS (
    SELECT 1 FROM org_podcastflow_pro."EpisodeInventory" ei
    WHERE ei."episodeId" = e.id
  )
  AND e.status = 'scheduled'
`);
console.log(`  Episodes without inventory: ${episodesWithoutInventory || 0}`);
if (episodesWithoutInventory === '0') {
  console.log('  ✅ All scheduled episodes have inventory records');
} else {
  console.log('  ⚠️ Some episodes missing inventory records');
}

// Test 5: Sample data verification
console.log('\nTest 5: Sample episode data...');
const sampleEpisodes = runQuery(`
  SELECT 
    e."episodeNumber",
    e.title,
    s.name as show_name,
    e."airDate"
  FROM org_podcastflow_pro."Episode" e
  JOIN org_podcastflow_pro."Show" s ON s.id = e."showId"
  ORDER BY e."createdAt" DESC
  LIMIT 3
`);
console.log('  Recent episodes:');
if (sampleEpisodes) {
  const lines = sampleEpisodes.split('\n').filter(line => line.trim());
  lines.forEach(line => {
    const parts = line.split('|').map(p => p.trim());
    if (parts.length >= 4) {
      console.log(`    Episode #${parts[0]} - ${parts[1]} (${parts[2]}) on ${parts[3]}`);
    }
  });
}

// Test 6: Check schedule builder items have proper linkage
console.log('\nTest 6: Checking schedule builder items linkage...');
const properlyLinkedItems = runQuery(`
  SELECT COUNT(*)
  FROM org_podcastflow_pro."ScheduleBuilderItem" sbi
  JOIN org_podcastflow_pro."Episode" e ON e.id = sbi."episodeId"
  WHERE e."showId" = sbi."showId"
  AND DATE(e."airDate") = sbi."airDate"
`);
const totalItems = runQuery(`
  SELECT COUNT(*) FROM org_podcastflow_pro."ScheduleBuilderItem"
`);
console.log(`  Properly linked items: ${properlyLinkedItems}/${totalItems}`);
if (properlyLinkedItems === totalItems) {
  console.log('  ✅ All items properly linked to episodes');
} else {
  console.log('  ⚠️ Some items have mismatched episode linkage');
}

console.log('\n✨ Episode data flow tests complete!');