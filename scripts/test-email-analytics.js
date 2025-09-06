#!/usr/bin/env node

/**
 * Test script to populate email metrics for analytics dashboard testing
 */

const { PrismaClient } = require('@prisma/client')
const { addDays, subDays } = require('date-fns')
const prisma = new PrismaClient()

async function populateTestMetrics() {
  console.log('📊 Populating test email metrics...\n')
  
  const testOrgId = 'cmd2qfev00000og5y8hftu795' // PodcastFlow Pro org
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  try {
    // Create metrics for the last 30 days
    for (let i = 0; i < 30; i++) {
      const date = subDays(today, i)
      date.setHours(0, 0, 0, 0)
      
      // Random metrics that vary by day
      const sent = Math.floor(Math.random() * 500) + 100
      const delivered = Math.floor(sent * (0.95 + Math.random() * 0.04))
      const opened = Math.floor(delivered * (0.15 + Math.random() * 0.25))
      const clicked = Math.floor(opened * (0.05 + Math.random() * 0.15))
      const bounced = Math.floor(sent * (0.01 + Math.random() * 0.03))
      const complained = Math.floor(delivered * (Math.random() * 0.002))
      const failed = sent - delivered - bounced
      
      await prisma.emailMetrics.upsert({
        where: {
          date_organizationId: {
            date,
            organizationId: testOrgId
          }
        },
        update: {
          sent,
          delivered,
          opened,
          clicked,
          bounced,
          complained,
          failed
        },
        create: {
          date,
          organizationId: testOrgId,
          sent,
          delivered,
          opened,
          clicked,
          bounced,
          complained,
          failed
        }
      })
      
      console.log(`✅ Created metrics for ${date.toDateString()}`)
    }
    
    // Create some email logs for template statistics
    const templates = [
      'user-invitation',
      'task-assignment',
      'payment-reminder',
      'campaign-status-update',
      'report-ready'
    ]
    
    console.log('\n📧 Creating email logs for template stats...')
    
    for (const templateKey of templates) {
      const count = Math.floor(Math.random() * 50) + 10
      
      for (let i = 0; i < count; i++) {
        const sentAt = subDays(today, Math.floor(Math.random() * 30))
        const delivered = Math.random() > 0.05
        const opened = delivered && Math.random() > 0.6
        const clicked = opened && Math.random() > 0.8
        const bounced = !delivered && Math.random() > 0.5
        
        await prisma.emailLog.create({
          data: {
            organizationId: testOrgId,
            toEmail: `test${i}@example.com`,
            fromEmail: 'noreply@podcastflow.pro',
            recipient: `test${i}@example.com`, // deprecated field
            subject: `Test Email - ${templateKey}`,
            templateKey,
            status: delivered ? 'delivered' : bounced ? 'bounced' : 'failed',
            messageId: `test-${templateKey}-${i}-${Date.now()}`,
            sentAt,
            deliveredAt: delivered ? addDays(sentAt, 0) : null,
            openedAt: opened ? addDays(sentAt, 1) : null,
            clickedAt: clicked ? addDays(sentAt, 1) : null,
            bouncedAt: bounced ? sentAt : null,
            bounceType: bounced ? (Math.random() > 0.5 ? 'Permanent' : 'Transient') : null
          }
        })
      }
      
      console.log(`✅ Created ${count} logs for ${templateKey}`)
    }
    
    // Add some suppression list entries
    console.log('\n🚫 Adding suppression list entries...')
    
    const suppressionEmails = [
      { email: 'bounce@example.com', reason: 'bounce' },
      { email: 'complaint1@example.com', reason: 'complaint' },
      { email: 'complaint2@example.com', reason: 'complaint' },
      { email: 'unsubscribed@example.com', reason: 'unsubscribe' },
      { email: 'manual@example.com', reason: 'manual' }
    ]
    
    for (const entry of suppressionEmails) {
      await prisma.emailSuppressionList.upsert({
        where: { email: entry.email },
        update: {},
        create: entry
      })
    }
    
    console.log(`✅ Added ${suppressionEmails.length} suppression entries`)
    
    // Summary
    const totalMetrics = await prisma.emailMetrics.count({
      where: { organizationId: testOrgId }
    })
    const totalLogs = await prisma.emailLog.count({
      where: { organizationId: testOrgId }
    })
    const totalSuppressed = await prisma.emailSuppressionList.count()
    
    console.log('\n📊 Summary:')
    console.log(`   - Email metrics: ${totalMetrics} days`)
    console.log(`   - Email logs: ${totalLogs} records`)
    console.log(`   - Suppression list: ${totalSuppressed} emails`)
    
    console.log('\n✨ Test data populated successfully!')
    console.log('   Visit /admin/email-analytics to view the dashboard')
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the script
populateTestMetrics().catch(console.error)