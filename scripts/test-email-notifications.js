#!/usr/bin/env node

/**
 * Test script for email notification system
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// Import services after build
let notificationService
let emailEventHandler

async function loadServices() {
  const notificationModule = await import('../.next/server/chunks/notification-service.js')
  const emailModule = await import('../.next/server/chunks/event-handler.js')
  
  notificationService = notificationModule.notificationService
  emailEventHandler = emailModule.emailEventHandler
}

async function testEmailNotifications() {
  console.log('🧪 Testing Email Notification System...\n')
  
  try {
    // Load services
    await loadServices()
    
    // Get a test user
    const testUser = await prisma.user.findFirst({
      where: {
        email: 'admin@podcastflow.pro',
        isActive: true
      }
    })
    
    if (!testUser) {
      console.error('❌ Test user not found')
      return
    }
    
    console.log(`📧 Testing with user: ${testUser.email}\n`)
    
    // Test 1: Task Assignment
    console.log('1️⃣ Testing Task Assignment Notification...')
    const taskResult = await notificationService.notifyTaskAssignment(
      testUser.id,
      {
        id: 'test-task-123',
        title: 'Complete Podcast Upload',
        description: 'Upload episode 45 of the Tech Talk podcast',
        priority: 'high',
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) // 2 days from now
      },
      testUser.id, // assigned by same user for testing
      false // Don't actually send email
    )
    console.log(`   Result: ${taskResult ? '✅ Success' : '❌ Failed'}\n`)
    
    // Test 2: Direct Email Event
    console.log('2️⃣ Testing Direct Email Event (Payment Reminder)...')
    const emailResult = await emailEventHandler.handleEvent({
      type: 'payment_reminder',
      recipients: [testUser.email],
      organizationId: testUser.organizationId,
      data: {
        clientName: testUser.firstName || 'Valued Client',
        invoiceNumber: 'INV-2025-001',
        amountDue: '$5,000.00',
        dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toLocaleDateString(),
        daysOverdue: 2,
        isOverdue: true,
        paymentLink: 'https://app.podcastflow.pro/invoices/test-123/pay'
      }
    })
    console.log(`   Result: ${emailResult ? '✅ Success' : '❌ Failed'}\n`)
    
    // Test 3: Bulk Notification
    console.log('3️⃣ Testing Bulk Campaign Status Notification...')
    const bulkResult = await notificationService.notifyCampaignStatusChange(
      [testUser.id],
      {
        id: 'test-campaign-456',
        name: 'Summer Podcast Sponsorship'
      },
      'draft',
      'active',
      testUser.id,
      'Campaign approved and launched successfully',
      false // Don't actually send email
    )
    console.log(`   Result: ${bulkResult > 0 ? '✅ Success' : '❌ Failed'}\n`)
    
    // Test 4: Check Email Queue
    console.log('4️⃣ Checking Email Queue...')
    const queuedEmails = await prisma.emailQueue.count({
      where: {
        status: 'pending',
        organizationId: testUser.organizationId
      }
    })
    console.log(`   Queued emails: ${queuedEmails}\n`)
    
    // Test 5: Check Notifications
    console.log('5️⃣ Checking In-App Notifications...')
    const notifications = await prisma.notification.findMany({
      where: {
        userId: testUser.id,
        createdAt: {
          gte: new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    })
    
    console.log(`   Recent notifications: ${notifications.length}`)
    notifications.forEach(n => {
      console.log(`   - ${n.type}: ${n.title}`)
    })
    
    console.log('\n✅ Email notification tests completed!')
    console.log('\n📝 Note: Emails are queued. Run the queue processor to send them.')
    console.log('   You can also check the EmailQueue and EmailLog tables.')
    
  } catch (error) {
    console.error('❌ Test failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Direct test without service imports
async function directDatabaseTest() {
  console.log('\n📊 Direct Database Test...')
  
  try {
    // Check email templates
    const templates = await prisma.emailTemplate.count({
      where: {
        organizationId: null,
        isSystemDefault: true
      }
    })
    console.log(`   System email templates: ${templates}`)
    
    // Create a test notification
    const testUser = await prisma.user.findFirst({
      where: { email: 'admin@podcastflow.pro' }
    })
    
    if (testUser) {
      const notification = await prisma.notification.create({
        data: {
          title: 'Test Email Notification System',
          message: 'This is a test of the email notification system',
          type: 'system_maintenance',
          userId: testUser.id,
          actionUrl: '/notifications'
        }
      })
      console.log(`   Created test notification: ${notification.id}`)
      
      // Queue a test email
      const queueItem = await prisma.emailQueue.create({
        data: {
          organizationId: testUser.organizationId,
          userId: testUser.id,
          recipient: testUser.email,
          templateKey: 'payment-reminder',
          templateData: {
            clientName: testUser.firstName || 'Test User',
            invoiceNumber: 'TEST-001',
            amountDue: '$100.00',
            dueDate: new Date().toLocaleDateString(),
            isOverdue: false,
            paymentLink: 'https://app.podcastflow.pro/test'
          },
          status: 'pending'
        }
      })
      console.log(`   Queued test email: ${queueItem.id}`)
    }
    
  } catch (error) {
    console.error('❌ Direct test failed:', error)
  }
}

// Run direct database test first
directDatabaseTest()
  .then(() => {
    console.log('\n💡 To send the queued emails, you need to:')
    console.log('   1. Ensure the email service is properly configured')
    console.log('   2. Run the email queue processor')
    console.log('   3. Check the EmailLog table for results')
  })
  .catch(console.error)
  .finally(() => prisma.$disconnect())