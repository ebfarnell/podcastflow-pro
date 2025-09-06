import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import prisma from '@/lib/db/prisma'
import { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

interface EmailWithMetadata {
  id: string
  toEmail: string
  fromEmail: string
  subject: string | null
  status: string
  sentAt: Date | null
  openedAt: Date | null
  clickedAt: Date | null
  metadata: any
  user: {
    id: string
    name: string
    email: string
    role: string
  } | null
}

export async function GET(request: NextRequest) {
  try {
    // Validate session
    const session = await getSessionFromCookie(request)
    if (!session || !['master', 'admin'].includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25')))
    const search = searchParams.get('search') || ''
    const sortBy = searchParams.get('sortBy') || 'date'
    const sortOrder = searchParams.get('sortOrder') || 'desc'
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    const offset = (page - 1) * limit

    // Build where clause
    const where: Prisma.EmailLogWhereInput = {
      organizationId: session.organizationId,
      // Exclude system emails
      templateKey: {
        notIn: ['password_reset', 'email_verification', 'system_notification']
      }
    }

    // Add search filter
    if (search) {
      where.OR = [
        {
          subject: {
            contains: search,
            mode: 'insensitive'
          }
        },
        {
          toEmail: {
            contains: search,
            mode: 'insensitive'
          }
        }
      ]
    }

    // Add date filters
    if (dateFrom || dateTo) {
      where.sentAt = {}
      if (dateFrom) {
        where.sentAt.gte = new Date(dateFrom)
      }
      if (dateTo) {
        const endDate = new Date(dateTo)
        endDate.setHours(23, 59, 59, 999)
        where.sentAt.lte = endDate
      }
    }

    // Count total emails
    const total = await prisma.emailLog.count({ where })

    // Build order by clause
    let orderBy: Prisma.EmailLogOrderByWithRelationInput = {}
    switch (sortBy) {
      case 'date':
        orderBy = { sentAt: sortOrder as 'asc' | 'desc' }
        break
      case 'subject':
        orderBy = { subject: sortOrder as 'asc' | 'desc' }
        break
      case 'status':
        orderBy = { status: sortOrder as 'asc' | 'desc' }
        break
      default:
        orderBy = { sentAt: 'desc' }
    }

    // Fetch emails with user information
    const emails = await prisma.emailLog.findMany({
      where,
      orderBy,
      skip: offset,
      take: limit,
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
    }) as EmailWithMetadata[]

    // Process emails to extract metadata information
    const processedEmails = emails.map(email => {
      const metadata = email.metadata as any || {}
      
      // Extract entity information from metadata
      const seller = metadata.sellerId ? {
        id: metadata.sellerId,
        name: metadata.sellerName || 'Unknown Seller',
        email: metadata.sellerEmail || ''
      } : (email.user?.role === 'sales' ? {
        id: email.user.id,
        name: email.user.name,
        email: email.user.email
      } : null)

      const advertiser = metadata.advertiserId ? {
        id: metadata.advertiserId,
        name: metadata.advertiserName || 'Unknown Advertiser'
      } : null

      const agency = metadata.agencyId ? {
        id: metadata.agencyId,
        name: metadata.agencyName || 'Unknown Agency'
      } : null

      const campaign = metadata.campaignId ? {
        id: metadata.campaignId,
        name: metadata.campaignName || 'Unknown Campaign'
      } : null

      return {
        id: email.id,
        toEmail: email.toEmail,
        fromEmail: email.fromEmail,
        subject: email.subject || '(No Subject)',
        status: email.status,
        sentAt: email.sentAt,
        openedAt: email.openedAt,
        clickedAt: email.clickedAt,
        seller,
        advertiser,
        agency,
        campaign,
        hasOpened: !!email.openedAt,
        hasClicked: !!email.clickedAt,
        templateKey: email.metadata?.templateKey || email.templateKey
      }
    })

    // Sort by metadata fields if requested
    if (sortBy === 'seller' || sortBy === 'advertiser' || sortBy === 'agency') {
      processedEmails.sort((a, b) => {
        const aValue = a[sortBy as keyof typeof a] as any
        const bValue = b[sortBy as keyof typeof b] as any
        
        if (!aValue && !bValue) return 0
        if (!aValue) return sortOrder === 'asc' ? 1 : -1
        if (!bValue) return sortOrder === 'asc' ? -1 : 1
        
        const aName = aValue.name || ''
        const bName = bValue.name || ''
        
        return sortOrder === 'asc' 
          ? aName.localeCompare(bName)
          : bName.localeCompare(aName)
      })
    }

    return NextResponse.json({
      emails: processedEmails,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    })
  } catch (error) {
    console.error('Error fetching all emails:', error)
    return NextResponse.json(
      { error: 'Failed to fetch emails' },
      { status: 500 }
    )
  }
}