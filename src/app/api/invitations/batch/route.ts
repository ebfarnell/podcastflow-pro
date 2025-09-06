import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import prisma from '@/lib/db/prisma'
import { emailService } from '@/lib/email/email-service'
import { AuthenticatedRequest } from '@/lib/auth/api-protection'
import { auditService, AuditEventType, AuditSeverity } from '@/lib/audit/audit-service'
import crypto from 'crypto'

// Force this route to be dynamic
export const dynamic = 'force-dynamic'

interface BatchInviteRequest {
  users: Array<{
    email: string
    name: string
    role: string
    phone?: string
  }>
  organizationId?: string
}

// POST /api/invitations/batch - Send batch invitations to multiple users
export const POST = async (request: NextRequest) => {
  const authToken = request.cookies.get('auth-token')
  if (!authToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // Validate session and get user
  const user = await UserService.validateSession(authToken.value)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // Only admin and master can send batch invitations
  if (!['admin', 'master'].includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  
  const authenticatedRequest = request as AuthenticatedRequest
  authenticatedRequest.user = user
  
  return postHandler(authenticatedRequest)
}

async function postHandler(request: AuthenticatedRequest) {
  try {
    const user = request.user!
    const body = await request.json() as BatchInviteRequest
    
    // Validate request
    if (!body.users || !Array.isArray(body.users) || body.users.length === 0) {
      return NextResponse.json(
        { error: 'Users array is required' },
        { status: 400 }
      )
    }
    
    if (body.users.length > 100) {
      return NextResponse.json(
        { error: 'Maximum 100 users can be invited at once' },
        { status: 400 }
      )
    }
    
    // Validate each user
    for (const u of body.users) {
      if (!u.email || !u.name || !u.role) {
        return NextResponse.json(
          { error: 'Each user must have email, name, and role' },
          { status: 400 }
        )
      }
    }
    
    const targetOrganizationId = body.organizationId || user.organizationId
    
    // Get organization details
    const organization = await prisma.organization.findUnique({
      where: { id: targetOrganizationId },
      select: { name: true }
    })
    
    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }
    
    const results = []
    const defaultPassword = 'Welcome2025!' // Temporary password
    
    // Process each user
    for (const userData of body.users) {
      const result: any = {
        email: userData.email,
        name: userData.name,
        role: userData.role,
        status: 'pending'
      }
      
      try {
        // Check if user already exists
        const existing = await prisma.user.findUnique({
          where: { email: userData.email }
        })
        
        if (existing) {
          result.status = 'skipped'
          result.reason = 'User already exists'
          results.push(result)
          continue
        }
        
        // Create user
        const newUser = await prisma.user.create({
          data: {
            email: userData.email,
            password: await UserService.hashPassword(defaultPassword),
            name: userData.name,
            role: userData.role,
            organizationId: targetOrganizationId,
            phone: userData.phone || null,
            isActive: true,
            emailVerified: false
          }
        })
        
        result.userId = newUser.id
        
        // Generate invitation token
        const invitationToken = crypto.randomBytes(32).toString('hex')
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        
        await prisma.session.create({
          data: {
            userId: newUser.id,
            token: invitationToken,
            expiresAt,
            userAgent: 'invitation',
            ipAddress: 'batch-import'
          }
        })
        
        // Send invitation email
        try {
          const emailResult = await emailService.sendUserInvitation(
            userData.email,
            userData.name,
            userData.role,
            organization.name,
            user.name || user.email,
            user.email, // CC the inviter
            invitationToken // Pass the invitation token
          )
          
          if (emailResult.success) {
            result.status = 'invited'
            result.emailMessageId = emailResult.messageId
          } else {
            result.status = 'created_no_email'
            result.emailError = emailResult.error || 'Failed to send email'
          }
        } catch (emailError: any) {
          result.status = 'created_no_email'
          result.emailError = emailError.message
        }
        
        // Log the creation
        await auditService.log({
          eventType: AuditEventType.USER_CREATED,
          severity: AuditSeverity.MEDIUM,
          userId: user.id,
          organizationId: user.organizationId,
          entityType: 'user',
          entityId: newUser.id,
          action: 'Created user via batch import',
          details: {
            newUserEmail: userData.email,
            newUserRole: userData.role,
            invitationEmailSent: result.status === 'invited',
            emailMessageId: result.emailMessageId,
            batchImport: true,
            createdBy: user.email
          },
          success: true
        })
        
      } catch (error: any) {
        console.error(`Failed to create user ${userData.email}:`, error)
        result.status = 'failed'
        result.error = error.message
      }
      
      results.push(result)
    }
    
    // Calculate summary
    const summary = {
      total: results.length,
      invited: results.filter(r => r.status === 'invited').length,
      createdNoEmail: results.filter(r => r.status === 'created_no_email').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      failed: results.filter(r => r.status === 'failed').length
    }
    
    // Log batch operation
    await auditService.log({
      eventType: AuditEventType.USER_CREATED,
      severity: AuditSeverity.HIGH,
      userId: user.id,
      organizationId: user.organizationId,
      entityType: 'batch_invitation',
      entityId: `batch_${Date.now()}`,
      action: 'Sent batch invitations',
      details: {
        organizationName: organization.name,
        summary,
        initiatedBy: user.email
      },
      success: summary.failed === 0
    })
    
    return NextResponse.json({
      success: true,
      summary,
      results,
      message: `Processed ${summary.total} users: ${summary.invited} invited, ${summary.createdNoEmail} created without email, ${summary.skipped} skipped, ${summary.failed} failed`
    })
    
  } catch (error) {
    console.error('Batch invitation error:', error)
    return NextResponse.json(
      { error: 'Failed to process batch invitations' },
      { status: 500 }
    )
  }
}