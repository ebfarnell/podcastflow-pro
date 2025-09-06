import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

// Global test setup
beforeAll(async () => {
  console.log('🧪 Setting up test environment...')
  
  // Set test environment variables
  process.env.NODE_ENV = 'test'
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://podcastflow:PodcastFlow2025Prod@localhost:5432/podcastflow_test'
  process.env.NEXTAUTH_SECRET = 'test-secret-key-for-testing-only'
  
  try {
    // Reset test database
    await execAsync('npx prisma db push --force-reset')
    console.log('✅ Test database reset complete')
    
    // Run test seeds if needed
    // await execAsync('npx prisma db seed')
    
  } catch (error) {
    console.error('❌ Test setup failed:', error)
    throw error
  }
})

afterAll(async () => {
  console.log('🧹 Cleaning up test environment...')
  
  try {
    // Clean up test data
    await execAsync('npx prisma db push --force-reset')
    console.log('✅ Test cleanup complete')
  } catch (error) {
    console.warn('⚠️ Test cleanup warning:', error)
  }
})

// Global test timeout
jest.setTimeout(30000)