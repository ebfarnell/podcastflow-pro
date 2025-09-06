import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import prisma from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Clear sidebar customization from user preferences
    await prisma.user.update({
      where: { id: session.userId },
      data: {
        preferences: {
          ...((await prisma.user.findUnique({
            where: { id: session.userId },
            select: { preferences: true }
          }))?.preferences as any || {}),
          sidebarCustomization: null
        }
      }
    })

    return NextResponse.json({ 
      success: true, 
      message: 'Sidebar customization cleared. Please refresh the page.' 
    })
  } catch (error) {
    console.error('Error clearing sidebar customization:', error)
    return NextResponse.json(
      { error: 'Failed to clear sidebar customization' },
      { status: 500 }
    )
  }
}