#!/usr/bin/env node

// Test email template sending
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testEmailTemplate() {
  try {
    console.log('Testing email template system...\n');
    
    // Create a test email queue entry
    const queueItem = await prisma.emailQueue.create({
      data: {
        organizationId: 'cmd2qfev00000og5y8hftu795', // PodcastFlow Pro
        recipient: 'michael@unfy.com',
        templateKey: 'user-invitation',
        templateData: {
          userName: 'Michael Smith',
          organizationName: 'PodcastFlow Pro',
          inviterName: 'System Admin',
          role: 'Admin',
          invitationUrl: 'https://app.podcastflow.pro/accept-invitation?token=test123'
        },
        priority: 10,
        scheduledFor: new Date(),
        status: 'pending'
      }
    });
    
    console.log('✅ Email queued successfully!');
    console.log('Queue ID:', queueItem.id);
    console.log('\nNow run the email queue processor to send the email:');
    console.log('curl -X POST http://localhost:3000/api/cron/email-queue -H "Authorization: Bearer podcastflow-cron-2025"');
    
  } catch (error) {
    console.error('❌ Failed to queue email:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testEmailTemplate();