import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import bcrypt from 'bcryptjs'
import { createAuditLog } from '@/lib/audit/audit-logger'
import { SecurityEventType } from '@/types/security'

interface ApiKeyInfo {
  id: string
  organizationId: string
  scopes: string[]
  name: string
}

/**
 * Validates API key from Authorization header
 * Format: Bearer pk_live_xxxxx
 */
export async function validateApiKey(request: NextRequest): Promise<ApiKeyInfo | null> {
  try {
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader?.startsWith('Bearer pk_')) {
      return null
    }

    const apiKey = authHeader.substring(7) // Remove 'Bearer '
    
    // Find all organizations (we need to check API keys across all orgs)
    const organizations = await prisma.organization.findMany({
      select: {
        id: true,
        settings: true
      }
    })

    // Search for the API key in all organizations
    for (const org of organizations) {
      const securitySettings = (org.settings as any)?.security
      const apiKeys = securitySettings?.apiKeys?.keys || []
      
      // Check if API keys are enabled for this org
      if (!securitySettings?.apiKeys?.enabled) {
        continue
      }

      // Check each key
      for (const keyRecord of apiKeys) {
        // Skip revoked keys
        if (keyRecord.revoked) {
          continue
        }

        // Check expiry
        if (keyRecord.expiresAt && new Date(keyRecord.expiresAt) < new Date()) {
          continue
        }

        // Validate the key hash
        const isValid = await bcrypt.compare(apiKey, keyRecord.keyHash)
        
        if (isValid) {
          // Update last used timestamp
          const updatedKeys = apiKeys.map((k: any) => 
            k.id === keyRecord.id 
              ? { ...k, lastUsedAt: new Date().toISOString() }
              : k
          )

          // Update organization settings with new lastUsedAt
          await prisma.organization.update({
            where: { id: org.id },
            data: {
              settings: {
                ...(org.settings as any),
                security: {
                  ...securitySettings,
                  apiKeys: {
                    ...securitySettings.apiKeys,
                    keys: updatedKeys
                  }
                }
              }
            }
          })

          // Log API key usage
          await createAuditLog({
            organizationId: org.id,
            userId: 'api-key',
            userEmail: `api-key:${keyRecord.name}`,
            action: SecurityEventType.API_KEY_USED,
            resource: request.nextUrl.pathname,
            resourceId: keyRecord.id,
            ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
            userAgent: request.headers.get('user-agent') || 'unknown',
            success: true,
          })

          return {
            id: keyRecord.id,
            organizationId: org.id,
            scopes: keyRecord.scopes,
            name: keyRecord.name
          }
        }
      }
    }

    return null
  } catch (error) {
    console.error('API key validation error:', error)
    return null
  }
}

/**
 * Checks if the API key has the required scope
 */
export function hasScope(apiKeyInfo: ApiKeyInfo, requiredScope: string): boolean {
  // Admin scope has access to everything
  if (apiKeyInfo.scopes.includes('admin:all')) {
    return true
  }

  // Check exact scope match
  if (apiKeyInfo.scopes.includes(requiredScope)) {
    return true
  }

  // Check wildcard scopes (e.g., 'read:*' matches 'read:campaigns')
  const [action, resource] = requiredScope.split(':')
  if (apiKeyInfo.scopes.includes(`${action}:*`)) {
    return true
  }

  return false
}

/**
 * Middleware to protect API routes with API key authentication
 */
export async function withApiKeyAuth(
  request: NextRequest,
  requiredScope?: string
): Promise<NextResponse | ApiKeyInfo> {
  const apiKeyInfo = await validateApiKey(request)
  
  if (!apiKeyInfo) {
    return NextResponse.json(
      { error: 'Invalid or missing API key' },
      { status: 401 }
    )
  }

  if (requiredScope && !hasScope(apiKeyInfo, requiredScope)) {
    return NextResponse.json(
      { error: 'Insufficient permissions', requiredScope },
      { status: 403 }
    )
  }

  return apiKeyInfo
}