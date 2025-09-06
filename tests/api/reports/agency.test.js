// Simple test for agency report generation
const http = require('http');

async function makeRequest(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: body
        });
      });
    });
    
    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function testAgencyReport() {
  console.log('🧪 Testing Agency Report Generation\n');
  
  // Step 1: Login
  console.log('1. Testing login...');
  const loginResponse = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  }, {
    email: 'admin@podcastflow.pro',
    password: 'admin123'
  });
  
  if (loginResponse.statusCode !== 200) {
    console.error('❌ Login failed:', loginResponse.body);
    return;
  }
  
  const authCookie = loginResponse.headers['set-cookie']?.find(c => c.startsWith('auth-token='));
  if (!authCookie) {
    console.error('❌ No auth cookie received');
    return;
  }
  
  console.log('✅ Login successful\n');
  
  // Step 2: Get agencies
  console.log('2. Fetching agencies...');
  const agenciesResponse = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/agencies',
    method: 'GET',
    headers: {
      'Cookie': authCookie.split(';')[0]
    }
  });
  
  if (agenciesResponse.statusCode !== 200) {
    console.error('❌ Failed to fetch agencies:', agenciesResponse.body);
    return;
  }
  
  const agencies = JSON.parse(agenciesResponse.body);
  if (!agencies || agencies.length === 0) {
    console.log('⚠️ No agencies found');
    return;
  }
  
  const testAgency = agencies.find(a => a.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)) || agencies[0];
  console.log(`✅ Found ${agencies.length} agencies`);
  console.log(`   Testing with: ${testAgency.name} (${testAgency.id})\n`);
  
  // Step 3: Generate report
  console.log('3. Generating agency report...');
  const reportResponse = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/reports/agency',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': authCookie.split(';')[0]
    }
  }, {
    agencyId: testAgency.id,
    format: 'zip',
    includeSections: ['summary', 'monthly', 'weekly']
  });
  
  if (reportResponse.statusCode === 200) {
    console.log('✅ Report generated successfully!');
    console.log(`   Content-Type: ${reportResponse.headers['content-type']}`);
    console.log(`   Size: ${reportResponse.body.length} bytes`);
    console.log(`   Correlation ID: ${reportResponse.headers['x-correlation-id']}`);
    
    // Save report
    const fs = require('fs');
    fs.writeFileSync('/tmp/agency-report-test.zip', reportResponse.body);
    console.log('   Saved to: /tmp/agency-report-test.zip');
  } else {
    console.error('❌ Report generation failed:', reportResponse.body);
    try {
      const error = JSON.parse(reportResponse.body);
      console.error(`   Error Code: ${error.code}`);
      console.error(`   Message: ${error.message}`);
      console.error(`   Correlation ID: ${error.correlationId}`);
    } catch (e) {
      // Not JSON error
    }
  }
  
  console.log('\n✅ Test completed');
}

// Run test
testAgencyReport().catch(console.error);