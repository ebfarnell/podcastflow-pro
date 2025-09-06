import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'

export async function POST(request: NextRequest) {
  try {
    console.log('[TEST] Starting test report API')
    
    // Test 1: Get session
    const sessionData = await getSessionFromCookie(request)
    console.log('[TEST] Session retrieved:', !!sessionData)
    
    if (!sessionData) {
      return NextResponse.json({ error: 'No session' }, { status: 401 })
    }
    
    // Test 2: Extract properties without destructuring
    const userId = sessionData.userId
    const role = sessionData.role
    const organizationId = sessionData.organizationId
    
    console.log('[TEST] Properties extracted:', { userId: !!userId, role, organizationId: !!organizationId })
    
    // Test 3: Simple response
    return NextResponse.json({
      success: true,
      session: {
        userId,
        role,
        organizationId
      }
    })
    
  } catch (error: any) {
    console.error('[TEST] Error:', error.message)
    return NextResponse.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 })
  }
}