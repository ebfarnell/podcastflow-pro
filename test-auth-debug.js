const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://podcastflow:PodcastFlow2025Prod@localhost:5432/podcastflow_production"
    }
  }
})

async function testAuth() {
  try {
    console.log('Testing database connection...')
    
    // Test basic connection
    const userCount = await prisma.user.count()
    console.log('User count:', userCount)
    
    // Test session query
    const sessions = await prisma.session.findMany({
      take: 1,
      include: { user: { include: { organization: true } } }
    })
    console.log('Session test:', sessions.length > 0 ? 'SUCCESS' : 'NO SESSIONS')
    
    if (sessions.length > 0) {
      console.log('Sample session:', {
        token: sessions[0].token.substring(0, 10) + '...',
        userId: sessions[0].user.id,
        userEmail: sessions[0].user.email,
        expired: sessions[0].expiresAt < new Date()
      })
    }
    
  } catch (error) {
    console.error('Database test failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testAuth()