import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { getProvisioningStatus } from '@/lib/provisioning/audit'

export async function GET(
  request: NextRequest,
  { params }: { params: { organizationId: string } }
) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const orgId = params.organizationId

    // Check permissions - master users can check any org, others only their own
    if (session.role !== 'master' && session.organizationId !== orgId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // Get the latest provisioning status
    const status = await getProvisioningStatus(orgId)

    if (!status) {
      return NextResponse.json({
        status: 'unknown',
        message: 'No provisioning records found for this organization'
      })
    }

    return NextResponse.json({
      status: status.status,
      summary: status.summary,
      error: status.error,
      duration: status.duration,
      mode: status.mode,
      createdAt: status.createdAt,
      updatedAt: status.updatedAt
    })

  } catch (error) {
    console.error('Provisioning status error:', error)
    return NextResponse.json(
      { error: 'Failed to get provisioning status' },
      { status: 500 }
    )
  }
}