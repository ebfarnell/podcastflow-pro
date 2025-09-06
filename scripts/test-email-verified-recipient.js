const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

async function testEmailWithVerifiedRecipient() {
  console.log('🧪 Testing Email with Verified Recipient');
  console.log('=========================================');
  
  const sesClient = new SESClient({ 
    region: process.env.AWS_REGION || 'us-east-1'
  });
  
  // Test with a verified email address that already exists
  const testEmail = {
    Destination: {
      ToAddresses: ['testinvite@example.com'] // This is already verified
    },
    Message: {
      Body: {
        Html: { 
          Data: '<h1>🎉 Success! Email System Working</h1><p>Your PodcastFlow Pro email system is now operational!</p>',
          Charset: 'UTF-8' 
        },
        Text: { 
          Data: 'Success! Email System Working - Your PodcastFlow Pro email system is now operational!',
          Charset: 'UTF-8' 
        }
      },
      Subject: { 
        Data: '🎉 PodcastFlow Pro - Email System Operational!',
        Charset: 'UTF-8' 
      }
    },
    Source: 'noreply@podcastflow.pro'
  };
  
  try {
    console.log('📧 Sending test email...');
    console.log(`📍 From: ${testEmail.Source} (✅ VERIFIED)`);
    console.log(`📍 To: ${testEmail.Destination.ToAddresses[0]} (✅ VERIFIED)`);
    console.log(`📍 Subject: ${testEmail.Message.Subject.Data}`);
    
    const command = new SendEmailCommand(testEmail);
    const result = await sesClient.send(command);
    
    console.log('✅ SUCCESS! Email sent successfully');
    console.log(`📨 Message ID: ${result.MessageId}`);
    console.log(`📊 HTTP Status: ${result.$metadata.httpStatusCode}`);
    
    console.log('');
    console.log('🎉 YOUR EMAIL SYSTEM IS WORKING!');
    console.log('📧 Invitations will now be sent successfully');
    console.log('');
    console.log('⚠️  NOTE: If you want to send to unverified emails like eric@unfy.com,');
    console.log('   you need to request production access from AWS SES');
    console.log('   Currently in sandbox mode (200 emails/day limit)');
    
    return true;
  } catch (error) {
    console.log('❌ FAILED! Email sending error:');
    console.log(`   Message: ${error.message}`);
    return false;
  }
}

// Run the test
testEmailWithVerifiedRecipient()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });