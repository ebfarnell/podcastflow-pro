import { NextRequest } from 'next/server'

/**
 * Parse IP address from request headers
 */
export function parseIPFromRequest(request: NextRequest): string {
  // Check various headers for IP (in order of preference)
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwardedFor.split(',')[0].trim()
  }
  
  const realIP = request.headers.get('x-real-ip')
  if (realIP) {
    return realIP.trim()
  }
  
  const cfConnectingIP = request.headers.get('cf-connecting-ip')
  if (cfConnectingIP) {
    return cfConnectingIP.trim()
  }
  
  // Fallback to a default if no IP found
  return '127.0.0.1'
}

/**
 * Check if an IP address matches a CIDR block
 */
export function ipMatchesCIDR(ip: string, cidr: string): boolean {
  try {
    // Handle single IP (no CIDR notation)
    if (!cidr.includes('/')) {
      return ip === cidr
    }

    const [range, prefixLength] = cidr.split('/')
    const prefix = parseInt(prefixLength, 10)
    
    // Convert IPs to 32-bit integers
    const ipInt = ipToInt(ip)
    const rangeInt = ipToInt(range)
    
    // Create mask
    const mask = (0xffffffff << (32 - prefix)) >>> 0
    
    // Check if IP is in range
    return (ipInt & mask) === (rangeInt & mask)
  } catch (error) {
    console.error('Error checking CIDR match:', error)
    return false
  }
}

/**
 * Convert IP address string to 32-bit integer
 */
function ipToInt(ip: string): number {
  const parts = ip.split('.')
  if (parts.length !== 4) {
    throw new Error('Invalid IP address')
  }
  
  let result = 0
  for (let i = 0; i < 4; i++) {
    const octet = parseInt(parts[i], 10)
    if (isNaN(octet) || octet < 0 || octet > 255) {
      throw new Error('Invalid IP address')
    }
    result = (result << 8) | octet
  }
  
  return result >>> 0 // Convert to unsigned 32-bit
}

/**
 * Validate CIDR notation
 */
export function isValidCIDR(cidr: string): boolean {
  const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/
  if (!cidrRegex.test(cidr)) return false
  
  const parts = cidr.split('/')
  const ip = parts[0]
  const prefix = parts[1]
  
  // Validate IP parts
  const ipParts = ip.split('.')
  for (const part of ipParts) {
    const num = parseInt(part, 10)
    if (num < 0 || num > 255) return false
  }
  
  // Validate prefix if present
  if (prefix) {
    const prefixNum = parseInt(prefix, 10)
    if (prefixNum < 0 || prefixNum > 32) return false
  }
  
  return true
}

/**
 * Get location from IP address (placeholder - would use GeoIP service in production)
 */
export async function getLocationFromIP(ip: string): Promise<string> {
  // In production, use a GeoIP service like MaxMind or IPinfo
  // For now, return a placeholder
  if (ip.startsWith('127.') || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return 'Local Network'
  }
  return 'Unknown Location'
}