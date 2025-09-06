import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import prisma from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

// Force migration of sidebar customization to fix icon issues
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get current preferences
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { preferences: true }
    })

    const preferences = (user?.preferences as any) || {}
    
    // Check if sidebar customization exists and needs migration
    if (preferences.sidebarCustomization) {
      // Set a flag to force reset on next load
      preferences.sidebarCustomizationVersion = 1
      preferences.forceReset = true
      
      // Update preferences
      await prisma.user.update({
        where: { id: session.userId },
        data: { preferences }
      })
      
      return NextResponse.json({ 
        success: true, 
        message: 'Sidebar customization marked for migration' 
      })
    }

    return NextResponse.json({ 
      success: true, 
      message: 'No migration needed' 
    })
  } catch (error) {
    console.error('Error migrating preferences:', error)
    return NextResponse.json(
      { error: 'Failed to migrate preferences' },
      { status: 500 }
    )
  }
}