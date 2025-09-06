const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

async function testDirectSES() {
  console.log('🧪 Testing Direct SES Email to eric@unfy.com');
  console.log('===============================================');
  
  const sesClient = new SESClient({ 
    region: 'us-east-1'
  });
  
  const emailParams = {
    Destination: {
      ToAddresses: ['eric@unfy.com']
    },
    Message: {
      Body: {
        Html: { 
          Data: `
            <h1>🎧 PodcastFlow Pro Invitation</h1>
            <p>Hi Eric,</p>
            <p>You have been invited to join PodcastFlow Pro!</p>
            <p>This is a test to see if emails are being delivered.</p>
            <p>Best regards,<br>PodcastFlow Pro Team</p>
          `,
          Charset: 'UTF-8' 
        },
        Text: { 
          Data: 'You have been invited to join PodcastFlow Pro! This is a test email.',
          Charset: 'UTF-8' 
        }
      },
      Subject: { 
        Data: '🎧 PodcastFlow Pro Invitation - Direct Test',
        Charset: 'UTF-8' 
      }
    },
    Source: 'noreply@podcastflow.pro'
  };
  
  try {
    console.log('📧 Attempting to send email...');
    console.log(`📍 From: ${emailParams.Source}`);
    console.log(`📍 To: ${emailParams.Destination.ToAddresses[0]}`);
    
    const command = new SendEmailCommand(emailParams);
    const result = await sesClient.send(command);
    
    console.log('✅ SUCCESS! Email sent');
    console.log(`📨 Message ID: ${result.MessageId}`);
    
    return { success: true, messageId: result.MessageId };
    
  } catch (error) {
    console.log('❌ FAILED to send email');
    console.log(`📋 Error: ${error.message}`);
    
    if (error.message.includes('Email address not verified')) {
      console.log('🔧 This is expected - you are still in sandbox mode');
      console.log('📞 Wait for AWS production access approval');
    }
    
    return { success: false, error: error.message };
  }
}

testDirectSES().then(result => {
  console.log('===============================================');
  if (result.success) {
    console.log('🎉 Email delivery is working!');
  } else {
    console.log('⚠️  Email delivery blocked by sandbox mode');
  }
}).catch(console.error);