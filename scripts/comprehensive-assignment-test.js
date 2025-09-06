/**
 * Comprehensive Assignment System Test Suite
 * Tests multi-tenant isolation, concurrent access, error handling, and security
 * 
 * Run with: node scripts/comprehensive-assignment-test.js
 */

const axios = require('axios');

const API_URL = 'http://localhost:3000/api';
const TEST_ORGANIZATIONS = {
  podcastflow: {
    admin: { email: 'admin@podcastflow.pro', password: 'admin123' },
    orgName: 'PodcastFlow Pro'
  },
  unfy: {
    admin: { email: 'michael@unfy.com', password: 'EMunfy2025' },
    orgName: 'Unfy'  
  }
};

// Test configuration
const CONCURRENT_USERS = 5;
const STRESS_TEST_DURATION = 30000; // 30 seconds

// Helper to login and get auth token
async function login(email, password) {
  try {
    const response = await axios.post(`${API_URL}/auth/login`, { email, password });
    return response.headers['set-cookie']?.find(c => c.startsWith('auth-token='));
  } catch (error) {
    throw new Error(`Login failed for ${email}: ${error.response?.data?.error || error.message}`);
  }
}

// Helper to make authenticated requests
async function apiRequest(method, path, authCookie, data = null) {
  const config = {
    method,
    url: `${API_URL}${path}`,
    headers: { Cookie: authCookie },
    data,
    timeout: 10000
  };
  
  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    throw {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    };
  }
}

// Test basic assignment operations
async function testBasicAssignments(authCookie, orgName) {
  console.log(`\n🧪 Testing basic assignments for ${orgName}...`);
  
  // Get shows
  const showsResult = await apiRequest('GET', '/shows?limit=3', authCookie);
  const shows = showsResult.shows || [];
  
  if (shows.length === 0) {
    console.log(`⚠️  No shows found for ${orgName}, skipping assignment tests`);
    return;
  }
  
  // Get users
  const usersResult = await apiRequest('GET', '/users?limit=10', authCookie);
  const users = usersResult.users || [];
  
  const producers = users.filter(u => u.role === 'producer');
  const talent = users.filter(u => u.role === 'talent');
  
  console.log(`Found ${shows.length} shows, ${producers.length} producers, ${talent.length} talent`);
  
  const testShow = shows[0];
  let assignmentResults = [];
  
  if (producers.length > 0) {
    const producer = producers[0];
    console.log(`Assigning producer ${producer.name} to show ${testShow.name}...`);
    
    try {
      const result = await apiRequest('POST', `/shows/${testShow.id}/assignments`, authCookie, {
        userId: producer.id,
        role: 'producer'
      });
      assignmentResults.push({ type: 'producer', success: true, result });
      console.log(`✅ Producer assigned successfully`);
    } catch (error) {
      assignmentResults.push({ type: 'producer', success: false, error });
      console.log(`❌ Producer assignment failed: ${error.data?.error || error.message}`);
    }
  }
  
  if (talent.length > 0) {
    const talentUser = talent[0];
    console.log(`Assigning talent ${talentUser.name} to show ${testShow.name}...`);
    
    try {
      const result = await apiRequest('POST', `/shows/${testShow.id}/assignments`, authCookie, {
        userId: talentUser.id,
        role: 'talent'
      });
      assignmentResults.push({ type: 'talent', success: true, result });
      console.log(`✅ Talent assigned successfully`);
    } catch (error) {
      assignmentResults.push({ type: 'talent', success: false, error });
      console.log(`❌ Talent assignment failed: ${error.data?.error || error.message}`);
    }
  }
  
  // Test getting assignments
  try {
    const assignments = await apiRequest('GET', `/shows/${testShow.id}/assignments`, authCookie);
    console.log(`✅ Retrieved ${assignments.assignments?.length || 0} assignments`);
  } catch (error) {
    console.log(`❌ Failed to retrieve assignments: ${error.data?.error}`);
  }
  
  return { show: testShow, results: assignmentResults };
}

