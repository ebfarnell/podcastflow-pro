import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

// GET /api/auth/reset-password/validate?token=xxx - Validate password reset token
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const token = searchParams.get('token')
    
    if (!token) {
      return NextResponse.json(
        { valid: false, error: 'Token is required' },
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
        { valid: false, error: 'Invalid password reset token' },
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
        { valid: false, error: 'Password reset link has expired' },
        { status: 400 }
      )
    }
    
    // Check if this is a password reset session
    if (session.userAgent !== 'password-reset') {
      return NextResponse.json(
        { valid: false, error: 'Invalid password reset token' },
        { status: 400 }
      )
    }
    
    return NextResponse.json({
      valid: true,
      email: session.user.email,
      expiresAt: session.expiresAt.toISOString()
    })
    
  } catch (error) {
    console.error('Token validation error:', error)
    return NextResponse.json(
      { valid: false, error: 'Failed to validate token' },
      { status: 500 }
    )
  }
}