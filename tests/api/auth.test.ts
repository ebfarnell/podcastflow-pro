import { POST as loginPost } from '@/app/api/auth/login/route'
import { POST as logoutPost } from '@/app/api/auth/logout/route'
import { createTestUser, createAuthenticatedRequest, cleanupTestData } from '../helpers/test-utils'

describe('/api/auth', () => {
  let testUser: any
  let organizationId: string

  beforeEach(async () => {
    testUser = await createTestUser({
      email: 'auth-test@example.com',
      role: 'admin'
    })
    organizationId = testUser.organizationId
  })

  afterEach(async () => {
    if (organizationId) {
      await cleanupTestData(organizationId)
    }
  })

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const request = createAuthenticatedRequest('/api/auth/login', 'POST', {
        email: testUser.email,
        password: testUser.password
      })

      const response = await loginPost(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('success', true)
      expect(data).toHaveProperty('user')
      expect(data.user).toHaveProperty('email', testUser.email)
      expect(data.user).toHaveProperty('role', testUser.role)
      
      // Check for auth cookie in headers
      const setCookieHeader = response.headers.get('set-cookie')
      expect(setCookieHeader).toContain('auth-token=')
    })

    it('should reject invalid credentials', async () => {
      const request = createAuthenticatedRequest('/api/auth/login', 'POST', {
        email: testUser.email,
        password: 'wrongpassword'
      })

      const response = await loginPost(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data).toHaveProperty('error')
      expect(data.error).toContain('Invalid credentials')
    })

    it('should reject missing email', async () => {
      const request = createAuthenticatedRequest('/api/auth/login', 'POST', {
        password: testUser.password
      })

      const response = await loginPost(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toHaveProperty('error')
    })

    it('should reject missing password', async () => {
      const request = createAuthenticatedRequest('/api/auth/login', 'POST', {
        email: testUser.email
      })

      const response = await loginPost(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toHaveProperty('error')
    })

    it('should reject non-existent user', async () => {
      const request = createAuthenticatedRequest('/api/auth/login', 'POST', {
        email: 'nonexistent@example.com',
        password: 'password123'
      })

      const response = await loginPost(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data).toHaveProperty('error')
    })

    it('should reject inactive user', async () => {
      // Create inactive user
      const inactiveUser = await createTestUser({
        email: 'inactive@example.com',
        role: 'admin'
      })

      // Deactivate user
      const prisma = require('@/lib/db/prisma').default
      await prisma.user.update({
        where: { id: inactiveUser.id },
        data: { isActive: false }
      })

      const request = createAuthenticatedRequest('/api/auth/login', 'POST', {
        email: inactiveUser.email,
        password: inactiveUser.password
      })

      const response = await loginPost(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data).toHaveProperty('error')
      expect(data.error).toContain('inactive')

      // Cleanup
      await cleanupTestData(inactiveUser.organizationId)
    })
  })

  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      const request = createAuthenticatedRequest('/api/auth/logout', 'POST')

      const response = await logoutPost(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('success', true)
      expect(data).toHaveProperty('message')
      
      // Check for auth cookie removal
      const setCookieHeader = response.headers.get('set-cookie')
      expect(setCookieHeader).toContain('auth-token=')
      expect(setCookieHeader).toContain('Max-Age=0')
    })
  })
})