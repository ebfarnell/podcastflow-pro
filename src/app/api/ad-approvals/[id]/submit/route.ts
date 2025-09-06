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

    // Only producers and talent can submit spots
    if (user.role !== 'producer' && user.role !== 'talent' && user.role !== 'admin' && user.role !== 'master') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { audioUrl, audioFileInfo, notes, s3Key } = body
    
    console.log(`📤 Submitting completed spot for ad approval ${params.id}`)
    
    // Submit the spot using schema-aware service
    const result = await AdApprovalServiceSchema.submitSpot(params.id, {
      audioUrl,
      s3Key,
      fileName: audioFileInfo?.fileName,
      fileSize: audioFileInfo?.fileSize,
      fileType: audioFileInfo?.fileType,
      audioDuration: audioFileInfo?.duration,
      notes,
      submittedBy: user.id,
      submitterRole: user.role,
    })
    
    console.log(`✅ Spot submitted for ad approval ${params.id} by ${user.role}`)
    
    return NextResponse.json({
      message: 'Spot submitted successfully',
      approval: result.approval,
      submission: result.submission,
    })
  } catch (error) {
    console.error('❌ Error submitting spot:', error)
    return NextResponse.json(
      { error: 'Failed to submit spot' },
      { status: 500 }
    )
  }
}