#!/usr/bin/env node

// Script to seed default email templates into the database

import { PrismaClient } from '@prisma/client'
import { defaultTemplates } from '../services/email/templates/default-templates'

const prisma = new PrismaClient()

async function seedEmailTemplates() {
  console.log('🌱 Starting email template seeding...')
  
  try {
    // Check if templates already exist
    const existingCount = await prisma.emailTemplate.count()
    
    if (existingCount > 0) {
      console.log(`⚠️  Found ${existingCount} existing templates. Updating...`)
    }
    
    let created = 0
    let updated = 0
    let errors = 0
    
    for (const template of defaultTemplates) {
      try {
        // Check if template exists
        const existing = await prisma.emailTemplate.findFirst({
          where: {
            key: template.key
          }
        })
        
        if (existing) {
          // Update existing template
          await prisma.emailTemplate.update({
            where: { id: existing.id },
            data: {
              name: template.name,
              description: template.description,
              subject: template.subject,
              htmlContent: template.htmlContent,
              textContent: template.textContent,
              variables: template.variables,
              category: template.category,
              isActive: true
            }
          })
          updated++
          console.log(`✅ Updated template: ${template.key}`)
        } else {
          // Create new template
          await prisma.emailTemplate.create({
            data: {
              key: template.key,
              name: template.name,
              description: template.description,
              subject: template.subject,
              htmlContent: template.htmlContent,
              textContent: template.textContent,
              variables: template.variables,
              category: template.category,
              isActive: true
            }
          })
          created++
          console.log(`✅ Created template: ${template.key}`)
        }
      } catch (error) {
        console.error(`❌ Error processing template ${template.key}:`, error)
        errors++
      }
    }
    
    console.log('\n📊 Seeding Summary:')
    console.log(`   Created: ${created} templates`)
    console.log(`   Updated: ${updated} templates`)
    console.log(`   Errors: ${errors}`)
    console.log(`   Total: ${defaultTemplates.length} templates`)
    
    if (errors === 0) {
      console.log('\n✨ Email template seeding completed successfully!')
    } else {
      console.log('\n⚠️  Email template seeding completed with errors.')
      process.exit(1)
    }
  } catch (error) {
    console.error('❌ Fatal error during seeding:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the seeder
seedEmailTemplates().catch((error) => {
  console.error('❌ Unhandled error:', error)
  process.exit(1)
})