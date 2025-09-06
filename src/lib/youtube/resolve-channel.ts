/**
 * YouTube Channel Resolver
 * 
 * Resolves various YouTube URL formats and handles to channel IDs and playlist IDs.
 * Supports @handles, /channel/UC..., /user/..., and legacy formats.
 */

import { YouTubeAPIError, YouTubeQuotaError } from './errors'

interface ChannelInfo {
  channelId: string
  uploadsPlaylistId: string
  canonicalUrl: string
  channelTitle?: string
  description?: string
  thumbnailUrl?: string
  subscriberCount?: number
  videoCount?: number
}

interface YouTubeAPIResponse {
  items?: any[]
  error?: {
    code: number
    message: string
    errors?: Array<{
      domain: string
      reason: string
      message: string
    }>
  }
}

/**
 * Parse various YouTube URL formats to extract identifiers
 */
function parseYouTubeUrl(input: string): {
  type: 'handle' | 'channelId' | 'username' | 'customUrl' | 'unknown'
  value: string
} {
  // Trim and clean input
  input = input.trim()
  
  // Direct channel ID (UC...)
  if (input.match(/^UC[\w-]{22}$/)) {
    return { type: 'channelId', value: input }
  }
  
  // Handle format (@username)
  if (input.startsWith('@')) {
    return { type: 'handle', value: input.substring(1) }
  }
  
  // Full URLs
  try {
    const url = new URL(input.includes('://') ? input : `https://${input}`)
    const pathname = url.pathname
    
    // youtube.com/@handle
    if (pathname.match(/^\/@([\w.-]+)/)) {
      return { type: 'handle', value: RegExp.$1 }
    }
    
    // youtube.com/channel/UCxxxxxx
    if (pathname.match(/^\/channel\/(UC[\w-]{22})/)) {
      return { type: 'channelId', value: RegExp.$1 }
    }
    
    // youtube.com/c/customurl
    if (pathname.match(/^\/c\/([\w-]+)/)) {
      return { type: 'customUrl', value: RegExp.$1 }
    }
    
    // youtube.com/user/username
    if (pathname.match(/^\/user\/([\w-]+)/)) {
      return { type: 'username', value: RegExp.$1 }
    }
    
    // youtube.com/customurl (direct custom URL)
    if (pathname.match(/^\/([^\/\@][^\/]*?)$/)) {
      const value = RegExp.$1
      // Skip common YouTube pages
      if (!['watch', 'playlist', 'feed', 'trending', 'subscriptions'].includes(value)) {
        return { type: 'customUrl', value }
      }
    }
  } catch (error) {
    // Not a valid URL, treat as potential handle or custom URL
    if (input.match(/^[\w.-]+$/)) {
      return { type: 'customUrl', value: input }
    }
  }
  
  return { type: 'unknown', value: input }
}

/**
 * Call YouTube API with error handling and quota awareness
 */
