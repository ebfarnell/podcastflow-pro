import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { UserRole } from '@prisma/client'

const prisma = new PrismaClient()

async function createTestAccounts() {
  try {
    // Get the master organization
    const masterOrg = await prisma.organization.findFirst({
      where: { slug: 'master' }
    })

    if (!masterOrg) {
      console.error('Master organization not found!')
      return
    }

    // Test accounts to create
    const testAccounts = [
      { email: 'admin@podcastflow.pro', password: 'admin123', role: UserRole.admin, name: 'Admin User' },
      { email: 'seller@podcastflow.pro', password: 'seller123', role: UserRole.sales, name: 'Sales Representative' },
      { email: 'producer@podcastflow.pro', password: 'producer123', role: UserRole.producer, name: 'Show Producer' },
      { email: 'talent@podcastflow.pro', password: 'talent123', role: UserRole.talent, name: 'Podcast Host' },
      { email: 'client@podcastflow.pro', password: 'client123', role: UserRole.client, name: 'Client User' },
    ]

    for (const account of testAccounts) {
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: account.email }
      })

      if (existingUser) {
        console.log(`User ${account.email} already exists, skipping...`)
        continue
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(account.password, 10)

      // Create user
      const user = await prisma.user.create({
        data: {
          email: account.email,
          password: hashedPassword,
          name: account.name,
          role: account.role,
          organizationId: masterOrg.id,
          emailVerified: true,
        }
      })

      console.log(`Created test account: ${user.email} (${user.role})`)
    }

    console.log('✅ Test accounts created successfully!')
  } catch (error) {
    console.error('Error creating test accounts:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createTestAccounts()