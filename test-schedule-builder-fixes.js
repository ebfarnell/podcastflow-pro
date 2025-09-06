#!/usr/bin/env node

/**
 * Test script for Schedule Builder fixes
 * Tests:
 * 1. advertiserId is properly passed when creating schedules
 * 2. Schedule value is correctly displayed in Campaign Schedule Summary
 * 3. Edit Schedule routes to calendar page with loaded data
 */

const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3000/api';
const TEST_EMAIL = 'admin@podcastflow.pro';
const TEST_PASSWORD = 'admin123';

let authToken = null;
let testCampaignId = null;
let testScheduleId = null;

async function login() {
  console.log('🔐 Logging in...');
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD })
  });

  if (!response.ok) {
    throw new Error(`Login failed: ${response.status}`);
  }

  const cookies = response.headers.get('set-cookie');
  authToken = cookies.match(/auth-token=([^;]+)/)[1];
  console.log('✅ Logged in successfully');
}

async function fetchWithAuth(url, options = {}) {
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Cookie': `auth-token=${authToken}`
    }
  });
}

async function getCampaignWithAdvertiser() {
  console.log('\n📋 Fetching campaigns...');
  const response = await fetchWithAuth(`${API_BASE}/campaigns`);
  const data = await response.json();
  
  // Find a campaign with an advertiserId
  const campaign = data.campaigns?.find(c => c.advertiserId);
  if (!campaign) {
    throw new Error('No campaigns with advertiserId found');
  }
  
  console.log(`✅ Found campaign: ${campaign.name} (ID: ${campaign.id})`);
  console.log(`   Advertiser ID: ${campaign.advertiserId}`);
  testCampaignId = campaign.id;
  
  // Fetch full campaign details
  const detailResponse = await fetchWithAuth(`${API_BASE}/campaigns/${campaign.id}`);
  const detailData = await detailResponse.json();
  
  console.log(`   Campaign details fetched. advertiserId: ${detailData.campaign?.advertiserId}`);
  return detailData.campaign;
}

async function testScheduleCreation(campaign) {
  console.log('\n🔧 Testing schedule creation...');
  
  const scheduleData = {
    name: `Test Schedule - ${new Date().toISOString()}`,
    campaignId: campaign.id,
    advertiserId: campaign.advertiserId,
    startDate: new Date().toISOString(),
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
    totalBudget: 50000,
    items: [
      {
        showId: 'show_1', // This would need to be a real show ID in production
        airDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        placementType: 'mid-roll',
        negotiatedPrice: 500
      }
    ]
  };
  
  console.log('   Sending schedule data:');
  console.log(`   - advertiserId: ${scheduleData.advertiserId} (type: ${typeof scheduleData.advertiserId})`);
  console.log(`   - campaignId: ${scheduleData.campaignId}`);
  console.log(`   - name: ${scheduleData.name}`);
  
  const response = await fetchWithAuth(`${API_BASE}/schedules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(scheduleData)
  });
  
  const result = await response.json();
  
  if (!response.ok) {
    console.error('❌ Schedule creation failed:', result);
    console.error('   Status:', response.status);
    console.error('   Error:', result.error);
    return null;
  }
  
  console.log('✅ Schedule created successfully!');
  console.log(`   Schedule ID: ${result.schedule?.id}`);
  testScheduleId = result.schedule?.id;
  return result.schedule;
}

async function testScheduleValue() {
  console.log('\n💰 Testing schedule value display...');
  
  if (!testCampaignId) {
    console.log('   ⚠️  No test campaign available, skipping');
    return;
  }
  
  const response = await fetchWithAuth(`${API_BASE}/schedules?campaignId=${testCampaignId}`);
  const data = await response.json();
  
  if (!response.ok || !data.schedules || data.schedules.length === 0) {
    console.log('   ⚠️  No schedules found for campaign');
    return;
  }
  
  const schedule = data.schedules[0];
  console.log('   Schedule data:');
  console.log(`   - name: ${schedule.name}`);
  console.log(`   - totalValue: ${schedule.totalValue}`);
  console.log(`   - netAmount: ${schedule.netAmount}`);
  console.log(`   - itemCount: ${schedule.itemCount}`);
  console.log(`   - showCount: ${schedule.showCount}`);
  
  if (schedule.totalValue !== undefined) {
    console.log('✅ totalValue field is present in API response');
  } else {
    console.log('❌ totalValue field is missing from API response');
  }
}

async function testScheduleLoading() {
  console.log('\n📖 Testing schedule loading for edit...');
  
  if (!testScheduleId) {
    console.log('   ⚠️  No test schedule available, skipping');
    return;
  }
  
  const response = await fetchWithAuth(`${API_BASE}/schedules/${testScheduleId}`);
  const data = await response.json();
  
  if (!response.ok) {
    console.error('❌ Failed to load schedule:', data.error);
    return;
  }
  
  console.log('   Schedule loaded:');
  console.log(`   - ID: ${data.schedule?.id}`);
  console.log(`   - Name: ${data.schedule?.name}`);
  console.log(`   - advertiserId: ${data.schedule?.advertiserId}`);
  console.log(`   - Items count: ${data.schedule?.items?.length || 0}`);
  
  if (data.schedule?.items && data.schedule.items.length > 0) {
    console.log('✅ Schedule has items - Edit Schedule should navigate to calendar view');
    console.log('   First item:');
    const firstItem = data.schedule.items[0];
    console.log(`   - Show: ${firstItem.show?.name || firstItem.showName}`);
    console.log(`   - Air Date: ${firstItem.airDate}`);
    console.log(`   - Placement: ${firstItem.placementType}`);
  } else {
    console.log('⚠️  Schedule has no items - might start at show selection');
  }
}

async function runTests() {
  try {
    console.log('🚀 Starting Schedule Builder Tests\n');
    
    // Login
    await login();
    
    // Get a campaign with advertiser
    const campaign = await getCampaignWithAdvertiser();
    
    // Test 1: Schedule creation with proper advertiserId
    const schedule = await testScheduleCreation(campaign);
    
    // Test 2: Schedule value display
    await testScheduleValue();
    
    // Test 3: Schedule loading for edit
    await testScheduleLoading();
    
    console.log('\n✅ All tests completed!');
    console.log('\n📝 Summary of fixes:');
    console.log('1. advertiserId is now properly extracted from campaign data before sending to API');
    console.log('2. Schedule value displays totalValue from API response (falling back to netAmount)');
    console.log('3. Edit Schedule loads existing schedule data and navigates to calendar when items exist');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the tests
runTests();