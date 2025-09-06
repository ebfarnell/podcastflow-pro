import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import prisma from '@/lib/db/prisma'
import fs from 'fs/promises'
import path from 'path'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify authentication
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      )
    }

    // Only admin/master users can download exports
    if (!['admin', 'master'].includes(user.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Get organization
    const org = await prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { id: true, slug: true }
    })

    if (!org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    // Sanitize filename to prevent path traversal
    const filename = params.id.replace(/[^a-zA-Z0-9._-]/g, '')
    const exportDir = `/home/ec2-user/backups/${org.id}/exports`
    const filePath = path.join(exportDir, filename)

    // Verify file exists and is within the org's export directory
    try {
      await fs.access(filePath)
      const realPath = await fs.realpath(filePath)
      const realExportDir = await fs.realpath(exportDir)
      
      if (!realPath.startsWith(realExportDir)) {
        throw new Error('Invalid file path')
      }
    } catch {
      return NextResponse.json(
        { error: 'Export file not found' },
        { status: 404 }
      )
    }

    // Get file stats for size
    const stats = await fs.stat(filePath)
    
    // Read file and stream response
    const fileBuffer = await fs.readFile(filePath)
    
    // Log audit event
    console.log(`📥 Export downloaded: ${filename} by ${user.email} (org: ${org.id})`)

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': stats.size.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Export-Org': org.id,
        'X-Export-Date': stats.mtime.toISOString()
      }
    })

  } catch (error) {
    console.error('❌ Export download error:', error)
    return NextResponse.json(
      { error: 'Failed to download export' },
      { status: 500 }
    )
  }
}