import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import prisma from '@/lib/db/prisma'
import fs from 'fs/promises'
import path from 'path'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
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

    // Only admin/master users can view exports
    if (!['admin', 'master'].includes(user.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Get organization
    const org = await prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { id: true, slug: true, name: true }
    })

    if (!org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    // Get export directory for this org
    const exportDir = `/home/ec2-user/backups/${org.id}/exports`
    
    try {
      await fs.access(exportDir)
    } catch {
      // Create org-specific export directory if it doesn't exist
      await fs.mkdir(exportDir, { recursive: true })
    }

    // List all export files for this org
    const files = await fs.readdir(exportDir)
    const exportFiles = files.filter(f => f.endsWith('.zip'))
    
    const exports = await Promise.all(
      exportFiles.map(async (file) => {
        const filePath = path.join(exportDir, file)
        const stats = await fs.stat(filePath)
        
        return {
          id: file,
          type: 'csv_export',
          bytes: stats.size,
          size: formatBytes(stats.size),
          createdAt: stats.mtime.toISOString(),
          createdBy: 'system', // Would need to track this in metadata
          location: 'local',
          status: 'ready',
          notes: file
        }
      })
    )

    // Sort by date (newest first)
    exports.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

    return NextResponse.json(exports)

  } catch (error) {
    console.error('❌ Exports API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper function to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}