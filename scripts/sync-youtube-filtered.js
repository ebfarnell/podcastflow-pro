#!/usr/bin/env node

/**
 * Filtered YouTube Sync Script
 * Syncs YouTube videos based on configured content type filters
 * 
 * Usage: node sync-youtube-filtered.js [showId]
 */

const https = require('https');
const { Pool } = require('pg');
const crypto = require('crypto');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://podcastflow:PodcastFlow2025Prod@localhost:5432/podcastflow_production',
});

// YouTube API configuration
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
const MAX_RESULTS = 50;
const MAX_PAGES = 50;

/**
 * Decrypt API key using AES-256-CBC
 */
function decryptApiKey(encryptedKey) {
  if (!encryptedKey.includes(':')) return encryptedKey;
  
  const ENCRYPTION_KEY = process.env.YOUTUBE_ENCRYPTION_KEY || 'a'.repeat(64);
  
  try {
    const parts = encryptedKey.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = Buffer.from(parts[1], 'hex');
    
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      Buffer.from(ENCRYPTION_KEY, 'hex'),
      iv
    );
    
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString();
  } catch (error) {
    console.error('Failed to decrypt API key:', error.message);
    process.exit(1);
  }
}

/**
 * Parse ISO 8601 duration to seconds
 */
function parseDuration(duration) {
  if (!duration) return 0;
  
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/);
  if (!match) return 0;
  
  const hours = parseInt(match[1] || '0');
  const minutes = parseInt(match[2] || '0');
  const seconds = parseFloat(match[3] || '0');
  
  return Math.floor(hours * 3600 + minutes * 60 + seconds);
}

/**
 * Determine content type based on video metadata
 */
function detectContentType(video, settings) {
  const title = video.snippet.title.toLowerCase();
  const duration = parseDuration(video.contentDetails.duration);
  
  // Check for YouTube Shorts (under 60 seconds)
  if (duration <= 60) {
    return 'short';
  }
  
  // Check for podcast episodes (look for episode numbers and long duration)
  const podcastPatterns = [
    /#\d+/i,
    /episode\s+\d+/i,
    /ep\.\s*\d+/i,
    /ep\s+\d+/i,
    /this past weekend.*#\d+/i
  ];
  
  if (duration >= 1200) { // At least 20 minutes
    for (const pattern of podcastPatterns) {
      if (pattern.test(video.snippet.title)) {
        return 'podcast';
      }
    }
    
    // Long form content without episode number might still be a podcast
    if (duration >= 2400) { // 40+ minutes
      return 'podcast';
    }
  }
  
  // Check for live streams
  if (video.snippet.liveBroadcastContent === 'live' || 
      /live|livestream|live stream|q&a|ama/i.test(title)) {
    return 'live';
  }
  
  // Check for clips (short to medium length, often with clip-related keywords)
  if (duration > 60 && duration < 600) { // Between 1-10 minutes
    if (/clip|highlight|best of|moments|shorts/i.test(title)) {
      return 'clip';
    }
  }
  
  // Default to clip for medium-length content
  if (duration >= 60 && duration < 1200) {
    return 'clip';
  }
  
  return 'other';
}

/**
 * Check if video should be imported based on filters
 */
function shouldImportVideo(video, settings) {
  const contentType = detectContentType(video, settings);
  const duration = parseDuration(video.contentDetails.duration);
  const title = video.snippet.title;
  
  console.log(`  Analyzing: "${title.substring(0, 60)}..." [${contentType}, ${duration}s]`);
  
  // Check content type filters
  if (contentType === 'podcast' && !settings.youtubeImportPodcasts) {
    return { import: false, reason: 'Podcast content disabled' };
  }
  if (contentType === 'short' && !settings.youtubeImportShorts) {
    return { import: false, reason: 'Shorts disabled' };
  }
  if (contentType === 'clip' && !settings.youtubeImportClips) {
    return { import: false, reason: 'Clips disabled' };
  }
  if (contentType === 'live' && !settings.youtubeImportLive) {
    return { import: false, reason: 'Live streams disabled' };
  }
  
  // Check duration filters
  if (settings.youtubeMinDuration && duration < settings.youtubeMinDuration) {
    return { import: false, reason: `Below minimum duration (${settings.youtubeMinDuration}s)` };
  }
  if (settings.youtubeMaxDuration && duration > settings.youtubeMaxDuration) {
    return { import: false, reason: `Above maximum duration (${settings.youtubeMaxDuration}s)` };
  }
  
  // Check title filters
  if (settings.youtubeTitleFilter) {
    try {
      const includeRegex = new RegExp(settings.youtubeTitleFilter, 'i');
      if (!includeRegex.test(title)) {
        return { import: false, reason: 'Does not match title filter' };
      }
    } catch (e) {
      console.error('Invalid title filter regex:', settings.youtubeTitleFilter);
    }
  }
  
  if (settings.youtubeExcludeFilter) {
    try {
      const excludeRegex = new RegExp(settings.youtubeExcludeFilter, 'i');
      if (excludeRegex.test(title)) {
        return { import: false, reason: 'Matches exclude filter' };
      }
    } catch (e) {
      console.error('Invalid exclude filter regex:', settings.youtubeExcludeFilter);
    }
  }
  
  return { import: true, contentType };
}

