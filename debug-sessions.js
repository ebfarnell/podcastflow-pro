/**
 * Debug session data
 */

const axios = require('axios');

async function debugSessions() {
  try {
    // Login to both orgs
    console.log('Testing session isolation...\n');
    
    // PodcastFlow login
    console.log('1. Logging in to PodcastFlow Pro...');
    const podcastflowLogin = await axios.post('http://localhost:3000/api/auth/login', {
      email: 'admin@podcastflow.pro',
      password: 'admin123'
    });
    const podcastflowAuth = podcastflowLogin.headers['set-cookie']?.find(c => c.startsWith('auth-token='));
    console.log('PodcastFlow auth token:', podcastflowAuth?.substring(0, 50) + '...');
    
    // Check PodcastFlow session
    const podcastflowProfile = await axios.get('http://localhost:3000/api/user/profile', {
      headers: { Cookie: podcastflowAuth }
    });
    console.log('PodcastFlow user:', {
      id: podcastflowProfile.data.id,
      name: podcastflowProfile.data.name,
      email: podcastflowProfile.data.email,
      organizationId: podcastflowProfile.data.organizationId
    });
    
    console.log('\n2. Logging in to Unfy...');
    const unfyLogin = await axios.post('http://localhost:3000/api/auth/login', {
      email: 'michael@unfy.com',
      password: 'EMunfy2025'
    });
    const unfyAuth = unfyLogin.headers['set-cookie']?.find(c => c.startsWith('auth-token='));
    console.log('Unfy auth token:', unfyAuth?.substring(0, 50) + '...');
    
    // Check Unfy session
    const unfyProfile = await axios.get('http://localhost:3000/api/user/profile', {
      headers: { Cookie: unfyAuth }
    });
    console.log('Unfy user:', {
      id: unfyProfile.data.id,
      name: unfyProfile.data.name,
      email: unfyProfile.data.email,
      organizationId: unfyProfile.data.organizationId
    });
    
    console.log('\n3. Verifying session isolation...');
    if (podcastflowProfile.data.id === unfyProfile.data.id) {
      console.log('❌ PROBLEM: Both sessions return the same user ID!');
    } else {
      console.log('✅ Sessions are properly isolated');
    }
    
    if (podcastflowProfile.data.organizationId === unfyProfile.data.organizationId) {
      console.log('❌ PROBLEM: Both sessions have the same organization ID!');
    } else {
      console.log('✅ Organizations are properly isolated');
    }
    
  } catch (error) {
    console.error('Debug failed:', error.response?.data || error.message);
  }
}

debugSessions();