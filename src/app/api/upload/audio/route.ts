import { NextRequest, NextResponse } from 'next/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { v4 as uuidv4 } from 'uuid'

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
  try {
    // Check authentication
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('audio') as File
    const approvalId = formData.get('approvalId') as string
    const userId = formData.get('userId') as string
    const userRole = formData.get('userRole') as string

    if (!file) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      )
    }

    // Validate file type
    const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/webm', 'audio/ogg', 'audio/mp4']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload an audio file.' },
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
    const fileExtension = file.name.split('.').pop() || 'mp3'
    const fileName = `${approvalId}/${userId}-${userRole}-${uuidv4()}.${fileExtension}`
    const s3Key = `ad-approvals/${fileName}`

    // Upload to S3
    const uploadCommand = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      Body: buffer,
      ContentType: file.type,
      Metadata: {
        approvalId: approvalId || '',
        userId: userId || '',
        userRole: userRole || '',
        originalName: file.name,
        uploadedAt: new Date().toISOString(),
      },
    })

    await s3Client.send(uploadCommand)

    // Generate URL (in production, use CloudFront or signed URLs)
    const fileUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${s3Key}`

    console.log(`✅ Audio file uploaded successfully: ${s3Key}`)

    return NextResponse.json({
      success: true,
      fileUrl,
      s3Key,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      duration: null, // Could be extracted with ffprobe or similar
    })
  } catch (error) {
    console.error('❌ Error uploading audio file:', error)
    
    // For development without AWS credentials, store locally
    if (process.env.NODE_ENV === 'development' && !process.env.AWS_ACCESS_KEY_ID) {
      // Simulate successful upload for development
      const mockUrl = `/api/mock-audio/${uuidv4()}.mp3`
      
      return NextResponse.json({
        success: true,
        fileUrl: mockUrl,
        s3Key: `mock/${uuidv4()}.mp3`,
        fileName: 'mock-audio.mp3',
        fileSize: 1024000,
        fileType: 'audio/mpeg',
        duration: null,
        mock: true,
      })
    }
    
    return NextResponse.json(
      { error: 'Failed to upload audio file' },
      { status: 500 }
    )
  }
}

// GET endpoint to retrieve audio file info
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const s3Key = searchParams.get('key')
    
    if (!s3Key) {
      return NextResponse.json(
        { error: 'S3 key required' },
        { status: 400 }
      )
    }

    // In production, generate a signed URL for secure access
    const signedUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${s3Key}`
    
    return NextResponse.json({
      url: signedUrl,
      expiresIn: 3600, // 1 hour
    })
  } catch (error) {
    console.error('❌ Error getting audio file:', error)
    return NextResponse.json(
      { error: 'Failed to get audio file' },
      { status: 500 }
    )
  }
}