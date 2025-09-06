#!/usr/bin/env node

// Test YouTube sync functionality
const crypto = require('crypto');

// Configuration
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || 'YOUR_API_KEY_HERE';
const SHOW_ID = 'show_1755587882316_e5ccuvioa';
const PLAYLIST_ID = 'PLY155lJX6_wcTzyjW2sGB4sTT5ZkivwnN';
const CHANNEL_HANDLE = '@TheoVon';

async function testYouTubeSync() {
  console.log('🎬 Testing YouTube sync functionality...\n');
  
  // Step 1: Test if we can fetch videos from the playlist
  console.log('Step 1: Fetching videos from playlist...');
  console.log(`Playlist ID: ${PLAYLIST_ID}`);
  
  if (!YOUTUBE_API_KEY || YOUTUBE_API_KEY === 'YOUR_API_KEY_HERE') {
    console.error('❌ ERROR: Please set YOUTUBE_API_KEY environment variable');
    console.log('\nTo fix this:');
    console.log('1. Get a YouTube Data API v3 key from Google Cloud Console');
    console.log('2. Run: export YOUTUBE_API_KEY="your-api-key-here"');
    console.log('3. Run this script again');
    return;
  }
  
  try {
    // Fetch playlist items
    const playlistUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${PLAYLIST_ID}&maxResults=5&key=${YOUTUBE_API_KEY}`;
    console.log(`\nFetching from: ${playlistUrl.replace(YOUTUBE_API_KEY, 'API_KEY_HIDDEN')}\n`);
    
    const response = await fetch(playlistUrl);
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ YouTube API Error:', errorData);
      
      if (response.status === 403) {
        console.log('\n⚠️  Possible issues:');
        console.log('1. API key is invalid');
        console.log('2. YouTube Data API v3 is not enabled in Google Cloud Console');
        console.log('3. API key restrictions are too strict');
      }
      return;
    }
    
    const data = await response.json();
    console.log(`✅ Found ${data.items.length} videos in playlist\n`);
    
    // Display first 3 videos
    console.log('Sample videos:');
    data.items.slice(0, 3).forEach((item, index) => {
      console.log(`${index + 1}. ${item.snippet.title}`);
      console.log(`   Video ID: ${item.contentDetails.videoId}`);
      console.log(`   Published: ${new Date(item.snippet.publishedAt).toLocaleDateString()}`);
    });
    
    // Step 2: Test video details API
    console.log('\nStep 2: Fetching video details...');
    const videoIds = data.items.map(item => item.contentDetails.videoId).join(',');
    const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics,snippet&id=${videoIds}&key=${YOUTUBE_API_KEY}`;
    
    const detailsResponse = await fetch(detailsUrl);
    if (!detailsResponse.ok) {
      console.error('❌ Failed to fetch video details');
      return;
    }
    
    const detailsData = await detailsResponse.json();
    console.log(`✅ Retrieved details for ${detailsData.items.length} videos\n`);
    
    // Show statistics for first video
    const firstVideo = detailsData.items[0];
    console.log('First video statistics:');
    console.log(`- Title: ${firstVideo.snippet.title}`);
    console.log(`- Views: ${parseInt(firstVideo.statistics.viewCount).toLocaleString()}`);
    console.log(`- Duration: ${firstVideo.contentDetails.duration}`);
    console.log(`- Likes: ${parseInt(firstVideo.statistics.likeCount || 0).toLocaleString()}`);
    
    console.log('\n✅ YouTube API is working correctly!');
    console.log('\n📝 Next steps:');
    console.log('1. Save the API key in the YouTube settings page');
    console.log('2. Make sure "Auto-create episodes" is enabled');
    console.log('3. Click "Sync Now" to import episodes');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run the test
testYouTubeSync();