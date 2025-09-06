import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug, querySchema } from '@/lib/db/schema-db'
import { accessLogger } from '@/lib/security/access-logger'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get session and verify authentication
    const authToken = request.cookies.get('auth-token')?.value
    if (!authToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // CRITICAL SECURITY FIX: Use schema-aware queries for multi-tenant data
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }
    
    // Check if master is accessing cross-org data
    if (user.role === 'master' && user.organizationId !== orgSlug) {
      await accessLogger.logMasterCrossOrgAccess(
        user.id,
        user.organizationId!,
        orgSlug,
        'POST',
        `/api/contracts/${params.id}/actions`,
        request
      )
    }
    
    // Verify contract exists using schema-aware query
    const contractQuery = `
      SELECT 
        c.*,
        a.id as advertiser_id, a.name as advertiser_name,
        ag.id as agency_id, ag.name as agency_name
      FROM "Contract" c
      LEFT JOIN "Advertiser" a ON a.id = c."advertiserId"
      LEFT JOIN "Agency" ag ON ag.id = c."agencyId"
      WHERE c.id = $1
    `
    const contractsRaw = await querySchema<any>(orgSlug, contractQuery, [params.id])
    
    if (!contractsRaw || contractsRaw.length === 0) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    }
    
    const contractRaw = contractsRaw[0]
    
    // Fetch signatures
    const signaturesQuery = `SELECT * FROM "ContractSignature" WHERE "contractId" = $1`
    const signatures = await querySchema<any>(orgSlug, signaturesQuery, [params.id])
    
    const contract = {
      ...contractRaw,
      advertiser: contractRaw.advertiser_id ? {
        id: contractRaw.advertiser_id,
        name: contractRaw.advertiser_name
      } : null,
      agency: contractRaw.agency_id ? {
        id: contractRaw.agency_id,
        name: contractRaw.agency_name
      } : null,
      signatures
    }

    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    }

    const body = await request.json()
    const { action, comment, ...actionData } = body

    let result: any = {}

    switch (action) {
      case 'approve':
        // Check permissions
        if (!['master', 'admin'].includes(user.role)) {
          return NextResponse.json({ error: 'Insufficient permissions to approve contracts' }, { status: 403 })
        }

        if (contract.status !== 'pending_review') {
          return NextResponse.json({ error: 'Contract must be in pending review status to approve' }, { status: 400 })
        }

        const approveQuery = `
          UPDATE "Contract"
          SET status = 'approved', "updatedAt" = CURRENT_TIMESTAMP
          WHERE id = $1
        `
        await querySchema(orgSlug, approveQuery, [params.id])

        const historyQuery = `
          INSERT INTO "ContractHistory" ("contractId", action, description, comment, "createdById", "createdAt")
          VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        `
        await querySchema(orgSlug, historyQuery, [
          params.id,
          'approved',
          'Contract approved',
          comment || 'Contract approved for sending',
          user.id
        ])

        result = { message: 'Contract approved successfully' }
        break

      case 'send':
        if (!['approved', 'draft'].includes(contract.status)) {
          return NextResponse.json({ error: 'Contract must be approved or in draft status to send' }, { status: 400 })
        }

        const { recipients = [] } = actionData

        // Create signatures for recipients
        for (const recipient of recipients) {
          const createSignatureQuery = `
            INSERT INTO "ContractSignature" 
            ("contractId", "signerType", "signerName", "signerEmail", "signerTitle", status, "expiresAt", "createdAt")
            VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
          `
          await querySchema(orgSlug, createSignatureQuery, [
            params.id,
            recipient.signerType || 'client',
            recipient.signerName,
            recipient.signerEmail,
            recipient.signerTitle || null,
            'pending',
            recipient.expiresAt ? new Date(recipient.expiresAt) : null
          ])
        }

        const sentQuery = `
          UPDATE "Contract"
          SET status = 'sent', "sentAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
          WHERE id = $1
        `
        await querySchema(orgSlug, sentQuery, [params.id])

        const sentHistoryQuery = `
          INSERT INTO "ContractHistory" ("contractId", action, description, comment, "createdById", "createdAt")
          VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        `
        await querySchema(orgSlug, sentHistoryQuery, [
          params.id,
          'sent',
          `Contract sent to ${recipients.length} recipient(s)`,
          comment || `Contract sent for signature to: ${recipients.map((r: any) => r.signerEmail).join(', ')}`,
          user.id
        ])

        result = { 
          message: 'Contract sent successfully',
          recipients: recipients.length
        }
        break

      case 'sign':
        const { signatureId, signatureData, ipAddress } = actionData

        if (contract.status !== 'sent') {
          return NextResponse.json({ error: 'Contract must be in sent status to sign' }, { status: 400 })
        }

        // Find the signature record
        const signature = contract.signatures.find(s => s.id === signatureId)
        if (!signature) {
          return NextResponse.json({ error: 'Signature record not found' }, { status: 404 })
        }

        if (signature.status !== 'pending') {
          return NextResponse.json({ error: 'Signature already completed or expired' }, { status: 400 })
        }

        // Update signature
        const updateSignatureQuery = `
          UPDATE "ContractSignature"
          SET status = 'signed', "signedAt" = CURRENT_TIMESTAMP, 
              "signatureData" = $2, "ipAddress" = $3, "updatedAt" = CURRENT_TIMESTAMP
          WHERE id = $1
        `
        await querySchema(orgSlug, updateSignatureQuery, [
          signatureId,
          signatureData || null,
          ipAddress || null
        ])

        // Check if all signatures are complete
        const allSignaturesQuery = `SELECT * FROM "ContractSignature" WHERE "contractId" = $1`
        const allSignatures = await querySchema<any>(orgSlug, allSignaturesQuery, [params.id])

        const allSigned = allSignatures.every(s => s.status === 'signed')

        if (allSigned) {
          const signedQuery = `
            UPDATE "Contract"
            SET status = 'signed', "signedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
            WHERE id = $1
          `
          await querySchema(orgSlug, signedQuery, [params.id])

          const signedHistoryQuery = `
            INSERT INTO "ContractHistory" ("contractId", action, description, comment, "createdById", "createdAt")
            VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
          `
          await querySchema(orgSlug, signedHistoryQuery, [
            params.id,
            'signed',
            'All parties have signed the contract',
            comment || 'Contract fully executed with all signatures',
            user.id
          ])
        } else {
          const partialHistoryQuery = `
            INSERT INTO "ContractHistory" ("contractId", action, description, comment, "createdById", "createdAt")
            VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
          `
          await querySchema(orgSlug, partialHistoryQuery, [
            params.id,
            'signature_added',
            `Signature added by ${signature.signerName}`,
            comment || `${signature.signerName} (${signature.signerEmail}) signed the contract`,
            user.id
          ])
        }

        result = { 
          message: 'Signature added successfully',
          allSigned
        }
        break

      case 'execute':
        // Check permissions
        if (!['master', 'admin'].includes(user.role)) {
          return NextResponse.json({ error: 'Insufficient permissions to execute contracts' }, { status: 403 })
        }

        if (contract.status !== 'signed') {
          return NextResponse.json({ error: 'Contract must be signed to execute' }, { status: 400 })
        }

        const executeQuery = `
          UPDATE "Contract"
          SET status = 'executed', "isExecuted" = true, "executedAt" = CURRENT_TIMESTAMP,
              "executedById" = $2, "completedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
          WHERE id = $1
        `
        await querySchema(orgSlug, executeQuery, [params.id, user.id])

        const executeHistoryQuery = `
          INSERT INTO "ContractHistory" ("contractId", action, description, comment, "createdById", "createdAt")
          VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        `
        await querySchema(orgSlug, executeHistoryQuery, [
          params.id,
          'executed',
          'Contract executed and finalized',
          comment || 'Contract execution completed',
          user.id
        ])

        result = { message: 'Contract executed successfully' }
        break

      case 'cancel':
        if (['executed', 'cancelled'].includes(contract.status)) {
          return NextResponse.json({ error: 'Cannot cancel executed or already cancelled contracts' }, { status: 400 })
        }

        const cancelQuery = `
          UPDATE "Contract"
          SET status = 'cancelled', "updatedAt" = CURRENT_TIMESTAMP
          WHERE id = $1
        `
        await querySchema(orgSlug, cancelQuery, [params.id])

        const cancelHistoryQuery = `
          INSERT INTO "ContractHistory" ("contractId", action, description, comment, "createdById", "createdAt")
          VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        `
        await querySchema(orgSlug, cancelHistoryQuery, [
          params.id,
          'cancelled',
          'Contract cancelled',
          comment || 'Contract cancelled',
          user.id
        ])

        result = { message: 'Contract cancelled successfully' }
        break

      case 'generate_document':
        const { templateId, variables = {} } = actionData

        // This would integrate with a document generation service
        // For now, we'll simulate document generation
        const documentUrl = `/contracts/${contract.contractNumber}/document.pdf`
        
        const docQuery = `
          UPDATE "Contract"
          SET "documentUrl" = $2, "generatedDocument" = $3::jsonb, "updatedAt" = CURRENT_TIMESTAMP
          WHERE id = $1
        `
        await querySchema(orgSlug, docQuery, [
          params.id,
          documentUrl,
          JSON.stringify({
            templateId,
            variables,
            generatedAt: new Date().toISOString(),
            fileName: `${contract.contractNumber}.pdf`
          })
        ])

        const docHistoryQuery = `
          INSERT INTO "ContractHistory" ("contractId", action, description, comment, "createdById", "createdAt")
          VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        `
        await querySchema(orgSlug, docHistoryQuery, [
          params.id,
          'document_uploaded',
          'Contract document generated',
          comment || 'PDF document generated from template',
          user.id
        ])

        result = { 
          message: 'Document generated successfully',
          documentUrl
        }
        break

      case 'add_signature_request':
        const { signerName, signerEmail, signerType, signerTitle, expiresAt } = actionData

        const addSignatureQuery = `
          INSERT INTO "ContractSignature" 
          ("contractId", "signerType", "signerName", "signerEmail", "signerTitle", status, "expiresAt", "createdAt")
          VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
        `
        await querySchema(orgSlug, addSignatureQuery, [
          params.id,
          signerType || 'client',
          signerName,
          signerEmail,
          signerTitle || null,
          'pending',
          expiresAt ? new Date(expiresAt) : null
        ])

        const addSigHistoryQuery = `
          INSERT INTO "ContractHistory" ("contractId", action, description, comment, "createdById", "createdAt")
          VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        `
        await querySchema(orgSlug, addSigHistoryQuery, [
          params.id,
          'signature_added',
          `Signature request added for ${signerName}`,
          comment || `Added signature request for ${signerName} (${signerEmail})`,
          user.id
        ])

        result = { message: 'Signature request added successfully' }
        break

      case 'send_reminder':
        const { signatureIds = [] } = actionData

        // Update reminder count for specified signatures
        if (signatureIds.length > 0) {
          const placeholders = signatureIds.map((_, index) => `$${index + 3}`).join(', ')
          const reminderQuery = `
            UPDATE "ContractSignature"
            SET "remindersSent" = COALESCE("remindersSent", 0) + 1, 
                "lastReminder" = CURRENT_TIMESTAMP,
                "updatedAt" = CURRENT_TIMESTAMP
            WHERE "contractId" = $1 AND status = $2 AND id IN (${placeholders})
          `
          await querySchema(orgSlug, reminderQuery, [params.id, 'pending', ...signatureIds])
        }

        const reminderHistoryQuery = `
          INSERT INTO "ContractHistory" ("contractId", action, description, comment, "createdById", "createdAt")
          VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        `
        await querySchema(orgSlug, reminderHistoryQuery, [
          params.id,
          'reminder_sent',
          `Reminders sent to ${signatureIds.length} recipient(s)`,
          comment || 'Signature reminders sent',
          user.id
        ])

        result = { message: 'Reminders sent successfully' }
        break

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error performing contract action:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
