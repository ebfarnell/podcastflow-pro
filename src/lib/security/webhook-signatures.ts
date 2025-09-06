import crypto from 'crypto'
import prisma from '@/lib/db/prisma'

export interface WebhookSignature {
  id: string
  secret: string
  algorithm: 'sha256' | 'sha512'
  header: string
}

/**
 * Generate a new webhook signing secret
 */
export function generateWebhookSecret(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Create a signature for webhook payload
 */
export function createWebhookSignature(
  payload: string | Buffer,
  secret: string,
  algorithm: 'sha256' | 'sha512' = 'sha256'
): string {
  const hmac = crypto.createHmac(algorithm, secret)
  hmac.update(typeof payload === 'string' ? payload : payload.toString())
  return `${algorithm}=${hmac.digest('hex')}`
}

/**
 * Verify a webhook signature
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string,
  secret: string
): boolean {
  // Extract algorithm from signature (e.g., "sha256=abc123")
  const [algorithm, hash] = signature.split('=')
  
  if (!algorithm || !hash) {
    return false
  }

  if (!['sha256', 'sha512'].includes(algorithm)) {
    return false
  }

  // Create expected signature
  const expectedSignature = createWebhookSignature(
    payload,
    secret,
    algorithm as 'sha256' | 'sha512'
  )

  // Use timing-safe comparison
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )
}

/**
 * Get webhook signing keys for an organization
 */
export async function getWebhookSigningKeys(organizationId: string): Promise<WebhookSignature[]> {
  const keys = await prisma.webhookSigningKey.findMany({
    where: {
      organizationId,
      active: true
    },
    orderBy: {
      createdAt: 'desc'
    }
  })

  return keys.map(key => ({
    id: key.id,
    secret: key.secret,
    algorithm: key.algorithm as 'sha256' | 'sha512',
    header: key.headerName
  }))
}

/**
 * Create a new webhook signing key
 */
export async function createWebhookSigningKey(
  organizationId: string,
  name: string,
  algorithm: 'sha256' | 'sha512' = 'sha256',
  headerName: string = 'X-Webhook-Signature'
): Promise<WebhookSignature> {
  const secret = generateWebhookSecret()
  
  const key = await prisma.webhookSigningKey.create({
    data: {
      organizationId,
      name,
      secret,
      algorithm,
      headerName,
      active: true
    }
  })

  return {
    id: key.id,
    secret: key.secret,
    algorithm: key.algorithm as 'sha256' | 'sha512',
    header: key.headerName
  }
}

/**
 * Rotate a webhook signing key
 */
export async function rotateWebhookSigningKey(
  keyId: string,
  organizationId: string
): Promise<WebhookSignature> {
  // Get the existing key
  const existingKey = await prisma.webhookSigningKey.findFirst({
    where: {
      id: keyId,
      organizationId
    }
  })

  if (!existingKey) {
    throw new Error('Webhook signing key not found')
  }

  // Deactivate the old key
  await prisma.webhookSigningKey.update({
    where: { id: keyId },
    data: {
      active: false,
      revokedAt: new Date()
    }
  })

  // Create a new key with the same settings
  return createWebhookSigningKey(
    organizationId,
    `${existingKey.name} (Rotated)`,
    existingKey.algorithm as 'sha256' | 'sha512',
    existingKey.headerName
  )
}

/**
 * Verify a webhook request
 */
export async function verifyWebhookRequest(
  organizationId: string,
  payload: string | Buffer,
  headers: Record<string, string | string[] | undefined>
): Promise<{
  valid: boolean
  keyId?: string
  error?: string
}> {
  try {
    // Get active signing keys for the organization
    const keys = await getWebhookSigningKeys(organizationId)
    
    if (keys.length === 0) {
      return {
        valid: false,
        error: 'No active webhook signing keys configured'
      }
    }

    // Try to verify with each key
    for (const key of keys) {
      // Get the signature from the header
      const headerValue = headers[key.header.toLowerCase()] || headers[key.header]
      
      if (!headerValue) {
        continue
      }

      const signature = Array.isArray(headerValue) ? headerValue[0] : headerValue
      
      if (verifyWebhookSignature(payload, signature, key.secret)) {
        return {
          valid: true,
          keyId: key.id
        }
      }
    }

    return {
      valid: false,
      error: 'Invalid webhook signature'
    }

  } catch (error) {
    console.error('Error verifying webhook:', error)
    return {
      valid: false,
      error: 'Internal error during webhook verification'
    }
  }
}

/**
 * Middleware for Express/Next.js to verify webhooks
 */
export async function webhookVerificationMiddleware(
  req: Request,
  organizationId: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    // Get the raw body
    const body = await req.text()
    
    // Get headers
    const headers: Record<string, string> = {}
    req.headers.forEach((value, key) => {
      headers[key] = value
    })

    // Verify the webhook
    const result = await verifyWebhookRequest(organizationId, body, headers)
    
    if (!result.valid) {
      console.warn('Webhook verification failed:', result.error)
    }

    return result

  } catch (error) {
    console.error('Webhook middleware error:', error)
    return {
      valid: false,
      error: 'Failed to process webhook'
    }
  }
}

/**
 * Generate webhook payload with signature
 */
export async function prepareWebhookPayload(
  organizationId: string,
  event: string,
  data: any
): Promise<{
  payload: string
  headers: Record<string, string>
}> {
  // Get the primary signing key
  const keys = await getWebhookSigningKeys(organizationId)
  
  if (keys.length === 0) {
    throw new Error('No active webhook signing keys')
  }

  const key = keys[0] // Use the most recent key
  
  // Prepare the payload
  const payload = JSON.stringify({
    event,
    timestamp: new Date().toISOString(),
    data
  })

  // Create signature
  const signature = createWebhookSignature(payload, key.secret, key.algorithm)

  return {
    payload,
    headers: {
      'Content-Type': 'application/json',
      [key.header]: signature,
      'X-Webhook-Event': event,
      'X-Webhook-Timestamp': new Date().toISOString()
    }
  }
}