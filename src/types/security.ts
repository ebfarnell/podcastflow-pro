// Organization Security Settings Types
export interface OrgSecuritySettings {
  // MFA & Authentication
  mfaRequired: boolean
  mfaGracePeriodDays?: number // Days to allow login before forcing MFA enrollment
  
  // SSO Configuration
  sso?: {
    enabled: boolean
    provider: 'oidc' | 'saml' | 'google' | 'microsoft' | null
    config?: {
      issuerUrl?: string
      clientId?: string
      clientSecret?: string // Will be encrypted
      metadataUrl?: string
      certificate?: string
      callbackUrl?: string
      allowedDomains?: string[] // Email domains that can use SSO
    }
    enforceForNonAdmins?: boolean // Force SSO for non-admin users
  }
  
  // Password Policy
  passwordPolicy?: {
    minLength: number
    requireUppercase: boolean
    requireLowercase: boolean
    requireNumbers: boolean
    requireSymbols: boolean
    expiryDays?: number // Force password change after X days
    historyCount?: number // Prevent reuse of last X passwords
    maxAttempts?: number // Lock account after X failed attempts
    lockoutDurationMinutes?: number
  }
  
  // Session Security
  session?: {
    idleTimeoutMinutes: number // Logout after inactivity
    absoluteTimeoutHours: number // Force re-login after X hours
    refreshRotation: 'rotate' | 'static' // Token rotation policy
    maxConcurrentSessions?: number // Limit concurrent sessions per user
    requireReauthForSensitive?: boolean // Re-auth for sensitive actions
  }
  
  // Network Security
  ipRestrictions?: {
    enabled: boolean
    allowlist?: string[] // CIDR blocks (e.g., "192.168.1.0/24")
    blocklist?: string[] // Explicitly blocked IPs/ranges
    enforceForAdmins?: boolean // Apply to admin users too
  }
  
  // Data & Export Controls
  exportPolicy?: {
    requireApproval: boolean
    allowedRoles: string[] // Roles that can export data
    watermarkExports?: boolean
    maxRecordsPerExport?: number
    auditAllExports: boolean
  }
  
  // API Security
  apiKeys?: {
    enabled: boolean
    maxKeysPerUser?: number
    requireExpiry?: boolean
    defaultExpiryDays?: number
    allowedScopes?: string[] // Available API scopes
  }
  
  // Webhook Security
  webhookSecurity?: {
    signingEnabled: boolean
    signingKeyId?: string
    rotateAfterDays?: number
    verifySSL?: boolean
  }
  
  // Audit & Compliance
  auditSettings?: {
    retentionDays: number
    logLevel: 'minimal' | 'standard' | 'detailed' | 'verbose'
    logSensitiveActions: boolean
    requireReasonForDeletion?: boolean
  }
  
  // Business Rules
  categoryExclusivity?: {
    enforced: boolean
    exclusivityWindowDays?: number // Prevent competitors within X days
    categories?: string[] // List of exclusive categories
  }
  
  // Metadata
  version: number // For optimistic concurrency control
  lastUpdatedAt: string
  lastUpdatedBy: string
}

// API Key Interface
export interface ApiKey {
  id: string
  name: string
  keyHash: string // Store only hash, show key once on creation
  scopes: string[]
  expiresAt?: string
  lastUsedAt?: string
  createdAt: string
  createdBy: string
  revoked: boolean
  revokedAt?: string
  revokedBy?: string
}

// Session Info Interface
export interface SessionInfo {
  id: string
  userId: string
  device: string
  browser: string
  ipAddress: string
  location?: string
  lastActive: string
  createdAt: string
  isCurrent: boolean
}

// Audit Log Entry
export interface AuditLogEntry {
  id: string
  organizationId: string
  userId: string
  userEmail: string
  action: string
  resource: string
  resourceId?: string
  changes?: Record<string, any>
  ipAddress: string
  userAgent: string
  timestamp: string
  success: boolean
  errorMessage?: string
}

// Security Event Types for Audit
export enum SecurityEventType {
  // Authentication
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILED = 'LOGIN_FAILED',
  LOGOUT = 'LOGOUT',
  MFA_ENABLED = 'MFA_ENABLED',
  MFA_DISABLED = 'MFA_DISABLED',
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  PASSWORD_RESET = 'PASSWORD_RESET',
  
  // Security Settings
  SECURITY_SETTINGS_UPDATED = 'SECURITY_SETTINGS_UPDATED',
  IP_RESTRICTION_ADDED = 'IP_RESTRICTION_ADDED',
  IP_RESTRICTION_REMOVED = 'IP_RESTRICTION_REMOVED',
  
  // API Keys
  API_KEY_CREATED = 'API_KEY_CREATED',
  API_KEY_REVOKED = 'API_KEY_REVOKED',
  API_KEY_USED = 'API_KEY_USED',
  
  // Data Access
  DATA_EXPORTED = 'DATA_EXPORTED',
  DATA_DELETED = 'DATA_DELETED',
  SENSITIVE_DATA_ACCESSED = 'SENSITIVE_DATA_ACCESSED',
  
  // Violations
  IP_RESTRICTION_VIOLATION = 'IP_RESTRICTION_VIOLATION',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  UNAUTHORIZED_ACCESS_ATTEMPT = 'UNAUTHORIZED_ACCESS_ATTEMPT',
}

// Default Security Settings
export const DEFAULT_SECURITY_SETTINGS: Partial<OrgSecuritySettings> = {
  mfaRequired: false,
  passwordPolicy: {
    minLength: 8,
    requireUppercase: false,
    requireLowercase: true,
    requireNumbers: true,
    requireSymbols: false,
    maxAttempts: 5,
    lockoutDurationMinutes: 30,
  },
  session: {
    idleTimeoutMinutes: 480, // 8 hours
    absoluteTimeoutHours: 24,
    refreshRotation: 'static',
  },
  auditSettings: {
    retentionDays: 90,
    logLevel: 'standard',
    logSensitiveActions: true,
  },
  exportPolicy: {
    requireApproval: false,
    allowedRoles: ['admin', 'master'],
    auditAllExports: true,
  },
  version: 1,
  lastUpdatedAt: new Date().toISOString(),
  lastUpdatedBy: 'system',
}