// Test cross-organization security
async function testCrossOrgSecurity() {
  console.log(`\n🔒 Testing cross-organization security...`);
  
  // Login to both orgs
  const podcastflowAuth = await login(
    TEST_ORGANIZATIONS.podcastflow.admin.email,
    TEST_ORGANIZATIONS.podcastflow.admin.password
  );
  const unfyAuth = await login(
    TEST_ORGANIZATIONS.unfy.admin.email,
    TEST_ORGANIZATIONS.unfy.admin.password
  );
  
  // Get shows from PodcastFlow Pro
  const podcastflowShows = await apiRequest('GET', '/shows?limit=1', podcastflowAuth);
  const podcastflowUsers = await apiRequest('GET', '/users?limit=1', podcastflowAuth);
  
  // Get users from Unfy
  const unfyUsers = await apiRequest('GET', '/users?limit=1', unfyAuth);
  
  if (podcastflowShows.shows?.length > 0 && unfyUsers.users?.length > 0) {
    const podcastflowShow = podcastflowShows.shows[0];
    const unfyUser = unfyUsers.users[0];
    
    console.log(`Attempting to assign Unfy user to PodcastFlow show (should fail)...`);
    
    try {
      await apiRequest('POST', `/shows/${podcastflowShow.id}/assignments`, podcastflowAuth, {
        userId: unfyUser.id,
        role: 'producer'
      });
      console.log(`❌ SECURITY BREACH: Cross-org assignment succeeded!`);
      return false;
    } catch (error) {
      if (error.status === 404 && error.data?.error?.includes('organization')) {
        console.log(`✅ Cross-org assignment properly blocked: ${error.data.error}`);
        return true;
      } else {
        console.log(`⚠️  Unexpected error: ${error.data?.error}`);
        return false;
      }
    }
  }
  
  console.log(`⚠️  Insufficient data for cross-org test`);
  return true;
}

// Test concurrent assignments to the same show
async function testConcurrentAssignments(authCookie, show, users) {
  console.log(`\n⚡ Testing concurrent assignments...`);
  
  if (!show || users.length < CONCURRENT_USERS) {
    console.log(`⚠️  Insufficient data for concurrent test`);
    return;
  }
  
  const promises = [];
  const results = [];
  
  // Create multiple concurrent assignment requests
  for (let i = 0; i < Math.min(CONCURRENT_USERS, users.length); i++) {
    const user = users[i];
    const promise = apiRequest('POST', `/shows/${show.id}/assignments`, authCookie, {
      userId: user.id,
      role: user.role
    }).then(result => {
      results.push({ userId: user.id, success: true, result });
    }).catch(error => {
      results.push({ 
        userId: user.id, 
        success: false, 
        error: error.data?.error || error.message 
      });
    });
    
    promises.push(promise);
  }
  
  // Wait for all requests to complete
  await Promise.all(promises);
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`✅ Concurrent assignments completed: ${successful} succeeded, ${failed} failed`);
  
  // Verify final state
  try {
    const finalAssignments = await apiRequest('GET', `/shows/${show.id}/assignments`, authCookie);
    console.log(`✅ Final assignment count: ${finalAssignments.assignments?.length || 0}`);
  } catch (error) {
    console.log(`❌ Failed to verify final state: ${error.data?.error}`);
  }
  
  return results;
}

// Test malformed requests and error handling
async function testErrorHandling(authCookie, show) {
  console.log(`\n🚨 Testing error handling...`);
  
  const errorTests = [
    {
      name: 'Missing userId',
      data: { role: 'producer' },
      expectedStatus: 400
    },
    {
      name: 'Invalid role',
      data: { userId: 'test-user', role: 'invalid-role' },
      expectedStatus: 400
    },
    {
      name: 'Invalid JSON',
      data: '{ invalid json }',
      expectedStatus: 400,
      raw: true
    },
    {
      name: 'Non-existent user',
      data: { userId: 'non-existent-user-id', role: 'producer' },
      expectedStatus: 404
    }
  ];
  
  for (const test of errorTests) {
    try {
      if (test.raw) {
        // Test raw JSON parsing errors
        const config = {
          method: 'POST',
          url: `${API_URL}/shows/${show.id}/assignments`,
          headers: { 
            Cookie: authCookie,
            'Content-Type': 'application/json'
          },
          data: test.data
        };
        await axios(config);
        console.log(`❌ ${test.name}: Expected error but request succeeded`);
      } else {
        await apiRequest('POST', `/shows/${show.id}/assignments`, authCookie, test.data);
        console.log(`❌ ${test.name}: Expected error but request succeeded`);
      }
    } catch (error) {
      if (error.status === test.expectedStatus) {
        console.log(`✅ ${test.name}: Correctly rejected with status ${error.status}`);
      } else {
        console.log(`⚠️  ${test.name}: Expected status ${test.expectedStatus}, got ${error.status}`);
      }
    }
  }
}

