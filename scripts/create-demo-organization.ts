import { PrismaClient } from '@prisma/client'
import { UserRole } from '@prisma/client'

const prisma = new PrismaClient()

async function createDemoOrganization() {
  try {
    // Check if demo organization already exists
    const existingOrg = await prisma.organization.findUnique({
      where: { slug: 'demo' }
    })

    if (existingOrg) {
      console.log('Demo organization already exists')
      
      // Update test accounts to use demo organization
      const testEmails = [
        'admin@podcastflow.pro',
        'seller@podcastflow.pro', 
        'producer@podcastflow.pro',
        'talent@podcastflow.pro',
        'client@podcastflow.pro'
      ]
      
      await prisma.user.updateMany({
        where: {
          email: { in: testEmails }
        },
        data: {
          organizationId: existingOrg.id
        }
      })
      
      console.log('Updated test accounts to use demo organization')
      return
    }

    // Create demo organization
    const demoOrg = await prisma.organization.create({
      data: {
        name: 'Demo Organization',
        slug: 'demo',
        isActive: true,
      }
    })

    console.log('Created demo organization:', demoOrg.name)

    // Update test accounts to use demo organization
    const testEmails = [
      'admin@podcastflow.pro',
      'seller@podcastflow.pro', 
      'producer@podcastflow.pro',
      'talent@podcastflow.pro',
      'client@podcastflow.pro'
    ]
    
    await prisma.user.updateMany({
      where: {
        email: { in: testEmails }
      },
      data: {
        organizationId: demoOrg.id
      }
    })
    
    console.log('✅ Demo organization created and test accounts updated!')
  } catch (error) {
    console.error('Error creating demo organization:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createDemoOrganization()