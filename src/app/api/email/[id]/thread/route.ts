import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import prisma from '@/lib/db/prisma'
import { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

// GET /api/email/[id]/thread - Get all emails in the same thread/conversation
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Validate session
    const session = await getSessionFromCookie(request)
    if (!session || !['master', 'admin'].includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const emailId = params.id

    // First, fetch the email to get its thread/conversation ID
    const email = await prisma.emailLog.findFirst({
      where: {
        id: emailId,
        organizationId: session.organizationId
      }
    })

    if (!email) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 })
    }

    const metadata = email.metadata as any || {}
    const threadId = metadata.threadId || metadata.conversationId

    // If no thread ID, return just this email
    if (!threadId) {
      return NextResponse.json({
        threadId: null,
        emails: [{
          id: email.id,
          toEmail: email.toEmail,
          fromEmail: email.fromEmail,
          subject: email.subject || '(No Subject)',
          status: email.status,
          sentAt: email.sentAt,
          isCurrentEmail: true
        }],
        total: 1
      })
    }

    // Fetch all emails in the thread
    const where: Prisma.EmailLogWhereInput = {
      organizationId: session.organizationId,
      OR: [
        {
          metadata: {
            path: ['threadId'],
            equals: threadId
          }
        },
        {
          metadata: {
            path: ['conversationId'],
            equals: threadId
          }
        }
      ]
    }

    const threadEmails = await prisma.emailLog.findMany({
      where,
      orderBy: {
        sentAt: 'asc'
      },
      select: {
        id: true,
        toEmail: true,
        fromEmail: true,
        subject: true,
        status: true,
        sentAt: true,
        openedAt: true,
        metadata: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      }
    })

    // Format emails for response
    const formattedEmails = threadEmails.map(e => {
      const emailMetadata = e.metadata as any || {}
      const seller = emailMetadata.sellerId ? {
        name: emailMetadata.sellerName || 'Unknown',
        email: emailMetadata.sellerEmail || ''
      } : (e.user?.role === 'sales' ? {
        name: e.user.name,
        email: e.user.email
      } : null)

      return {
        id: e.id,
        toEmail: e.toEmail,
        fromEmail: e.fromEmail,
        subject: e.subject || '(No Subject)',
        status: e.status,
        sentAt: e.sentAt,
        openedAt: e.openedAt,
        seller,
        isCurrentEmail: e.id === emailId
      }
    })

    return NextResponse.json({
      threadId,
      emails: formattedEmails,
      total: formattedEmails.length
    })
  } catch (error) {
    console.error('Error fetching email thread:', error)
    return NextResponse.json(
      { error: 'Failed to fetch email thread' },
      { status: 500 }
    )
  }
}