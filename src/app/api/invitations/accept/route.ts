import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import bcrypt from 'bcryptjs'
import { UserService } from '@/lib/auth/user-service'

// Force this route to be dynamic
export const dynamic = 'force-dynamic'

// GET /api/invitations/accept?token=xxx - Get invitation details
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const token = searchParams.get('token')
    
    if (!token) {
      return NextResponse.json(
        { error: 'Invitation token is required' },
        { status: 400 }
      )
    }
    
    // Find the session (invitation) by token
    const session = await prisma.session.findUnique({
      where: { token },
      include: {
        user: {
          include: {
            organization: true
          }
        }
      }
    })
    
    if (!session) {
      return NextResponse.json(
        { error: 'Invalid invitation token' },
        { status: 404 }
      )
    }
    
    // Check if invitation has expired
    if (session.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'Invitation has expired' },
        { status: 400 }
      )
    }
    
    // Check if this is an invitation (not a regular session)
    if (session.userAgent !== 'invitation') {
      return NextResponse.json(
        { error: 'Invalid invitation token' },
        { status: 400 }
      )
    }
    
    // Check if user has already set up their account
    const isAlreadySetup = session.user.emailVerified;
    
    console.log('Invitation token lookup:', {
      token: token.substring(0, 8) + '...',
      userId: session.userId,
      userEmail: session.user.email,
      emailVerified: session.user.emailVerified,
      hasPassword: !!session.user.password,
      userAgent: session.userAgent,
      isAlreadySetup
    })
    
    // Get inviter name from the session that created the user
    let inviterName = 'System Administrator';
    
    // Try to find who created this user based on audit logs or other sessions
    // For now, we'll use a default name
    
    return NextResponse.json({
      invitation: {
        email: session.user.email,
        name: session.user.name || '',
        role: session.user.role,
        organizationName: session.user.organization?.name || 'Unknown Organization',
        organizationId: session.user.organizationId,
        status: isAlreadySetup ? 'accepted' : 'pending',
        expiresAt: session.expiresAt.toISOString(),
        createdAt: session.createdAt.toISOString(),
        inviterName,
        phone: session.user.phone || '',
        title: session.user.title || '',
        department: session.user.department || '',
        isAlreadySetup
      }
    })
    
  } catch (error) {
    console.error('Get invitation error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch invitation details' },
      { status: 500 }
    )
  }
}

// POST /api/invitations/accept - Accept invitation and set password
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, password, name, phone, title, department } = body
    
    // Validate required fields
    if (!token || !password) {
      return NextResponse.json(
        { error: 'Token and password are required' },
        { status: 400 }
      )
    }
    
    // Validate password requirements
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      )
    }
    
    // Find the session (invitation) by token
    const session = await prisma.session.findUnique({
      where: { token },
      include: {
        user: true
      }
    })
    
    if (!session) {
      return NextResponse.json(
        { error: 'Invalid invitation token' },
        { status: 404 }
      )
    }
    
    // Check if invitation has expired
    if (session.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'Invitation has expired' },
        { status: 400 }
      )
    }
    
    // Check if this is an invitation (not a regular session)
    if (session.userAgent !== 'invitation') {
      return NextResponse.json(
        { error: 'Invalid invitation token' },
        { status: 400 }
      )
    }
    
    // Check if user has already set up their account
    if (session.user.emailVerified) {
      return NextResponse.json(
        { error: 'Account has already been set up' },
        { status: 400 }
      )
    }
    
    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 10)
    
    // Update user with new password and profile info
    await prisma.user.update({
      where: { id: session.userId },
      data: {
        password: hashedPassword,
        name: name || session.user.name,
        emailVerified: true,
        phone: phone || null,
        title: title || null,
        department: department || null,
        updatedAt: new Date()
      }
    })
    
    // Delete the invitation session
    await prisma.session.delete({
      where: { id: session.id }
    })
    
    // Delete any other invitation sessions for this user
    await prisma.session.deleteMany({
      where: {
        userId: session.userId,
        userAgent: 'invitation'
      }
    })
    
    return NextResponse.json({
      success: true,
      message: 'Account successfully set up',
      user: {
        email: session.user.email,
        name: session.user.name,
        role: session.user.role
      }
    })
    
  } catch (error) {
    console.error('Accept invitation error:', error)
    return NextResponse.json(
      { error: 'Failed to accept invitation' },
      { status: 500 }
    )
  }
}