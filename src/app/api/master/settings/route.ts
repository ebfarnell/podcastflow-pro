import { NextRequest, NextResponse } from 'next/server'
import { withMasterProtection } from '@/lib/auth/api-protection'

// Platform settings - in production these would be stored in database
const platformSettings = {
  platformName: 'PodcastFlow Pro',
  supportEmail: 'support@podcastflow.pro',
  maintenanceMode: false,
  registrationEnabled: true,
  defaultUserRole: 'client',
  enforceSSL: true,
  sessionTimeout: 8, // hours
  passwordMinLength: 8,
  requireMFA: false,
  allowedDomains: '',
  emailNotifications: true,
  systemAlerts: true,
  maintenanceNotices: true,
  weeklyReports: true,
  maxUploadSize: 100, // MB
  storageQuota: 1000, // GB
  backupRetention: 30, // days
  rateLimitEnabled: true,
  requestsPerMinute: 1000,
  apiVersioning: true,
}

// GET /api/master/settings
export const GET = await withMasterProtection(async (request: NextRequest) => {
  try {
    // Return current settings
    return NextResponse.json(platformSettings)
  } catch (error) {
    console.error('Master settings API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    )
  }
})

// PUT /api/master/settings
export const PUT = await withMasterProtection(async (request: NextRequest) => {
  try {
    const updates = await request.json()
    
    // In production, this would update the database
    // For now, we'll merge with current settings
    Object.assign(platformSettings, updates)
    
    console.log('Platform settings updated:', updates)
    
    return NextResponse.json({
      success: true,
      settings: platformSettings
    })
  } catch (error) {
    console.error('Update settings error:', error)
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    )
  }
})