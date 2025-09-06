#!/usr/bin/env node

const https = require('https');
const http = require('http');

async function login() {
  const response = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@podcastflow.pro',
      password: 'admin123'
    })
  });
  const data = await response.json();
  return response.headers.get('set-cookie');
}

async function testAudienceData() {
  console.log('=== Testing Audience Tab Data Sources ===\n');
  
  const cookie = await login();
  if (!cookie) {
    console.log('Failed to login');
    return;
  }

  // Test audience data endpoint (category type)
  console.log('1. Testing /api/analytics/audience?type=category');
  const audienceResponse = await fetch('http://localhost:3000/api/analytics/audience?type=category', {
    headers: { 'Cookie': cookie }
  });
  const audienceData = await audienceResponse.json();
  console.log('Response:', JSON.stringify(audienceData, null, 2));
  
  console.log('\n2. Testing /api/analytics/audience/insights');
  const insightsResponse = await fetch('http://localhost:3000/api/analytics/audience/insights?timeRange=30d', {
    headers: { 'Cookie': cookie }
  });
  const insightsData = await insightsResponse.json();
  
  // Show what data is being returned
  console.log('Insights Response (summary):');
  console.log('- avgListeningDuration:', insightsData.avgListeningDuration);
  console.log('- completionRate:', insightsData.completionRate);
  console.log('- returnListenerRate:', insightsData.returnListenerRate);
  console.log('- bingeBehavior:', insightsData.bingeBehavior);
  console.log('- topCategories:', insightsData.topCategories);
  console.log('- topMarkets:', insightsData.topMarkets);
  console.log('- listeningDevices:', insightsData.listeningDevices);
  console.log('- platformDistribution:', insightsData.platformDistribution);
  
  console.log('\n=== Summary ===');
  console.log('The Audience tab is showing:');
  console.log('1. PIE CHART: Show categories distribution (from actual shows in DB)');
  console.log('2. INSIGHTS PANEL:');
  console.log('   - Some real data: topCategories, topMarkets (from actual DB data)');
  console.log('   - Some empty/zero data: listeningDevices, platformDistribution (now returning empty)');
  console.log('   - Some calculated metrics: bingeBehavior, contentVelocity (calculated from shows/episodes)');
}

testAudienceData().catch(console.error);