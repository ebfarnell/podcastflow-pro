#!/usr/bin/env node

/**
 * Setup script for AWS SES bounce and complaint notifications via SNS
 * This script creates SNS topics and configures SES to send notifications
 */

const { 
  SNSClient, 
  CreateTopicCommand, 
  SubscribeCommand,
  SetTopicAttributesCommand 
} = require('@aws-sdk/client-sns')
const { 
  SESClient, 
  PutConfigurationSetEventDestinationCommand,
  CreateConfigurationSetCommand,
  GetConfigurationSetCommand
} = require('@aws-sdk/client-ses')

// Configuration
const AWS_REGION = process.env.AWS_REGION || 'us-east-1'
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://app.podcastflow.pro/api/webhooks/ses'
const CONFIGURATION_SET_NAME = 'podcastflow-notifications'
const SNS_TOPIC_NAME = 'podcastflow-ses-notifications'

// Initialize clients
const snsClient = new SNSClient({ region: AWS_REGION })
const sesClient = new SESClient({ region: AWS_REGION })

async function setupSNSTopic() {
  console.log('📋 Setting up SNS topic...')
  
  try {
    // Create SNS topic
    const createTopicResponse = await snsClient.send(
      new CreateTopicCommand({ Name: SNS_TOPIC_NAME })
    )
    
    const topicArn = createTopicResponse.TopicArn
    console.log(`✅ SNS topic created: ${topicArn}`)
    
    // Set topic attributes to allow SES to publish
    await snsClient.send(
      new SetTopicAttributesCommand({
        TopicArn: topicArn,
        AttributeName: 'Policy',
        AttributeValue: JSON.stringify({
          Version: '2012-10-17',
          Statement: [{
            Effect: 'Allow',
            Principal: {
              Service: 'ses.amazonaws.com'
            },
            Action: 'SNS:Publish',
            Resource: topicArn
          }]
        })
      })
    )
    
    console.log('✅ SNS topic policy configured')
    
    // Subscribe webhook to SNS topic
    const subscribeResponse = await snsClient.send(
      new SubscribeCommand({
        TopicArn: topicArn,
        Protocol: 'https',
        Endpoint: WEBHOOK_URL,
        Attributes: {
          RawMessageDelivery: 'false'
        }
      })
    )
    
    console.log(`✅ Webhook subscribed: ${subscribeResponse.SubscriptionArn}`)
    console.log(`⚠️  IMPORTANT: Check your webhook endpoint for subscription confirmation`)
    
    return topicArn
  } catch (error) {
    console.error('❌ Failed to setup SNS topic:', error)
    throw error
  }
}

async function setupSESConfigurationSet(topicArn) {
  console.log('\n📧 Setting up SES configuration set...')
  
  try {
    // Check if configuration set exists
    let configSetExists = false
    try {
      await sesClient.send(
        new GetConfigurationSetCommand({ ConfigurationSetName: CONFIGURATION_SET_NAME })
      )
      configSetExists = true
      console.log('ℹ️  Configuration set already exists')
    } catch (error) {
      if (error.name === 'ConfigurationSetDoesNotExist') {
        // Create configuration set
        await sesClient.send(
          new CreateConfigurationSetCommand({
            ConfigurationSet: { Name: CONFIGURATION_SET_NAME }
          })
        )
        console.log('✅ Configuration set created')
      } else {
        throw error
      }
    }
    
    // Add SNS event destination for bounces
    try {
      await sesClient.send(
        new PutConfigurationSetEventDestinationCommand({
          ConfigurationSetName: CONFIGURATION_SET_NAME,
          EventDestination: {
            Name: 'bounce-notifications',
            Enabled: true,
            SNSDestination: {
              TopicARN: topicArn
            },
            MatchingEventTypes: ['bounce', 'complaint', 'delivery', 'send', 'reject']
          }
        })
      )
      console.log('✅ Bounce and complaint notifications configured')
    } catch (error) {
      if (error.name === 'EventDestinationAlreadyExists') {
        console.log('ℹ️  Event destination already exists')
      } else {
        throw error
      }
    }
    
  } catch (error) {
    console.error('❌ Failed to setup SES configuration set:', error)
    throw error
  }
}

async function displayInstructions(topicArn) {
  console.log('\n🎉 Setup Complete!')
  console.log('\n📝 Next Steps:')
  console.log('1. Check your webhook endpoint for SNS subscription confirmation')
  console.log('2. Click the confirmation link in the SNS subscription email')
  console.log('3. Update your .env file with:')
  console.log(`   AWS_SES_TOPIC_ARN=${topicArn}`)
  console.log(`   SES_CONFIGURATION_SET=${CONFIGURATION_SET_NAME}`)
  console.log('\n4. Update your email service to use the configuration set:')
  console.log('   - The configuration set is already referenced in ses-provider.ts')
  console.log('   - All emails will automatically be tracked')
  console.log('\n5. Test the webhook:')
  console.log('   - Send a test email to a non-existent address to trigger a bounce')
  console.log('   - Check the EmailLog and EmailSuppressionList tables')
}

async function main() {
  console.log('🚀 PodcastFlow Pro - SES Notifications Setup')
  console.log(`Region: ${AWS_REGION}`)
  console.log(`Webhook URL: ${WEBHOOK_URL}`)
  console.log('-------------------------------------------\n')
  
  try {
    // Step 1: Setup SNS topic
    const topicArn = await setupSNSTopic()
    
    // Step 2: Setup SES configuration set
    await setupSESConfigurationSet(topicArn)
    
    // Step 3: Display instructions
    await displayInstructions(topicArn)
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message)
    process.exit(1)
  }
}

// Run the setup
main().catch(console.error)