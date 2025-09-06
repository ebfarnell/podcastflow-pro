#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

// Helper function to encrypt API key
function encryptApiKey(apiKey) {
  const ENCRYPTION_KEY = process.env.YOUTUBE_ENCRYPTION_KEY || 'a'.repeat(64);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    'aes-256-cbc',
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    iv
  );
  let encrypted = cipher.update(apiKey);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

async function fixYouTubeIntegration() {
  try {
    console.log('🔧 Fixing YouTube Integration...\n');
    
    const organizationId = 'org_1754865456639_dzmqka';
    
    // Check if config exists
    const existingConfig = await prisma.youTubeApiConfig.findUnique({
      where: { organizationId }
    });
    
    if (existingConfig) {
      console.log('✅ YouTube API configuration already exists');
      console.log(`   Has API Key: ${!!existingConfig.apiKey}`);
      console.log(`   Is Active: ${existingConfig.isActive}`);
      console.log(`   Quota Used: ${existingConfig.quotaUsed}/${existingConfig.quotaLimit}`);
    } else {
      console.log('❌ No YouTube API configuration found');
      console.log('\n📝 To complete YouTube integration:');
      console.log('1. Go to https://console.cloud.google.com');
      console.log('2. Enable YouTube Data API v3');
      console.log('3. Create an API key');
      console.log('4. Save it in the YouTube settings page in the app');
      console.log('\nOr run this command with an API key:');
      console.log('YOUTUBE_API_KEY="your-key-here" node fix-youtube-integration.js');
      
      // If API key is provided via environment, create the config
      if (process.env.YOUTUBE_API_KEY && process.env.YOUTUBE_API_KEY !== 'YOUR_API_KEY_HERE') {
        console.log('\n🔑 API key provided, creating configuration...');
        
        const encryptedKey = encryptApiKey(process.env.YOUTUBE_API_KEY);
        
        const newConfig = await prisma.youTubeApiConfig.create({
          data: {
            organizationId,
            apiKey: encryptedKey,
            quotaLimit: 10000,
            quotaUsed: 0,
            isActive: true,
            syncFrequency: 'daily'
          }
        });
        
        console.log('✅ YouTube API configuration created successfully!');
        console.log(`   Config ID: ${newConfig.id}`);
      }
    }
    
    // Check YouTube sync logs
    console.log('\n📊 Checking YouTube sync logs...');
    const syncLogs = await prisma.$queryRaw`
      SELECT id, status, "completedAt", "totalItems", "successfulItems", "errorMessage"
      FROM org_podcastflow_pro."YouTubeSyncLog"
      WHERE "organizationId" = ${organizationId}
      ORDER BY "createdAt" DESC
      LIMIT 5
    `;
    
    if (syncLogs.length > 0) {
      console.log(`Found ${syncLogs.length} sync attempts:`);
      syncLogs.forEach((log, index) => {
        console.log(`${index + 1}. Status: ${log.status}, Items: ${log.successfulItems}/${log.totalItems}`);
        if (log.errorMessage) {
          console.log(`   Error: ${log.errorMessage}`);
        }
      });
    } else {
      console.log('No sync attempts found yet');
    }
    
    // Check if episodes were created
    console.log('\n📺 Checking YouTube episodes...');
    const youtubeEpisodes = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM org_podcastflow_pro."Episode"
      WHERE "youtubeVideoId" IS NOT NULL
    `;
    
    console.log(`YouTube episodes in database: ${youtubeEpisodes[0].count}`);
    
    // Check the show's YouTube configuration
    console.log('\n🎬 Checking show configuration...');
    const show = await prisma.$queryRaw`
      SELECT id, name, "youtubeChannelUrl", "youtubePlaylistId", 
             "youtubeSyncEnabled", "youtubeAutoCreateEpisodes"
      FROM org_podcastflow_pro."Show"
      WHERE id = 'show_1755587882316_e5ccuvioa'
    `;
    
    if (show[0]) {
      console.log(`Show: ${show[0].name}`);
      console.log(`Channel URL: ${show[0].youtubeChannelUrl}`);
      console.log(`Playlist ID: ${show[0].youtubePlaylistId}`);
      console.log(`Sync Enabled: ${show[0].youtubeSyncEnabled}`);
      console.log(`Auto-create Episodes: ${show[0].youtubeAutoCreateEpisodes}`);
    }
    
    console.log('\n✅ Diagnostic complete!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the fix
fixYouTubeIntegration();