#!/usr/bin/env node

/**
 * Full YouTube Sync Script
 * Syncs all videos from a YouTube channel to Episodes in the database
 * 
 * Usage: node sync-youtube-full.js [showId]
 */

const https = require('https');
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://podcastflow:PodcastFlow2025Prod@localhost:5432/podcastflow_production',
});

// YouTube API configuration
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
const MAX_RESULTS = 50; // YouTube API max per page
const MAX_PAGES = 50; // Limit to prevent runaway quota usage (50 pages = 2500 videos max)

/**
 * Decrypt API key using AES-256-CBC
 */
function decryptApiKey(encryptedKey) {
  // If it's not encrypted (no colon), return as-is
  if (!encryptedKey.includes(':')) {
    return encryptedKey;
  }
  
  const crypto = require('crypto');
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
 * Extract episode number from title
 */
function extractEpisodeNumber(title) {
  const patterns = [
    /(?:episode|ep\.?|#)\s*(\d+)/i,
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
 * Sync YouTube videos to episodes
 */
async function syncYouTubeVideos(showId) {
  const client = await pool.connect();
  
  try {
    // Get show details
    const showResult = await client.query(`
      SELECT 
        s.id, 
        s.name, 
        s."youtubeChannelUrl",
        s."youtubeChannelId",
        s."youtubeUploadsPlaylistId",
        s."organizationId"
      FROM org_podcastflow_pro."Show" s
      WHERE s.id = $1
    `, [showId]);
    
    if (showResult.rows.length === 0) {
      throw new Error('Show not found');
    }
    
    const show = showResult.rows[0];
    console.log(`\nSyncing YouTube videos for: ${show.name}`);
    console.log(`Channel ID: ${show.youtubeChannelId}`);
    
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
        
        // Update the show with the uploads playlist ID
        await client.query(`
          UPDATE org_podcastflow_pro."Show"
          SET "youtubeUploadsPlaylistId" = $1
          WHERE id = $2
        `, [uploadsPlaylistId, showId]);
      } else {
        throw new Error('Could not fetch channel details from YouTube');
      }
    }
    
    if (!uploadsPlaylistId) {
      throw new Error('No uploads playlist ID available');
    }
    
    console.log(`Uploads Playlist: ${uploadsPlaylistId}`);
    
    // Fetch all videos from uploads playlist
    let pageToken = null;
    let totalVideos = 0;
    let episodesCreated = 0;
    let episodesUpdated = 0;
    let pagesProcessed = 0;
    
    console.log('\nFetching videos from YouTube...');
    
    do {
      // Build playlist items URL
      let playlistUrl = `${YOUTUBE_API_BASE}/playlistItems?part=contentDetails,snippet&playlistId=${uploadsPlaylistId}&maxResults=${MAX_RESULTS}&key=${apiKey}`;
      if (pageToken) {
        playlistUrl += `&pageToken=${pageToken}`;
      }
      
      console.log(`Fetching page ${pagesProcessed + 1}...`);
      const playlistData = await makeYouTubeRequest(playlistUrl);
      
      if (!playlistData.items || playlistData.items.length === 0) {
        break;
      }
      
      // Collect video IDs
      const videoIds = playlistData.items.map(item => item.contentDetails.videoId);
      
      // Fetch detailed video information
      const videosUrl = `${YOUTUBE_API_BASE}/videos?part=snippet,contentDetails,statistics&id=${videoIds.join(',')}&key=${apiKey}`;
      const videosData = await makeYouTubeRequest(videosUrl);
      
      // Process each video
      for (const video of videosData.items) {
        totalVideos++;
        
        // Check if episode already exists
        const existingResult = await client.query(`
          SELECT id, "youtubeViewCount"
          FROM org_podcastflow_pro."Episode"
          WHERE "showId" = $1 AND "youtubeVideoId" = $2
        `, [showId, video.id]);
        
        if (existingResult.rows.length > 0) {
          // Update existing episode with latest stats
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
          
          if (totalVideos % 10 === 0) {
            console.log(`Updated episode: ${video.snippet.title.substring(0, 50)}...`);
          }
        } else {
          // Create new episode
          let episodeNumber = extractEpisodeNumber(video.snippet.title);
          
          if (!episodeNumber) {
            // Get next available episode number
            const maxEpisodeResult = await client.query(`
              SELECT COALESCE(MAX("episodeNumber"), 0) as max_episode
              FROM org_podcastflow_pro."Episode"
              WHERE "showId" = $1
            `, [showId]);
            episodeNumber = maxEpisodeResult.rows[0].max_episode + 1;
          }
          
          // Generate unique ID
          const episodeId = `ep_youtube_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
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
            parseDuration(video.contentDetails.duration),
            parseDuration(video.contentDetails.duration),
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
          
          console.log(`Created episode #${episodeNumber}: ${video.snippet.title.substring(0, 50)}...`);
        }
      }
      
      pageToken = playlistData.nextPageToken;
      pagesProcessed++;
      
      // Respect rate limits
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
      'videos',
      'completed',
      totalVideos,
      totalVideos,
      episodesCreated + episodesUpdated,
      0,
      pagesProcessed * 8, // Approximate quota usage
      JSON.stringify({ showId, maxPages: MAX_PAGES }),
      JSON.stringify({
        created: episodesCreated,
        updated: episodesUpdated,
        totalProcessed: totalVideos
      })
    ]);
    
    console.log('\n=== SYNC COMPLETE ===');
    console.log(`Total videos processed: ${totalVideos}`);
    console.log(`Episodes created: ${episodesCreated}`);
    console.log(`Episodes updated: ${episodesUpdated}`);
    console.log(`Pages processed: ${pagesProcessed}`);
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
  const showId = process.argv[2] || 'show_1755587882316_e5ccuvioa'; // Default to Theo Von's show
  
  console.log('YouTube Full Sync Script');
  console.log('========================');
  
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