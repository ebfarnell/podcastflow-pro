#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

// Configuration
const ORGANIZATION_ID = 'org_1754865456639_dzmqka';
const ENCRYPTION_KEY = process.env.YOUTUBE_ENCRYPTION_KEY || 'a'.repeat(64);

// Helper function to encrypt API key
function encryptApiKey(apiKey) {
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

async function saveYouTubeApiKey() {
  try {
    const apiKey = process.env.YOUTUBE_API_KEY;
    
    if (!apiKey) {
      console.error('❌ Please provide YOUTUBE_API_KEY environment variable');
      console.log('\nUsage:');
      console.log('YOUTUBE_API_KEY="your-api-key-here" node save-youtube-api-key.js');
      process.exit(1);
    }
    
    console.log('🔑 Encrypting and saving YouTube API key...');
    
    const encryptedKey = encryptApiKey(apiKey);
    
    // Check if config exists
    const existingConfig = await prisma.youTubeApiConfig.findUnique({
      where: { organizationId: ORGANIZATION_ID }
    });
    
    let config;
    if (existingConfig) {
      console.log('📝 Updating existing configuration...');
      config = await prisma.youTubeApiConfig.update({
        where: { organizationId: ORGANIZATION_ID },
        data: {
          apiKey: encryptedKey,
          updatedAt: new Date()
        }
      });
    } else {
      console.log('✨ Creating new configuration...');
      config = await prisma.youTubeApiConfig.create({
        data: {
          organizationId: ORGANIZATION_ID,
          apiKey: encryptedKey,
          quotaLimit: 10000,
          quotaUsed: 0,
          isActive: true,
          syncFrequency: 'daily'
        }
      });
    }
    
    console.log('✅ YouTube API key saved successfully!');
    console.log(`   Config ID: ${config.id}`);
    console.log(`   Organization: ${ORGANIZATION_ID}`);
    console.log(`   Quota Limit: ${config.quotaLimit}`);
    console.log(`   Active: ${config.isActive}`);
    
  } catch (error) {
    console.error('❌ Error saving API key:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
saveYouTubeApiKey();