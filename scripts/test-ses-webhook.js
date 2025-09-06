#!/usr/bin/env node

/**
 * Test script for SES webhook endpoint
 * Simulates bounce and complaint notifications
 */

const https = require('https')
const crypto = require('crypto')

// Configuration
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://app.podcastflow.pro/api/webhooks/ses'
const TEST_MESSAGE_ID = `test-${Date.now()}@email.amazonses.com`

// Test data
const testBounceNotification = {
  Type: 'Notification',
  MessageId: crypto.randomUUID(),
  TopicArn: process.env.AWS_SES_TOPIC_ARN || 'arn:aws:sns:us-east-1:123456789012:test-topic',
  Message: JSON.stringify({
    notificationType: 'Bounce',
    mail: {
      messageId: TEST_MESSAGE_ID,
      source: 'noreply@podcastflow.pro',
      timestamp: new Date().toISOString(),
      destination: ['test@example.com']
    },
    bounce: {
      bounceType: 'Permanent',
      bounceSubType: 'General',
      bouncedRecipients: [{
        emailAddress: 'test@example.com',
        status: '5.1.1',
        diagnosticCode: 'smtp; 550 5.1.1 <test@example.com>: Recipient address rejected: User unknown'
      }],
      timestamp: new Date().toISOString()
    }
  }),
  Timestamp: new Date().toISOString(),
  Signature: 'test-signature',
  SigningCertURL: 'https://sns.us-east-1.amazonaws.com/test.pem'
}

const testComplaintNotification = {
  Type: 'Notification',
  MessageId: crypto.randomUUID(),
  TopicArn: process.env.AWS_SES_TOPIC_ARN || 'arn:aws:sns:us-east-1:123456789012:test-topic',
  Message: JSON.stringify({
    notificationType: 'Complaint',
    mail: {
      messageId: TEST_MESSAGE_ID,
      source: 'noreply@podcastflow.pro',
      timestamp: new Date().toISOString(),
      destination: ['complainer@example.com']
    },
    complaint: {
      complaintFeedbackType: 'abuse',
      complainedRecipients: [{
        emailAddress: 'complainer@example.com'
      }],
      timestamp: new Date().toISOString()
    }
  }),
  Timestamp: new Date().toISOString(),
  Signature: 'test-signature',
  SigningCertURL: 'https://sns.us-east-1.amazonaws.com/test.pem'
}

async function sendTestNotification(notification, type) {
  return new Promise((resolve, reject) => {
    const url = new URL(WEBHOOK_URL)
    const data = JSON.stringify(notification)
    
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'x-amz-sns-message-type': 'Notification',
        'x-amz-sns-message-id': notification.MessageId,
        'x-amz-sns-topic-arn': notification.TopicArn
      }
    }
    
    const req = https.request(options, (res) => {
      let body = ''
      res.on('data', (chunk) => body += chunk)
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log(`✅ ${type} notification sent successfully`)
          console.log(`   Response: ${body}`)
          resolve()
        } else {
          console.error(`❌ ${type} notification failed: ${res.statusCode}`)
          console.error(`   Response: ${body}`)
          reject(new Error(`HTTP ${res.statusCode}`))
        }
      })
    })
    
    req.on('error', (error) => {
      console.error(`❌ ${type} notification error:`, error.message)
      reject(error)
    })
    
    req.write(data)
    req.end()
  })
}

async function checkDatabase() {
  console.log('\n📊 To verify the webhook processed correctly, run these queries:')
  console.log('\n-- Check EmailLog for bounces:')
  console.log(`SELECT * FROM "EmailLog" WHERE "messageId" = '${TEST_MESSAGE_ID}';`)
  console.log('\n-- Check suppression list:')
  console.log(`SELECT * FROM "EmailSuppressionList" WHERE email IN ('test@example.com', 'complainer@example.com');`)
  console.log('\n-- Check tracking events:')
  console.log(`SELECT * FROM "EmailTrackingEvent" WHERE "emailLogId" IN (SELECT id FROM "EmailLog" WHERE "messageId" = '${TEST_MESSAGE_ID}');`)
}

async function main() {
  console.log('🧪 Testing SES Webhook Endpoint')
  console.log(`Webhook URL: ${WEBHOOK_URL}`)
  console.log(`Test Message ID: ${TEST_MESSAGE_ID}`)
  console.log('----------------------------------------\n')
  
  try {
    // Test bounce notification
    console.log('📧 Sending test bounce notification...')
    await sendTestNotification(testBounceNotification, 'Bounce')
    
    // Wait a moment between requests
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Test complaint notification
    console.log('\n📧 Sending test complaint notification...')
    await sendTestNotification(testComplaintNotification, 'Complaint')
    
    // Display database check instructions
    await checkDatabase()
    
    console.log('\n✅ All tests completed!')
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message)
    process.exit(1)
  }
}

// Run the test
main().catch(console.error)