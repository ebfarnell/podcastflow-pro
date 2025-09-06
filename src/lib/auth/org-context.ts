import { NextRequest } from 'next/server'
import { getSession } from './session'
import prisma from '@/lib/db/prisma'

export interface OrgContext {
  userId: string
  userRole: string
  organizationId: string
  organizationSlug: string
  isMaster: boolean
}

// Get organization context from request
export async function getOrgContext(request: NextRequest): Promise<OrgContext | null> {
  const session = await getSession(request)
  if (!session) return null
  
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { organization: true }
  })
  
  if (!user || !user.organization) return null
  
  return {
    userId: user.id,
    userRole: user.role,
    organizationId: user.organizationId!,
    organizationSlug: user.organization.slug,
    isMaster: user.role === 'master'
  }
}

// Get organization from various sources
export async function getOrganizationFromRequest(
  request: NextRequest
): Promise<{ id: string; slug: string } | null> {
  // 1. Check for explicit org header (for master account)
  const orgHeader = request.headers.get('x-organization-slug')
  if (orgHeader) {
    const org = await prisma.organization.findUnique({
      where: { slug: orgHeader },
      select: { id: true, slug: true }
    })
    if (org) return org
  }
  
  // 2. Get from user's organization
  const context = await getOrgContext(request)
  if (context) {
    return {
      id: context.organizationId,
      slug: context.organizationSlug
    }
  }
  
  return null
}