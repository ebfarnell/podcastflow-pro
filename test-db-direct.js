const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://podcastflow:PodcastFlow2025Prod@localhost:5432/podcastflow_production"
    }
  },
  log: ['error', 'warn']
})

async function testDb() {
  try {
    console.log('Testing direct Prisma connection...')
    
    // Test basic connection
    const userCount = await prisma.user.count()
    console.log('✅ Database connection works, user count:', userCount)
    
    // Test finding a specific user
    const testUser = await prisma.user.findFirst({
      where: { email: 'admin@podcastflow.pro' },
      include: { organization: true }
    })
    console.log('✅ User query works:', testUser ? 'User found' : 'User not found')
    
    if (testUser) {
      console.log('User details:', { 
        id: testUser.id, 
        email: testUser.email, 
        isActive: testUser.isActive,
        organizationId: testUser.organizationId
      })
    }
    
  } catch (error) {
    console.error('❌ Database test failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testDb()