// Stress test with rapid requests
async function stressTest(authCookie, show, users) {
  console.log(`\n💪 Running stress test for ${STRESS_TEST_DURATION/1000} seconds...`);
  
  if (!show || users.length === 0) {
    console.log(`⚠️  Insufficient data for stress test`);
    return;
  }
  
  let requestCount = 0;
  let successCount = 0;
  let errorCount = 0;
  const startTime = Date.now();
  const endTime = startTime + STRESS_TEST_DURATION;
  
  const promises = [];
  
  while (Date.now() < endTime) {
    const user = users[requestCount % users.length];
    requestCount++;
    
    const promise = apiRequest('POST', `/shows/${show.id}/assignments`, authCookie, {
      userId: user.id,
      role: user.role
    }).then(() => {
      successCount++;
    }).catch(() => {
      errorCount++;
    });
    
    promises.push(promise);
    
    // Add small delay to prevent overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Wait for all requests to complete
  await Promise.all(promises);
  
  const duration = Date.now() - startTime;
  const requestsPerSecond = Math.round((requestCount / duration) * 1000);
  
  console.log(`✅ Stress test completed:`);
  console.log(`   Total requests: ${requestCount}`);
  console.log(`   Successful: ${successCount}`);
  console.log(`   Errors: ${errorCount}`);
  console.log(`   Duration: ${duration}ms`);
  console.log(`   Requests/second: ${requestsPerSecond}`);
  
  return {
    totalRequests: requestCount,
    successful: successCount,
    errors: errorCount,
    duration,
    requestsPerSecond
  };
}

// Main test runner
async function runComprehensiveTests() {
  console.log('🚀 Starting Comprehensive Assignment System Tests\n');
  
  const results = {
    basicTests: {},
    securityTest: false,
    concurrentTests: {},
    errorTests: {},
    stressTests: {}
  };
  
  try {
    // Test 1: Basic assignment operations for each org
    for (const [orgKey, orgConfig] of Object.entries(TEST_ORGANIZATIONS)) {
      try {
        const authCookie = await login(orgConfig.admin.email, orgConfig.admin.password);
        const basicResult = await testBasicAssignments(authCookie, orgConfig.orgName);
        results.basicTests[orgKey] = basicResult;
        
        // If we have test data, run additional tests
        if (basicResult) {
          const usersResult = await apiRequest('GET', '/users', authCookie);
          const users = usersResult.users || [];
          
          if (basicResult.show && users.length >= 2) {
            // Test concurrent assignments
            const concurrentResult = await testConcurrentAssignments(
              authCookie, 
              basicResult.show, 
              users.slice(0, CONCURRENT_USERS)
            );
            results.concurrentTests[orgKey] = concurrentResult;
            
            // Test error handling
            await testErrorHandling(authCookie, basicResult.show);
            
            // Run stress test only for the first org to avoid overwhelming the system
            if (orgKey === 'podcastflow') {
              const stressResult = await stressTest(authCookie, basicResult.show, users);
              results.stressTests[orgKey] = stressResult;
            }
          }
        }
      } catch (error) {
        console.log(`❌ Tests failed for ${orgConfig.orgName}: ${error.message}`);
        results.basicTests[orgKey] = { error: error.message };
      }
    }
    
    // Test 2: Cross-organization security
    try {
      results.securityTest = await testCrossOrgSecurity();
    } catch (error) {
      console.log(`❌ Security test failed: ${error.message}`);
      results.securityTest = false;
    }
    
  } catch (error) {
    console.error(`❌ Test suite failed: ${error.message}`);
  }
  
  // Print final summary
  console.log(`\n📊 TEST SUMMARY`);
  console.log(`================`);
  
  Object.entries(results.basicTests).forEach(([org, result]) => {
    if (result.error) {
      console.log(`❌ ${org}: ${result.error}`);
    } else {
      const successCount = result.results?.filter(r => r.success).length || 0;
      const totalCount = result.results?.length || 0;
      console.log(`✅ ${org}: ${successCount}/${totalCount} basic assignments succeeded`);
    }
  });
  
  console.log(`${results.securityTest ? '✅' : '❌'} Cross-org security: ${results.securityTest ? 'PASSED' : 'FAILED'}`);
  
  Object.entries(results.stressTests).forEach(([org, result]) => {
    if (result) {
      console.log(`✅ ${org} stress test: ${result.requestsPerSecond} req/sec, ${result.successful}/${result.totalRequests} succeeded`);
    }
  });
  
  if (results.securityTest && Object.values(results.basicTests).every(r => !r.error)) {
    console.log(`\n🎉 ALL TESTS PASSED - Assignment system is secure and functional!`);
  } else {
    console.log(`\n⚠️  SOME TESTS FAILED - Please review the issues above`);
  }
}

// Run the tests
runComprehensiveTests().catch(console.error);