import axios, { AxiosInstance, AxiosResponse } from 'axios'

// Rate limiting configuration (60 requests per minute)
const RATE_LIMIT = {
  requestsPerMinute: 60,
  requestsPerSecond: 1,
}

interface MegaphoneConfig {
  apiToken: string
  baseURL?: string
}

interface MegaphoneNetwork {
  id: string
  name: string
  code: string
  createdAt: string
  podcastCount: number
}

interface MegaphonePodcast {
  id: string
  createdAt: string
  updatedAt: string
  title: string
  link?: string
  copyright?: string
  author?: string
  imageFile?: string
  explicit: 'no' | 'clean' | 'yes'
  ownerName?: string
  subtitle?: string
  summary?: string
  ownerEmail?: string
  language: string
  itunesCategories: string[]
  uid?: string
  category?: string
  redirectUrl?: string
  itunesActive?: boolean
  slug?: string
  networkId: string
  redirectedAt?: string
  itunesRating?: number
  originalRssUrl?: string
  itunesIdentifier?: string
  stitcherIdentifier?: string
  episodesCount: number
  podtracEnabled: boolean
  spotifyIdentifier?: string
  episodeLimit?: number
  feedUrl?: string
  externalId?: string
  podcastType: 'episodic' | 'serial'
  advertisingTags: string[]
  clonedFeedUrls: string[]
  adFreeFeedUrls: string[]
  spanOptIn: 'unsubmitted' | 'pending' | 'active' | 'paused' | 'rejected'
  adFree: boolean
}

interface MegaphoneEpisode {
  id: string
  createdAt: string
  updatedAt: string
  title: string
  pubdate?: string
  link?: string
  author?: string
  imageFile?: string
  explicit: 'no' | 'clean' | 'yes'
  episodeType: 'full' | 'trailer' | 'bonus'
  seasonNumber?: number
  episodeNumber?: number
  subtitle?: string
  summary?: string
  audioFile?: string
  downloadUrl?: string
  size?: number
  duration?: number
  uid?: string
  originalUrl?: string
  bitrate?: number
  samplerate?: number
  channelMode: 'stereo' | 'mono' | 'jstereo'
  vbr: boolean
  audioFileProcessing: boolean
  podcastId: string
  preCount: number
  postCount: number
  insertionPoints: number[]
  cuepoints?: any[]
  id3File?: string
  id3FileProcessing: boolean
  id3FileSize?: number
  parentId?: string
  guid?: string
  pubdateTimezone?: string
  originalFilename?: string
  preOffset: number
  postOffset: number
  spotifyIdentifier?: string
  expectedAdhash?: string
  audioFileUpdatedAt?: string
  draft: boolean
  externalId?: string
  cleanTitle?: string
  customFields?: any
  podcastTitle?: string
  networkId?: string
  podcastAuthor?: string
  podcastItunesCategories?: string[]
  advertisingTags: string[]
  status: 'published' | 'scheduled' | 'not_ready'
  audioFileStatus: 'no_audio' | 'processing' | 'success' | 'error'
  adFree: boolean
  contentRating?: 'eighteen_plus' | 'unspecified'
  promotionalContent: boolean
  episodeVideoThumbnailUrl?: string
}

interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    perPage: number
    total: number
    lastPage?: number
    nextPage?: number
    prevPage?: number
  }
  links?: {
    first?: string
    last?: string
    next?: string
    prev?: string
  }
}

class MegaphoneApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string,
    public response?: any
  ) {
    super(message)
    this.name = 'MegaphoneApiError'
  }
}

export class MegaphoneApiService {
  private client: AxiosInstance
  private lastRequestTime: number = 0

