import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { CognitoJwtVerifier } from 'aws-jwt-verify'
import prisma from '@/lib/db/prisma'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'
const AUTH_PROVIDER = process.env.AUTH_PROVIDER || 'custom' // 'cognito' or 'custom'

// Cognito configuration
const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || ''
const COGNITO_CLIENT_ID = process.env.COGNITO_CLIENT_ID || ''
const COGNITO_REGION = process.env.COGNITO_REGION || 'us-east-1'

// Create Cognito verifier if using Cognito
let cognitoVerifier: any = null
if (AUTH_PROVIDER === 'cognito' && COGNITO_USER_POOL_ID && COGNITO_CLIENT_ID) {
  cognitoVerifier = CognitoJwtVerifier.create({
    userPoolId: COGNITO_USER_POOL_ID,
    tokenUse: 'access',
    clientId: COGNITO_CLIENT_ID,
  })
}

export interface AuthUser {
  id: string
  email: string
  name: string
  role: 'admin' | 'sales' | 'producer' | 'talent' | 'client'
  organizationId?: string
  permissions?: string[]
}

export async function verifyAuth(request: NextRequest): Promise<AuthUser | null> {
  try {
    // Get token from Authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null
    }

    const token = authHeader.substring(7)

    if (AUTH_PROVIDER === 'cognito' && cognitoVerifier) {
      // Verify Cognito token
      try {
        const payload = await cognitoVerifier.verify(token)
        
        // Extract user info from Cognito token
        return {
          id: payload.sub,
          email: payload.email || payload['cognito:username'],
          name: payload.name || payload['cognito:username'],
          role: payload['custom:role'] || 'client',
          organizationId: payload['custom:organizationId'],
          permissions: payload['custom:permissions']?.split(',') || [],
        }
      } catch (error) {
        console.error('Cognito token verification failed:', error)
        return null
      }
    } else {
      // Verify custom JWT token
      try {
        const payload = jwt.verify(token, JWT_SECRET) as any
        
        // Check token expiration
        if (payload.exp && Date.now() >= payload.exp * 1000) {
          return null
        }

        return {
          id: payload.id || payload.sub,
          email: payload.email,
          name: payload.name,
          role: payload.role || 'client',
          organizationId: payload.organizationId,
          permissions: payload.permissions || [],
        }
      } catch (error) {
        console.error('JWT verification failed:', error)
        return null
      }
    }
  } catch (error) {
    console.error('Auth verification error:', error)
    return null
  }
}

export function requireAuth(allowedRoles?: string[]) {
  return async function middleware(request: NextRequest) {
    const user = await verifyAuth(request)
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check role permissions if specified
    if (allowedRoles && !allowedRoles.includes(user.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Add user to request headers for use in route handlers
    const headers = new Headers(request.headers)
    headers.set('x-user-id', user.id)
    headers.set('x-user-email', user.email)
    headers.set('x-user-role', user.role)
    headers.set('x-user-name', user.name)
    if (user.organizationId) {
      headers.set('x-organization-id', user.organizationId)
    }

    return NextResponse.next({
      request: {
        headers,
      },
    })
  }
}

// Helper to get user from request in route handlers
export function getUserFromRequest(request: NextRequest): AuthUser | null {
  const userId = request.headers.get('x-user-id')
  const userEmail = request.headers.get('x-user-email')
  const userRole = request.headers.get('x-user-role') as AuthUser['role']
  const userName = request.headers.get('x-user-name')
  const organizationId = request.headers.get('x-organization-id')

  if (!userId || !userEmail || !userRole || !userName) {
    return null
  }

  return {
    id: userId,
    email: userEmail,
    name: userName,
    role: userRole,
    organizationId: organizationId || undefined,
  }
}

// Generate JWT token for custom auth
export function generateToken(user: AuthUser): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
      permissions: user.permissions,
    },
    JWT_SECRET,
    {
      expiresIn: '8h', // 8 hour expiration as requested
    }
  )
}