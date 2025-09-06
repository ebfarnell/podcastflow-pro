import { NextRequest, NextResponse } from 'next/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { v4 as uuidv4 } from 'uuid'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import prisma from '@/lib/db/prisma'

// Force this route to be dynamic
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
const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB

export async function POST(request: NextRequest) {
  const session = await getSessionFromCookie(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const category = formData.get('category') as string || 'general'
    const entityType = formData.get('entityType') as string // campaign, episode, show, contract
    const entityId = formData.get('entityId') as string
    const description = formData.get('description') as string

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file type
    const allowedTypes = {
      document: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain',
        'text/csv',
        'application/json'
      ],
      image: [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/svg+xml'
      ],
      audio: [
        'audio/mpeg',
        'audio/wav',
        'audio/webm',
        'audio/ogg',
        'audio/mp4',
        'audio/aac'
      ],
      video: [
        'video/mp4',
        'video/webm',
        'video/quicktime',
        'video/x-msvideo'
      ]
    }

    const allAllowedTypes = Object.values(allowedTypes).flat()
    if (!allAllowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload a supported file format.' },
        { status: 400 }
      )
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds 100MB limit' },
        { status: 400 }
      )
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Generate unique filename
    const fileExtension = file.name.split('.').pop() || 'bin'
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const fileName = `${uuidv4()}-${sanitizedName}`
    const s3Key = `uploads/${session.organizationId}/${category}/${fileName}`

    // Upload to S3
    const uploadCommand = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      Body: buffer,
      ContentType: file.type,
      Metadata: {
        organizationId: session.organizationId,
        userId: session.userId,
        category,
        entityType: entityType || '',
        entityId: entityId || '',
        originalName: file.name,
        uploadedAt: new Date().toISOString(),
      },
    })

    await s3Client.send(uploadCommand)

    // Generate URL
    const fileUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${s3Key}`

    // Determine file type category
    let fileTypeCategory = 'document'
    for (const [category, types] of Object.entries(allowedTypes)) {
      if (types.includes(file.type)) {
        fileTypeCategory = category
        break
      }
    }

    // Save file record to database
    const fileRecord = await prisma.uploadedFile.create({
      data: {
        organizationId: session.organizationId,
        uploadedById: session.userId,
        originalName: file.name,
        fileName,
        fileSize: file.size,
        mimeType: file.type,
        category: fileTypeCategory,
        s3Key,
        s3Url: fileUrl,
        entityType: entityType || null,
        entityId: entityId || null,
        description: description || null,
        status: 'active'
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

    console.log(`✅ File uploaded successfully: ${s3Key}`)

    return NextResponse.json({
      success: true,
      file: {
        id: fileRecord.id,
        originalName: fileRecord.originalName,
        fileName: fileRecord.fileName,
        fileSize: fileRecord.fileSize,
        mimeType: fileRecord.mimeType,
        category: fileRecord.category,
        fileUrl: fileRecord.s3Url,
        s3Key: fileRecord.s3Key,
        entityType: fileRecord.entityType,
        entityId: fileRecord.entityId,
        description: fileRecord.description,
        uploadedAt: fileRecord.createdAt,
        uploadedBy: fileRecord.uploadedBy
      }
    })
  } catch (error) {
    console.error('❌ Error uploading file:', error)
    
    // For development without AWS credentials, create a mock record
    if (process.env.NODE_ENV === 'development' && !process.env.AWS_ACCESS_KEY_ID) {
      try {
        const formData = await request.formData()
        const file = formData.get('file') as File
        const category = formData.get('category') as string || 'general'
        
        const mockFileRecord = {
          id: uuidv4(),
          originalName: file?.name || 'mock-file.pdf',
          fileName: `mock-${uuidv4()}.pdf`,
          fileSize: file?.size || 1024000,
          mimeType: file?.type || 'application/pdf',
          category: 'document',
          fileUrl: `/api/mock-file/${uuidv4()}.pdf`,
          s3Key: `mock/${uuidv4()}.pdf`,
          uploadedAt: new Date().toISOString(),
          uploadedBy: { name: 'Mock User', email: 'mock@example.com', role: 'admin' },
          mock: true
        }
        
        return NextResponse.json({
          success: true,
          file: mockFileRecord
        })
      } catch (devError) {
        console.error('❌ Development mock error:', devError)
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    )
  }
}

// GET endpoint to list files
export async function GET(request: NextRequest) {
  const session = await getSessionFromCookie(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const entityType = searchParams.get('entityType')
    const entityId = searchParams.get('entityId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const offset = (page - 1) * limit

    const where: any = {
      organizationId: session.organizationId, // CRITICAL: Enforce organization isolation
      status: 'active'
    }

    if (category) where.category = category
    if (entityType) where.entityType = entityType
    if (entityId) where.entityId = entityId

    // Fetch files with organization isolation
    const [files, total] = await Promise.all([
      prisma.uploadedFile.findMany({
        where,
        include: {
          uploadedBy: {
            select: {
              name: true,
              email: true,
              role: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit
      }),
      prisma.uploadedFile.count({ where })
    ])

    return NextResponse.json({
      success: true,
      files,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('❌ Error fetching files:', error)
    return NextResponse.json(
      { error: 'Failed to fetch files' },
      { status: 500 }
    )
  }
}