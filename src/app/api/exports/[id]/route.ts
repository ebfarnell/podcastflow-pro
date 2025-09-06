import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import prisma from '@/lib/db/prisma'
import fs from 'fs/promises'
import path from 'path'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'

export async function DELETE(
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

    // Only admin/master users can delete exports
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
    const exportsDir = `/home/ec2-user/backups/${org.id}/exports`
    const filePath = path.join(exportsDir, filename)

    // Verify file exists and is within the org's exports directory
    try {
      await fs.access(filePath)
      const realPath = await fs.realpath(filePath)
      const realExportsDir = await fs.realpath(exportsDir)
      
      if (!realPath.startsWith(realExportsDir)) {
        throw new Error('Invalid file path')
      }
    } catch {
      return NextResponse.json(
        { error: 'Export file not found' },
        { status: 404 }
      )
    }
    
    // Delete the file
    try {
      await fs.unlink(filePath)
      
      // Log audit event
      console.log(`🗑️ Export deleted: ${filename} by ${user.email} (org: ${org.id})`)
    } catch (error) {
      console.error('Failed to delete export file:', error)
      return NextResponse.json(
        { error: 'Failed to delete export file' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      message: 'Export deleted successfully',
      exportId: filename
    })
    
  } catch (error) {
    console.error('❌ Export Delete Error:', error)
    return NextResponse.json(
      { error: 'Failed to delete export' },
      { status: 500 }
    )
  }
}