  constructor(config: MegaphoneConfig) {
    this.client = axios.create({
      baseURL: config.baseURL || 'https://cms.megaphone.fm/api',
      headers: {
        'Authorization': `Token token="${config.apiToken}"`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 30000, // 30 seconds
    })

    // Add request interceptor for rate limiting
    this.client.interceptors.request.use(async (config) => {
      await this.enforceRateLimit()
      return config
    })

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response) {
          throw new MegaphoneApiError(
            error.response.data?.message || error.message,
            error.response.status,
            error.response.data?.code,
            error.response.data
          )
        }
        throw new MegaphoneApiError(error.message)
      }
    )
  }

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now()
    const timeSinceLastRequest = now - this.lastRequestTime
    const minInterval = 1000 / RATE_LIMIT.requestsPerSecond // 1 second between requests

    if (timeSinceLastRequest < minInterval) {
      const waitTime = minInterval - timeSinceLastRequest
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }

    this.lastRequestTime = Date.now()
  }

  /**
   * Get all networks for the organization
   */
  async getNetworks(): Promise<MegaphoneNetwork[]> {
    const response = await this.client.get<MegaphoneNetwork[]>('/networks')
    return response.data
  }

  /**
   * Get all podcasts across all networks
   */
  async getAllPodcasts(params?: {
    page?: number
    perPage?: number
  }): Promise<PaginatedResponse<MegaphonePodcast>> {
    const queryParams = new URLSearchParams()
    if (params?.page) queryParams.append('page', params.page.toString())
    if (params?.perPage) queryParams.append('per_page', Math.min(params.perPage, 500).toString())

    const response = await this.client.get<MegaphonePodcast[]>(`/podcasts?${queryParams}`)
    
    return this.parsePaginatedResponse(response)
  }

  /**
   * Get podcasts for a specific network
   */
  async getNetworkPodcasts(
    networkId: string,
    params?: { page?: number; perPage?: number }
  ): Promise<PaginatedResponse<MegaphonePodcast>> {
    const queryParams = new URLSearchParams()
    if (params?.page) queryParams.append('page', params.page.toString())
    if (params?.perPage) queryParams.append('per_page', Math.min(params.perPage, 500).toString())

    const response = await this.client.get<MegaphonePodcast[]>(
      `/networks/${networkId}/podcasts?${queryParams}`
    )

    return this.parsePaginatedResponse(response)
  }

  /**
   * Get all episodes for a podcast
   */
  async getPodcastEpisodes(
    networkId: string,
    podcastId: string,
    params?: { page?: number; perPage?: number }
  ): Promise<PaginatedResponse<MegaphoneEpisode>> {
    const queryParams = new URLSearchParams()
    if (params?.page) queryParams.append('page', params.page.toString())
    if (params?.perPage) queryParams.append('per_page', Math.min(params.perPage, 500).toString())

    const response = await this.client.get<MegaphoneEpisode[]>(
      `/networks/${networkId}/podcasts/${podcastId}/episodes?${queryParams}`
    )

    return this.parsePaginatedResponse(response)
  }

  /**
   * Get all episodes across all podcasts (useful for recent episodes)
   */
  async getAllEpisodes(params?: {
    page?: number
    perPage?: number
    externalId?: string
  }): Promise<PaginatedResponse<MegaphoneEpisode>> {
    const queryParams = new URLSearchParams()
    if (params?.page) queryParams.append('page', params.page.toString())
    if (params?.perPage) queryParams.append('per_page', Math.min(params.perPage, 500).toString())
    if (params?.externalId) queryParams.append('external_id', params.externalId)

    const response = await this.client.get<MegaphoneEpisode[]>(`/episodes?${queryParams}`)
    
    return this.parsePaginatedResponse(response)
  }

  /**
   * Get a specific podcast by ID
   */
  async getPodcast(networkId: string, podcastId: string): Promise<MegaphonePodcast> {
    const response = await this.client.get<MegaphonePodcast>(
      `/networks/${networkId}/podcasts/${podcastId}`
    )
    return response.data
  }

  /**
   * Get a specific episode by ID
   */
  async getEpisode(
    networkId: string,
    podcastId: string,
    episodeId: string
  ): Promise<MegaphoneEpisode> {
    const response = await this.client.get<MegaphoneEpisode>(
      `/networks/${networkId}/podcasts/${podcastId}/episodes/${episodeId}`
    )
    return response.data
  }

  /**
   * Test the API connection
   */
  async testConnection(): Promise<{ success: boolean; networkCount: number }> {
    try {
      const networks = await this.getNetworks()
      return {
        success: true,
        networkCount: networks.length,
      }
    } catch (error) {
      throw new MegaphoneApiError(
        `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Parse paginated response from Megaphone API
   */
  private parsePaginatedResponse<T>(response: AxiosResponse<T[]>): PaginatedResponse<T> {
    const linkHeader = response.headers.link
    const page = parseInt(response.headers['x-page'] || '1')
    const perPage = parseInt(response.headers['x-per-page'] || '20')
    const total = parseInt(response.headers['x-total'] || '0')

    // Parse Link header for pagination URLs
    const links: { [key: string]: string } = {}
    if (linkHeader) {
      const linkParts = linkHeader.split(',')
      linkParts.forEach((part) => {
        const match = part.match(/<([^>]+)>;\s*rel="([^"]+)"/)
        if (match) {
          links[match[2]] = match[1]
        }
      })
    }

    return {
      data: response.data,
      pagination: {
        page,
        perPage,
        total,
        lastPage: Math.ceil(total / perPage),
        nextPage: links.next ? page + 1 : undefined,
        prevPage: links.prev ? page - 1 : undefined,
      },
      links: {
        first: links.first,
        last: links.last,
        next: links.next,
        prev: links.prev,
      },
    }
  }
}

export { MegaphoneApiError }
export type {
  MegaphoneConfig,
  MegaphoneNetwork,
  MegaphonePodcast,
  MegaphoneEpisode,
  PaginatedResponse,
}