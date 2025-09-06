'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Box,
  IconButton,
  Slider,
  Typography,
  Stack,
  Paper,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  CircularProgress,
  Button,
} from '@mui/material'
import {
  PlayArrow,
  Pause,
  SkipNext,
  SkipPrevious,
  VolumeUp,
  VolumeOff,
  Speed,
  Forward10,
  Replay10,
  Download,
  Share,
  MoreVert,
  Fullscreen,
  PictureInPictureAlt,
} from '@mui/icons-material'

interface AudioPlayerProps {
  src: string
  title: string
  subtitle?: string
  coverImage?: string
  onNext?: () => void
  onPrevious?: () => void
  showSkipButtons?: boolean
  compact?: boolean
  autoPlay?: boolean
  onTimeUpdate?: (currentTime: number, duration: number) => void
  onEnded?: () => void
}

export function AudioPlayer({
  src,
  title,
  subtitle,
  coverImage,
  onNext,
  onPrevious,
  showSkipButtons = false,
  compact = false,
  autoPlay = false,
  onTimeUpdate,
  onEnded,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [speedMenuAnchor, setSpeedMenuAnchor] = useState<null | HTMLElement>(null)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const setAudioData = () => {
      setDuration(audio.duration)
      setCurrentTime(audio.currentTime)
      setIsLoading(false)
    }

    const setAudioTime = () => {
      setCurrentTime(audio.currentTime)
      if (onTimeUpdate) {
        onTimeUpdate(audio.currentTime, audio.duration)
      }
    }

    const handleEnded = () => {
      setIsPlaying(false)
      if (onEnded) {
        onEnded()
      }
    }

    const handleLoadStart = () => {
      setIsLoading(true)
    }

    const handleCanPlay = () => {
      setIsLoading(false)
    }

    // Add event listeners
    audio.addEventListener('loadeddata', setAudioData)
    audio.addEventListener('timeupdate', setAudioTime)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('loadstart', handleLoadStart)
    audio.addEventListener('canplay', handleCanPlay)

    // Auto play if requested
    if (autoPlay) {
      audio.play().then(() => setIsPlaying(true)).catch(console.error)
    }

    return () => {
      audio.removeEventListener('loadeddata', setAudioData)
      audio.removeEventListener('timeupdate', setAudioTime)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('loadstart', handleLoadStart)
      audio.removeEventListener('canplay', handleCanPlay)
    }
  }, [src, autoPlay, onTimeUpdate, onEnded])

  const togglePlayPause = () => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
    } else {
      audio.play()
    }
    setIsPlaying(!isPlaying)
  }

  const handleSliderChange = (_: Event, value: number | number[]) => {
    const audio = audioRef.current
    if (!audio) return

    const newTime = value as number
    audio.currentTime = newTime
    setCurrentTime(newTime)
  }

  const handleVolumeChange = (_: Event, value: number | number[]) => {
    const audio = audioRef.current
    if (!audio) return

    const newVolume = value as number
    audio.volume = newVolume
    setVolume(newVolume)
    setIsMuted(newVolume === 0)
  }

  const toggleMute = () => {
    const audio = audioRef.current
    if (!audio) return

    if (isMuted) {
      audio.volume = volume || 1
      setIsMuted(false)
    } else {
      audio.volume = 0
      setIsMuted(true)
    }
  }

  const skip = (seconds: number) => {
    const audio = audioRef.current
    if (!audio) return

    audio.currentTime = Math.max(0, Math.min(audio.currentTime + seconds, duration))
  }

  const handleSpeedChange = (speed: number) => {
    const audio = audioRef.current
    if (!audio) return

    audio.playbackRate = speed
    setPlaybackRate(speed)
    setSpeedMenuAnchor(null)
  }

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00'
    
    const hours = Math.floor(time / 3600)
    const minutes = Math.floor((time % 3600) / 60)
    const seconds = Math.floor(time % 60)

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const handleDownload = () => {
    const a = document.createElement('a')
    a.href = src
    a.download = title + '.mp3'
    a.click()
    setAnchorEl(null)
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: title,
          text: subtitle || `Listen to ${title}`,
          url: typeof window !== 'undefined' ? window.location.href : '',
        })
      } catch (error) {
        console.error('Error sharing:', error)
      }
    } else {
      // Fallback to copying URL
      if (typeof window !== 'undefined') {
        navigator.clipboard.writeText(window.location.href)
        alert('Link copied to clipboard!')
      }
    }
    setAnchorEl(null)
  }

  if (compact) {
    return (
      <Paper sx={{ p: 2 }}>
        <audio ref={audioRef} src={src} />
        <Stack spacing={1}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {coverImage && (
              <Box
                component="img"
                src={coverImage}
                alt={title}
                sx={{ width: 48, height: 48, borderRadius: 1 }}
              />
            )}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle2" noWrap>{title}</Typography>
              {subtitle && (
                <Typography variant="caption" color="text.secondary" noWrap>
                  {subtitle}
                </Typography>
              )}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <IconButton onClick={() => skip(-10)} size="small">
                <Replay10 />
              </IconButton>
              <IconButton onClick={togglePlayPause} disabled={isLoading}>
                {isLoading ? (
                  <CircularProgress size={24} />
                ) : isPlaying ? (
                  <Pause />
                ) : (
                  <PlayArrow />
                )}
              </IconButton>
              <IconButton onClick={() => skip(10)} size="small">
                <Forward10 />
              </IconButton>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" sx={{ minWidth: 40 }}>
              {formatTime(currentTime)}
            </Typography>
            <Slider
              size="small"
              value={currentTime}
              max={duration}
              onChange={handleSliderChange}
              sx={{ flex: 1 }}
            />
            <Typography variant="caption" sx={{ minWidth: 40, textAlign: 'right' }}>
              {formatTime(duration)}
            </Typography>
          </Box>
        </Stack>
      </Paper>
    )
  }

  return (
    <Paper sx={{ p: 3 }}>
      <audio ref={audioRef} src={src} />
      
      <Stack spacing={3}>
        {/* Title and Cover */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          {coverImage && (
            <Box
              component="img"
              src={coverImage}
              alt={title}
              sx={{ width: 80, height: 80, borderRadius: 2 }}
            />
          )}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6" noWrap>{title}</Typography>
            {subtitle && (
              <Typography variant="body2" color="text.secondary" noWrap>
                {subtitle}
              </Typography>
            )}
          </Box>
          <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
            <MoreVert />
          </IconButton>
        </Box>

        {/* Progress Bar */}
        <Box>
          <Slider
            value={currentTime}
            max={duration}
            onChange={handleSliderChange}
            sx={{ mb: 1 }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="caption">{formatTime(currentTime)}</Typography>
            <Typography variant="caption">{formatTime(duration)}</Typography>
          </Box>
        </Box>

        {/* Controls */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
          {showSkipButtons && (
            <IconButton onClick={onPrevious} disabled={!onPrevious}>
              <SkipPrevious fontSize="large" />
            </IconButton>
          )}
          
          <IconButton onClick={() => skip(-10)}>
            <Replay10 />
          </IconButton>

          <IconButton 
            onClick={togglePlayPause} 
            disabled={isLoading}
            sx={{ 
              bgcolor: 'primary.main', 
              color: 'primary.contrastText',
              '&:hover': { bgcolor: 'primary.dark' },
              p: 2,
            }}
          >
            {isLoading ? (
              <CircularProgress size={32} color="inherit" />
            ) : isPlaying ? (
              <Pause fontSize="large" />
            ) : (
              <PlayArrow fontSize="large" />
            )}
          </IconButton>

          <IconButton onClick={() => skip(10)}>
            <Forward10 />
          </IconButton>

          {showSkipButtons && (
            <IconButton onClick={onNext} disabled={!onNext}>
              <SkipNext fontSize="large" />
            </IconButton>
          )}
        </Box>

        {/* Bottom Controls */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {/* Volume */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
            <IconButton onClick={toggleMute} size="small">
              {isMuted ? <VolumeOff /> : <VolumeUp />}
            </IconButton>
            <Slider
              size="small"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              max={1}
              step={0.1}
              sx={{ width: 100 }}
            />
          </Box>

          {/* Speed */}
          <Button
            size="small"
            startIcon={<Speed />}
            onClick={(e) => setSpeedMenuAnchor(e.currentTarget)}
          >
            {playbackRate}x
          </Button>
        </Box>
      </Stack>

      {/* More Options Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem onClick={handleDownload}>
          <ListItemIcon>
            <Download fontSize="small" />
          </ListItemIcon>
          <ListItemText>Download</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleShare}>
          <ListItemIcon>
            <Share fontSize="small" />
          </ListItemIcon>
          <ListItemText>Share</ListItemText>
        </MenuItem>
      </Menu>

      {/* Speed Menu */}
      <Menu
        anchorEl={speedMenuAnchor}
        open={Boolean(speedMenuAnchor)}
        onClose={() => setSpeedMenuAnchor(null)}
      >
        {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((speed) => (
          <MenuItem
            key={speed}
            selected={speed === playbackRate}
            onClick={() => handleSpeedChange(speed)}
          >
            {speed}x
          </MenuItem>
        ))}
      </Menu>
    </Paper>
  )
}