/**
 * Provisioning Audit Service
 * 
 * Records provisioning operations for audit trail and debugging
 */

import prisma from '@/lib/db/prisma';

export interface ProvisioningAuditEntry {
  id: string;
  orgId: string;
  orgSlug: string;
  mode: 'sync' | 'async';
  status: 'started' | 'success' | 'failed';
  summary?: any;
  error?: string;
  details?: any;
  duration?: number;
  userId?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Record the start of a provisioning operation
 */
export async function recordProvisionStart({
  orgId,
  orgSlug,
  mode = 'sync',
  userId
}: {
  orgId: string;
  orgSlug: string;
  mode?: 'sync' | 'async';
  userId?: string;
}): Promise<string> {
  try {
    // First, ensure the ProvisioningAudit table exists in public schema
    await ensureAuditTable();

    const result = await prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO "ProvisioningAudit" (
        id, "orgId", "orgSlug", mode, status, "userId", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid()::text,
        ${orgId},
        ${orgSlug},
        ${mode},
        'started',
        ${userId || null},
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      RETURNING id
    `;

    console.log(`[PROVISION AUDIT] Started provisioning for ${orgSlug} (${orgId}) in ${mode} mode`);
    return result[0].id;
  } catch (error) {
    console.error('[PROVISION AUDIT] Failed to record start:', error);
    // Don't throw - auditing failure shouldn't block provisioning
    return `audit-error-${Date.now()}`;
  }
}

/**
 * Record successful provisioning completion
 */
export async function recordProvisionSuccess({
  auditId,
  orgId,
  orgSlug,
  summary,
  duration
}: {
  auditId?: string;
  orgId: string;
  orgSlug: string;
  summary: any;
  duration: number;
}): Promise<void> {
  try {
    if (auditId && auditId.startsWith('audit-error')) {
      // Skip if we couldn't create the initial audit record
      console.log(`[PROVISION AUDIT] Success for ${orgSlug} (${orgId}) - Duration: ${duration}ms`);
      return;
    }

    if (auditId) {
      await prisma.$executeRaw`
        UPDATE "ProvisioningAudit"
        SET 
          status = 'success',
          summary = ${JSON.stringify(summary)}::jsonb,
          duration = ${duration},
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE id = ${auditId}
      `;
    } else {
      // Create a new record if we don't have an audit ID
      await prisma.$executeRaw`
        INSERT INTO "ProvisioningAudit" (
          id, "orgId", "orgSlug", mode, status, summary, duration, "createdAt", "updatedAt"
        ) VALUES (
          gen_random_uuid()::text,
          ${orgId},
          ${orgSlug},
          'sync',
          'success',
          ${JSON.stringify(summary)}::jsonb,
          ${duration},
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
      `;
    }

    console.log(`[PROVISION AUDIT] Success for ${orgSlug} (${orgId}) - Duration: ${duration}ms`);
  } catch (error) {
    console.error('[PROVISION AUDIT] Failed to record success:', error);
    // Don't throw - auditing failure shouldn't block success response
  }
}

/**
 * Record provisioning failure
 */
export async function recordProvisionFailure({
  auditId,
  orgId,
  orgSlug,
  error,
  details,
  duration
}: {
  auditId?: string;
  orgId: string;
  orgSlug: string;
  error: string;
  details?: any;
  duration?: number;
}): Promise<void> {
  try {
    if (auditId && auditId.startsWith('audit-error')) {
      // Skip if we couldn't create the initial audit record
      console.error(`[PROVISION AUDIT] Failure for ${orgSlug} (${orgId}): ${error}`);
      return;
    }

    if (auditId) {
      await prisma.$executeRaw`
        UPDATE "ProvisioningAudit"
        SET 
          status = 'failed',
          error = ${error},
          details = ${details ? JSON.stringify(details) : null}::jsonb,
          duration = ${duration || 0},
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE id = ${auditId}
      `;
    } else {
      // Create a new record if we don't have an audit ID
      await prisma.$executeRaw`
        INSERT INTO "ProvisioningAudit" (
          id, "orgId", "orgSlug", mode, status, error, details, duration, "createdAt", "updatedAt"
        ) VALUES (
          gen_random_uuid()::text,
          ${orgId},
          ${orgSlug},
          'sync',
          'failed',
          ${error},
          ${details ? JSON.stringify(details) : null}::jsonb,
          ${duration || 0},
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
      `;
    }

    console.error(`[PROVISION AUDIT] Failure for ${orgSlug} (${orgId}): ${error}`);
  } catch (err) {
    console.error('[PROVISION AUDIT] Failed to record failure:', err);
    // Don't throw - auditing failure shouldn't mask the actual error
  }
}

/**
 * Get provisioning status for an organization
 */
export async function getProvisioningStatus(orgId: string): Promise<ProvisioningAuditEntry | null> {
  try {
    const result = await prisma.$queryRaw<ProvisioningAuditEntry[]>`
      SELECT * FROM "ProvisioningAudit"
      WHERE "orgId" = ${orgId}
      ORDER BY "createdAt" DESC
      LIMIT 1
    `;

    return result[0] || null;
  } catch (error) {
    console.error('[PROVISION AUDIT] Failed to get status:', error);
    return null;
  }
}

/**
 * Ensure the audit table exists in the public schema
 */
async function ensureAuditTable(): Promise<void> {
  try {
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "ProvisioningAudit" (
        id TEXT PRIMARY KEY,
        "orgId" TEXT NOT NULL,
        "orgSlug" TEXT NOT NULL,
        mode TEXT NOT NULL DEFAULT 'sync',
        status TEXT NOT NULL DEFAULT 'started',
        summary JSONB,
        error TEXT,
        details JSONB,
        duration INTEGER,
        "userId" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create indexes if they don't exist
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "ProvisioningAudit_orgId_idx" ON "ProvisioningAudit"("orgId")
    `;

    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "ProvisioningAudit_status_idx" ON "ProvisioningAudit"(status)
    `;

    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "ProvisioningAudit_createdAt_idx" ON "ProvisioningAudit"("createdAt" DESC)
    `;
  } catch (error) {
    // Table might already exist, that's fine
    if (!error.message.includes('already exists')) {
      console.error('[PROVISION AUDIT] Failed to ensure audit table:', error);
    }
  }
}