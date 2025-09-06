const https = require('https');

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
async function login() {
  const options = {
    hostname: 'app.podcastflow.pro',
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  };
  
  const result = await makeRequest(options, { 
    email: 'admin@podcastflow.pro', 
    password: 'admin123' 
  });
  
  if (result.status === 200) {
    const setCookies = result.headers['set-cookie'];
    if (setCookies) {
      for (const cookie of setCookies) {
        if (cookie.includes('auth-token=')) {
          return cookie.split('auth-token=')[1].split(';')[0];
        }
      }
    }
  }
  throw new Error('Login failed');
}

async function testBudgetComparison() {
  try {
    const authToken = await login();
    console.log('Login successful\n');
    
    // Test budget comparison with different groupBy options
    const groupByOptions = ['month', 'year'];
    
    for (const groupBy of groupByOptions) {
      console.log(`\n=== TESTING BUDGET COMPARISON (groupBy: ${groupBy}) ===\n`);
      
      const options = {
        hostname: 'app.podcastflow.pro',
        path: `/api/budget/comparison?year=2025&groupBy=${groupBy}`,
        method: 'GET',
        headers: {
          'Cookie': `auth-token=${authToken}`
        }
      };
      
      const result = await makeRequest(options);
      
      if (result.status === 200) {
        const { comparison, summary } = result.data;
        
        console.log('Summary:');
        console.log(`- Total Current Budget: $${summary.totalCurrentBudget?.toLocaleString() || 0}`);
        console.log(`- Total Current Actual: $${summary.totalCurrentActual?.toLocaleString() || 0}`);
        console.log(`- Overall Variance: $${summary.overallVariance?.toLocaleString() || 0}`);
        
        if (comparison && comparison.length > 0) {
          console.log(`\nDetailed breakdown (${comparison.length} periods):`);
          comparison.forEach(period => {
            console.log(`${period.period}: Budget=$${period.currentBudget?.toLocaleString() || 0}, Actual=$${period.currentActual?.toLocaleString() || 0}`);
          });
        }
      } else {
        console.log('Error:', result.data);
      }
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testBudgetComparison();