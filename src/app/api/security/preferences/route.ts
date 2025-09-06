import { NextRequest, NextResponse } from 'next/server'
import { db, TABLES, prefixId } from '@/lib/dynamodb'

export async function PUT(request: NextRequest) {
  try {
    // Check authentication
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const preferences = await request.json()

    // Validate preferences
    const validPreferences = [
      'sessionTimeout',
      'requirePasswordChange',
      'allowMultipleSessions',
      'notifyOnNewLogin',
      'notifyOnPasswordChange'
    ]

    const invalidKeys = Object.keys(preferences).filter(
      key => !validPreferences.includes(key)
    )

    if (invalidKeys.length > 0) {
      return NextResponse.json(
        { error: `Invalid preference keys: ${invalidKeys.join(', ')}` },
        { status: 400 }
      )
    }

    // Get user ID from token
    const token = authHeader.replace('Bearer ', '')
    let userId: string
    if (token === 'master-token') {
      userId = 'master-user-id'
    } else {
      userId = 'test-user-id'
    }

    console.log('🔐 Preferences API: Updating security preferences', { userId, preferences })

    // Get current security settings
    const result = await db.get(TABLES.SETTINGS, {
      PK: prefixId('USER', userId),
      SK: 'SECURITY'
    })

    const currentSettings = result.Item || {}
    const currentPreferences = currentSettings.securityPreferences || {}

    // Merge preferences
    const updatedPreferences = {
      ...currentPreferences,
      ...preferences
    }

    // Update security preferences
    await db.update(
      TABLES.SETTINGS,
      {
        PK: prefixId('USER', userId),
        SK: 'SECURITY'
      },
      {
        securityPreferences: updatedPreferences
      }
    )

    console.log('✅ Preferences API: Security preferences updated successfully')
    return NextResponse.json({
      message: 'Security preferences updated successfully',
      preferences: updatedPreferences
    })

  } catch (error) {
    console.error('❌ Preferences API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}