/**
 * YouTube Sync API Route
 * POST /api/shows/:id/sync-youtube
 * 
 * Triggers YouTube channel sync for a show.
 * Supports both quick sync (in-request) and background job modes.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { resolveOrgSlug } from '@/lib/tenancy/resolve-org'
import { syncYouTubeUploads } from '@/lib/youtube/sync-uploads'
import { safeQuerySchema } from '@/lib/db/schema-db'
import prisma from '@/lib/db/prisma'
import { v4 as uuidv4 } from 'uuid'

export const dynamic = 'force-dynamic'

// Job queue for background processing (in-memory for now, use Redis/BullMQ in production)
const jobQueue = new Map<string, any>()

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: showId } = await params
    
    // Authenticate user
    const session = await getSessionFromCookie(request)
    if (!session || !session.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Check permissions - only admin, master, and producer can sync
    if (!['admin', 'master', 'producer'].includes(session.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }
    
    // Parse request options
    const url = new URL(request.url)
    const mode = url.searchParams.get('mode') || 'background'
    const maxVideos = parseInt(url.searchParams.get('maxVideos') || '0')
    const since = url.searchParams.get('since')
    
    // Resolve organization slug
    const orgSlug = await resolveOrgSlug(request, { showId })
    console.log('Resolved org slug:', orgSlug)
    
    // Get show details from organization schema using raw SQL
    const showQuery = `
      SELECT 
        id, 
        name, 
        "youtubeChannelUrl", 
        "youtubeChannelId", 
        "youtubeUploadsPlaylistId", 
        "youtubePlaylistId", 
        "youtubeSyncEnabled", 
        "youtubeAutoCreateEpisodes", 
        "youtubeLastSyncAt"
      FROM "Show"
      WHERE id = $1 AND "organizationId" = $2
      LIMIT 1
    `
    
    const { querySchema } = await import('@/lib/db/schema-db')
    const showResult = await querySchema(orgSlug, showQuery, [showId, session.organizationId])
    const show = showResult[0]
    
    if (!show) {
      return NextResponse.json(
        { error: 'Show not found' },
        { status: 404 }
      )
    }
    
    if (!show.youtubeChannelUrl && !show.youtubeChannelId) {
      return NextResponse.json(
        { error: 'YouTube channel not configured for this show' },
        { status: 400 }
      )
    }
    
    if (!show.youtubeSyncEnabled) {
      return NextResponse.json(
        { error: 'YouTube sync is disabled for this show' },
        { status: 400 }
      )
    }
    
    // Get YouTube API configuration
    const youtubeConfig = await prisma.youTubeApiConfig.findUnique({
      where: { organizationId: session.organizationId }
    })
    
    if (!youtubeConfig || !youtubeConfig.apiKey) {
      return NextResponse.json(
        { error: 'YouTube API not configured for your organization' },
        { status: 400 }
      )
    }
    
    // Check quota limits
    if (youtubeConfig.quotaLimit && youtubeConfig.quotaUsed >= youtubeConfig.quotaLimit) {
      const resetAt = youtubeConfig.quotaResetAt
      const resetTime = resetAt ? new Date(resetAt).toLocaleString() : 'unknown'
      
      return NextResponse.json(
        { 
          error: 'YouTube API quota exceeded',
          details: {
            quotaUsed: youtubeConfig.quotaUsed,
            quotaLimit: youtubeConfig.quotaLimit,
            resetAt: resetTime
          }
        },
        { status: 429 }
      )
    }
    
    // For quick sync mode (admin only, limited to small channels)
    if (mode === 'sync' && ['admin', 'master'].includes(session.role)) {
      console.log('Running quick sync for show:', showId)
      
      try {
        const result = await syncYouTubeUploads({
          orgSlug,
          showId,
          apiKey: youtubeConfig.apiKey,
          maxPages: 1, // Limit to 1 page (50 videos max)
          since: since ? new Date(since) : undefined,
          userId: session.userId,
          organizationId: session.organizationId
        })
        
        // Update quota usage
        await prisma.youTubeApiConfig.update({
          where: { id: youtubeConfig.id },
          data: {
            quotaUsed: {
              increment: result.quotaUsed
            }
          }
        })
        
        return NextResponse.json({
          success: true,
          mode: 'sync',
          message: 'YouTube sync completed',
          results: {
            videosProcessed: result.videosProcessed,
            episodesCreated: result.episodesCreated,
            episodesUpdated: result.episodesUpdated,
            episodesSkipped: result.episodesSkipped,
            quotaUsed: result.quotaUsed,
            errors: result.errors
          }
        })
      } catch (error) {
        console.error('Quick sync error:', error)
        return NextResponse.json(
          { 
            error: error instanceof Error ? error.message : 'Sync failed',
            details: error
          },
          { status: 500 }
        )
      }
    }
    
    // Background job mode (default)
    const jobId = uuidv4()
    
    // Create job entry
    const job = {
      id: jobId,
      type: 'youtube-sync',
      status: 'pending',
      showId,
      orgSlug,
      organizationId: session.organizationId,
      userId: session.userId,
      config: {
        apiKey: youtubeConfig.apiKey,
        maxPages: maxVideos ? Math.ceil(maxVideos / 50) : 10,
        since: since ? new Date(since) : undefined
      },
      createdAt: new Date(),
      attempts: 0
    }
    
    jobQueue.set(jobId, job)
    
    // Process job asynchronously
    processYouTubeSyncJob(job).catch(error => {
      console.error('Background job error:', error)
      job.status = 'failed'
      job.error = error instanceof Error ? error.message : 'Unknown error'
    })
    
    return NextResponse.json({
      success: true,
      mode: 'background',
      message: 'YouTube sync job created',
      jobId,
      statusUrl: `/api/shows/${showId}/sync-youtube/status?jobId=${jobId}`
    }, { status: 202 })
    
  } catch (error) {
    console.error('Error in YouTube sync route:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to sync YouTube videos'
      },
      { status: 500 }
    )
  }
}

/**
 * Process YouTube sync job in background
 */
