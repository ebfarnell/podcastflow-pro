import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from './session-helper'
import { enforceSecurityPolicies } from '@/middleware/security-enforcement'

type ApiHandler = (request: NextRequest, context?: any) => Promise<NextResponse>

/**
 * Wraps an API handler with security enforcement
 * Checks organization security policies before allowing the request
 */
export function withSecurity(handler: ApiHandler): ApiHandler {
  return async (request: NextRequest, context?: any) => {
    try {
      // Get session
      const session = await getSessionFromCookie(request)
      
      if (!session) {
        // No session, let the handler deal with auth
        return handler(request, context)
      }

      // Enforce security policies
      const securityResponse = await enforceSecurityPolicies(request, session)
      
      if (securityResponse) {
        // Security check failed, return the response
        return securityResponse
      }

      // Security checks passed, call the handler
      return handler(request, context)
    } catch (error) {
      console.error('Security wrapper error:', error)
      // On error, let the request through
      return handler(request, context)
    }
  }
}