async function callYouTubeAPI(
  endpoint: string,
  params: Record<string, any>,
  apiKey: string
): Promise<any> {
  const queryParams = new URLSearchParams({
    ...params,
    key: apiKey
  })
  
  const url = `https://www.googleapis.com/youtube/v3/${endpoint}?${queryParams}`
  
  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://app.podcastflow.pro'
      }
    })
    
    const data: YouTubeAPIResponse = await response.json()
    
    // Check for API errors
    if (data.error) {
      const error = data.error
      
      // Quota exceeded
      if (error.code === 403 && error.errors?.some(e => e.reason === 'quotaExceeded')) {
        throw new YouTubeQuotaError('YouTube API quota exceeded')
      }
      
      // Invalid API key
      if (error.code === 403 && error.errors?.some(e => 
        ['keyInvalid', 'keyExpired', 'accessNotConfigured'].includes(e.reason)
      )) {
        throw new YouTubeAPIError(`Invalid YouTube API key: ${error.message}`, 'INVALID_API_KEY')
      }
      
      // Not found
      if (error.code === 404) {
        throw new YouTubeAPIError('Channel not found', 'CHANNEL_NOT_FOUND')
      }
      
      // Generic API error
      throw new YouTubeAPIError(
        error.message || 'YouTube API error',
        'API_ERROR'
      )
    }
    
    return data
  } catch (error) {
    if (error instanceof YouTubeAPIError || error instanceof YouTubeQuotaError) {
      throw error
    }
    
    // Network or other errors
    throw new YouTubeAPIError(
      `Failed to call YouTube API: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'NETWORK_ERROR'
    )
  }
}

/**
 * Resolve a YouTube channel from various input formats
 * 
 * @param apiKey - YouTube Data API v3 key
 * @param input - Channel URL, @handle, or channel ID
 * @returns Channel information including channel ID and uploads playlist
 */
export async function resolveYouTubeChannel(
  apiKey: string,
  input: string
): Promise<ChannelInfo> {
  if (!apiKey) {
    throw new YouTubeAPIError('YouTube API key is required', 'MISSING_API_KEY')
  }
  
  if (!input) {
    throw new YouTubeAPIError('Channel input is required', 'MISSING_INPUT')
  }
  
  const parsed = parseYouTubeUrl(input)
  console.log('Parsed YouTube input:', parsed)
  
  let channelId: string | null = null
  let channelData: any = null
  
  try {
    switch (parsed.type) {
      case 'channelId':
        // We already have the channel ID
        channelId = parsed.value
        break
      
      case 'handle':
        // Search for channel by handle
        const handleSearch = await callYouTubeAPI('search', {
          part: 'snippet',
          type: 'channel',
          q: `@${parsed.value}`,
          maxResults: 1
        }, apiKey)
        
        if (handleSearch.items?.length > 0) {
          channelId = handleSearch.items[0].snippet.channelId
        } else {
          // Try without @ symbol
          const altSearch = await callYouTubeAPI('search', {
            part: 'snippet',
            type: 'channel',
            q: parsed.value,
            maxResults: 5
          }, apiKey)
          
          // Look for exact match in results
          const exactMatch = altSearch.items?.find((item: any) => 
            item.snippet.channelTitle.toLowerCase() === parsed.value.toLowerCase() ||
            item.snippet.customUrl?.toLowerCase() === `@${parsed.value.toLowerCase()}`
          )
          
          if (exactMatch) {
            channelId = exactMatch.snippet.channelId
          } else if (altSearch.items?.length > 0) {
            // Use first result as fallback
            channelId = altSearch.items[0].snippet.channelId
          }
        }
        break
      
      case 'username':
        // Legacy username format
        const userChannel = await callYouTubeAPI('channels', {
          part: 'snippet,contentDetails',
          forUsername: parsed.value
        }, apiKey)
        
        if (userChannel.items?.length > 0) {
          channelData = userChannel.items[0]
          channelId = channelData.id
        }
        break
      
      case 'customUrl':
        // Search by custom URL or channel name
        const customSearch = await callYouTubeAPI('search', {
          part: 'snippet',
          type: 'channel',
          q: parsed.value,
          maxResults: 5
        }, apiKey)
        
        // Try to find exact match
        const match = customSearch.items?.find((item: any) => {
          const title = item.snippet.channelTitle.toLowerCase()
          const query = parsed.value.toLowerCase()
          return title === query || 
                 title.replace(/\s+/g, '') === query ||
                 item.snippet.customUrl?.toLowerCase() === query
        })
        
        if (match) {
          channelId = match.snippet.channelId
        } else if (customSearch.items?.length > 0) {
          // Use first result as fallback
          channelId = customSearch.items[0].snippet.channelId
        }
        break
      
      default:
        // Try generic search as last resort
        const genericSearch = await callYouTubeAPI('search', {
          part: 'snippet',
          type: 'channel',
          q: parsed.value,
          maxResults: 1
        }, apiKey)
        
        if (genericSearch.items?.length > 0) {
          channelId = genericSearch.items[0].snippet.channelId
        }
    }
    
    if (!channelId) {
      throw new YouTubeAPIError(
        `Could not find YouTube channel for: ${input}`,
        'CHANNEL_NOT_FOUND'
      )
    }
    
    // Get full channel details if we don't have them yet
    if (!channelData) {
      const channelResponse = await callYouTubeAPI('channels', {
        part: 'snippet,contentDetails,statistics',
        id: channelId
      }, apiKey)
      
      if (!channelResponse.items?.length) {
        throw new YouTubeAPIError(
          `Channel not found: ${channelId}`,
          'CHANNEL_NOT_FOUND'
        )
      }
      
      channelData = channelResponse.items[0]
    }
    
    // Extract uploads playlist ID
    const uploadsPlaylistId = channelData.contentDetails?.relatedPlaylists?.uploads
    
    if (!uploadsPlaylistId) {
      // Generate default uploads playlist ID (UU + channel ID suffix)
      const uploadsId = 'UU' + channelId.substring(2)
      console.log('Generated uploads playlist ID:', uploadsId)
      
      return {
        channelId,
        uploadsPlaylistId: uploadsId,
        canonicalUrl: `https://www.youtube.com/channel/${channelId}`,
        channelTitle: channelData.snippet?.title,
        description: channelData.snippet?.description,
        thumbnailUrl: channelData.snippet?.thumbnails?.high?.url || 
                      channelData.snippet?.thumbnails?.medium?.url ||
                      channelData.snippet?.thumbnails?.default?.url,
        subscriberCount: parseInt(channelData.statistics?.subscriberCount || '0'),
        videoCount: parseInt(channelData.statistics?.videoCount || '0')
      }
    }
    
    return {
      channelId,
      uploadsPlaylistId,
      canonicalUrl: `https://www.youtube.com/channel/${channelId}`,
      channelTitle: channelData.snippet?.title,
      description: channelData.snippet?.description,
      thumbnailUrl: channelData.snippet?.thumbnails?.high?.url || 
                    channelData.snippet?.thumbnails?.medium?.url ||
                    channelData.snippet?.thumbnails?.default?.url,
      subscriberCount: parseInt(channelData.statistics?.subscriberCount || '0'),
      videoCount: parseInt(channelData.statistics?.videoCount || '0')
    }
    
  } catch (error) {
    console.error('Error resolving YouTube channel:', error)
    
    if (error instanceof YouTubeAPIError || error instanceof YouTubeQuotaError) {
      throw error
    }
    
    throw new YouTubeAPIError(
      `Failed to resolve channel: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'RESOLVE_ERROR'
    )
  }
}

/**
 * Validate a YouTube API key by making a simple API call
 */
export async function validateYouTubeApiKey(apiKey: string): Promise<boolean> {
  try {
    // Make a simple API call to validate the key
    // Using videos.list with a known video ID uses minimal quota
    await callYouTubeAPI('videos', {
      part: 'id',
      id: 'dQw4w9WgXcQ' // Well-known video ID
    }, apiKey)
    
    return true
  } catch (error) {
    if (error instanceof YouTubeAPIError && error.code === 'INVALID_API_KEY') {
      return false
    }
    // Other errors (quota, network) don't mean the key is invalid
    return true
  }
}