import { NextRequest } from 'next/server'
import { UserService } from './user-service'

export async function getSessionFromCookie(request: NextRequest) {
  const authToken = request.cookies.get('auth-token')
  if (!authToken) {
    return null
  }

  const user = await UserService.validateSession(authToken.value)
  if (!user) {
    return null
  }

  return {
    userId: user.id,
    organizationId: user.organizationId,
    organizationSlug: user.organization?.slug || null,
    role: user.role,
    user
  }
}