import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { getUserOrgSlug } from '@/lib/db/schema-db'
import { workflowAutomation } from '@/lib/workflow/automation-service'

/**
 * GET /api/workflow/automations
 * 
 * Get all workflow automation rules
 * Only accessible by admin and master users
 */
export async function GET(request: NextRequest) {
  try {
    // Session validation
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only allow admin and master users
    if (!['master', 'admin'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const automationRules = workflowAutomation.getAutomationRules()

    return NextResponse.json({
      rules: automationRules,
      message: 'Automation rules retrieved successfully'
    })

  } catch (error) {
    console.error('Error fetching automation rules:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/workflow/automations
 * 
 * Execute a specific automation rule manually or update rule status
 * Only accessible by admin and master users
 */
export async function POST(request: NextRequest) {
  try {
    // Session validation
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only allow admin and master users
    if (!['master', 'admin'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { action, ruleId, entityId, entityType, previousState, newState, metadata } = body

    const orgSlug = await getUserOrgSlug(session.userId)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 400 })
    }

    if (action === 'trigger') {
      // Manually trigger a specific automation
      if (!ruleId || !entityId || !entityType || !newState) {
        return NextResponse.json({ 
          error: 'Missing required fields: ruleId, entityId, entityType, newState' 
        }, { status: 400 })
      }

      const context = {
        userId: session.userId,
        orgSlug,
        entityId,
        entityType,
        previousState,
        newState,
        metadata
      }

      await workflowAutomation.triggerAutomation(ruleId, context)

      return NextResponse.json({
        message: `Automation rule ${ruleId} executed successfully`,
        context
      })

    } else if (action === 'toggle') {
      // Enable/disable a specific rule
      if (!ruleId || typeof body.isActive !== 'boolean') {
        return NextResponse.json({ 
          error: 'Missing required fields: ruleId, isActive' 
        }, { status: 400 })
      }

      workflowAutomation.setRuleStatus(ruleId, body.isActive)

      return NextResponse.json({
        message: `Automation rule ${ruleId} ${body.isActive ? 'enabled' : 'disabled'}`,
        ruleId,
        isActive: body.isActive
      })

    } else {
      return NextResponse.json({ 
        error: 'Invalid action. Supported actions: trigger, toggle' 
      }, { status: 400 })
    }

  } catch (error) {
    console.error('Error processing automation request:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }, { status: 500 })
  }
}