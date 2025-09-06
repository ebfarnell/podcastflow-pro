import { PrismaClient, UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting production seed...')

  // Create master organization
  const masterOrg = await prisma.organization.create({
    data: {
      name: 'PodcastFlow Master',
      slug: 'master',
    }
  })

  console.log('✅ Created master organization')

  // Create master admin user
  const hashedPassword = await bcrypt.hash('ChangeMeImmediately!', 10)
  
  const masterUser = await prisma.user.create({
    data: {
      email: 'admin@podcastflow.pro',
      password: hashedPassword,
      name: 'System Administrator',
      role: UserRole.master,
      organizationId: masterOrg.id,
      emailVerified: true,
    }
  })

  console.log('✅ Created master admin user')
  console.log('')
  console.log('🔐 Master Admin Credentials:')
  console.log('   Email: admin@podcastflow.pro')
  console.log('   Password: ChangeMeImmediately!')
  console.log('')
  console.log('⚠️  IMPORTANT: Change this password immediately after first login!')
  console.log('')
  console.log('📝 Next Steps:')
  console.log('1. Log in with the master admin account')
  console.log('2. Create your organization')
  console.log('3. Add users for your organization')
  console.log('4. Set up shows, advertisers, and campaigns')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })