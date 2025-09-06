// Master email settings API endpoints

import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import prisma from '@/lib/db/prisma'
import { PlatformEmailSettingsData } from '@/lib/email/types'
import { emailService, EmailService } from '@/services/email'
import { EmailProviderFactory } from '@/services/email/providers/factory'

// GET /api/master/email-settings
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only master accounts can access platform settings
    if (session.role !== 'master') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get platform email settings
    const settings = await prisma.platformEmailSettings.findFirst()

    if (!settings) {
      // Return default empty state
      return NextResponse.json({
        configured: false,
        provider: null,
        message: 'Email system not configured. Please configure email provider settings.',
        settings: {
          id: null,
          provider: null,
          sesConfig: {
            configured: false,
            region: null,
            useIAMRole: true
          },
          smtpConfig: {
            configured: false,
            host: null,
            port: null,
            secure: false
          },
          quotaLimits: {
            dailyQuota: 0,
            sendRate: 0,
            maxRecipients: 50
          },
          monitoring: {
            trackOpens: false,
            trackClicks: false,
            trackBounces: true,
            trackComplaints: true
          },
          suppressionList: {
            enabled: false,
            autoAddBounces: true,
            autoAddComplaints: true
          },
          isConfigured: false
        }
      })
    }

    // Don't send sensitive credentials to frontend
    const sanitizedSettings: PlatformEmailSettingsData = {
      ...settings,
      sesConfig: {
        ...settings.sesConfig as any,
        accessKeyId: settings.sesConfig?.accessKeyId ? '***' : undefined,
        secretAccessKey: undefined // Never send this
      },
      smtpConfig: {
        ...settings.smtpConfig as any,
        auth: settings.smtpConfig?.auth ? {
          user: settings.smtpConfig.auth.user,
          pass: undefined // Never send this
        } : undefined
      }
    }

    return NextResponse.json({
      configured: settings.isConfigured,
      provider: settings.provider,
      settings: sanitizedSettings
    })
  } catch (error) {
    console.error('Failed to get email settings:', error)
    return NextResponse.json(
      { error: 'Failed to get email settings' },
      { status: 500 }
    )
  }
}

// PUT /api/master/email-settings
export async function PUT(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only master accounts can update platform settings
    if (session.role !== 'master') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const updates = await request.json()

    // Get existing settings
    let settings = await prisma.platformEmailSettings.findFirst()
    
    if (!settings) {
      // Create new settings if they don't exist
      settings = await prisma.platformEmailSettings.create({
        data: {
          provider: updates.provider,
          sesConfig: updates.sesConfig || {},
          smtpConfig: updates.smtpConfig || {},
          quotaLimits: updates.quotaLimits || {
            dailyQuota: 0,
            sendRate: 0,
            maxRecipients: 50
          },
          monitoring: updates.monitoring || {
            trackOpens: false,
            trackClicks: false,
            trackBounces: true,
            trackComplaints: true
          },
          suppressionList: updates.suppressionList || {
            enabled: false,
            autoAddBounces: true,
            autoAddComplaints: true
          },
          isConfigured: false,
          updatedBy: session.userId
        }
      })
    }

    // Prepare the config for validation
    const testConfig: any = {
      provider: updates.provider
    }

    if (updates.provider === 'ses') {
      testConfig.sesConfig = {
        ...settings.sesConfig as any,
        ...updates.sesConfig,
        // Only update credentials if provided (not '***')
        accessKeyId: updates.sesConfig?.accessKeyId && updates.sesConfig.accessKeyId !== '***' 
          ? updates.sesConfig.accessKeyId 
          : (settings.sesConfig as any)?.accessKeyId,
        secretAccessKey: updates.sesConfig?.secretAccessKey 
          ? updates.sesConfig.secretAccessKey 
          : (settings.sesConfig as any)?.secretAccessKey
      }
    } else if (updates.provider === 'smtp') {
      testConfig.smtpConfig = {
        ...settings.smtpConfig as any,
        ...updates.smtpConfig,
        auth: updates.smtpConfig?.auth ? {
          user: updates.smtpConfig.auth.user,
          pass: updates.smtpConfig.auth.pass || (settings.smtpConfig as any)?.auth?.pass
        } : (settings.smtpConfig as any)?.auth
      }
    }

    // Test the configuration
    let isConfigured = false
    try {
      const testProvider = await EmailProviderFactory.create(testConfig)
      isConfigured = true
      
      // Reset the email service to use new configuration
      EmailService.reset()
    } catch (error) {
      console.error('Email provider test failed:', error)
      return NextResponse.json(
        { error: 'Email provider configuration is invalid. Please check your settings.' },
        { status: 400 }
      )
    }

    // Update existing settings
    const updatedSettings = await prisma.platformEmailSettings.update({
      where: { id: settings.id },
      data: {
        provider: updates.provider,
        sesConfig: updates.provider === 'ses' ? testConfig.sesConfig : settings.sesConfig,
        smtpConfig: updates.provider === 'smtp' ? testConfig.smtpConfig : settings.smtpConfig,
        quotaLimits: updates.quotaLimits || settings.quotaLimits,
        monitoring: updates.monitoring || settings.monitoring,
        suppressionList: updates.suppressionList || settings.suppressionList,
        isConfigured: isConfigured,
        updatedBy: session.userId,
        updatedAt: new Date()
      }
    })

    // Sanitize response
    const sanitizedSettings: PlatformEmailSettingsData = {
      ...updatedSettings,
      sesConfig: {
        ...updatedSettings.sesConfig as any,
        accessKeyId: updatedSettings.sesConfig?.accessKeyId ? '***' : undefined,
        secretAccessKey: undefined
      },
      smtpConfig: {
        ...updatedSettings.smtpConfig as any,
        auth: updatedSettings.smtpConfig?.auth ? {
          user: updatedSettings.smtpConfig.auth.user,
          pass: undefined
        } : undefined
      }
    }

    return NextResponse.json({
      success: true,
      settings: sanitizedSettings
    })
  } catch (error) {
    console.error('Failed to update email settings:', error)
    return NextResponse.json(
      { error: 'Failed to update email settings' },
      { status: 500 }
    )
  }
}