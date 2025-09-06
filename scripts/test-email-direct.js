const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

async function testEmailDirect() {
  console.log('🧪 Testing AWS SES Email Delivery');
  console.log('=====================================');
  
  const sesClient = new SESClient({ 
    region: process.env.AWS_REGION || 'us-east-1'
  });
  
  const testEmail = {
    Destination: {
      ToAddresses: ['eric@unfy.com'] // The email you tried to invite
    },
    Message: {
      Body: {
        Html: { 
          Data: '<h1>🧪 Test Email from PodcastFlow Pro</h1><p>This is a test email to verify AWS SES is working properly.</p>',
          Charset: 'UTF-8' 
        },
        Text: { 
          Data: 'Test Email from PodcastFlow Pro - This is a test email to verify AWS SES is working properly.',
          Charset: 'UTF-8' 
        }
      },
      Subject: { 
        Data: '🧪 PodcastFlow Pro - Email Test',
        Charset: 'UTF-8' 
      }
    },
    Source: 'noreply@podcastflow.pro'
  };
  
  try {
    console.log('📧 Sending test email...');
    console.log(`📍 From: ${testEmail.Source}`);
    console.log(`📍 To: ${testEmail.Destination.ToAddresses[0]}`);
    console.log(`📍 Subject: ${testEmail.Message.Subject.Data}`);
    
    const command = new SendEmailCommand(testEmail);
    const result = await sesClient.send(command);
    
    console.log('✅ SUCCESS! Email sent successfully');
    console.log(`📨 Message ID: ${result.MessageId}`);
    console.log(`📊 HTTP Status: ${result.$metadata.httpStatusCode}`);
    
    return true;
  } catch (error) {
    console.log('❌ FAILED! Email sending error:');
    console.log('📋 Error details:');
    console.log(`   Name: ${error.name}`);
    console.log(`   Message: ${error.message}`);
    
    if (error.Code) {
      console.log(`   Code: ${error.Code}`);
    }
    
    if (error.$metadata) {
      console.log(`   HTTP Status: ${error.$metadata.httpStatusCode}`);
      console.log(`   Request ID: ${error.$metadata.requestId}`);
    }
    
    // Check for specific issues
    if (error.message.includes('Email address not verified')) {
      console.log('🔧 SOLUTION: Verify the sender email address (noreply@podcastflow.pro)');
      console.log('   Go to: https://console.aws.amazon.com/ses/#addresses');
    } else if (error.message.includes('Daily sending quota exceeded')) {
      console.log('🔧 SOLUTION: Request higher sending limits');
    } else if (error.message.includes('Invalid email address')) {
      console.log('🔧 SOLUTION: Check email address format');
    }
    
    return false;
  }
}

// Run the test
testEmailDirect()
  .then(success => {
    console.log('=====================================');
    if (success) {
      console.log('🎉 Email system is working correctly!');
      console.log('✅ Your invitation emails should be delivered');
    } else {
      console.log('🔧 Email system needs configuration');
      console.log('📋 Follow the solution steps above');
    }
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });