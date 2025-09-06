import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import prisma from '@/lib/db/prisma'
import { Prisma } from '@prisma/client'
import { format } from 'date-fns'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Validate session
    const session = await getSessionFromCookie(request)
    if (!session || !['master', 'admin'].includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search') || ''
    const sortBy = searchParams.get('sortBy') || 'date'
    const sortOrder = searchParams.get('sortOrder') || 'desc'
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const formatType = searchParams.get('format') || 'csv'

    // Build where clause
    const where: Prisma.EmailLogWhereInput = {
      organizationId: session.organizationId,
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

    // Fetch all matching emails (no pagination for export)
    const emails = await prisma.emailLog.findMany({
      where,
      orderBy,
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

    // Generate CSV content
    const headers = [
      'Date Sent',
      'Recipient',
      'Subject',
      'Status',
      'Opened',
      'Clicked',
      'Seller Name',
      'Seller Email',
      'Advertiser',
      'Agency',
      'Campaign',
      'Template'
    ]

    const rows = emails.map(email => {
      const metadata = email.metadata as any || {}
      
      const seller = metadata.sellerId ? {
        name: metadata.sellerName || 'Unknown',
        email: metadata.sellerEmail || ''
      } : (email.user?.role === 'sales' ? {
        name: email.user.name,
        email: email.user.email
      } : { name: '', email: '' })

      return [
        email.sentAt ? format(new Date(email.sentAt), 'yyyy-MM-dd HH:mm:ss') : '',
        email.toEmail,
        email.subject || '(No Subject)',
        email.status,
        email.openedAt ? 'Yes' : 'No',
        email.clickedAt ? 'Yes' : 'No',
        seller.name,
        seller.email,
        metadata.advertiserName || '',
        metadata.agencyName || '',
        metadata.campaignName || '',
        email.templateKey || ''
      ]
    })

    // Convert to CSV string
    const csvContent = [
      headers.join(','),
      ...rows.map(row => 
        row.map(cell => 
          // Escape commas and quotes in cell values
          typeof cell === 'string' && (cell.includes(',') || cell.includes('"'))
            ? `"${cell.replace(/"/g, '""')}"`
            : cell
        ).join(',')
      )
    ].join('\n')

    // Return CSV file
    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="emails-export-${format(new Date(), 'yyyy-MM-dd')}.csv"`
      }
    })
  } catch (error) {
    console.error('Error exporting emails:', error)
    return NextResponse.json(
      { error: 'Failed to export emails' },
      { status: 500 }
    )
  }
}