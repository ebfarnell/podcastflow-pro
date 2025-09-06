import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { UserService } from '@/lib/auth/user-service'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


export async function GET(request: NextRequest) {
  const timestamp = new Date().toISOString()
  console.log('🔍 Test Auth State - Called at:', timestamp)
  
  // Check for referer to see where request came from
  const referer = request.headers.get('referer')
  console.log('🔍 Test Auth State - Referer:', referer)
  
  const cookieStore = cookies()
  const authToken = cookieStore.get('auth-token')
  
  console.log('🔍 Test Auth State - Cookie exists:', !!authToken)
  
  if (!authToken) {
    console.log('🔍 Test Auth State - No auth token in cookies')
    return NextResponse.json({
      timestamp,
      authenticated: false,
      reason: 'No auth-token cookie',
      referer
    })
  }
  
  try {
    const user = await UserService.validateSession(authToken.value)
    
    if (!user) {
      console.log('🔍 Test Auth State - Session validation failed')
      return NextResponse.json({
        timestamp,
        authenticated: false,
        reason: 'Session validation failed',
        referer
      })
    }
    
    console.log('🔍 Test Auth State - User authenticated:', user.email)
    return NextResponse.json({
      timestamp,
      authenticated: true,
      user: {
        email: user.email,
        role: user.role,
        organizationId: user.organizationId
      },
      referer
    })
  } catch (error) {
    console.log('🔍 Test Auth State - Error:', error)
    return NextResponse.json({
      timestamp,
      authenticated: false,
      reason: 'Error validating session',
      error: String(error),
      referer
    })
  }
}
