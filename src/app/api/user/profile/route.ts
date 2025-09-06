import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import prisma from '@/lib/db/prisma'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      )
    }

    console.log('📝 User Profile API: Fetching profile for user', { userId: user.id, role: user.role })

    // Fetch full user profile from database
    const userProfile = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        organization: user.role !== 'master' ? {
          select: {
            id: true,
            name: true,
            plan: true
          }
        } : false
      }
    })

    if (!userProfile) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Format response
    const response = {
      id: userProfile.id,
      email: userProfile.email,
      name: userProfile.name || 'User',
      role: userProfile.role,
      status: userProfile.isActive ? 'active' : 'inactive',
      avatar: userProfile.avatar,
      phone: userProfile.phone,
      department: userProfile.department,
      title: userProfile.title,
      bio: userProfile.bio,
      timezone: userProfile.timezone || 'America/New_York',
      language: userProfile.language || 'en',
      notifications: {
        email: userProfile.emailNotifications ?? true,
        push: userProfile.pushNotifications ?? true,
        sms: userProfile.smsNotifications ?? false
      },
      preferences: {
        theme: userProfile.theme || 'light',
        emailFrequency: userProfile.emailFrequency || 'daily',
        showWelcomeMessage: userProfile.showWelcomeMessage ?? true
      },
      organization: userProfile.organization,
      lastLoginAt: userProfile.lastLoginAt?.toISOString() || new Date().toISOString(),
      createdAt: userProfile.createdAt.toISOString()
    }

    console.log('✅ User Profile API: Returning profile data')
    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ User Profile API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Verify authentication
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      )
    }

    const updates = await request.json()
    console.log('📝 User Profile API: Updating profile', { userId: user.id, updates })

    // Build update data object
    const updateData: any = {
      updatedAt: new Date()
    }

    // Map updates to database fields
    if (updates.name !== undefined) updateData.name = updates.name
    if (updates.phone !== undefined) updateData.phone = updates.phone
    if (updates.department !== undefined) updateData.department = updates.department
    if (updates.title !== undefined) updateData.title = updates.title
    if (updates.bio !== undefined) updateData.bio = updates.bio
    if (updates.timezone !== undefined) updateData.timezone = updates.timezone
    if (updates.language !== undefined) updateData.language = updates.language

    // Handle notifications object
    if (updates.notifications) {
      if (updates.notifications.email !== undefined) updateData.emailNotifications = updates.notifications.email
      if (updates.notifications.push !== undefined) updateData.pushNotifications = updates.notifications.push
      if (updates.notifications.sms !== undefined) updateData.smsNotifications = updates.notifications.sms
    }

    // Handle preferences object
    if (updates.preferences) {
      if (updates.preferences.theme !== undefined) updateData.theme = updates.preferences.theme
      if (updates.preferences.emailFrequency !== undefined) updateData.emailFrequency = updates.preferences.emailFrequency
      if (updates.preferences.showWelcomeMessage !== undefined) updateData.showWelcomeMessage = updates.preferences.showWelcomeMessage
    }

    // Update user profile in PostgreSQL
    const updatedProfile = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
      include: {
        organization: user.role !== 'master' ? {
          select: {
            id: true,
            name: true,
            plan: true
          }
        } : false
      }
    })

    console.log('✅ User Profile API: Profile updated successfully')
    
    // Return the updated profile in the same format as GET
    const response = {
      id: updatedProfile.id,
      email: updatedProfile.email,
      name: updatedProfile.name || 'User',
      role: updatedProfile.role,
      status: updatedProfile.isActive ? 'active' : 'inactive',
      avatar: updatedProfile.avatar,
      phone: updatedProfile.phone,
      department: updatedProfile.department,
      title: updatedProfile.title,
      bio: updatedProfile.bio,
      timezone: updatedProfile.timezone || 'America/New_York',
      language: updatedProfile.language || 'en',
      notifications: {
        email: updatedProfile.emailNotifications ?? true,
        push: updatedProfile.pushNotifications ?? true,
        sms: updatedProfile.smsNotifications ?? false
      },
      preferences: {
        theme: updatedProfile.theme || 'light',
        emailFrequency: updatedProfile.emailFrequency || 'daily',
        showWelcomeMessage: updatedProfile.showWelcomeMessage ?? true
      },
      organization: updatedProfile.organization,
      lastLoginAt: updatedProfile.lastLoginAt?.toISOString() || new Date().toISOString(),
      createdAt: updatedProfile.createdAt.toISOString()
    }
    
    return NextResponse.json({
      message: 'Profile updated successfully',
      profile: response
    })

  } catch (error) {
    console.error('❌ User Profile API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
