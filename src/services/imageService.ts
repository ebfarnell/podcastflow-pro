/**
 * Image Service for handling image uploads, processing, and serving
 * Replaces placeholder images with proper image handling
 */

export interface ImageUploadResponse {
  url: string
  publicId: string
  width: number
  height: number
  format: string
  size: number
}

export interface ImageOptions {
  width?: number
  height?: number
  quality?: number
  format?: 'webp' | 'jpg' | 'png'
  crop?: 'fill' | 'fit' | 'scale' | 'thumb'
}

class ImageService {
  private readonly baseUrl = process.env.NEXT_PUBLIC_IMAGE_SERVICE_URL || '/api/images'
  private readonly defaultCoverImage = '/images/default-podcast-cover.jpg'
  private readonly defaultAvatar = '/images/default-avatar.jpg'

  /**
   * Upload an image file to the cloud storage
   */
  async upload(file: File, folder?: string): Promise<ImageUploadResponse> {
    try {
      const formData = new FormData()
      formData.append('image', file)
      if (folder) {
        formData.append('folder', folder)
      }

      const response = await fetch(`${this.baseUrl}/upload`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`)
      }

      const result = await response.json()
      return result
    } catch (error) {
      console.error('Error uploading image:', error)
      throw new Error('Failed to upload image')
    }
  }

  /**
   * Generate optimized image URL with transformations
   */
  getOptimizedUrl(originalUrl: string, options: ImageOptions = {}): string {
    // If it's a placeholder URL, return a proper default image
    if (this.isPlaceholderUrl(originalUrl)) {
      return this.getDefaultImage(originalUrl)
    }

    // If it's already an external URL or doesn't need optimization, return as-is
    if (originalUrl.startsWith('http') || originalUrl.startsWith('/images/')) {
      return originalUrl
    }

    // Build query parameters for image optimization
    const params = new URLSearchParams()
    
    if (options.width) params.append('w', options.width.toString())
    if (options.height) params.append('h', options.height.toString())
    if (options.quality) params.append('q', options.quality.toString())
    if (options.format) params.append('f', options.format)
    if (options.crop) params.append('c', options.crop)

    const queryString = params.toString()
    const separator = originalUrl.includes('?') ? '&' : '?'
    
    return queryString ? `${originalUrl}${separator}${queryString}` : originalUrl
  }

  /**
   * Get a default image based on the type of placeholder
   */
  getDefaultImage(placeholderUrl: string): string {
    // Determine type based on dimensions or context
    if (placeholderUrl.includes('40/40') || placeholderUrl.includes('avatar')) {
      return this.defaultAvatar
    }
    
    // Default to cover image for larger dimensions
    return this.defaultCoverImage
  }

  /**
   * Check if URL is a placeholder
   */
  isPlaceholderUrl(url: string): boolean {
    return url.includes('/api/placeholder') || 
           url.includes('placeholder') ||
           url.startsWith('data:image/svg') ||
           url.includes('placeholdit.imgix.net')
  }

  /**
   * Generate podcast cover image with text fallback
   */
  generateCoverImage(showName: string, options: ImageOptions = {}): string {
    const params = new URLSearchParams({
      text: showName,
      bg: 'gradient',
      size: `${options.width || 300}x${options.height || 300}`
    })

    return `${this.baseUrl}/generate?${params.toString()}`
  }

  /**
   * Generate avatar with initials
   */
  generateAvatar(name: string, options: ImageOptions = {}): string {
    const initials = name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .join('')
      .slice(0, 2)

    const params = new URLSearchParams({
      text: initials,
      bg: 'auto',
      color: 'white',
      size: `${options.width || 40}x${options.height || 40}`
    })

    return `${this.baseUrl}/avatar?${params.toString()}`
  }

  /**
   * Delete an image from storage
   */
  async delete(publicId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/delete`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ publicId }),
      })

      return response.ok
    } catch (error) {
      console.error('Error deleting image:', error)
      return false
    }
  }

  /**
   * Validate image file before upload
   */
  validateImage(file: File): { valid: boolean; error?: string } {
    const maxSize = 10 * 1024 * 1024 // 10MB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

    if (!allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: 'Invalid file type. Please use JPEG, PNG, WebP, or GIF.'
      }
    }

    if (file.size > maxSize) {
      return {
        valid: false,
        error: 'File size too large. Maximum size is 10MB.'
      }
    }

    return { valid: true }
  }

  /**
   * Convert blob URL to optimized image URL
   */
  async processBlob(blobUrl: string, options: ImageOptions = {}): Promise<string> {
    try {
      const response = await fetch(blobUrl)
      const blob = await response.blob()
      const file = new File([blob], 'image.jpg', { type: blob.type })
      
      const uploadResult = await this.upload(file)
      return this.getOptimizedUrl(uploadResult.url, options)
    } catch (error) {
      console.error('Error processing blob:', error)
      return this.defaultCoverImage
    }
  }
}

export const imageService = new ImageService()