/**
 * Test script for show-user assignments with multi-tenant isolation
 * Run with: node scripts/test-show-assignments.js
 */

const axios = require('axios');

// Test configuration
const API_URL = 'http://localhost:3000/api';
const TEST_USERS = {
  podcastflowAdmin: {
    email: 'admin@podcastflow.pro',
    password: 'admin123',
    org: 'PodcastFlow Pro'
  },
  unfyAdmin: {
    email: 'michael@unfy.com',
    password: 'EMunfy2025',
    org: 'Unfy'
  }
};

// Helper to login and get auth token
async function login(email, password) {
  try {
    const response = await axios.post(`${API_URL}/auth/login`, { email, password });
    return response.headers['set-cookie']?.find(c => c.startsWith('auth-token='));
  } catch (error) {
    console.error(`Login failed for ${email}:`, error.response?.data || error.message);
    throw error;
  }
}

// Helper to make authenticated requests
async function apiRequest(method, path, authCookie, data = null) {
  const config = {
    method,
    url: `${API_URL}${path}`,
    headers: { Cookie: authCookie },
    data
  };
  
  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
}

// Main test function
async function runTests() {
  console.log('🧪 Testing Show-User Assignments with Multi-Tenant Isolation\n');
  
  try {
    // 1. Login as both admins
    console.log('1️⃣ Logging in as admins from different organizations...');
    const podcastflowAuth = await login(TEST_USERS.podcastflowAdmin.email, TEST_USERS.podcastflowAdmin.password);
    const unfyAuth = await login(TEST_USERS.unfyAdmin.email, TEST_USERS.unfyAdmin.password);
    console.log('✅ Both admins logged in successfully\n');

    // 2. Get shows for each organization
    console.log('2️⃣ Fetching shows for each organization...');
    const podcastflowShows = await apiRequest('GET', '/shows?limit=5', podcastflowAuth);
    const unfyShows = await apiRequest('GET', '/shows?limit=5', unfyAuth);
    
    console.log(`PodcastFlow Pro has ${podcastflowShows.shows?.length || 0} shows`);
    console.log(`Unfy has ${unfyShows.shows?.length || 0} shows\n`);

    // 3. Test isolation - Ensure shows don't leak between orgs
    console.log('3️⃣ Testing data isolation...');
    const podcastflowShowIds = podcastflowShows.shows?.map(s => s.id) || [];
    const unfyShowIds = unfyShows.shows?.map(s => s.id) || [];
    
    const overlap = podcastflowShowIds.filter(id => unfyShowIds.includes(id));
    if (overlap.length > 0) {
      console.error('❌ SECURITY ISSUE: Shows are leaking between organizations!', overlap);
    } else {
      console.log('✅ Show data is properly isolated between organizations\n');
    }

    // 4. Test assignments for PodcastFlow Pro
    if (podcastflowShows.shows?.length > 0) {
      const testShow = podcastflowShows.shows[0];
      console.log(`4️⃣ Testing assignments for PodcastFlow Pro show: ${testShow.name}`);
      
      // Get current assignments
      const assignments = await apiRequest('GET', `/shows/${testShow.id}/assignments`, podcastflowAuth);
      console.log(`Current assignments: ${assignments.assignments?.length || 0} users`);
      
      // Get users to assign
      const users = await apiRequest('GET', '/users?limit=5', podcastflowAuth);
      const producer = users.users?.find(u => u.role === 'producer');
      const talent = users.users?.find(u => u.role === 'talent');
      
      if (producer) {
        console.log(`Assigning producer ${producer.name} to show...`);
        const assignResult = await apiRequest('POST', `/shows/${testShow.id}/assignments`, podcastflowAuth, {
          userId: producer.id,
          role: 'producer'
        });
        console.log('✅', assignResult.message);
      }
      
      if (talent) {
        console.log(`Assigning talent ${talent.name} to show...`);
        const assignResult = await apiRequest('POST', `/shows/${testShow.id}/assignments`, podcastflowAuth, {
          userId: talent.id,
          role: 'talent'
        });
        console.log('✅', assignResult.message);
      }
      
      // Verify assignments
      const updatedAssignments = await apiRequest('GET', `/shows/${testShow.id}/assignments`, podcastflowAuth);
      console.log(`Updated assignments: ${updatedAssignments.assignments?.length || 0} users\n`);
    }

    // 5. Test cross-org isolation
    console.log('5️⃣ Testing cross-organization isolation...');
    if (podcastflowShows.shows?.length > 0 && unfyShows.shows?.length > 0) {
      const podcastflowShowId = podcastflowShows.shows[0].id;
      
      try {
        // Try to access PodcastFlow show from Unfy account (should fail)
        await apiRequest('GET', `/shows/${podcastflowShowId}`, unfyAuth);
        console.error('❌ SECURITY ISSUE: Unfy can access PodcastFlow shows!');
      } catch (error) {
        if (error.error === 'Show not found') {
          console.log('✅ Cross-org access properly blocked');
        } else {
          console.error('❌ Unexpected error:', error);
        }
      }
    }

    // 6. Test filtering by assigned shows
    console.log('\n6️⃣ Testing episode filtering by assigned shows...');
    const podcastflowEpisodes = await apiRequest('GET', '/episodes?assignedOnly=true', podcastflowAuth);
    console.log(`Episodes from assigned shows: ${podcastflowEpisodes.episodes?.length || 0}`);

    console.log('\n✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the tests
runTests().catch(console.error);