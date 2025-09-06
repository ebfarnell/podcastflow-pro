import { NextResponse } from 'next/server'

export async function GET() {
  const buildId = process.env.BUILD_ID || Date.now().toString()
  
  return NextResponse.json({
    buildId,
    timestamp: new Date().toISOString(),
    message: 'Cache bust endpoint - use this to verify build version'
  }, {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  })
}