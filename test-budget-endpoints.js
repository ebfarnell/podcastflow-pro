const https = require('https');

// Test configuration
const baseUrl = 'https://app.podcastflow.pro';
const adminEmail = 'admin@podcastflow.pro';
const adminPassword = 'admin123';
const salesEmail = 'seller@podcastflow.pro';
const salesPassword = 'seller123';

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

// Test budget endpoints
async function testBudgetEndpoints() {
  try {
    console.log('Testing Budget Endpoints...\n');
    
    // Login as admin
    console.log('1. Logging in as admin...');
    const authToken = await login(adminEmail, adminPassword);
    console.log('✓ Login successful, auth token:', authToken.substring(0, 20) + '...\n');
    
    // Test budget comparison endpoint
    console.log('2. Testing GET /api/budget/comparison...');
    const comparisonOptions = {
      hostname: 'app.podcastflow.pro',
      path: '/api/budget/comparison?year=2025',
      method: 'GET',
      headers: {
        'Cookie': `auth-token=${authToken}`
      }
    };
    
    const comparisonResult = await makeRequest(comparisonOptions);
    console.log('Status:', comparisonResult.status);
    console.log('Response:', JSON.stringify(comparisonResult.data, null, 2).substring(0, 200) + '...\n');
    
    // Test hierarchical budget endpoint
    console.log('3. Testing GET /api/budget/hierarchical...');
    const hierarchicalOptions = {
      hostname: 'app.podcastflow.pro',
      path: '/api/budget/hierarchical?year=2025&month=7',
      method: 'GET',
      headers: {
        'Cookie': `auth-token=${authToken}`
      }
    };
    
    const hierarchicalResult = await makeRequest(hierarchicalOptions);
    console.log('Status:', hierarchicalResult.status);
    console.log('Response:', JSON.stringify(hierarchicalResult.data, null, 2).substring(0, 200) + '...\n');
    
    // Test budget entities endpoint
    console.log('4. Testing GET /api/budget/entities...');
    const entitiesOptions = {
      hostname: 'app.podcastflow.pro',
      path: '/api/budget/entities',
      method: 'GET',
      headers: {
        'Cookie': `auth-token=${authToken}`
      }
    };
    
    const entitiesResult = await makeRequest(entitiesOptions);
    console.log('Status:', entitiesResult.status);
    console.log('Response:', JSON.stringify(entitiesResult.data, null, 2).substring(0, 200) + '...\n');
    
    console.log('✓ All admin budget endpoint tests completed\n');
    
    // Test with sales user
    console.log('Testing with Sales User...\n');
    
    console.log('5. Logging in as sales user...');
    const salesToken = await login(salesEmail, salesPassword);
    console.log('✓ Sales login successful\n');
    
    // Test budget comparison endpoint with sales user
    console.log('6. Testing GET /api/budget/comparison as sales user...');
    const salesComparisonOptions = {
      hostname: 'app.podcastflow.pro',
      path: '/api/budget/comparison?year=2025',
      method: 'GET',
      headers: {
        'Cookie': `auth-token=${salesToken}`
      }
    };
    
    const salesComparisonResult = await makeRequest(salesComparisonOptions);
    console.log('Status:', salesComparisonResult.status);
    console.log('Response:', JSON.stringify(salesComparisonResult.data, null, 2).substring(0, 200) + '...\n');
    
    console.log('✓ All tests completed');
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run tests
testBudgetEndpoints();