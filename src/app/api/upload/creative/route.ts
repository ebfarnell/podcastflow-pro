import { NextRequest, NextResponse } from 'next/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { v4 as uuidv4 } from 'uuid'
import { getSessionFromCookie } from '@/lib/auth/session-helper'

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
const MAX_FILE_SIZE = 500 * 1024 * 1024 // 500MB for video

export async function POST(request: NextRequest) {
  const session = await getSessionFromCookie(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const type = formData.get('type') as string // audio, video, image

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file type based on upload type
    const allowedTypes: Record<string, string[]> = {
      audio: ['audio/mpeg', 'audio/wav', 'audio/webm', 'audio/ogg', 'audio/mp4'],
      video: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'],
      image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    }

    const allowed = allowedTypes[type] || []
    if (!allowed.includes(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type. Please upload a ${type} file.` },
        { status: 400 }
      )
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds 500MB limit' },
        { status: 400 }
      )
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Generate unique filename
    const fileExtension = file.name.split('.').pop() || 'bin'
    const fileName = `${uuidv4()}.${fileExtension}`
    const s3Key = `creatives/${session.organizationId}/${type}/${fileName}`

    // Upload to S3
    const uploadCommand = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      Body: buffer,
      ContentType: file.type,
      Metadata: {
        organizationId: session.organizationId,
        userId: session.userId,
        uploadType: type,
        originalName: file.name,
        uploadedAt: new Date().toISOString(),
      },
    })

    await s3Client.send(uploadCommand)

    // Generate URL (in production, use CloudFront or signed URLs)
    const fileUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${s3Key}`

    console.log(`✅ Creative file uploaded successfully: ${s3Key}`)

    return NextResponse.json({
      success: true,
      fileUrl,
      s3Key,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      uploadType: type,
    })
  } catch (error) {
    console.error('❌ Error uploading creative file:', error)
    
    // For development without AWS credentials, return mock URL
    if (process.env.NODE_ENV === 'development' && !process.env.AWS_ACCESS_KEY_ID) {
      const mockUrl = `/api/mock-creative/${uuidv4()}.mp3`
      
      return NextResponse.json({
        success: true,
        fileUrl: mockUrl,
        s3Key: `mock/${uuidv4()}.mp3`,
        fileName: 'mock-creative.mp3',
        fileSize: 1024000,
        fileType: 'audio/mpeg',
        uploadType: 'audio',
        mock: true,
      })
    }
    
    return NextResponse.json(
      { error: 'Failed to upload creative file' },
      { status: 500 }
    )
  }
}