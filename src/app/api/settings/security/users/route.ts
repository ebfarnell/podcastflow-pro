import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import prisma from '@/lib/db/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin and master users can view all user activity
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch all users with their last login information
    const users = await prisma.user.findMany({
      where: {
        organizationId: session.organizationId
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: {
        lastLoginAt: 'desc'
      }
    })

    // Calculate if user is active (logged in within last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const usersWithActivity = users.map(user => ({
      ...user,
      isActive: user.lastLoginAt ? new Date(user.lastLoginAt) > thirtyDaysAgo : false
    }))

    return NextResponse.json({ 
      users: usersWithActivity,
      stats: {
        total: users.length,
        active: usersWithActivity.filter(u => u.isActive).length,
        inactive: usersWithActivity.filter(u => !u.isActive).length
      }
    })
  } catch (error) {
    console.error('Error fetching user activity:', error)
    return NextResponse.json({ error: 'Failed to fetch user activity' }, { status: 500 })
  }
}