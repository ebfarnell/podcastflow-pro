/**
 * YouTube Service Export with Conditional Quota Management
 * 
 * Exports the appropriate YouTube service based on feature flag
 */

import { YouTubeService as YouTubeServiceOriginal } from './youtube-service'
import { YouTubeServiceWithQuota } from './youtube-service-quota'
import { syncYouTubeUploads as syncOriginal } from './sync-uploads'
import { syncYouTubeUploadsWithQuota } from './sync-uploads-quota'

// Check if quota enforcement is enabled
const QUOTA_ENFORCEMENT_ENABLED = process.env.YOUTUBE_QUOTA_ENFORCEMENT === 'true'

// Export the appropriate service based on feature flag
export const YouTubeService = QUOTA_ENFORCEMENT_ENABLED 
  ? YouTubeServiceWithQuota 
  : YouTubeServiceOriginal

export const syncYouTubeUploads = QUOTA_ENFORCEMENT_ENABLED
  ? syncYouTubeUploadsWithQuota
  : syncOriginal

// Re-export quota manager for UI components
export { quotaManager, QuotaExceededError, YOUTUBE_API_COSTS } from './quota-manager'
export type { QuotaCheckResult, QuotaUsageUpdate, YouTubeEndpoint } from './quota-manager'

// Re-export errors
export * from './errors'

// Log which version is active
if (typeof window === 'undefined') {
  console.log(`[YouTube Service] Quota enforcement: ${QUOTA_ENFORCEMENT_ENABLED ? 'ENABLED' : 'DISABLED'}`)
}