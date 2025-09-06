import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { readFile } from 'fs/promises'
import { join } from 'path'

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const filename = params.filename
    if (!filename.endsWith('.pdf')) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 })
    }

    // Sanitize filename to prevent directory traversal
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9\-_.]/g, '')
    const filePath = join('/home/ec2-user/podcastflow-pro/uploads/contracts', sanitizedFilename)

    try {
      const fileBuffer = await readFile(filePath)
      
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${sanitizedFilename}"`,
          'Cache-Control': 'private, max-age=3600'
        }
      })
    } catch (error) {
      console.error('Error reading contract file:', error)
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    }
  } catch (error) {
    console.error('Error in GET /api/contracts/download/[filename]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}