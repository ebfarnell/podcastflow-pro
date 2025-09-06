import { NextRequest, NextResponse } from 'next/server'
import { withTenantIsolation, getTenantClient } from '@/lib/db/tenant-isolation'
import prisma from '@/lib/db/prisma'
import { z } from 'zod'

const simulateSchema = z.object({
  campaignId: z.string(),
  targetStage: z.enum(['10', '35', '65', '90', '100']),
  dryRun: z.boolean().default(false),
})

export async function POST(request: NextRequest) {
  try {
    return await withTenantIsolation(request, async (context) => {
      // Only admins and master users can simulate transitions
      if (!['admin', 'master'].includes(context.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      const body = await request.json()
      const { campaignId, targetStage, dryRun } = simulateSchema.parse(body)

      // Get organization settings for workflow automation from public schema
      const organization = await prisma.organization.findUnique({
        where: { id: context.organizationId },
        select: { settings: true },
      })

      if (!organization) {
        return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
      }

      const settings = (organization.settings as any)?.workflowAutomation || {}
      
      // Get campaign from org schema using tenant client
      const tenantDb = getTenantClient(context)
      const campaign = await tenantDb.campaign.findUnique({
        where: { id: campaignId },
        include: {
          advertiser: true,
          agency: true,
        }
      })

      if (!campaign) {
        return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
      }

      const sideEffects: any[] = []
      const targetProbability = parseInt(targetStage)

      // Simulate stage transitions based on target
      if (targetProbability >= 10 && settings.autoStages?.at10 !== false) {
        sideEffects.push({
          stage: 10,
          action: 'CAMPAIGN_ACTIVATED',
          description: 'Campaign marked as active pre-sale',
          scheduleBuilderEnabled: true,
        })
      }

      if (targetProbability >= 35 && settings.autoStages?.at35 !== false) {
        sideEffects.push({
          stage: 35,
          action: 'SCHEDULE_VALIDATED',
          description: 'Schedule saved and rate card delta tracking started',
          rateCardDeltaTracking: true,
        })
      }

      if (targetProbability >= 65 && settings.autoStages?.at65 !== false) {
        // Check for talent approval requirement
        const requiresTalentApproval = settings.talentApprovals?.hostRead || settings.talentApprovals?.endorsed
        if (requiresTalentApproval) {
          sideEffects.push({
            stage: 65,
            action: 'TALENT_APPROVAL_REQUESTED',
            description: 'Talent/Producer approval request created',
            approvalId: dryRun ? 'SIMULATED-APPROVAL-001' : null,
          })
        }

        // Check exclusivity conflicts
        if (settings.exclusivity?.policy) {
          sideEffects.push({
            stage: 65,
            action: 'EXCLUSIVITY_CHECK',
            description: `Category exclusivity check performed (${settings.exclusivity.policy} mode)`,
            conflicts: [],
          })
        }
      }

      if (targetProbability >= 90 && settings.autoStages?.at90 !== false) {
        // Inventory reservation
        if (settings.inventory?.reserveAt90 !== false) {
          sideEffects.push({
            stage: 90,
            action: 'INVENTORY_RESERVED',
            description: `Inventory reserved with ${settings.inventory?.reservationTtlHours || 72} hour TTL`,
            reservationIds: dryRun ? ['SIMULATED-RESERVATION-001', 'SIMULATED-RESERVATION-002'] : [],
          })
        }

        // Admin approval
        sideEffects.push({
          stage: 90,
          action: 'ADMIN_APPROVAL_REQUIRED',
          description: 'Campaign moved to reservations pending admin approval',
        })
      }

      if (targetProbability >= 100 && settings.autoStages?.at100 !== false) {
        // Order creation
        sideEffects.push({
          stage: 100,
          action: 'ORDER_CREATED',
          description: 'Campaign copied to Post-Sale (Order)',
          orderId: dryRun ? 'SIMULATED-ORDER-001' : null,
        })

        // Ad requests
        sideEffects.push({
          stage: 100,
          action: 'AD_REQUESTS_GENERATED',
          description: 'Ad requests created for shows/talent',
          adRequestIds: dryRun ? ['SIMULATED-AD-REQ-001'] : [],
        })

        // Contract generation
        if (settings.contracts?.autoGenerate !== false) {
          sideEffects.push({
            stage: 100,
            action: 'CONTRACT_GENERATED',
            description: `Contract generated using template: ${settings.contracts?.emailTemplateId || 'default'}`,
            contractId: dryRun ? 'SIMULATED-CONTRACT-001' : null,
          })
        }

        // Billing schedule
        if (settings.billing) {
          sideEffects.push({
            stage: 100,
            action: 'BILLING_SCHEDULE_CREATED',
            description: `Monthly billing schedule created (day ${settings.billing.invoiceDayOfMonth || 15})`,
            billingScheduleId: dryRun ? 'SIMULATED-BILLING-001' : null,
            prebillEnabled: settings.billing.prebillWhenNoTerms,
          })
        }
      }

      // Notifications that would be sent
      const notifications = [
        { event: 'campaign_status_changed', recipients: ['admin', 'seller'] },
      ]

      if (targetProbability >= 65) {
        notifications.push({ event: 'approval_requested', recipients: ['producer', 'talent'] })
      }
      if (targetProbability >= 90) {
        notifications.push({ event: 'inventory_reserved', recipients: ['admin'] })
      }
      if (targetProbability >= 100) {
        notifications.push(
          { event: 'order_created', recipients: ['admin', 'seller'] },
          { event: 'contract_generated', recipients: ['client'] }
        )
      }

      // If not dry run and in dev mode, actually perform some actions
      if (!dryRun && process.env.NODE_ENV === 'development') {
        // Update campaign probability in org schema
        await tenantDb.campaign.update({
          where: { id: campaignId },
          data: { 
            probability: targetProbability,
            updatedAt: new Date()
          }
        })
      }

      return NextResponse.json({
        success: true,
        simulation: {
          campaignId,
          currentStage: campaign.probability,
          targetStage: targetProbability,
          dryRun,
          sideEffects,
          notifications,
          settingsApplied: {
            autoStages: settings.autoStages,
            inventory: settings.inventory,
            exclusivity: settings.exclusivity,
            talentApprovals: settings.talentApprovals,
            contracts: settings.contracts,
            billing: settings.billing,
          },
        },
      })
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Invalid request format', 
        details: error.errors 
      }, { status: 400 })
    }
    
    console.error('Error simulating workflow transition:', error)
    return NextResponse.json({ error: 'Failed to simulate transition' }, { status: 500 })
  }
}