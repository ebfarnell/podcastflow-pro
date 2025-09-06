-- Security Enforcement Migration
-- Adds comprehensive security tables for multi-tenant organizations

-- API Keys table (org-scoped)
CREATE TABLE IF NOT EXISTS "ApiKey" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL, -- Store only hashed version
    "lastFourChars" TEXT NOT NULL, -- For display purposes
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "expiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "lastUsedIp" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "revokedBy" TEXT,
    "revokedReason" TEXT,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- IP Rules table (org-scoped)
CREATE TABLE IF NOT EXISTS "IpRule" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL CHECK ("type" IN ('allow', 'deny')),
    "cidr" TEXT NOT NULL,
    "description" TEXT,
    "applyToAdmins" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IpRule_pkey" PRIMARY KEY ("id")
);

-- Failed Login Attempts (for rate limiting)
CREATE TABLE IF NOT EXISTS "LoginAttempt" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "failureReason" TEXT,
    "organizationId" TEXT,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- Two-Factor Backup Codes
CREATE TABLE IF NOT EXISTS "TwoFactorBackupCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TwoFactorBackupCode_pkey" PRIMARY KEY ("id")
);

-- Security Audit Log (separate from general audit)
CREATE TABLE IF NOT EXISTS "SecurityAuditLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "userEmail" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "changes" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityAuditLog_pkey" PRIMARY KEY ("id")
);

-- Password History (for preventing reuse)
CREATE TABLE IF NOT EXISTS "PasswordHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordHistory_pkey" PRIMARY KEY ("id")
);

-- Webhook Signing Keys
CREATE TABLE IF NOT EXISTS "WebhookSigningKey" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "keyId" TEXT NOT NULL UNIQUE,
    "secret" TEXT NOT NULL, -- Encrypted
    "algorithm" TEXT NOT NULL DEFAULT 'hmac-sha256',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rotatedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "WebhookSigningKey_pkey" PRIMARY KEY ("id")
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS "ApiKey_organizationId_idx" ON "ApiKey"("organizationId");
CREATE INDEX IF NOT EXISTS "ApiKey_userId_idx" ON "ApiKey"("userId");
CREATE INDEX IF NOT EXISTS "ApiKey_keyHash_idx" ON "ApiKey"("keyHash");
CREATE INDEX IF NOT EXISTS "ApiKey_isActive_idx" ON "ApiKey"("isActive");

CREATE INDEX IF NOT EXISTS "IpRule_organizationId_idx" ON "IpRule"("organizationId");
CREATE INDEX IF NOT EXISTS "IpRule_enabled_idx" ON "IpRule"("enabled");

CREATE INDEX IF NOT EXISTS "LoginAttempt_email_idx" ON "LoginAttempt"("email");
CREATE INDEX IF NOT EXISTS "LoginAttempt_ipAddress_idx" ON "LoginAttempt"("ipAddress");
CREATE INDEX IF NOT EXISTS "LoginAttempt_attemptedAt_idx" ON "LoginAttempt"("attemptedAt");

CREATE INDEX IF NOT EXISTS "TwoFactorBackupCode_userId_idx" ON "TwoFactorBackupCode"("userId");
CREATE INDEX IF NOT EXISTS "TwoFactorBackupCode_usedAt_idx" ON "TwoFactorBackupCode"("usedAt");

CREATE INDEX IF NOT EXISTS "SecurityAuditLog_organizationId_idx" ON "SecurityAuditLog"("organizationId");
CREATE INDEX IF NOT EXISTS "SecurityAuditLog_userId_idx" ON "SecurityAuditLog"("userId");
CREATE INDEX IF NOT EXISTS "SecurityAuditLog_action_idx" ON "SecurityAuditLog"("action");
CREATE INDEX IF NOT EXISTS "SecurityAuditLog_createdAt_idx" ON "SecurityAuditLog"("createdAt");

CREATE INDEX IF NOT EXISTS "PasswordHistory_userId_idx" ON "PasswordHistory"("userId");
CREATE INDEX IF NOT EXISTS "PasswordHistory_createdAt_idx" ON "PasswordHistory"("createdAt");

CREATE INDEX IF NOT EXISTS "WebhookSigningKey_organizationId_idx" ON "WebhookSigningKey"("organizationId");
CREATE INDEX IF NOT EXISTS "WebhookSigningKey_keyId_idx" ON "WebhookSigningKey"("keyId");

-- Add foreign key constraints
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_organizationId_fkey" 
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IpRule" ADD CONSTRAINT "IpRule_organizationId_fkey" 
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TwoFactorBackupCode" ADD CONSTRAINT "TwoFactorBackupCode_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SecurityAuditLog" ADD CONSTRAINT "SecurityAuditLog_organizationId_fkey" 
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PasswordHistory" ADD CONSTRAINT "PasswordHistory_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WebhookSigningKey" ADD CONSTRAINT "WebhookSigningKey_organizationId_fkey" 
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add session tracking fields to Session table
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "device" TEXT;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "browser" TEXT;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "ipAddress" TEXT;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "location" TEXT;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "lastActiveAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

-- Add security fields to User table if not exist
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordChangedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mfaEnrolledAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "failedLoginAttempts" INTEGER DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "requirePasswordChange" BOOLEAN DEFAULT false;