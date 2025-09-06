import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug } from '@/lib/db/schema-db'
import { ProposalVersionService } from '@/services/proposal-version-service'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify authentication
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const proposalId = params.id
    const { version } = await request.json()

    if (!version || typeof version !== 'number') {
      return NextResponse.json({ error: 'Version number is required' }, { status: 400 })
    }

    // Only admin and master can restore versions
    if (!['admin', 'master'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions to restore versions' }, { status: 403 })
    }

    // Restore the version
    const restoredProposal = await ProposalVersionService.restoreVersion(
      orgSlug,
      proposalId,
      version,
      user.id
    )

    return NextResponse.json({ 
      success: true,
      proposal: restoredProposal,
      message: `Proposal restored to version ${version}`
    })

  } catch (error: any) {
    console.error('Restore version error:', error)
    return NextResponse.json(
      { error: 'Failed to restore version', details: error.message },
      { status: 500 }
    )
  }
}