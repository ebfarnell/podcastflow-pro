import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


export async function GET(request: NextRequest) {
  console.log('🍪 Cookie Test - Called at:', new Date().toISOString())
  
  const cookieStore = cookies()
  const authToken = cookieStore.get('auth-token')
  
  // Get all cookies
  const allCookies = cookieStore.getAll()
  
  console.log('🍪 Cookie Test - Auth token exists:', !!authToken)
  console.log('🍪 Cookie Test - All cookies:', allCookies.map(c => c.name))
  console.log('🍪 Cookie Test - Request headers:', request.headers.get('cookie'))
  
  return NextResponse.json({
    timestamp: new Date().toISOString(),
    hasAuthToken: !!authToken,
    authTokenValue: authToken ? authToken.value.substring(0, 20) + '...' : null,
    allCookieNames: allCookies.map(c => c.name),
    headerCookie: request.headers.get('cookie'),
    userAgent: request.headers.get('user-agent')
  })
}
