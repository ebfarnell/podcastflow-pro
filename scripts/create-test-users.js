const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function createTestUsers() {
  console.log('Creating test organization and users...')

  try {
    // Create default organization first
    let organization = await prisma.organization.findFirst({
      where: { name: 'PodcastFlow Pro' }
    })

    if (!organization) {
      organization = await prisma.organization.create({
        data: {
          name: 'PodcastFlow Pro',
          slug: 'podcastflow-pro',
          isActive: true
        }
      })
      console.log('✅ Created organization:', organization.name)
    } else {
      console.log('✅ Organization already exists:', organization.name)
    }

    // Test users to create
    const testUsers = [
      {
        email: 'michael@unfy.com',
        password: 'EMunfy2025',
        name: 'Michael (Master)',
        role: 'master'
      },
      {
        email: 'admin@podcastflow.pro',
        password: 'admin123',
        name: 'Admin User',
        role: 'admin'
      },
      {
        email: 'seller@podcastflow.pro',
        password: 'seller123',
        name: 'Sales User',
        role: 'sales'
      },
      {
        email: 'producer@podcastflow.pro',
        password: 'producer123',
        name: 'Producer User',
        role: 'producer'
      },
      {
        email: 'talent@podcastflow.pro',
        password: 'talent123',
        name: 'Talent User',
        role: 'talent'
      },
      {
        email: 'client@podcastflow.pro',
        password: 'client123',
        name: 'Client User',
        role: 'client'
      }
    ]

    for (const userData of testUsers) {
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: userData.email }
      })

      if (existingUser) {
        console.log(`⚠️  User already exists: ${userData.email}`)
        continue
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, 10)

      // Create user
      const user = await prisma.user.create({
        data: {
          email: userData.email,
          password: hashedPassword,
          name: userData.name,
          role: userData.role,
          organizationId: userData.role === 'master' ? null : organization.id,
          isActive: true,
          emailVerified: true
        }
      })

      console.log(`✅ Created user: ${user.email} (${user.role})`)
    }

    console.log('\n🎉 Test users created successfully!')
    console.log('\nLogin credentials:')
    testUsers.forEach(user => {
      console.log(`${user.role.toUpperCase()}: ${user.email} / ${user.password}`)
    })

  } catch (error) {
    console.error('❌ Error creating test users:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createTestUsers()