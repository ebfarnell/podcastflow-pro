import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import prisma from '@/lib/db/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const networkId = searchParams.get('networkId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    const where = {
      organizationId: session.user.organizationId,
      ...(networkId && { networkId })
    }

    const [podcasts, total] = await Promise.all([
      prisma.megaphonePodcast.findMany({
        where,
        orderBy: { title: 'asc' },
        skip,
        take: limit,
        select: {
          id: true,
          megaphoneId: true,
          title: true,
          subtitle: true,
          author: true,
          imageFile: true,
          episodesCount: true,
          lastSyncAt: true,
          createdAt: true,
          network: {
            select: {
              id: true,
              name: true
            }
          },
          _count: {
            select: {
              episodes: true
            }
          }
        }
      }),
      prisma.megaphonePodcast.count({ where })
    ])

    return NextResponse.json({
      podcasts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching Megaphone podcasts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch podcasts' },
      { status: 500 }
    )
  }
}