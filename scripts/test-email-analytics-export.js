#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const path = require('path')

const prisma = new PrismaClient()

async function testEmailAnalyticsExport() {
  console.log('🧪 Testing Email Analytics Export...\n')
  
  try {
    // Get a test session
    const session = await prisma.session.findFirst({
      where: {
        user: {
          email: 'admin@podcastflow.pro',
          role: 'admin'
        }
      },
      include: { user: true },
      orderBy: { createdAt: 'desc' }
    })
    
    if (!session) {
      console.error('❌ No admin session found. Please login first.')
      return
    }
    
    console.log(`✅ Using session for ${session.user.email}`)
    
    // Test CSV export endpoints
    const baseUrl = 'http://localhost:3000'
    const authHeader = { 'Cookie': `auth-token=${session.token}` }
    
    // Test analytics endpoint
    console.log('\n📊 Testing analytics endpoint...')
    const analyticsRes = await fetch(`${baseUrl}/api/email/analytics?startDate=2025-06-27T00:00:00.000Z&endDate=2025-07-27T00:00:00.000Z&groupBy=day`, {
      headers: authHeader
    })
    
    if (!analyticsRes.ok) {
      console.error(`❌ Analytics endpoint failed: ${analyticsRes.status}`)
      const error = await analyticsRes.text()
      console.error(error)
      return
    }
    
    const analytics = await analyticsRes.json()
    console.log('✅ Analytics data retrieved:')
    console.log(`   - Total Sent: ${analytics.summary.totalSent}`)
    console.log(`   - Delivery Rate: ${analytics.summary.deliveryRate.toFixed(2)}%`)
    console.log(`   - Open Rate: ${analytics.summary.openRate.toFixed(2)}%`)
    console.log(`   - Templates: ${analytics.templates.length}`)
    
    // Test PDF export endpoint
    console.log('\n📄 Testing PDF export...')
    const pdfRes = await fetch(`${baseUrl}/api/email/analytics/export`, {
      method: 'POST',
      headers: {
        ...authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        format: 'pdf',
        data: analytics,
        dateRange: { days: 30, groupBy: 'day' }
      })
    })
    
    if (!pdfRes.ok) {
      console.error(`❌ PDF export failed: ${pdfRes.status}`)
      const error = await pdfRes.text()
      console.error(error)
      return
    }
    
    console.log('✅ PDF export successful')
    console.log(`   - Content-Type: ${pdfRes.headers.get('content-type')}`)
    console.log(`   - Size: ${pdfRes.headers.get('content-length')} bytes`)
    
    // Save PDF to test output
    const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer())
    const outputPath = path.join(__dirname, `test-email-report-${new Date().toISOString().split('T')[0]}.pdf`)
    fs.writeFileSync(outputPath, pdfBuffer)
    console.log(`   - Saved to: ${outputPath}`)
    
    console.log('\n✅ All tests passed!')
    
  } catch (error) {
    console.error('❌ Test failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the test
testEmailAnalyticsExport().catch(console.error)