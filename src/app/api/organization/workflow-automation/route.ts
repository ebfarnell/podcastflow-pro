import { NextRequest, NextResponse } from 'next/server'
import { withTenantIsolation } from '@/lib/db/tenant-isolation'
import prisma from '@/lib/db/prisma'
import { z } from 'zod'

// Schema for workflow automation settings
const workflowAutomationSchema = z.object({
  enabled: z.boolean().default(true),
  autoStages: z.object({
    at10: z.boolean().default(true),
    at35: z.boolean().default(true),
    at65: z.boolean().default(true),
    at90: z.boolean().default(true),
    at100: z.boolean().default(true),
  }),
  inventory: z.object({
    reserveAt90: z.boolean().default(true),
    reservationTtlHours: z.number().min(1).max(720).default(72),
  }),
  rateCard: z.object({
    deltaApprovalThresholdPct: z.number().min(0).max(100).default(15),
  }),
  exclusivity: z.object({
    policy: z.enum(['WARN', 'BLOCK']).default('WARN'),
    categories: z.array(z.string()).default([]),
  }),
  talentApprovals: z.object({
    hostRead: z.boolean().default(true),
    endorsed: z.boolean().default(true),
  }),
  contracts: z.object({
    autoGenerate: z.boolean().default(true),
    emailTemplateId: z.string().default('contract_default'),
  }),
  billing: z.object({
    invoiceDayOfMonth: z.number().min(1).max(28).default(15),
    timezone: z.string().default('America/Los_Angeles'),
    prebillWhenNoTerms: z.boolean().default(true),
  }),
})

export async function GET(request: NextRequest) {
  try {
    return await withTenantIsolation(request, async (context) => {
      // Only admins and master users can view workflow settings
      if (!['admin', 'master'].includes(context.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      try {
        // Get organization settings from public schema
        const organization = await prisma.organization.findUnique({
          where: { id: context.organizationId },
          select: { settings: true },
        })

        if (!organization) {
          // Return defaults if org not found (shouldn't happen but defensive)
          console.warn(`Organization ${context.organizationId} not found, returning defaults`)
          const defaultSettings = workflowAutomationSchema.parse({})
          return NextResponse.json(defaultSettings)
        }

        // Extract workflow automation settings
        const settings = organization.settings as any || {}
        const workflowSettings = settings.workflowAutomation || {}

        // Parse and merge settings with defaults
        // Use parse to get defaults, then override with actual settings
        const parsedSettings = workflowAutomationSchema.parse({
          enabled: workflowSettings.enabled ?? true,
          autoStages: workflowSettings.autoStages || {},
          inventory: workflowSettings.inventory || {},
          rateCard: workflowSettings.rateCard || {},
          exclusivity: workflowSettings.exclusivity || {},
          talentApprovals: workflowSettings.talentApprovals || {},
          contracts: workflowSettings.contracts || {},
          billing: workflowSettings.billing || {},
        })

        return NextResponse.json(parsedSettings)
      } catch (dbError) {
        console.error('Database error in workflow GET:', dbError)
        // Return defaults on DB error
        const defaultSettings = workflowAutomationSchema.parse({})
        return NextResponse.json(defaultSettings)
      }
    })
  } catch (error) {
    console.error('Error fetching workflow automation settings:', error)
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    return await withTenantIsolation(request, async (context) => {
      // Only admins and master users can update workflow settings
      if (!['admin', 'master'].includes(context.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      const body = await request.json()
      
      // Validate the settings
      const validatedSettings = workflowAutomationSchema.parse(body)

      // Get current organization settings from public schema
      const organization = await prisma.organization.findUnique({
        where: { id: context.organizationId },
        select: { settings: true },
      })

      if (!organization) {
        return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
      }

      const currentSettings = organization.settings as any || {}
      
      // Update workflow automation settings
      const updatedSettings = {
        ...currentSettings,
        workflowAutomation: validatedSettings,
      }

      // Save updated settings
      await prisma.organization.update({
        where: { id: context.organizationId },
        data: { settings: updatedSettings },
      })

      // Log the update
      console.log(`Workflow automation settings updated for org ${context.organizationId} by user ${context.userId}`)

      return NextResponse.json({ 
        success: true, 
        settings: validatedSettings 
      })
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Invalid settings format', 
        details: error.errors 
      }, { status: 400 })
    }
    
    console.error('Error updating workflow automation settings:', error)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}