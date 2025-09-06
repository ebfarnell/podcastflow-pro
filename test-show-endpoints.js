const https = require('https');

// Test configuration
const baseUrl = 'https://app.podcastflow.pro';
const adminEmail = 'admin@podcastflow.pro';
const adminPassword = 'admin123';

// Helper function to make HTTPS requests
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          resolve({ 
            status: res.statusCode, 
            data: response,
            headers: res.headers 
          });
        } catch (e) {
          resolve({ 
            status: res.statusCode, 
            data: body,
            headers: res.headers 
          });
        }
      });
    });
    
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

// Login and get auth token
async function login(email, password) {
  const options = {
    hostname: 'app.podcastflow.pro',
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  };
  
  const result = await makeRequest(options, { email, password });
  if (result.status === 200) {
    // Extract auth-token from set-cookie header
    const setCookies = result.headers['set-cookie'];
    if (setCookies) {
      for (const cookie of setCookies) {
        if (cookie.includes('auth-token=')) {
          const authToken = cookie.split('auth-token=')[1].split(';')[0];
          return authToken;
        }
      }
    }
    return result.data.authToken;
  }
  throw new Error(`Login failed: ${JSON.stringify(result)}`);
}

// Test show endpoints
async function testShowEndpoints() {
  try {
    console.log('Testing Show Endpoints...\n');
    
    // Login as admin
    console.log('1. Logging in as admin...');
    const authToken = await login(adminEmail, adminPassword);
    console.log('✓ Login successful\n');
    
    // Test shows list endpoint
    console.log('2. Testing GET /api/shows...');
    const showsOptions = {
      hostname: 'app.podcastflow.pro',
      path: '/api/shows',
      method: 'GET',
      headers: {
        'Cookie': `auth-token=${authToken}`
      }
    };
    
    const showsResult = await makeRequest(showsOptions);
    console.log('Status:', showsResult.status);
    console.log('Shows returned:', showsResult.data?.shows?.length || showsResult.data?.length || 0);
    
    const shows = showsResult.data?.shows || showsResult.data || [];
    if (shows.length > 0) {
      console.log('First show:', JSON.stringify(shows[0], null, 2));
    }
    
    // Check for selloutProjection and estimatedEpisodeValue
    if (shows && shows.length > 0) {
      const firstShow = shows[0];
      console.log('\nChecking for required fields:');
      console.log('- selloutProjection:', firstShow.selloutProjection !== undefined ? '✓ Present' : '✗ Missing');
      console.log('- estimatedEpisodeValue:', firstShow.estimatedEpisodeValue !== undefined ? '✓ Present' : '✗ Missing');
      
      // Get a specific show
      if (firstShow.id) {
        console.log(`\n3. Testing GET /api/shows/${firstShow.id}...`);
        const showOptions = {
          hostname: 'app.podcastflow.pro',
          path: `/api/shows/${firstShow.id}`,
          method: 'GET',
          headers: {
            'Cookie': `auth-token=${authToken}`
          }
        };
        
        const showResult = await makeRequest(showOptions);
        console.log('Status:', showResult.status);
        console.log('Show details:');
        console.log('- Name:', showResult.data.name);
        console.log('- selloutProjection:', showResult.data.selloutProjection);
        console.log('- estimatedEpisodeValue:', showResult.data.estimatedEpisodeValue);
      }
    }
    
    console.log('\n✓ All show endpoint tests completed');
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run tests
testShowEndpoints();