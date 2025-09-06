// Test the actual invitation system by calling your API
const fetch = require('node-fetch');

async function testInvitationSystem() {
  console.log('🧪 Testing PodcastFlow Pro Invitation System');
  console.log('=============================================');
  
  const testInvitation = {
    name: 'Test User',
    email: 'admin@podcastflow.pro', // Use a verified email
    role: 'client',
    phone: '555-123-4567'
  };
  
  try {
    console.log('📧 Sending invitation via API...');
    console.log(`📍 Name: ${testInvitation.name}`);
    console.log(`📍 Email: ${testInvitation.email}`);
    console.log(`📍 Role: ${testInvitation.role}`);
    
    const response = await fetch('http://localhost:3000/api/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer admin-token' // Your auth token
      },
      body: JSON.stringify(testInvitation)
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ SUCCESS! Invitation sent successfully');
      console.log('📋 Response:', JSON.stringify(data, null, 2));
      
      if (data.message.includes('sandbox')) {
        console.log('');
        console.log('🎉 EMAIL SYSTEM IS WORKING!');
        console.log('📧 Emails are being sent (logged to console in sandbox mode)');
        console.log('');
        console.log('🔓 To send to any email address (like eric@unfy.com):');
        console.log('   Request production access from AWS SES');
      }
      
      return true;
    } else {
      console.log('❌ FAILED! API error:');
      console.log('📋 Response:', JSON.stringify(data, null, 2));
      return false;
    }
    
  } catch (error) {
    console.log('❌ FAILED! Request error:');
    console.log(`   Message: ${error.message}`);
    return false;
  }
}

// Run the test
testInvitationSystem()
  .then(success => {
    console.log('=============================================');
    if (success) {
      console.log('🎉 Your invitation system is working!');
    } else {
      console.log('🔧 Check the error details above');
    }
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });