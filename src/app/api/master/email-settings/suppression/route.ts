// Email suppression list management

import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import prisma from '@/lib/db/prisma'

// GET /api/master/email-settings/suppression
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only master accounts can view suppression list
    if (session.role !== 'master') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const suppressedEmails = await prisma.emailSuppressionList.findMany({
      orderBy: {
        addedAt: 'desc'
      },
      include: {
        addedByUser: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    if (suppressedEmails.length === 0) {
      return NextResponse.json({
        hasData: false,
        message: 'No emails in suppression list',
        suppressedEmails: []
      })
    }

    return NextResponse.json({
      hasData: true,
      suppressedEmails: suppressedEmails.map(item => ({
        id: item.id,
        email: item.email,
        reason: item.reason,
        source: item.source,
        metadata: item.metadata,
        addedAt: item.addedAt,
        addedBy: item.addedByUser ? {
          id: item.addedByUser.id,
          name: item.addedByUser.name,
          email: item.addedByUser.email
        } : null
      }))
    })
  } catch (error) {
    console.error('Failed to get suppression list:', error)
    return NextResponse.json(
      { error: 'Failed to get suppression list' },
      { status: 500 }
    )
  }
}

// POST /api/master/email-settings/suppression
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only master accounts can add to suppression list
    if (session.role !== 'master') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { email, reason, source } = await request.json()

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Valid email address required' },
        { status: 400 }
      )
    }

    if (!reason || !['bounce', 'complaint', 'manual', 'unsubscribe'].includes(reason)) {
      return NextResponse.json(
        { error: 'Valid reason required (bounce, complaint, manual, unsubscribe)' },
        { status: 400 }
      )
    }

    // Check if already suppressed
    const existing = await prisma.emailSuppressionList.findUnique({
      where: { email }
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Email already in suppression list' },
        { status: 409 }
      )
    }

    // Add to suppression list
    const suppressed = await prisma.emailSuppressionList.create({
      data: {
        email,
        reason,
        source: source || 'manual_admin',
        metadata: {
          addedVia: 'api',
          userAgent: request.headers.get('user-agent') || 'unknown'
        },
        addedBy: session.userId
      }
    })

    return NextResponse.json({
      success: true,
      suppressed: {
        id: suppressed.id,
        email: suppressed.email,
        reason: suppressed.reason,
        addedAt: suppressed.addedAt
      }
    })
  } catch (error) {
    console.error('Failed to add to suppression list:', error)
    return NextResponse.json(
      { error: 'Failed to add to suppression list' },
      { status: 500 }
    )
  }
}

