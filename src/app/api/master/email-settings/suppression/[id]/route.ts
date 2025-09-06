// Delete suppression list entry

import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import prisma from '@/lib/db/prisma'

// DELETE /api/master/email-settings/suppression/:id
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only master accounts can remove from suppression list
    if (session.role !== 'master') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = params

    if (!id) {
      return NextResponse.json(
        { error: 'Suppression ID required' },
        { status: 400 }
      )
    }

    // Delete from suppression list
    await prisma.emailSuppressionList.delete({
      where: { id }
    })

    return NextResponse.json({
      success: true,
      message: 'Email removed from suppression list'
    })
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Suppression entry not found' },
        { status: 404 }
      )
    }
    
    console.error('Failed to remove from suppression list:', error)
    return NextResponse.json(
      { error: 'Failed to remove from suppression list' },
      { status: 500 }
    )
  }
}