#!/usr/bin/env node

/**
 * Set YouTube API Key directly
 * Usage: node set-youtube-api-key.js YOUR_API_KEY
 */

const { Pool } = require('pg');
const crypto = require('crypto');

// Get API key from command line
const apiKey = process.argv[2];

if (!apiKey) {
  console.error('Usage: node set-youtube-api-key.js YOUR_API_KEY');
  console.error('Example: node set-youtube-api-key.js AIzaSyB...');
  process.exit(1);
}

// Validate API key format
if (!apiKey.match(/^AIza[0-9A-Za-z\-_]{35}$/)) {
  console.error('Invalid YouTube API key format. It should start with AIza and be 39 characters long.');
  process.exit(1);
}

// Database connection
const pool = new Pool({
  connectionString: 'postgresql://podcastflow:PodcastFlow2025Prod@localhost:5432/podcastflow_production',
});

// Encryption function
const ENCRYPTION_KEY = 'a'.repeat(64);
const IV_LENGTH = 16;

function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(
    'aes-256-cbc',
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    iv
  );
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

async function setApiKey() {
  const client = await pool.connect();
  
  try {
    // Encrypt the API key
    const encryptedKey = encrypt(apiKey);
    console.log('Encrypting API key...');
    
    // Update the YouTube config for PodcastFlow Pro organization
    const result = await client.query(`
      UPDATE "YouTubeApiConfig"
      SET 
        "apiKey" = $1,
        "updatedAt" = NOW()
      WHERE "organizationId" = 'cmd2qfev00000og5y8hftu795'
      RETURNING id
    `, [encryptedKey]);
    
    if (result.rows.length > 0) {
      console.log('✅ YouTube API key updated successfully!');
      console.log('Config ID:', result.rows[0].id);
      
      // Test decryption
      const testDecrypt = decrypt(encryptedKey);
      if (testDecrypt === apiKey) {
        console.log('✅ Encryption/decryption test passed');
      } else {
        console.log('⚠️  Warning: Decryption test failed');
      }
    } else {
      console.log('No existing config found. Creating new config...');
      
      const createResult = await client.query(`
        INSERT INTO "YouTubeApiConfig" (
          "organizationId",
          "apiKey",
          "isActive",
          "quotaLimit",
          "quotaUsed",
          "createdAt",
          "updatedAt"
        ) VALUES (
          'cmd2qfev00000og5y8hftu795',
          $1,
          true,
          10000,
          0,
          NOW(),
          NOW()
        )
        RETURNING id
      `, [encryptedKey]);
      
      console.log('✅ YouTube API config created successfully!');
      console.log('Config ID:', createResult.rows[0].id);
    }
    
  } catch (error) {
    console.error('Error setting API key:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

function decrypt(text) {
  const parts = text.split(':');
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
}

// Run the script
setApiKey();