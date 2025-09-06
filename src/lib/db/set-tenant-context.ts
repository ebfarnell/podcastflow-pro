import { NextRequest } from 'next/server'
import prisma from '@/lib/db/prisma'
import { getSessionFromCookie } from '@/lib/auth/session-helper'

/**
 * Sets the database tenant context for the current request
 * This ensures all database operations are properly scoped to the user's organization
 */
export async function setTenantContext(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session || !session.userId || !session.organizationId) {
      return null
    }

    // Set the tenant context in the database
    await prisma.$executeRaw`
      SELECT set_config('app.current_user_id', ${session.userId}, false),
             set_config('app.current_org_id', ${session.organizationId}, false)
    `

    // Log the context setting for audit purposes
    console.log(`[Tenant Context] Set for user ${session.userId} in org ${session.organizationId}`)

    return session
  } catch (error) {
    console.error('[Tenant Context] Failed to set context:', error)
    return null
  }
}

/**
 * Clears the tenant context after request processing
 */
export async function clearTenantContext() {
  try {
    await prisma.$executeRaw`
      RESET app.current_user_id;
      RESET app.current_org_id;
    `
  } catch (error) {
    console.error('[Tenant Context] Failed to clear context:', error)
  }
}

/**
 * Wrapper for API routes that sets tenant context
 */
export async function withTenantContext<T>(
  request: NextRequest,
  handler: (session: any) => Promise<T>
): Promise<T> {
  const session = await setTenantContext(request)
  
  if (!session) {
    throw new Error('Unauthorized: No valid session')
  }

  try {
    return await handler(session)
  } finally {
    // Always clear context after request
    await clearTenantContext()
  }
}