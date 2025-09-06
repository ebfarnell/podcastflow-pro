#!/usr/bin/env node

// Test script to verify tenant isolation is working correctly
// Run with: node test-tenant-isolation.js

const https = require('https');

// Test configuration
const API_BASE = 'https://app.podcastflow.pro/api';
const TEST_USERS = {
  podcastflow_admin: {
    email: 'admin@podcastflow.pro',
    password: 'admin123',
    expectedOrgId: null // Will be filled after login
  },
  unfy_admin: {
    email: 'michael@unfy.com', 
    password: 'EMunfy2025',
    expectedOrgId: null // Will be filled after login
  }
};

// Helper function to make API requests
function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const response = {
            status: res.statusCode,
            headers: res.headers,
            data: data ? JSON.parse(data) : null
          };
          resolve(response);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    
    if (postData) {
      req.write(postData);
    }
    
    req.end();
  });
}

// Login function
async function login(email, password) {
  console.log(`\n🔐 Logging in as ${email}...`);
  
  const response = await makeRequest({
    hostname: 'app.podcastflow.pro',
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  }, JSON.stringify({ email, password }));

  if (response.status !== 200) {
    throw new Error(`Login failed: ${response.status} - ${JSON.stringify(response.data)}`);
  }

  // Extract auth cookie
  const cookies = response.headers['set-cookie'];
  const authCookie = cookies?.find(c => c.startsWith('auth-token='));
  
  if (!authCookie) {
    throw new Error('No auth cookie received');
  }

  console.log(`✅ Login successful for ${email}`);
  
  const orgId = response.data.user?.organizationId || response.data.organizationId;
  const orgName = response.data.user?.organization?.name || response.data.organization?.name || 'Unknown';
  
  console.log(`   Organization: ${orgName} (${orgId})`);
  
  return {
    authCookie: authCookie.split(';')[0],
    user: response.data.user || response.data,
    organizationId: orgId
  };
}

// Test function to check if user can access data from another org
async function testCrossOrgAccess(authCookie, testName, endpoint) {
  console.log(`\n🧪 Testing: ${testName}`);
  console.log(`   Endpoint: ${endpoint}`);
  
  try {
    const response = await makeRequest({
      hostname: 'app.podcastflow.pro',
      path: endpoint,
      method: 'GET',
      headers: {
        'Cookie': authCookie
      }
    });

    console.log(`   Response Status: ${response.status}`);
    
    if (response.data) {
      // Check if we got data from wrong organization
      if (Array.isArray(response.data)) {
        console.log(`   Records returned: ${response.data.length}`);
        return response.data;
      } else if (response.data.campaigns) {
        console.log(`   Campaigns returned: ${response.data.campaigns.length}`);
        return response.data.campaigns;
      } else if (response.data.users) {
        console.log(`   Users returned: ${response.data.users.length}`);
        return response.data.users;
      } else if (response.data.files) {
        console.log(`   Files returned: ${response.data.files.length}`);
        return response.data.files;
      }
    }
    
    return response.data;
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return null;
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting Tenant Isolation Tests');
  console.log('==================================\n');

  try {
    // Login as both users
    const podcastflowSession = await login(TEST_USERS.podcastflow_admin.email, TEST_USERS.podcastflow_admin.password);
    const unfySession = await login(TEST_USERS.unfy_admin.email, TEST_USERS.unfy_admin.password);
    
    // Store org IDs
    TEST_USERS.podcastflow_admin.expectedOrgId = podcastflowSession.organizationId;
    TEST_USERS.unfy_admin.expectedOrgId = unfySession.organizationId;

    console.log('\n📊 Test Scenario 1: PodcastFlow admin accessing Unfy data');
    console.log('=========================================================');
    
    // Test 1: Can PodcastFlow admin see Unfy campaigns?
    const campaigns = await testCrossOrgAccess(
      podcastflowSession.authCookie, 
      'Campaigns API',
      '/api/campaigns'
    );
    
    // Test 2: Can PodcastFlow admin see Unfy users?
    const users = await testCrossOrgAccess(
      podcastflowSession.authCookie,
      'Users API',
      '/api/users'
    );
    
    // Test 3: Can PodcastFlow admin see Unfy files?
    const files = await testCrossOrgAccess(
      podcastflowSession.authCookie,
      'Files API',
      '/api/files'
    );

    // Test 4: Can PodcastFlow admin see Unfy deletion requests?
    const deletionRequests = await testCrossOrgAccess(
      podcastflowSession.authCookie,
      'Deletion Requests API',
      '/api/deletion-requests'
    );

    console.log('\n📊 Test Scenario 2: Unfy admin accessing PodcastFlow data');
    console.log('=========================================================');
    
    // Test reverse direction
    await testCrossOrgAccess(
      unfySession.authCookie,
      'Campaigns API (Reverse)',
      '/api/campaigns'
    );
    
    await testCrossOrgAccess(
      unfySession.authCookie,
      'Users API (Reverse)',
      '/api/users'
    );

    // Analyze results
    console.log('\n📋 Analysis Summary');
    console.log('==================');
    
    // Check campaigns
    if (campaigns && Array.isArray(campaigns)) {
      const wrongOrgCampaigns = campaigns.filter(c => 
        c.organizationId && c.organizationId !== TEST_USERS.podcastflow_admin.expectedOrgId
      );
      if (wrongOrgCampaigns.length > 0) {
        console.log(`❌ CRITICAL: Found ${wrongOrgCampaigns.length} campaigns from wrong organization!`);
      } else {
        console.log(`✅ Campaigns: Properly isolated (${campaigns.length} campaigns, all from correct org)`);
      }
    }
    
    // Check users
    if (users && Array.isArray(users)) {
      const wrongOrgUsers = users.filter(u => 
        u.organizationId && u.organizationId !== TEST_USERS.podcastflow_admin.expectedOrgId
      );
      if (wrongOrgUsers.length > 0) {
        console.log(`❌ CRITICAL: Found ${wrongOrgUsers.length} users from wrong organization!`);
        console.log(`   Wrong org users:`, wrongOrgUsers.map(u => u.email));
      } else {
        console.log(`✅ Users: Properly isolated (${users.length} users, all from correct org)`);
      }
    }

    // Test specific file access
    console.log('\n📊 Test Scenario 3: Direct resource access across orgs');
    console.log('=====================================================');
    
    // First, get a file ID from PodcastFlow org
    if (files && files.length > 0) {
      const testFileId = files[0].id;
      console.log(`\n🧪 Testing direct file access: ${testFileId}`);
      
      // Try to access this file as Unfy admin
      const crossOrgFile = await testCrossOrgAccess(
        unfySession.authCookie,
        `Direct File Access (${testFileId})`,
        `/api/files/${testFileId}`
      );
      
      if (crossOrgFile && crossOrgFile.file) {
        console.log(`❌ CRITICAL: Unfy admin can access PodcastFlow file!`);
      } else if (crossOrgFile && crossOrgFile.error) {
        console.log(`✅ File access properly blocked: ${crossOrgFile.error}`);
      }
    }

    // Test database context
    console.log('\n📊 Test Scenario 4: Database context verification');
    console.log('================================================');
    
    // Check if tenant access log has any violations
    const violations = await testCrossOrgAccess(
      podcastflowSession.authCookie,
      'Check for access violations',
      '/api/security/audit?violations=true'
    );

    console.log('\n✅ Tenant Isolation Tests Complete!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the tests
runTests().catch(console.error);