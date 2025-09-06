import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Socket.IO requires a custom server, so we'll handle WebSocket upgrade in server.js
export async function GET(request: NextRequest) {
  return NextResponse.json({ 
    message: 'WebSocket endpoint. Connect using Socket.IO client.',
    path: '/api/socket'
  })
}