import { GET as usersGet, POST as usersPost } from '@/app/api/users/route'
import { GET as userGet, PUT as userPut, DELETE as userDelete } from '@/app/api/users/[id]/route'
import { createTestUser, createTestSession, createAuthenticatedRequest, cleanupTestData, assertApiResponse, assertErrorResponse } from '../helpers/test-utils'

describe('/api/users', () => {
  let testUser: any
  let adminUser: any
  let sessionToken: string
  let adminSessionToken: string
  let organizationId: string

  beforeEach(async () => {
    adminUser = await createTestUser({
      email: 'admin-user-test@example.com',
      role: 'admin'
    })
    
    organizationId = adminUser.organizationId
    adminSessionToken = await createTestSession(adminUser.id)
    
    testUser = await createTestUser({
      email: 'regular-user-test@example.com',
      role: 'producer',
      organizationId // Same organization
    })
    
    sessionToken = await createTestSession(testUser.id)
  })

  afterEach(async () => {
    if (organizationId) {
      await cleanupTestData(organizationId)
    }
  })

  describe('GET /api/users', () => {
    it('should return users for authenticated user', async () => {
      const request = createAuthenticatedRequest('/api/users', 'GET', null, adminSessionToken)

      const response = await usersGet(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      assertApiResponse(data, ['users', 'total', 'timestamp'])
      expect(Array.isArray(data.users)).toBe(true)
      expect(data.users.length).toBeGreaterThan(0)
      
      const user = data.users[0]
      assertApiResponse(user, ['id', 'name', 'email', 'role', 'isActive'])
    })

    it('should filter users by organization', async () => {
      const request = createAuthenticatedRequest('/api/users', 'GET', null, adminSessionToken)

      const response = await usersGet(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      // All users should belong to the same organization
      expect(data.users.every((u: any) => u.organizationId === organizationId)).toBe(true)
    })

    it('should reject unauthenticated requests', async () => {
      const request = createAuthenticatedRequest('/api/users', 'GET')

      const response = await usersGet(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      assertErrorResponse(data, 401)
    })

    it('should handle pagination parameters', async () => {
      const request = createAuthenticatedRequest('/api/users?limit=1&offset=0', 'GET', null, adminSessionToken)

      const response = await usersGet(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.users.length).toBeLessThanOrEqual(1)
    })

    it('should handle role filter', async () => {
      const request = createAuthenticatedRequest('/api/users?role=admin', 'GET', null, adminSessionToken)

      const response = await usersGet(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      if (data.users.length > 0) {
        expect(data.users.every((u: any) => u.role === 'admin')).toBe(true)
      }
    })

    it('should handle search parameters', async () => {
      const request = createAuthenticatedRequest(`/api/users?search=${adminUser.email}`, 'GET', null, adminSessionToken)

      const response = await usersGet(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      if (data.users.length > 0) {
        expect(data.users.some((u: any) => u.email.includes(adminUser.email))).toBe(true)
      }
    })
  })

  describe('POST /api/users', () => {
    it('should create new user (admin only)', async () => {
      const newUser = {
        name: 'New Test User',
        email: 'newuser@example.com',
        role: 'producer',
        password: 'password123'
      }

      const request = createAuthenticatedRequest('/api/users', 'POST', newUser, adminSessionToken)

      const response = await usersPost(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      assertApiResponse(data, ['success', 'user'])
      expect(data.user.email).toBe(newUser.email)
      expect(data.user.role).toBe(newUser.role)
      expect(data.user.organizationId).toBe(organizationId)
    })

    it('should reject duplicate email', async () => {
      const duplicateUser = {
        name: 'Duplicate User',
        email: testUser.email, // Existing email
        role: 'producer',
        password: 'password123'
      }

      const request = createAuthenticatedRequest('/api/users', 'POST', duplicateUser, adminSessionToken)

      const response = await usersPost(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      assertErrorResponse(data, 400)
    })

    it('should reject invalid email format', async () => {
      const invalidUser = {
        name: 'Invalid User',
        email: 'not-an-email',
        role: 'producer',
        password: 'password123'
      }

      const request = createAuthenticatedRequest('/api/users', 'POST', invalidUser, adminSessionToken)

      const response = await usersPost(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      assertErrorResponse(data, 400)
    })

    it('should reject missing required fields', async () => {
      const incompleteUser = {
        name: 'Incomplete User'
        // Missing email, role, password
      }

      const request = createAuthenticatedRequest('/api/users', 'POST', incompleteUser, adminSessionToken)

      const response = await usersPost(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      assertErrorResponse(data, 400)
    })

    it('should reject invalid role', async () => {
      const invalidRoleUser = {
        name: 'Invalid Role User',
        email: 'invalidrole@example.com',
        role: 'invalid-role',
        password: 'password123'
      }

      const request = createAuthenticatedRequest('/api/users', 'POST', invalidRoleUser, adminSessionToken)

      const response = await usersPost(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      assertErrorResponse(data, 400)
    })

    it('should reject non-admin users', async () => {
      const newUser = {
        name: 'Unauthorized User',
        email: 'unauthorized@example.com',
        role: 'producer',
        password: 'password123'
      }

      const request = createAuthenticatedRequest('/api/users', 'POST', newUser, sessionToken) // Non-admin token

      const response = await usersPost(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      assertErrorResponse(data, 403)
    })
  })

  describe('GET /api/users/[id]', () => {
    it('should return specific user', async () => {
      const request = createAuthenticatedRequest(`/api/users/${testUser.id}`, 'GET', null, adminSessionToken)

      const response = await userGet(request, { params: { id: testUser.id } })
      const data = await response.json()

      expect(response.status).toBe(200)
      assertApiResponse(data, ['user'])
      expect(data.user.id).toBe(testUser.id)
      expect(data.user.email).toBe(testUser.email)
    })

    it('should return 404 for non-existent user', async () => {
      const fakeId = 'non-existent-id'
      const request = createAuthenticatedRequest(`/api/users/${fakeId}`, 'GET', null, adminSessionToken)

      const response = await userGet(request, { params: { id: fakeId } })
      const data = await response.json()

      expect(response.status).toBe(404)
      assertErrorResponse(data, 404)
    })

    it('should reject access to other organization users', async () => {
      // Create user in different organization
      const otherUser = await createTestUser({ email: 'other@example.com' })
      const otherSessionToken = await createTestSession(otherUser.id)

      const request = createAuthenticatedRequest(`/api/users/${testUser.id}`, 'GET', null, otherSessionToken)

      const response = await userGet(request, { params: { id: testUser.id } })
      const data = await response.json()

      expect(response.status).toBe(404)
      assertErrorResponse(data, 404)

      await cleanupTestData(otherUser.organizationId)
    })

    it('should allow users to view their own profile', async () => {
      const request = createAuthenticatedRequest(`/api/users/${testUser.id}`, 'GET', null, sessionToken)

      const response = await userGet(request, { params: { id: testUser.id } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.user.id).toBe(testUser.id)
    })
  })

  describe('PUT /api/users/[id]', () => {
    it('should update user (admin only)', async () => {
      const updates = {
        name: 'Updated User Name',
        role: 'sales'
      }

      const request = createAuthenticatedRequest(`/api/users/${testUser.id}`, 'PUT', updates, adminSessionToken)

      const response = await userPut(request, { params: { id: testUser.id } })
      const data = await response.json()

      expect(response.status).toBe(200)
      assertApiResponse(data, ['success', 'user'])
      expect(data.user.name).toBe(updates.name)
      expect(data.user.role).toBe(updates.role)
    })

    it('should allow users to update their own profile (limited fields)', async () => {
      const updates = {
        name: 'Self Updated Name'
        // Can't change role
      }

      const request = createAuthenticatedRequest(`/api/users/${testUser.id}`, 'PUT', updates, sessionToken)

      const response = await userPut(request, { params: { id: testUser.id } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.user.name).toBe(updates.name)
      expect(data.user.role).toBe(testUser.role) // Role unchanged
    })

    it('should reject email updates to existing email', async () => {
      const updates = {
        email: adminUser.email // Existing email
      }

      const request = createAuthenticatedRequest(`/api/users/${testUser.id}`, 'PUT', updates, adminSessionToken)

      const response = await userPut(request, { params: { id: testUser.id } })
      const data = await response.json()

      expect(response.status).toBe(400)
      assertErrorResponse(data, 400)
    })

    it('should reject invalid role updates', async () => {
      const updates = {
        role: 'invalid-role'
      }

      const request = createAuthenticatedRequest(`/api/users/${testUser.id}`, 'PUT', updates, adminSessionToken)

      const response = await userPut(request, { params: { id: testUser.id } })
      const data = await response.json()

      expect(response.status).toBe(400)
      assertErrorResponse(data, 400)
    })

    it('should reject unauthorized access to other users', async () => {
      // Create different organization user
      const otherUser = await createTestUser({ email: 'other@example.com' })
      const otherSessionToken = await createTestSession(otherUser.id)

      const updates = {
        name: 'Unauthorized Update'
      }

      const request = createAuthenticatedRequest(`/api/users/${testUser.id}`, 'PUT', updates, otherSessionToken)

      const response = await userPut(request, { params: { id: testUser.id } })
      const data = await response.json()

      expect(response.status).toBe(404)
      assertErrorResponse(data, 404)

      await cleanupTestData(otherUser.organizationId)
    })
  })

  describe('DELETE /api/users/[id]', () => {
    it('should delete user (admin only)', async () => {
      const request = createAuthenticatedRequest(`/api/users/${testUser.id}`, 'DELETE', null, adminSessionToken)

      const response = await userDelete(request, { params: { id: testUser.id } })
      const data = await response.json()

      expect(response.status).toBe(200)
      assertApiResponse(data, ['success', 'message'])

      // Verify user is deleted
      const verifyRequest = createAuthenticatedRequest(`/api/users/${testUser.id}`, 'GET', null, adminSessionToken)
      const verifyResponse = await userGet(verifyRequest, { params: { id: testUser.id } })
      
      expect(verifyResponse.status).toBe(404)
    })

    it('should reject self-deletion', async () => {
      const request = createAuthenticatedRequest(`/api/users/${adminUser.id}`, 'DELETE', null, adminSessionToken)

      const response = await userDelete(request, { params: { id: adminUser.id } })
      const data = await response.json()

      expect(response.status).toBe(400)
      assertErrorResponse(data, 400)
      expect(data.error).toContain('delete yourself')
    })

    it('should reject non-admin deletion attempts', async () => {
      const request = createAuthenticatedRequest(`/api/users/${adminUser.id}`, 'DELETE', null, sessionToken) // Non-admin

      const response = await userDelete(request, { params: { id: adminUser.id } })
      const data = await response.json()

      expect(response.status).toBe(403)
      assertErrorResponse(data, 403)
    })

    it('should return 404 for non-existent user', async () => {
      const fakeId = 'non-existent-user'
      const request = createAuthenticatedRequest(`/api/users/${fakeId}`, 'DELETE', null, adminSessionToken)

      const response = await userDelete(request, { params: { id: fakeId } })
      const data = await response.json()

      expect(response.status).toBe(404)
      assertErrorResponse(data, 404)
    })
  })

  describe('User role permissions', () => {
    it('should enforce role hierarchy in operations', async () => {
      // Create users with different roles
      const clientUser = await createTestUser({
        email: 'client@example.com',
        role: 'client',
        organizationId
      })
      const clientSessionToken = await createTestSession(clientUser.id)

      // Client should not be able to list all users
      const request = createAuthenticatedRequest('/api/users', 'GET', null, clientSessionToken)
      const response = await usersGet(request)
      const data = await response.json()

      // May succeed but with limited data or fail depending on implementation
      if (response.status === 200) {
        // Should only see own user or limited data
        expect(data.users.length).toBeLessThanOrEqual(1)
      } else {
        expect(response.status).toBe(403)
      }
    })

    it('should validate role-based access to user creation', async () => {
      const roles = ['client', 'talent', 'producer', 'sales']
      
      for (const role of roles) {
        const testRoleUser = await createTestUser({
          email: `${role}@example.com`,
          role,
          organizationId
        })
        const roleSessionToken = await createTestSession(testRoleUser.id)

        const newUser = {
          name: `New User by ${role}`,
          email: `new-by-${role}@example.com`,
          role: 'producer',
          password: 'password123'
        }

        const request = createAuthenticatedRequest('/api/users', 'POST', newUser, roleSessionToken)
        const response = await usersPost(request)

        // Only admin and master should be able to create users
        if (role === 'admin') {
          expect(response.status).toBe(201)
        } else {
          expect(response.status).toBe(403)
        }
      }
    })
  })

  describe('Password management', () => {
    it('should hash passwords when creating users', async () => {
      const newUser = {
        name: 'Password Test User',
        email: 'password-test@example.com',
        role: 'producer',
        password: 'plaintext-password'
      }

      const request = createAuthenticatedRequest('/api/users', 'POST', newUser, adminSessionToken)
      const response = await usersPost(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      // Password should not be returned in response
      expect(data.user).not.toHaveProperty('password')
      
      // Verify password is hashed in database
      const prisma = require('@/lib/db/prisma').default
      const dbUser = await prisma.user.findUnique({
        where: { email: newUser.email }
      })
      
      expect(dbUser?.password).toBeDefined()
      expect(dbUser?.password).not.toBe(newUser.password) // Should be hashed
      expect(dbUser?.password?.length).toBeGreaterThan(20) // Hashed passwords are longer
    })

    it('should not return password in user responses', async () => {
      const request = createAuthenticatedRequest(`/api/users/${testUser.id}`, 'GET', null, adminSessionToken)

      const response = await userGet(request, { params: { id: testUser.id } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.user).not.toHaveProperty('password')
    })
  })
})