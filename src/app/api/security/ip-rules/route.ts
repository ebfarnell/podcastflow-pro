import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import prisma from '@/lib/db/prisma'
import { createSecurityAuditLog } from '@/lib/security/audit'
import { isValidCIDR } from '@/lib/security/ip-utils'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// GET /api/security/ip-rules - Get all IP rules for organization
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Only admins and masters can manage IP rules
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    console.log('🔐 IP Rules API: Fetching IP rules for organization', { 
      organizationId: session.organizationId 
    })

    // Get all IP rules for the organization
    const ipRules = await prisma.ipRule.findMany({
      where: {
        organizationId: session.organizationId
      },
      orderBy: [
        { type: 'asc' },
        { createdAt: 'desc' }
      ]
    })

    // Format the response
    const formattedRules = ipRules.map(rule => ({
      id: rule.id,
      type: rule.type,
      cidr: rule.cidr,
      description: rule.description,
      enabled: rule.enabled,
      createdAt: rule.createdAt.toISOString(),
      updatedAt: rule.updatedAt.toISOString()
    }))

    console.log('✅ IP Rules API: Returning IP rules', { count: formattedRules.length })
    return NextResponse.json(formattedRules)

  } catch (error) {
    console.error('❌ IP Rules API Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch IP rules' },
      { status: 500 }
    )
  }
}

// POST /api/security/ip-rules - Create new IP rule
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Only admins and masters can manage IP rules
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { type, cidr, description } = body

    // Validate input
    if (!type || !['allowlist', 'blocklist'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid rule type. Must be "allowlist" or "blocklist"' },
        { status: 400 }
      )
    }

    if (!cidr || !isValidCIDR(cidr)) {
      return NextResponse.json(
        { error: 'Invalid CIDR notation' },
        { status: 400 }
      )
    }

    console.log('🔐 IP Rules API: Creating new IP rule', { 
      organizationId: session.organizationId,
      type,
      cidr 
    })

    // Check if the same CIDR already exists for this org
    const existingRule = await prisma.ipRule.findFirst({
      where: {
        organizationId: session.organizationId,
        cidr,
        type
      }
    })

    if (existingRule) {
      return NextResponse.json(
        { error: 'This IP rule already exists' },
        { status: 409 }
      )
    }

    // Create the IP rule
    const ipRule = await prisma.ipRule.create({
      data: {
        organizationId: session.organizationId,
        type,
        cidr,
        description: description || null,
        enabled: true,
        createdBy: session.userId
      }
    })

    // Create audit log
    await createSecurityAuditLog({
      organizationId: session.organizationId,
      userId: session.userId,
      userEmail: session.email,
      action: 'IP_RULE_CREATED',
      resource: 'ip_rule',
      resourceId: ipRule.id,
      changes: { type, cidr, description },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      success: true
    })

    console.log('✅ IP Rules API: IP rule created successfully')
    return NextResponse.json({
      id: ipRule.id,
      type: ipRule.type,
      cidr: ipRule.cidr,
      description: ipRule.description,
      enabled: ipRule.enabled,
      createdAt: ipRule.createdAt.toISOString(),
      updatedAt: ipRule.updatedAt.toISOString()
    })

  } catch (error) {
    console.error('❌ IP Rules API Error:', error)
    return NextResponse.json(
      { error: 'Failed to create IP rule' },
      { status: 500 }
    )
  }
}

// PUT /api/security/ip-rules - Update IP rule
export async function PUT(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Only admins and masters can manage IP rules
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { id, enabled, description } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Rule ID is required' },
        { status: 400 }
      )
    }

    console.log('🔐 IP Rules API: Updating IP rule', { 
      organizationId: session.organizationId,
      ruleId: id 
    })

    // Verify the rule belongs to the organization
    const existingRule = await prisma.ipRule.findFirst({
      where: {
        id,
        organizationId: session.organizationId
      }
    })

    if (!existingRule) {
      return NextResponse.json(
        { error: 'IP rule not found' },
        { status: 404 }
      )
    }

    // Update the rule
    const updatedRule = await prisma.ipRule.update({
      where: { id },
      data: {
        enabled: enabled !== undefined ? enabled : existingRule.enabled,
        description: description !== undefined ? description : existingRule.description,
        updatedAt: new Date()
      }
    })

    // Create audit log
    const changes: any = {}
    if (enabled !== undefined && enabled !== existingRule.enabled) {
      changes.enabled = { from: existingRule.enabled, to: enabled }
    }
    if (description !== undefined && description !== existingRule.description) {
      changes.description = { from: existingRule.description, to: description }
    }

    if (Object.keys(changes).length > 0) {
      await createSecurityAuditLog({
        organizationId: session.organizationId,
        userId: session.userId,
        userEmail: session.email,
        action: 'IP_RULE_UPDATED',
        resource: 'ip_rule',
        resourceId: id,
        changes,
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        success: true
      })
    }

    console.log('✅ IP Rules API: IP rule updated successfully')
    return NextResponse.json({
      id: updatedRule.id,
      type: updatedRule.type,
      cidr: updatedRule.cidr,
      description: updatedRule.description,
      enabled: updatedRule.enabled,
      createdAt: updatedRule.createdAt.toISOString(),
      updatedAt: updatedRule.updatedAt.toISOString()
    })

  } catch (error) {
    console.error('❌ IP Rules API Error:', error)
    return NextResponse.json(
      { error: 'Failed to update IP rule' },
      { status: 500 }
    )
  }
}

// DELETE /api/security/ip-rules - Delete IP rule
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Only admins and masters can manage IP rules
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Rule ID is required' },
        { status: 400 }
      )
    }

    console.log('🔐 IP Rules API: Deleting IP rule', { 
      organizationId: session.organizationId,
      ruleId: id 
    })

    // Verify the rule belongs to the organization
    const existingRule = await prisma.ipRule.findFirst({
      where: {
        id,
        organizationId: session.organizationId
      }
    })

    if (!existingRule) {
      return NextResponse.json(
        { error: 'IP rule not found' },
        { status: 404 }
      )
    }

    // Delete the rule
    await prisma.ipRule.delete({
      where: { id }
    })

    // Create audit log
    await createSecurityAuditLog({
      organizationId: session.organizationId,
      userId: session.userId,
      userEmail: session.email,
      action: 'IP_RULE_DELETED',
      resource: 'ip_rule',
      resourceId: id,
      changes: { 
        type: existingRule.type,
        cidr: existingRule.cidr,
        description: existingRule.description 
      },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      success: true
    })

    console.log('✅ IP Rules API: IP rule deleted successfully')
    return NextResponse.json({
      message: 'IP rule deleted successfully'
    })

  } catch (error) {
    console.error('❌ IP Rules API Error:', error)
    return NextResponse.json(
      { error: 'Failed to delete IP rule' },
      { status: 500 }
    )
  }
}