import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { MegaphoneApiService } from '../../../../services/megaphoneApi'

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { apiToken } = body

    if (!apiToken) {
      return NextResponse.json({ error: 'API token is required' }, { status: 400 })
    }

    const apiService = new MegaphoneApiService({ apiToken })
    const result = await apiService.testConnection()

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error testing Megaphone connection:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Connection test failed' },
      { status: 400 }
    )
  }
}