async function processYouTubeSyncJob(job: any) {
  console.log('Processing YouTube sync job:', job.id)
  
  job.status = 'processing'
  job.startedAt = new Date()
  
  try {
    const result = await syncYouTubeUploads({
      orgSlug: job.orgSlug,
      showId: job.showId,
      apiKey: job.config.apiKey,
      maxPages: job.config.maxPages,
      since: job.config.since,
      userId: job.userId,
      organizationId: job.organizationId
    })
    
    job.status = 'completed'
    job.completedAt = new Date()
    job.result = result
    
    // Update quota usage
    await prisma.youTubeApiConfig.update({
      where: { organizationId: job.organizationId },
      data: {
        quotaUsed: {
          increment: result.quotaUsed
        }
      }
    })
    
    console.log('YouTube sync job completed:', job.id, result)
  } catch (error) {
    job.status = 'failed'
    job.completedAt = new Date()
    job.error = error instanceof Error ? error.message : 'Unknown error'
    job.errorDetails = error
    
    console.error('YouTube sync job failed:', job.id, error)
  }
}

/**
 * GET /api/shows/:id/sync-youtube/status?jobId=xxx
 * Check status of a background sync job
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: showId } = await params
    const url = new URL(request.url)
    const jobId = url.searchParams.get('jobId')
    
    if (!jobId) {
      // Return last sync log for the show
      const session = await getSessionFromCookie(request)
      if (!session || !session.organizationId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      
      const orgSlug = await resolveOrgSlug(request, { showId })
      
      const lastSyncQuery = `
        SELECT *
        FROM "YouTubeSyncLog"
        WHERE "syncConfig"->>'showId' = $1
        ORDER BY "createdAt" DESC
        LIMIT 1
      `
      const { data: lastSyncResult } = await safeQuerySchema(orgSlug, lastSyncQuery, [showId])
      const lastSync = lastSyncResult[0]
      
      return NextResponse.json({
        lastSync: lastSync ? {
          id: lastSync.id,
          status: lastSync.status,
          startedAt: lastSync.startedAt,
          completedAt: lastSync.completedAt,
          totalItems: lastSync.totalItems,
          processedItems: lastSync.processedItems,
          successfulItems: lastSync.successfulItems,
          failedItems: lastSync.failedItems,
          errorMessage: lastSync.errorMessage,
          results: lastSync.results
        } : null
      })
    }
    
    // Get job status
    const job = jobQueue.get(jobId)
    
    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      result: job.result,
      error: job.error
    })
    
  } catch (error) {
    console.error('Error getting sync status:', error)
    return NextResponse.json(
      { error: 'Failed to get sync status' },
      { status: 500 }
    )
  }
}