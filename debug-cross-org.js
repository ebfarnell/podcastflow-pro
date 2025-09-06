/**
 * Debug cross-org assignment issue
 */

const axios = require('axios');

async function debugCrossOrg() {
  try {
    // Login to both orgs
    console.log('Logging in to both organizations...');
    
    const podcastflowLogin = await axios.post('http://localhost:3000/api/auth/login', {
      email: 'admin@podcastflow.pro',
      password: 'admin123'
    });
    const podcastflowAuth = podcastflowLogin.headers['set-cookie']?.find(c => c.startsWith('auth-token='));
    
    const unfyLogin = await axios.post('http://localhost:3000/api/auth/login', {
      email: 'michael@unfy.com',
      password: 'EMunfy2025'
    });
    const unfyAuth = unfyLogin.headers['set-cookie']?.find(c => c.startsWith('auth-token='));
    
    console.log('Both logins successful');
    
    // Get data from each org
    const podcastflowShows = await axios.get('http://localhost:3000/api/shows?limit=1', {
      headers: { Cookie: podcastflowAuth }
    });
    
    const unfyUsers = await axios.get('http://localhost:3000/api/users?limit=1', {
      headers: { Cookie: unfyAuth }
    });
    
    const podcastflowUsers = await axios.get('http://localhost:3000/api/users?limit=1', {
      headers: { Cookie: podcastflowAuth }
    });
    
    console.log('PodcastFlow show:', podcastflowShows.data.shows?.[0]?.name, podcastflowShows.data.shows?.[0]?.id);
    console.log('Unfy user:', unfyUsers.data.users?.[0]?.name, unfyUsers.data.users?.[0]?.id, unfyUsers.data.users?.[0]?.organizationId);
    console.log('PodcastFlow user:', podcastflowUsers.data.users?.[0]?.name, podcastflowUsers.data.users?.[0]?.id, podcastflowUsers.data.users?.[0]?.organizationId);
    
    if (podcastflowShows.data.shows?.length > 0 && unfyUsers.data.users?.length > 0) {
      const show = podcastflowShows.data.shows[0];
      const unfyUser = unfyUsers.data.users[0];
      
      console.log(`\nAttempting to assign Unfy user ${unfyUser.id} to PodcastFlow show ${show.id}...`);
      
      try {
        const result = await axios.post(`http://localhost:3000/api/shows/${show.id}/assignments`, {
          userId: unfyUser.id,
          role: 'producer'
        }, {
          headers: { Cookie: podcastflowAuth }
        });
        
        console.log('❌ SECURITY BREACH: Assignment succeeded!');
        console.log('Response:', result.data);
        
      } catch (error) {
        console.log('✅ Assignment properly blocked:');
        console.log('Status:', error.response?.status);
        console.log('Error:', error.response?.data);
      }
    }
    
  } catch (error) {
    console.error('Debug failed:', error.response?.data || error.message);
  }
}

debugCrossOrg();