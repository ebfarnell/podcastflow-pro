import { NextRequest, NextResponse } from 'next/server'
import { S3Client, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import prisma from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

// Configure S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
})

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'podcastflow-audio-uploads'

// GET single file details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookie(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params

    // Fetch file with organization isolation
    const file = await prisma.uploadedFile.findFirst({
      where: {
        id,
        organizationId: session.organizationId // CRITICAL: Enforce organization isolation
      },
      include: {
        uploadedBy: {
          select: {
            name: true,
            email: true,
            role: true
          }
        }
      }
    })

    if (!file) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      )
    }

    // Generate a presigned URL for secure download
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: file.s3Key,
    })
    
    const downloadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 }) // 1 hour expiry

    return NextResponse.json({
      file: {
        ...file,
        downloadUrl
      }
    })
  } catch (error) {
    console.error('❌ Error fetching file:', error)
    return NextResponse.json(
      { error: 'Failed to fetch file' },
      { status: 500 }
    )
  }
}

// PUT update file metadata
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookie(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    const body = await request.json()

    // Update file with organization isolation
    const file = await prisma.uploadedFile.updateMany({
      where: {
        id,
        organizationId: session.organizationId // CRITICAL: Enforce organization isolation
      },
      data: {
        description: body.description,
        entityType: body.entityType,
        entityId: body.entityId,
        updatedAt: new Date()
      }
    })

    if (file.count === 0) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      )
    }

    // Fetch updated file
    const updatedFile = await prisma.uploadedFile.findFirst({
      where: {
        id,
        organizationId: session.organizationId
      },
      include: {
        uploadedBy: {
          select: {
            name: true,
            email: true,
            role: true
          }
        }
      }
    })

    return NextResponse.json({ file: updatedFile })
  } catch (error) {
    console.error('❌ Error updating file:', error)
    return NextResponse.json(
      { error: 'Failed to update file' },
      { status: 500 }
    )
  }
}

// DELETE file
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookie(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params

    // First, fetch the file to get S3 key (with organization isolation)
    const file = await prisma.uploadedFile.findFirst({
      where: {
        id,
        organizationId: session.organizationId // CRITICAL: Enforce organization isolation
      }
    })

    if (!file) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      )
    }

    // Delete from S3
    try {
      const deleteCommand = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: file.s3Key,
      })
      await s3Client.send(deleteCommand)
    } catch (s3Error) {
      console.error('❌ Error deleting from S3:', s3Error)
      // Continue with database deletion even if S3 fails
    }

    // Delete from database (soft delete by updating status)
    const result = await prisma.uploadedFile.updateMany({
      where: {
        id,
        organizationId: session.organizationId // CRITICAL: Enforce organization isolation
      },
      data: {
        status: 'deleted',
        updatedAt: new Date()
      }
    })

    // Verify the file was actually deleted (belonged to this org)
    if (result.count === 0) {
      return NextResponse.json(
        { error: 'File not found or access denied' },
        { status: 404 }
      )
    }

    return NextResponse.json({ 
      success: true,
      message: 'File deleted successfully' 
    })
  } catch (error) {
    console.error('❌ Error deleting file:', error)
    return NextResponse.json(
      { error: 'Failed to delete file' },
      { status: 500 }
    )
  }
}