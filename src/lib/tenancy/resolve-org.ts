/**
 * Tenant Resolution Utility
 * 
 * Resolves organization slug from various sources to ensure proper tenant isolation.
 * This is critical for multi-tenant data access and security.
 */

import { NextRequest } from 'next/server'
import prisma from '@/lib/db/prisma'
import { getSessionFromCookie } from '@/lib/auth/session-helper'

interface ResolveOptions {
  showId?: string
  orgId?: string
  episodeId?: string
  campaignId?: string
}

/**
 * Resolve organization slug from multiple sources
 * 
 * Priority order:
 * 1. Session organizationSlug
 * 2. Organization ID from session/JWT mapped to slug
 * 3. Show/Episode/Campaign ID mapped via platform index
 * 4. X-Org-Slug header (trusted internal only)
 * 
 * @param req - Next.js request object
 * @param options - Additional context for resolution
 * @returns Organization slug or throws error
 */
export async function resolveOrgSlug(
  req: NextRequest,
  options: ResolveOptions = {}
): Promise<string> {
  try {
    // 1. Try session first
    const session = await getSessionFromCookie(req)
    
    if (session?.organizationSlug) {
      console.log('Resolved org slug from session:', session.organizationSlug)
      return session.organizationSlug
    }
    
    // 2. Try organization ID from session
    if (session?.organizationId) {
      const org = await prisma.organization.findUnique({
        where: { id: session.organizationId },
        select: { slug: true }
      })
      
      if (org?.slug) {
        console.log('Resolved org slug from org ID:', org.slug)
        return org.slug
      }
    }
    
    // 3. Try to resolve from entity IDs
    // This requires a platform-level index table or cross-schema query
    
    if (options.showId) {
      // Check known organization schemas for this show ID
      const schemas = ['org_podcastflow_pro', 'org_unfy']
      
      for (const schema of schemas) {
        try {
          const result = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
            `SELECT COUNT(*) as count FROM ${schema}."Show" WHERE id = $1`,
            options.showId
          )
          
          if (result[0]?.count > 0) {
            const orgSlug = schema.replace('org_', '').replace('_', '-')
            console.log(`Resolved org slug from showId ${options.showId}:`, orgSlug)
            return orgSlug
          }
        } catch (error) {
          // Schema might not exist or show might not be in this schema
          continue
        }
      }
    }
    
    if (options.episodeId) {
      // Similar check for episode ID
      const schemas = ['org_podcastflow_pro', 'org_unfy']
      
      for (const schema of schemas) {
        try {
          const result = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
            `SELECT COUNT(*) as count FROM ${schema}."Episode" WHERE id = $1`,
            options.episodeId
          )
          
          if (result[0]?.count > 0) {
            const orgSlug = schema.replace('org_', '').replace('_', '-')
            console.log(`Resolved org slug from episodeId ${options.episodeId}:`, orgSlug)
            return orgSlug
          }
        } catch (error) {
          continue
        }
      }
    }
    
    if (options.campaignId) {
      // Check for campaign ID
      const schemas = ['org_podcastflow_pro', 'org_unfy']
      
      for (const schema of schemas) {
        try {
          const result = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
            `SELECT COUNT(*) as count FROM ${schema}."Campaign" WHERE id = $1`,
            options.campaignId
          )
          
          if (result[0]?.count > 0) {
            const orgSlug = schema.replace('org_', '').replace('_', '-')
            console.log(`Resolved org slug from campaignId ${options.campaignId}:`, orgSlug)
            return orgSlug
          }
        } catch (error) {
          continue
        }
      }
    }
    
    // 4. Last resort - check for trusted internal header
    // Only for internal service-to-service calls
    const orgSlugHeader = req.headers.get('x-org-slug')
    if (orgSlugHeader) {
      // Validate this is from a trusted source (e.g., internal IP, specific API key)
      const internalApiKey = req.headers.get('x-internal-api-key')
      if (internalApiKey === process.env.INTERNAL_API_KEY) {
        console.log('Resolved org slug from trusted header:', orgSlugHeader)
        return orgSlugHeader
      }
    }
    
    // Unable to resolve organization
    throw new Error('Unable to resolve organization context')
    
  } catch (error) {
    console.error('Failed to resolve organization slug:', error)
    throw new Error(`Tenant resolution failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Get organization slug from entity ID with caching
 * This is a performance-optimized version for frequent lookups
 */
const orgSlugCache = new Map<string, { slug: string; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export async function getOrgSlugFromEntity(
  entityType: 'show' | 'episode' | 'campaign' | 'advertiser',
  entityId: string
): Promise<string | null> {
  const cacheKey = `${entityType}:${entityId}`
  const cached = orgSlugCache.get(cacheKey)
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.slug
  }
  
  const schemas = ['org_podcastflow_pro', 'org_unfy']
  const tableMap = {
    show: 'Show',
    episode: 'Episode',
    campaign: 'Campaign',
    advertiser: 'Advertiser'
  }
  
  for (const schema of schemas) {
    try {
      const result = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
        `SELECT COUNT(*) as count FROM ${schema}."${tableMap[entityType]}" WHERE id = $1`,
        entityId
      )
      
      if (result[0]?.count > 0) {
        const orgSlug = schema.replace('org_', '').replace('_', '-')
        orgSlugCache.set(cacheKey, { slug: orgSlug, timestamp: Date.now() })
        return orgSlug
      }
    } catch (error) {
      continue
    }
  }
  
  return null
}

/**
 * Validate that an organization slug exists and is active
 */
export async function validateOrgSlug(slug: string): Promise<boolean> {
  try {
    const org = await prisma.organization.findUnique({
      where: { slug },
      select: { id: true, isActive: true }
    })
    
    return !!(org?.isActive)
  } catch (error) {
    console.error('Error validating org slug:', error)
    return false
  }
}