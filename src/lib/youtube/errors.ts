/**
 * YouTube Integration Error Classes
 * 
 * Custom error types for better error handling and user feedback
 */

export class YouTubeAPIError extends Error {
  code: string
  details?: any
  
  constructor(message: string, code: string = 'YOUTUBE_API_ERROR', details?: any) {
    super(message)
    this.name = 'YouTubeAPIError'
    this.code = code
    this.details = details
  }
  
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details
    }
  }
}

export class YouTubeQuotaError extends YouTubeAPIError {
  constructor(message: string = 'YouTube API quota exceeded', details?: any) {
    super(message, 'QUOTA_EXCEEDED', details)
    this.name = 'YouTubeQuotaError'
  }
}

export class YouTubeSyncError extends Error {
  showId?: string
  channelId?: string
  details?: any
  
  constructor(message: string, details?: any) {
    super(message)
    this.name = 'YouTubeSyncError'
    this.details = details
  }
  
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      showId: this.showId,
      channelId: this.channelId,
      details: this.details
    }
  }
}

export class YouTubeAuthError extends YouTubeAPIError {
  constructor(message: string = 'YouTube authentication failed', details?: any) {
    super(message, 'AUTH_ERROR', details)
    this.name = 'YouTubeAuthError'
  }
}