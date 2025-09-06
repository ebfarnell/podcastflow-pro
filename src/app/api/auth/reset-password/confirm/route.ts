import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import bcrypt from 'bcryptjs'

// POST /api/auth/reset-password/confirm - Reset password with token
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, password } = body
    
    // Validate input
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
    
    // Find the session by token
    const session = await prisma.session.findUnique({
      where: { token },
      include: {
        user: true
      }
    })
    
    if (!session) {
      return NextResponse.json(
        { error: 'Invalid password reset token' },
        { status: 404 }
      )
    }
    
    // Check if session has expired
    if (session.expiresAt < new Date()) {
      // Delete expired session
      await prisma.session.delete({
        where: { id: session.id }
      })
      
      return NextResponse.json(
        { error: 'Password reset link has expired' },
        { status: 400 }
      )
    }
    
    // Check if this is a password reset session
    if (session.userAgent !== 'password-reset') {
      return NextResponse.json(
        { error: 'Invalid password reset token' },
        { status: 400 }
      )
    }
    
    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 10)
    
    // Update user password
    await prisma.user.update({
      where: { id: session.userId },
      data: {
        password: hashedPassword,
        updatedAt: new Date()
      }
    })
    
    // Delete the password reset session
    await prisma.session.delete({
      where: { id: session.id }
    })
    
    // Delete any other password reset sessions for this user
    await prisma.session.deleteMany({
      where: {
        userId: session.userId,
        userAgent: 'password-reset'
      }
    })
    
    return NextResponse.json({
      success: true,
      message: 'Password reset successfully',
      email: session.user.email
    })
    
  } catch (error) {
    console.error('Password reset error:', error)
    return NextResponse.json(
      { error: 'Failed to reset password' },
      { status: 500 }
    )
  }
}