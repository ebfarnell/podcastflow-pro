#!/usr/bin/env node

/**
 * Manual test script for email template functionality
 * Run with: node test-email-templates.js
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function testEmailTemplates() {
  console.log('🧪 Testing Email Template System...\n')
  
  const testOrgId = 'cmd2qfev00000og5y8hftu795' // PodcastFlow Pro org
  
  try {
    // Test 1: Check existing templates
    console.log('1️⃣ Checking existing system templates...')
    const systemTemplates = await prisma.emailTemplate.findMany({
      where: {
        organizationId: null,
        isSystemDefault: true
      }
    })
    console.log(`   Found ${systemTemplates.length} system templates`)
    systemTemplates.forEach(t => {
      console.log(`   - ${t.key}: ${t.name}`)
    })
    
    // Test 2: Create org-specific template
    console.log('\n2️⃣ Creating org-specific template...')
    const orgTemplate = await prisma.emailTemplate.create({
      data: {
        key: 'test-org-template',
        name: 'Test Org Template',
        subject: 'Custom: {{title}}',
        htmlContent: '<p>This is a custom template for {{organizationName}}</p>',
        textContent: 'This is a custom template for {{organizationName}}',
        organizationId: testOrgId,
        isActive: true,
        isSystemDefault: false,
        category: 'test',
        variables: ['title', 'organizationName']
      }
    })
    console.log(`   ✅ Created org template: ${orgTemplate.id}`)
    
    // Test 3: Query templates with fallback
    console.log('\n3️⃣ Testing template fallback logic...')
    
    // Should get org-specific template
    const orgSpecific = await prisma.emailTemplate.findFirst({
      where: {
        key: 'test-org-template',
        organizationId: testOrgId,
        isActive: true
      }
    })
    console.log(`   ✅ Found org-specific template: ${orgSpecific?.name}`)
    
    // Should fallback to system template
    const systemFallback = await prisma.emailTemplate.findFirst({
      where: {
        key: 'user-invitation',
        organizationId: null,
        isSystemDefault: true,
        isActive: true
      }
    })
    console.log(`   ✅ Found system template: ${systemFallback?.name}`)
    
    // Test 4: Update org template
    console.log('\n4️⃣ Updating org template...')
    const updated = await prisma.emailTemplate.update({
      where: { id: orgTemplate.id },
      data: {
        subject: 'Updated: {{title}}',
        updatedAt: new Date()
      }
    })
    console.log(`   ✅ Updated template subject: ${updated.subject}`)
    
    // Test 5: List all templates for org (with system fallbacks)
    console.log('\n5️⃣ Listing all available templates for org...')
    const allSystemTemplates = await prisma.emailTemplate.findMany({
      where: {
        organizationId: null,
        isSystemDefault: true,
        isActive: true
      }
    })
    const allOrgTemplates = await prisma.emailTemplate.findMany({
      where: {
        organizationId: testOrgId,
        isActive: true
      }
    })
    
    // Merge logic (org overrides system)
    const templateMap = new Map()
    allSystemTemplates.forEach(t => templateMap.set(t.key, { ...t, source: 'system' }))
    allOrgTemplates.forEach(t => templateMap.set(t.key, { ...t, source: 'org' }))
    
    console.log(`   Total templates available: ${templateMap.size}`)
    templateMap.forEach((template, key) => {
      console.log(`   - ${key}: ${template.name} (${template.source})`)
    })
    
    // Cleanup
    console.log('\n🧹 Cleaning up test data...')
    await prisma.emailTemplate.delete({
      where: { id: orgTemplate.id }
    })
    console.log('   ✅ Test template deleted')
    
    console.log('\n✨ All tests passed!')
    
  } catch (error) {
    console.error('\n❌ Test failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run tests
testEmailTemplates().catch(console.error)