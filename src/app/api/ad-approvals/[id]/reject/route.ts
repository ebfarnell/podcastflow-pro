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

    // Only sales and admin can reject
    if (user.role !== 'sales' && user.role !== 'admin' && user.role !== 'master') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { feedback } = body
    
    console.log(`❌ Rejecting ad approval ${params.id} with feedback:`, feedback)
    
    // Reject the ad using schema-aware service
    const approval = await AdApprovalServiceSchema.reject(
      params.id,
      user.id,
      feedback || 'No reason provided'
    )
    
    console.log(`❌ Ad approval ${params.id} rejected successfully`)
    
    return NextResponse.json({
      message: 'Approval rejected successfully',
      approval
    })
  } catch (error) {
    console.error('❌ Error rejecting ad approval:', error)
    return NextResponse.json(
      { error: 'Failed to reject ad approval' },
      { status: 500 }
    )
  }
}