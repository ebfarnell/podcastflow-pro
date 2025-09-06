import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import { AdApprovalServiceSchema } from '@/lib/services/ad-approval-service-schema'

// Force this route to be dynamic
export const dynamic = 'force-dynamic'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Only sales and admin can request revisions
    if (user.role !== 'sales' && user.role !== 'admin' && user.role !== 'master') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { feedback } = body
    
    console.log(`🔄 Requesting revision for ad approval ${params.id} with feedback:`, feedback)
    
    // Request revision using schema-aware service
    const approval = await AdApprovalServiceSchema.requestRevision(
      params.id,
      user.id,
      feedback || 'Please revise'
    )
    
    console.log(`🔄 Revision requested for ad approval ${params.id}`)
    
    return NextResponse.json({
      message: 'Revision requested successfully',
      approval
    })
  } catch (error) {
    console.error('❌ Error requesting revision:', error)
    return NextResponse.json(
      { error: 'Failed to request revision' },
      { status: 500 }
    )
  }
}