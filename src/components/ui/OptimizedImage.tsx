import React, { useState } from 'react'
import { Box, Skeleton } from '@mui/material'
import { imageService, type ImageOptions } from '@/services/imageService'

interface OptimizedImageProps {
  src: string
  alt: string
  width?: number
  height?: number
  options?: ImageOptions
  fallbackText?: string
  borderRadius?: number | string
  className?: string
  style?: React.CSSProperties
}

/**
 * OptimizedImage component that handles:
 * - Automatic placeholder replacement
 * - Image optimization
 * - Loading states
 * - Fallback generation
 */
export function OptimizedImage({
  src,
  alt,
  width,
  height,
  options = {},
  fallbackText,
  borderRadius = 0,
  className,
  style,
  ...props
}: OptimizedImageProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Merge width/height into options
  const imageOptions: ImageOptions = {
    width: width || options.width,
    height: height || options.height,
    quality: options.quality || 85,
    format: options.format || 'webp',
    crop: options.crop || 'fill',
    ...options,
  }

  // Get optimized URL or generate fallback
  const optimizedSrc = React.useMemo(() => {
    if (error && fallbackText) {
      return imageService.generateCoverImage(fallbackText, imageOptions)
    }
    return imageService.getOptimizedUrl(src, imageOptions)
  }, [src, error, fallbackText, imageOptions])

  const handleLoad = () => {
    setLoading(false)
    setError(false)
  }

  const handleError = () => {
    setLoading(false)
    setError(true)
  }

  const containerStyle: React.CSSProperties = {
    width: width || '100%',
    height: height || 'auto',
    borderRadius,
    overflow: 'hidden',
    position: 'relative',
    ...style,
  }

  return (
    <Box sx={containerStyle} className={className}>
      {loading && (
        <Skeleton
          variant="rectangular"
          width={width}
          height={height}
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            borderRadius,
          }}
        />
      )}
      <img
        src={optimizedSrc}
        alt={alt}
        onLoad={handleLoad}
        onError={handleError}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: loading ? 0 : 1,
          transition: 'opacity 0.2s ease-in-out',
        }}
        {...props}
      />
    </Box>
  )
}

export default OptimizedImage