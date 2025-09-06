import { NextRequest, NextResponse } from 'next/server'
import { AdApprovalServiceSchema } from '@/lib/services/ad-approval-service-schema'
import { getUserFromRequest } from '@/lib/auth/auth-middleware'
import { UserService } from '@/lib/auth/user-service'
import { withApiProtection, AuthenticatedRequest } from '@/lib/auth/api-protection'
import { PERMISSIONS } from '@/types/auth'

// Force this route to be dynamic
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Validate session
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') as any
    
    // Filter by organization and other criteria
    const filters: any = {}
    
    if (status && status !== 'all') {
      filters.status = status
    }

    // Role-based filtering
    if (user.role === 'sales') {
      filters.salesRepId = user.id
    }
    
    // Use schema-aware service to get approvals
    const approvals = await AdApprovalServiceSchema.list(user.id, filters)
    
    // Additional filtering for producers/talent
    let filteredApprovals = approvals
    if (user.role === 'producer') {
      filteredApprovals = approvals.filter(approval => 
        approval.show.assignedProducers.some((p: any) => p.id === user.id)
      )
    } else if (user.role === 'talent') {
      filteredApprovals = approvals.filter(approval => 
        approval.show.assignedTalent.some((t: any) => t.id === user.id)
      )
    }
    
    return NextResponse.json({
      approvals: filteredApprovals,
      total: filteredApprovals.length,
    })
  } catch (error) {
    console.error('Error fetching ad approvals:', error)
    return NextResponse.json(
      { error: 'Failed to fetch ad approvals' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Validate session
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only sales and admin can create ad approvals
    if (user.role !== 'sales' && user.role !== 'admin' && user.role !== 'master') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    
    // Validate inputs
    const showIds = body.showIds || body.shows || []
    const durations = body.durations || []
    
    if (showIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one show must be selected' },
        { status: 400 }
      )
    }
    
    if (durations.length === 0) {
      return NextResponse.json(
        { error: 'At least one duration must be selected' },
        { status: 400 }
      )
    }

    // Create approvals using schema-aware service
    const approvals = await AdApprovalServiceSchema.create(user.id, {
      title: body.title,
      advertiserId: body.advertiserId,
      advertiserName: body.advertiserName,
      campaignId: body.campaignId,
      showIds,
      durations,
      type: body.type || 'host-read',
      script: body.script,
      talkingPoints: body.talkingPoints,
      priority: body.priority,
      deadline: body.deadline ? new Date(body.deadline) : undefined,
      salesRepId: user.role === 'sales' ? user.id : body.salesRepId || user.id,
      salesRepName: user.name,
      submittedBy: user.id,
      organizationId: user.organizationId!,
    })
    
    console.log(`✅ Created ${approvals.length} ad approvals`)
    
    return NextResponse.json({
      message: `Created ${approvals.length} ad approval(s)`,
      approvals,
      showIds,
      durations,
      totalApprovals: approvals.length
    }, { status: 201 })
    
  } catch (error) {
    console.error('❌ Error creating ad approval:', error)
    return NextResponse.json(
      { error: 'Failed to create ad approval' },
      { status: 500 }
    )
  }
}