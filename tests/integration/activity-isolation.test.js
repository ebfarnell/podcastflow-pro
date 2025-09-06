/**
 * Integration test for Activity table multi-tenant isolation
 */

const { execSync } = require('child_process')

// Database connection config
const DB_CONFIG = {
  user: 'podcastflow',
  password: 'PodcastFlow2025Prod',
  host: 'localhost',
  database: 'podcastflow_production'
}

// Helper to run SQL queries
function runSQL(query) {
  const cmd = `PGPASSWORD=${DB_CONFIG.password} psql -U ${DB_CONFIG.user} -h ${DB_CONFIG.host} -d ${DB_CONFIG.database} -t -c "${query}"`
  try {
    const result = execSync(cmd, { encoding: 'utf8' })
    return result.trim()
  } catch (error) {
    console.error('SQL Error:', error.message)
    return null
  }
}

// Test Activity isolation
async function testActivityIsolation() {
  console.log('=== Activity Multi-Tenant Isolation Test ===\n')
  
  // 1. Clear today's test data
  console.log('1. Clearing test data...')
  runSQL(`DELETE FROM org_podcastflow_pro."Activity" WHERE id LIKE 'test-%'`)
  runSQL(`DELETE FROM org_unfy."Activity" WHERE id LIKE 'test-%'`)
  
  // 2. Insert test activities for each org
  console.log('2. Inserting test activities...')
  
  // Insert for PodcastFlow Pro
  runSQL(`
    INSERT INTO org_podcastflow_pro."Activity" (id, type, description, "userId", "createdAt")
    VALUES 
      ('test-pf-1', 'campaign_approved', 'Test approval 1', 'cmd2qff240004og5y1f5msy5g', NOW()),
      ('test-pf-2', 'campaign_approved', 'Test approval 2', 'cmd2qff240004og5y1f5msy5g', NOW()),
      ('test-pf-3', 'campaign_rejected', 'Test rejection', 'cmd2qff240004og5y1f5msy5g', NOW())
  `)
  
  // Insert for Unfy
  runSQL(`
    INSERT INTO org_unfy."Activity" (id, type, description, "userId", "createdAt")
    VALUES 
      ('test-unfy-1', 'campaign_rejected', 'Test rejection 1', 'cmd2qff240004og5y1f5msy5g', NOW()),
      ('test-unfy-2', 'campaign_rejected', 'Test rejection 2', 'cmd2qff240004og5y1f5msy5g', NOW())
  `)
  
  // 3. Verify isolation - count per org
  console.log('\n3. Verifying isolation...')
  
  const pfApproved = runSQL(`
    SELECT COUNT(*) FROM org_podcastflow_pro."Activity" 
    WHERE type = 'campaign_approved' AND id LIKE 'test-%'
  `)
  
  const pfRejected = runSQL(`
    SELECT COUNT(*) FROM org_podcastflow_pro."Activity" 
    WHERE type = 'campaign_rejected' AND id LIKE 'test-%'
  `)
  
  const unfyApproved = runSQL(`
    SELECT COUNT(*) FROM org_unfy."Activity" 
    WHERE type = 'campaign_approved' AND id LIKE 'test-%'
  `)
  
  const unfyRejected = runSQL(`
    SELECT COUNT(*) FROM org_unfy."Activity" 
    WHERE type = 'campaign_rejected' AND id LIKE 'test-%'
  `)
  
  console.log('PodcastFlow Pro:')
  console.log(`  - Approved: ${pfApproved} (expected: 2)`)
  console.log(`  - Rejected: ${pfRejected} (expected: 1)`)
  
  console.log('\nUnfy:')
  console.log(`  - Approved: ${unfyApproved} (expected: 0)`)
  console.log(`  - Rejected: ${unfyRejected} (expected: 2)`)
  
  // 4. Test cross-tenant query (should fail or return 0)
  console.log('\n4. Testing cross-tenant isolation...')
  
  // Try to query Unfy data from PodcastFlow Pro context (should find nothing)
  const crossQuery = runSQL(`
    SELECT COUNT(*) FROM org_podcastflow_pro."Activity" 
    WHERE id LIKE 'test-unfy-%'
  `)
  
  console.log(`Cross-tenant query result: ${crossQuery} (expected: 0)`)
  
  // 5. Cleanup
  console.log('\n5. Cleaning up test data...')
  runSQL(`DELETE FROM org_podcastflow_pro."Activity" WHERE id LIKE 'test-%'`)
  runSQL(`DELETE FROM org_unfy."Activity" WHERE id LIKE 'test-%'`)
  
  // 6. Test summary
  console.log('\n=== Test Summary ===')
  const allTestsPassed = 
    pfApproved == 2 && 
    pfRejected == 1 && 
    unfyApproved == 0 && 
    unfyRejected == 2 &&
    crossQuery == 0
  
  if (allTestsPassed) {
    console.log('✅ All tests passed! Activity isolation is working correctly.')
  } else {
    console.log('❌ Some tests failed. Activity isolation may have issues.')
  }
  
  return allTestsPassed
}

// Run the test
testActivityIsolation()
  .then(passed => {
    process.exit(passed ? 0 : 1)
  })
  .catch(error => {
    console.error('Test failed:', error)
    process.exit(1)
  })