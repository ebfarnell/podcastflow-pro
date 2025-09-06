import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// Configure S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
})

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'podcastflow-audio-uploads'

/**
 * Generate a presigned URL for downloading a file from S3
 * @param s3Key - The S3 key of the file
 * @param filename - Optional filename for Content-Disposition header
 * @param expiresIn - URL expiration time in seconds (default: 1 hour)
 * @returns Presigned URL string
 */
export async function generatePresignedUrl(
  s3Key: string,
  filename?: string,
  expiresIn: number = 3600
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
    ResponseContentDisposition: filename 
      ? `attachment; filename="${filename}"`
      : undefined
  })
  
  return await getSignedUrl(s3Client, command, { expiresIn })
}