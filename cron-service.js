/**
 * PodcastFlow Pro Cron Service
 * Manages scheduled tasks like daily YouTube sync
 */

const cron = require('node-cron');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

console.log('[Cron Service] Starting PodcastFlow Pro cron service...');

// Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.podcastflow.pro';
const CRON_SECRET = process.env.CRON_SECRET || 'your-secret-key-here';

// Helper function to call API endpoints
async function callEndpoint(path, method = 'GET') {
  try {
    console.log(`[Cron Service] Calling ${method} ${API_BASE_URL}${path}`);
    
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': CRON_SECRET
      }
    });
    
    const data = await response.json();
    console.log(`[Cron Service] Response:`, data);
    return data;
  } catch (error) {
    console.error(`[Cron Service] Error calling ${path}:`, error);
    return null;
  }
}

// Schedule daily YouTube sync at midnight (12:00 AM)
cron.schedule('0 0 * * *', async () => {
  console.log('[Cron Service] Running daily YouTube sync at midnight...');
  const result = await callEndpoint('/api/cron/youtube-sync');
  
  if (result && result.organizationsSynced !== undefined) {
    console.log(`[Cron Service] YouTube sync completed: ${result.organizationsSynced} organizations synced, ${result.totalEpisodes} episodes processed`);
  } else {
    console.error('[Cron Service] YouTube sync failed or returned unexpected result');
  }
}, {
  scheduled: true,
  timezone: "America/Los_Angeles"
});

// Schedule hourly YouTube sync check at :30 past each hour (for orgs with hourly sync)
cron.schedule('30 * * * *', async () => {
  console.log('[Cron Service] Running hourly YouTube sync check...');
  // This would check for organizations with hourly sync enabled
  // For now, we'll skip this as most orgs use daily sync
});

// Process notification queue every minute
cron.schedule('* * * * *', async () => {
  const result = await callEndpoint('/api/cron/notifications');
  
  if (result && result.processed > 0) {
    console.log(`[Cron Service] Processed ${result.processed} notifications (${result.successful} successful, ${result.failed} failed)`);
  }
}, {
  scheduled: true
});

// Heartbeat - log every hour to show service is running
cron.schedule('0 * * * *', () => {
  console.log('[Cron Service] Heartbeat - Cron service is running');
});

// Run an immediate sync on startup for testing (will run once when cron restarts)
if (process.env.NODE_ENV !== 'production' || process.env.RUN_SYNC_ON_STARTUP === 'true') {
  setTimeout(async () => {
    console.log('[Cron Service] Running immediate YouTube sync (startup test)...');
    const result = await callEndpoint('/api/cron/youtube-sync');
    if (result && result.organizationsSynced !== undefined) {
      console.log(`[Cron Service] Startup sync completed: ${result.organizationsSynced} organizations synced, ${result.totalEpisodes} episodes processed`);
    }
  }, 5000);
}

console.log('[Cron Service] Cron service started successfully');
console.log('[Cron Service] Scheduled tasks:');
console.log('  - Daily YouTube sync at midnight (12:00 AM PST)');
console.log('  - Notification queue processing every minute');
console.log('  - Hourly heartbeat');

// Keep the process running
process.on('SIGINT', () => {
  console.log('[Cron Service] Shutting down cron service...');
  process.exit(0);
});