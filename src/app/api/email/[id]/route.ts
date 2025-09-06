import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import prisma from '@/lib/db/prisma'
import { generatePresignedUrl } from '@/lib/s3/s3-utils'

export const dynamic = 'force-dynamic'

// GET /api/email/[id] - Get single email detail with attachments
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

    // Fetch email with full details
    const email = await prisma.emailLog.findFirst({
      where: {
        id: emailId,
        organizationId: session.organizationId
      },
      include: {
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

    if (!email) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 })
    }

    // Fetch attachments for this email
    const attachments = await prisma.uploadedFile.findMany({
      where: {
        organizationId: session.organizationId,
        entityType: 'email',
        entityId: emailId,
        status: 'active'
      },
      select: {
        id: true,
        originalName: true,
        fileName: true,
        fileSize: true,
        mimeType: true,
        s3Key: true,
        description: true,
        createdAt: true
      }
    })

    // Generate presigned URLs for attachments
    const attachmentsWithUrls = await Promise.all(
      attachments.map(async (attachment) => {
        const presignedUrl = await generatePresignedUrl(attachment.s3Key, attachment.originalName)
        return {
          ...attachment,
          downloadUrl: presignedUrl
        }
      })
    )

    // Extract seller info from metadata or user
    const metadata = email.metadata as any || {}
    const seller = metadata.sellerId ? {
      id: metadata.sellerId,
      name: metadata.sellerName || 'Unknown',
      email: metadata.sellerEmail || ''
    } : (email.user?.role === 'sales' ? {
      id: email.user.id,
      name: email.user.name,
      email: email.user.email
    } : null)

    // Get email body from Email table if available
    let emailBody = null
    if (metadata.emailId) {
      const fullEmail = await prisma.email.findUnique({
        where: { id: metadata.emailId },
        select: {
          html: true,
          text: true,
          cc: true,
          bcc: true
        }
      })
      if (fullEmail) {
        emailBody = {
          html: fullEmail.html,
          text: fullEmail.text,
          cc: fullEmail.cc,
          bcc: fullEmail.bcc
        }
      }
    }

    // Format response
    const response = {
      id: email.id,
      toEmail: email.toEmail,
      fromEmail: email.fromEmail,
      subject: email.subject || '(No Subject)',
      status: email.status,
      templateKey: email.templateKey,
      sentAt: email.sentAt,
      deliveredAt: email.deliveredAt,
      openedAt: email.openedAt,
      clickedAt: email.clickedAt,
      bouncedAt: email.bouncedAt,
      bounceType: email.bounceType,
      bounceReason: email.bounceReason,
      complainedAt: email.complainedAt,
      createdAt: email.createdAt,
      seller,
      advertiser: metadata.advertiserName || null,
      advertiserId: metadata.advertiserId || null,
      agency: metadata.agencyName || null,
      agencyId: metadata.agencyId || null,
      campaign: metadata.campaignName || null,
      campaignId: metadata.campaignId || null,
      threadId: metadata.threadId || null,
      conversationId: metadata.conversationId || null,
      body: emailBody,
      attachments: attachmentsWithUrls,
      metadata: metadata
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching email detail:', error)
    return NextResponse.json(
      { error: 'Failed to fetch email detail' },
      { status: 500 }
    )
  }
}