import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug, querySchema } from '@/lib/db/schema-db'
import { emailService } from '@/lib/email/email-service'
import prisma from '@/lib/db/prisma'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


// POST /api/contacts/[id]/invite - Send invite to a contact
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Validate session
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only sales, admin, and master can send invites
    if (!['sales', 'admin', 'master'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = params

    // Get org schema
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Get the contact
    const contactQuery = `
      SELECT c.*, a.name as advertiser_name, ag.name as agency_name
      FROM "Contact" c
      LEFT JOIN "Advertiser" a ON a.id = c."advertiserId"
      LEFT JOIN "Agency" ag ON ag.id = c."agencyId"
      WHERE c.id = $1 AND c."isActive" = true
    `

    const contactResult = await querySchema<any>(orgSlug, contactQuery, [id])
    
    if (!contactResult || contactResult.length === 0) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    const contact = contactResult[0]

    // Check if user already exists using Prisma
    const existingUser = await prisma.user.findFirst({
      where: { 
        email: {
          equals: contact.email,
          mode: 'insensitive'
        }
      }
    })
    
    if (existingUser) {
      if (existingUser.isActive) {
        return NextResponse.json({ 
          error: 'User already has an active account',
          userStatus: 'active'
        }, { status: 400 })
      }
      if (!existingUser.emailVerified) {
        return NextResponse.json({ 
          error: 'User already has a pending invitation',
          userStatus: 'invited'
        }, { status: 400 })
      }
    }

    // Create new user using UserService
    const tempPassword = crypto.randomBytes(16).toString('hex')
    
    const newUser = await UserService.createUser({
      email: contact.email,
      password: tempPassword,
      name: contact.name,
      role: 'client', // Default role for advertiser contacts  
      organizationId: user.organizationId,
      phone: contact.phone,
      title: contact.title,
      isActive: false, // Not active until invite accepted
      emailVerified: false // Email not verified until invite accepted
    })

    // Generate invitation token for email
    const invitationToken = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    
    // Create session for invitation
    await prisma.session.create({
      data: {
        userId: newUser.id,
        token: invitationToken,
        expiresAt,
        userAgent: 'invitation',
        ipAddress: 'contact-invite'
      }
    })

    // Update contact with user ID and invite status
    const updateContactQuery = `
      UPDATE "Contact"
      SET 
        "userId" = $1, 
        "inviteStatus" = 'sent',
        "updatedAt" = NOW()
      WHERE id = $2
      RETURNING *
    `

    await querySchema(
      orgSlug,
      updateContactQuery,
      [newUser.id, id]
    )

    // Get organization details for email
    const organization = await prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { name: true }
    })

    // Send invitation email using the email service
    let emailResult: any = { success: false }
    
    try {
      emailResult = await emailService.sendUserInvitation(
        contact.email,
        contact.name,
        'client',
        organization?.name || 'PodcastFlow Pro',
        user.name || user.email,
        user.email,
        invitationToken,
        user.organizationId,
        user.id
      )
      
      if (!emailResult.success) {
        console.error('Email send failure details:', emailResult.details)
      }
    } catch (emailError) {
      console.error('Failed to send invitation email:', emailError)
      emailResult = { success: false, error: (emailError as any).message }
    }

    // Log invite details for debugging
    console.log(`Invite created for ${contact.email}:`)
    console.log(`- Name: ${contact.name}`)
    console.log(`- Organization: ${contact.advertiser_name || contact.agency_name}`)
    console.log(`- Email sent: ${emailResult.success}`)
    console.log(`- Invited by: ${user.name} (${user.email})`)

    return NextResponse.json({
      success: true,
      message: emailResult.success 
        ? 'Invitation sent successfully' 
        : 'User created but invitation email could not be sent',
      emailSent: emailResult.success,
      emailDetails: emailResult.success ? {
        messageId: emailResult.messageId,
        provider: emailResult.details?.provider
      } : null,
      userId: newUser.id,
      userEmail: newUser.email
    })
  } catch (error) {
    console.error('Error sending invite:', error)
    return NextResponse.json({ error: 'Failed to send invitation' }, { status: 500 })
  }
}
