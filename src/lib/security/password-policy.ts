import prisma from '@/lib/db/prisma'
import bcrypt from 'bcryptjs'

export interface PasswordPolicy {
  minLength: number
  requireUppercase: boolean
  requireLowercase: boolean
  requireNumbers: boolean
  requireSpecialChars: boolean
  preventReuse: number
  maxAge: number // days
  minAge: number // hours
}

export interface PasswordValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * Get password policy for an organization
 */
export async function getPasswordPolicy(organizationId: string): Promise<PasswordPolicy> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true }
  })

  const securitySettings = (org?.settings as any)?.security || {}
  const passwordPolicy = securitySettings.passwordPolicy || {}

  // Return policy with defaults
  return {
    minLength: passwordPolicy.minLength || 8,
    requireUppercase: passwordPolicy.requireUppercase !== false,
    requireLowercase: passwordPolicy.requireLowercase !== false,
    requireNumbers: passwordPolicy.requireNumbers !== false,
    requireSpecialChars: passwordPolicy.requireSpecialChars || false,
    preventReuse: passwordPolicy.preventReuse || 5,
    maxAge: passwordPolicy.maxAge || 90,
    minAge: passwordPolicy.minAge || 0
  }
}

/**
 * Validate a password against the organization's policy
 */
export async function validatePasswordPolicy(
  password: string,
  organizationId: string
): Promise<PasswordValidationResult> {
  const policy = await getPasswordPolicy(organizationId)
  const errors: string[] = []

  // Check minimum length
  if (password.length < policy.minLength) {
    errors.push(`Password must be at least ${policy.minLength} characters long`)
  }

  // Check uppercase requirement
  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  }

  // Check lowercase requirement
  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  }

  // Check number requirement
  if (policy.requireNumbers && !/\d/.test(password)) {
    errors.push('Password must contain at least one number')
  }

  // Check special character requirement
  if (policy.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Check if a password has been used before
 */
export async function checkPasswordReuse(
  userId: string,
  newPassword: string,
  organizationId: string
): Promise<boolean> {
  const policy = await getPasswordPolicy(organizationId)
  
  if (policy.preventReuse === 0) {
    return false // No reuse prevention
  }

  // Get the last N password hashes
  const passwordHistory = await prisma.passwordHistory.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: policy.preventReuse
  })

  // Check if the new password matches any previous passwords
  for (const history of passwordHistory) {
    const matches = await bcrypt.compare(newPassword, history.passwordHash)
    if (matches) {
      return true // Password has been used before
    }
  }

  return false
}

/**
 * Store a password in history
 */
export async function storePasswordHistory(
  userId: string,
  passwordHash: string
): Promise<void> {
  await prisma.passwordHistory.create({
    data: {
      userId,
      passwordHash
    }
  })

  // Clean up old password history (keep only last 20)
  const oldPasswords = await prisma.passwordHistory.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    skip: 20
  })

  if (oldPasswords.length > 0) {
    await prisma.passwordHistory.deleteMany({
      where: {
        id: {
          in: oldPasswords.map(p => p.id)
        }
      }
    })
  }
}

/**
 * Check if password needs to be changed due to age
 */
export async function checkPasswordAge(userId: string, organizationId: string): Promise<{
  needsChange: boolean
  daysUntilExpiry?: number
  expired?: boolean
}> {
  const policy = await getPasswordPolicy(organizationId)
  
  if (policy.maxAge === 0) {
    return { needsChange: false } // No password expiry
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordChangedAt: true }
  })

  if (!user?.passwordChangedAt) {
    return { needsChange: true, expired: true }
  }

  const passwordAge = Math.floor(
    (Date.now() - user.passwordChangedAt.getTime()) / (1000 * 60 * 60 * 24)
  )

  if (passwordAge >= policy.maxAge) {
    return { needsChange: true, expired: true }
  }

  const daysUntilExpiry = policy.maxAge - passwordAge
  
  // Warn if password expires in less than 7 days
  if (daysUntilExpiry <= 7) {
    return { needsChange: true, daysUntilExpiry }
  }

  return { needsChange: false, daysUntilExpiry }
}

/**
 * Check if enough time has passed since last password change
 */
export async function checkPasswordMinAge(userId: string, organizationId: string): Promise<{
  canChange: boolean
  hoursUntilCanChange?: number
}> {
  const policy = await getPasswordPolicy(organizationId)
  
  if (policy.minAge === 0) {
    return { canChange: true } // No minimum age restriction
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordChangedAt: true }
  })

  if (!user?.passwordChangedAt) {
    return { canChange: true } // No previous password change
  }

  const hoursSinceChange = Math.floor(
    (Date.now() - user.passwordChangedAt.getTime()) / (1000 * 60 * 60)
  )

  if (hoursSinceChange < policy.minAge) {
    return {
      canChange: false,
      hoursUntilCanChange: policy.minAge - hoursSinceChange
    }
  }

  return { canChange: true }
}

/**
 * Generate a password that meets the policy requirements
 */
export function generateSecurePassword(policy: PasswordPolicy): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const lowercase = 'abcdefghijklmnopqrstuvwxyz'
  const numbers = '0123456789'
  const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?'
  
  let charset = ''
  let password = ''
  
  // Ensure at least one of each required character type
  if (policy.requireUppercase) {
    charset += uppercase
    password += uppercase[Math.floor(Math.random() * uppercase.length)]
  }
  
  if (policy.requireLowercase) {
    charset += lowercase
    password += lowercase[Math.floor(Math.random() * lowercase.length)]
  }
  
  if (policy.requireNumbers) {
    charset += numbers
    password += numbers[Math.floor(Math.random() * numbers.length)]
  }
  
  if (policy.requireSpecialChars) {
    charset += specialChars
    password += specialChars[Math.floor(Math.random() * specialChars.length)]
  }
  
  // If no specific requirements, use all character types
  if (charset === '') {
    charset = uppercase + lowercase + numbers
  }
  
  // Fill the rest of the password length
  const remainingLength = Math.max(policy.minLength, 12) - password.length
  for (let i = 0; i < remainingLength; i++) {
    password += charset[Math.floor(Math.random() * charset.length)]
  }
  
  // Shuffle the password to avoid predictable patterns
  return password.split('').sort(() => Math.random() - 0.5).join('')
}

/**
 * Get password strength score (0-100)
 */
export function getPasswordStrength(password: string): {
  score: number
  strength: 'weak' | 'fair' | 'good' | 'strong' | 'very-strong'
} {
  let score = 0
  
  // Length scoring
  if (password.length >= 8) score += 10
  if (password.length >= 12) score += 10
  if (password.length >= 16) score += 10
  
  // Character variety scoring
  if (/[a-z]/.test(password)) score += 10
  if (/[A-Z]/.test(password)) score += 10
  if (/\d/.test(password)) score += 10
  if (/[^a-zA-Z0-9]/.test(password)) score += 20
  
  // Pattern detection (penalize common patterns)
  if (!/(.)\1{2,}/.test(password)) score += 10 // No repeated characters
  if (!/^(123|abc|password|qwerty)/i.test(password)) score += 10 // No common patterns
  
  // Entropy estimation
  const uniqueChars = new Set(password).size
  if (uniqueChars >= password.length * 0.6) score += 10
  
  let strength: 'weak' | 'fair' | 'good' | 'strong' | 'very-strong'
  if (score < 30) strength = 'weak'
  else if (score < 50) strength = 'fair'
  else if (score < 70) strength = 'good'
  else if (score < 90) strength = 'strong'
  else strength = 'very-strong'
  
  return { score, strength }
}