/**
 * Extract episode number from title
 */
function extractEpisodeNumber(title) {
  const patterns = [
    /#(\d+)/i,
    /(?:episode|ep\.?)\s*(\d+)/i,
    /^(\d+)[\s\-:]/,
    /\s(\d+)$/
  ];
  
  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match) {
      const num = parseInt(match[1]);
      if (!isNaN(num) && num > 0 && num < 10000) {
        return num;
      }
    }
  }
  
  return null;
}

/**
 * Make HTTPS request to YouTube API
 */
function makeYouTubeRequest(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) {
            reject(new Error(json.error.message || 'YouTube API error'));
          } else {
            resolve(json);
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

/**
 * Sync YouTube videos with content filtering
 */
async function syncYouTubeVideos(showId) {
  const client = await pool.connect();
  
  try {
    // Get show details and import settings
    const showResult = await client.query(`
      SELECT 
        s.id, 
        s.name, 
        s."youtubeChannelId",
        s."youtubeUploadsPlaylistId",
        s."organizationId",
        s."youtubeImportPodcasts",
        s."youtubeImportShorts",
        s."youtubeImportClips",
        s."youtubeImportLive",
        s."youtubeMinDuration",
        s."youtubeMaxDuration",
        s."youtubeTitleFilter",
        s."youtubeExcludeFilter"
      FROM org_podcastflow_pro."Show" s
      WHERE s.id = $1
    `, [showId]);
    
    if (showResult.rows.length === 0) {
      throw new Error('Show not found');
    }
    
    const show = showResult.rows[0];
    const settings = {
      youtubeImportPodcasts: show.youtubeImportPodcasts !== false,
      youtubeImportShorts: show.youtubeImportShorts === true,
      youtubeImportClips: show.youtubeImportClips === true,
      youtubeImportLive: show.youtubeImportLive === true,
      youtubeMinDuration: show.youtubeMinDuration || 600,
      youtubeMaxDuration: show.youtubeMaxDuration,
      youtubeTitleFilter: show.youtubeTitleFilter,
      youtubeExcludeFilter: show.youtubeExcludeFilter
    };
    
    console.log(`\nSyncing YouTube videos for: ${show.name}`);
    console.log('Import Settings:');
    console.log(`  - Podcasts: ${settings.youtubeImportPodcasts}`);
    console.log(`  - Shorts: ${settings.youtubeImportShorts}`);
    console.log(`  - Clips: ${settings.youtubeImportClips}`);
    console.log(`  - Live: ${settings.youtubeImportLive}`);
    console.log(`  - Min Duration: ${settings.youtubeMinDuration}s`);
    console.log(`  - Max Duration: ${settings.youtubeMaxDuration || 'No limit'}`);
    if (settings.youtubeTitleFilter) {
      console.log(`  - Title Filter: ${settings.youtubeTitleFilter}`);
    }
    if (settings.youtubeExcludeFilter) {
      console.log(`  - Exclude Filter: ${settings.youtubeExcludeFilter}`);
    }
    console.log('');
    
    // Get API key
    const configResult = await client.query(`
      SELECT "apiKey"
      FROM "YouTubeApiConfig"
      WHERE "organizationId" = $1
    `, [show.organizationId]);
    
    if (configResult.rows.length === 0) {
      throw new Error('No YouTube API configuration found');
    }
    
    const apiKey = decryptApiKey(configResult.rows[0].apiKey);
    
    // Fetch uploads playlist ID if missing
    let uploadsPlaylistId = show.youtubeUploadsPlaylistId;
    if (!uploadsPlaylistId && show.youtubeChannelId) {
      console.log('Fetching uploads playlist ID from YouTube...');
      const channelUrl = `${YOUTUBE_API_BASE}/channels?part=contentDetails&id=${show.youtubeChannelId}&key=${apiKey}`;
      const channelData = await makeYouTubeRequest(channelUrl);
      
      if (channelData.items && channelData.items.length > 0) {
        uploadsPlaylistId = channelData.items[0].contentDetails.relatedPlaylists.uploads;
        console.log(`Found uploads playlist: ${uploadsPlaylistId}`);
        
        await client.query(`
          UPDATE org_podcastflow_pro."Show"
          SET "youtubeUploadsPlaylistId" = $1
          WHERE id = $2
        `, [uploadsPlaylistId, showId]);
      } else {
        throw new Error('Could not fetch channel details from YouTube');
      }
    }
    
    // Fetch and process videos
    let pageToken = null;
    let totalVideos = 0;
    let episodesCreated = 0;
    let episodesUpdated = 0;
    let videosSkipped = 0;
    let pagesProcessed = 0;
    
    const skippedReasons = {};
    
    console.log('Fetching videos from YouTube...\n');
    
    do {
      let playlistUrl = `${YOUTUBE_API_BASE}/playlistItems?part=contentDetails,snippet&playlistId=${uploadsPlaylistId}&maxResults=${MAX_RESULTS}&key=${apiKey}`;
      if (pageToken) {
        playlistUrl += `&pageToken=${pageToken}`;
      }
      
      console.log(`Fetching page ${pagesProcessed + 1}...`);
      const playlistData = await makeYouTubeRequest(playlistUrl);
      
      if (!playlistData.items || playlistData.items.length === 0) {
        break;
      }
      
      const videoIds = playlistData.items.map(item => item.contentDetails.videoId);
      
      const videosUrl = `${YOUTUBE_API_BASE}/videos?part=snippet,contentDetails,statistics&id=${videoIds.join(',')}&key=${apiKey}`;
      const videosData = await makeYouTubeRequest(videosUrl);
      
      for (const video of videosData.items) {
        totalVideos++;
        
        // Check if video should be imported
        const importDecision = shouldImportVideo(video, settings);
        
        if (!importDecision.import) {
          videosSkipped++;
          skippedReasons[importDecision.reason] = (skippedReasons[importDecision.reason] || 0) + 1;
          
          // Log to import log
          const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          await client.query(`
            INSERT INTO org_podcastflow_pro."YouTubeImportLog" (
              id, "showId", "organizationId", "videoId", "videoTitle",
              "videoDuration", "videoType", action, reason, "createdAt"
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
          `, [
            logId,
            showId,
            show.organizationId,
            video.id,
            video.snippet.title.substring(0, 500),
            parseDuration(video.contentDetails.duration),
            importDecision.contentType || 'unknown',
            'skipped',
            importDecision.reason
          ]);
          
          continue;
        }
        
        // Check if episode already exists
        const existingResult = await client.query(`
          SELECT id, "youtubeViewCount"
          FROM org_podcastflow_pro."Episode"
          WHERE "showId" = $1 AND "youtubeVideoId" = $2
        `, [showId, video.id]);
        
        if (existingResult.rows.length > 0) {
          // Update existing episode
          await client.query(`
            UPDATE org_podcastflow_pro."Episode"
            SET 
              "youtubeViewCount" = $1,
              "youtubeLikeCount" = $2,
              "youtubeCommentCount" = $3,
              "updatedAt" = NOW()
            WHERE id = $4
          `, [
            parseInt(video.statistics?.viewCount || '0'),
            parseInt(video.statistics?.likeCount || '0'),
            parseInt(video.statistics?.commentCount || '0'),
            existingResult.rows[0].id
          ]);
          episodesUpdated++;
          console.log(`  ✓ Updated: ${video.snippet.title.substring(0, 60)}...`);
        } else {
          // Create new episode
          let episodeNumber = extractEpisodeNumber(video.snippet.title);
          
          if (!episodeNumber) {
            const maxEpisodeResult = await client.query(`
              SELECT COALESCE(MAX("episodeNumber"), 0) as max_episode
              FROM org_podcastflow_pro."Episode"
              WHERE "showId" = $1
            `, [showId]);
            episodeNumber = maxEpisodeResult.rows[0].max_episode + 1;
          }
          
          const episodeId = `ep_youtube_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const duration = parseDuration(video.contentDetails.duration);
          
          await client.query(`
            INSERT INTO org_podcastflow_pro."Episode" (
              id, "showId", "organizationId", "episodeNumber",
              title, duration, "durationSeconds", "airDate",
              status, "createdBy", "updatedAt", "youtubeVideoId",
              "youtubeUrl", "youtubeViewCount", "youtubeLikeCount",
              "youtubeCommentCount", "thumbnailUrl", "publishUrl"
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), $11, $12, $13, $14, $15, $16, $17
            )
          `, [
            episodeId,
            showId,
            show.organizationId,
            episodeNumber,
            video.snippet.title.substring(0, 500),
            duration,
            duration,
            new Date(video.snippet.publishedAt),
            'published',
            'youtube-sync',
            video.id,
            `https://www.youtube.com/watch?v=${video.id}`,
            parseInt(video.statistics?.viewCount || '0'),
            parseInt(video.statistics?.likeCount || '0'),
            parseInt(video.statistics?.commentCount || '0'),
            video.snippet.thumbnails?.maxres?.url ||
              video.snippet.thumbnails?.high?.url ||
              video.snippet.thumbnails?.medium?.url ||
              video.snippet.thumbnails?.default?.url || '',
            `https://www.youtube.com/watch?v=${video.id}`
          ]);
          episodesCreated++;
          console.log(`  ✓ Created #${episodeNumber}: ${video.snippet.title.substring(0, 60)}...`);
          
          // Log successful import
          const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          await client.query(`
            INSERT INTO org_podcastflow_pro."YouTubeImportLog" (
              id, "showId", "organizationId", "videoId", "videoTitle",
              "videoDuration", "videoType", action, reason, "createdAt"
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
          `, [
            logId,
            showId,
            show.organizationId,
            video.id,
            video.snippet.title.substring(0, 500),
            duration,
            importDecision.contentType,
            'imported',
            null
          ]);
        }
      }
      
      pageToken = playlistData.nextPageToken;
      pagesProcessed++;
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } while (pageToken && pagesProcessed < MAX_PAGES);
    
    // Update show's last sync time
    await client.query(`
      UPDATE org_podcastflow_pro."Show"
      SET "youtubeLastSyncAt" = NOW()
      WHERE id = $1
    `, [showId]);
    
    // Create sync log entry
    const syncLogId = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await client.query(`
      INSERT INTO org_podcastflow_pro."YouTubeSyncLog" (
        id, "organizationId", "syncType", status,
        "completedAt", "totalItems", "processedItems",
        "successfulItems", "failedItems", "quotaUsed",
        "syncConfig", results
      ) VALUES (
        $1, $2, $3, $4, NOW(), $5, $6, $7, $8, $9, $10, $11
      )
    `, [
      syncLogId,
      show.organizationId,
      'videos_filtered',
      'completed',
      totalVideos,
      totalVideos,
      episodesCreated + episodesUpdated,
      videosSkipped,
      pagesProcessed * 8,
      JSON.stringify({ showId, settings }),
      JSON.stringify({
        created: episodesCreated,
        updated: episodesUpdated,
        skipped: videosSkipped,
        skippedReasons,
        totalProcessed: totalVideos
      })
    ]);
    
    console.log('\n=== SYNC COMPLETE ===');
    console.log(`Total videos processed: ${totalVideos}`);
    console.log(`Episodes created: ${episodesCreated}`);
    console.log(`Episodes updated: ${episodesUpdated}`);
    console.log(`Videos skipped: ${videosSkipped}`);
    
    if (videosSkipped > 0) {
      console.log('\nSkip Reasons:');
      for (const [reason, count] of Object.entries(skippedReasons)) {
        console.log(`  - ${reason}: ${count}`);
      }
    }
    
    console.log(`\nPages processed: ${pagesProcessed}`);
    console.log(`Estimated quota used: ${pagesProcessed * 8}`);
    
  } catch (error) {
    console.error('Sync error:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Main execution
async function main() {
  const showId = process.argv[2] || 'show_1755587882316_e5ccuvioa';
  
  console.log('YouTube Filtered Sync Script');
  console.log('============================');
  
  try {
    await syncYouTubeVideos(showId);
    console.log('\nSync completed successfully!');
  } catch (error) {
    console.error('\nSync failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the script
main();