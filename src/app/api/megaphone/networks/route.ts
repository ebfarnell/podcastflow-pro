import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import prisma from '@/lib/db/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const networks = await prisma.megaphoneNetwork.findMany({
      where: { organizationId: session.user.organizationId },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        megaphoneId: true,
        name: true,
        code: true,
        podcastCount: true,
        lastSyncAt: true,
        createdAt: true,
        _count: {
          select: {
            podcasts: true
          }
        }
      }
    })

    return NextResponse.json(networks)
  } catch (error) {
    console.error('Error fetching Megaphone networks:', error)
    return NextResponse.json(
      { error: 'Failed to fetch networks' },
      { status: 500 }
    )
  }
}