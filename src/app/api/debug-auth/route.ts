import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


export async function GET(request: NextRequest) {
  const cookieStore = cookies()
  const authToken = cookieStore.get('auth-token')
  
  return NextResponse.json({
    hasAuthToken: !!authToken,
    tokenValue: authToken ? 'REDACTED' : null,
    tokenName: authToken?.name,
    path: request.nextUrl.pathname,
    allCookies: cookieStore.getAll().map(c => ({ name: c.name, hasValue: !!c.value }))
  })
}
