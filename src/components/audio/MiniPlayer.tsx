'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Box,
  IconButton,
  Typography,
  LinearProgress,
  Paper,
  Collapse,
  Stack,
} from '@mui/material'
import {
  PlayArrow,
  Pause,
  Close,
  ExpandLess,
  ExpandMore,
} from '@mui/icons-material'
import { AudioPlayer } from './AudioPlayer'

interface MiniPlayerProps {
  src?: string
  title?: string
  subtitle?: string
  coverImage?: string
  onClose?: () => void
}

export function MiniPlayer({
  src,
  title = 'No episode selected',
  subtitle,
  coverImage,
  onClose,
}: MiniPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    if (!src) return

    const audio = audioRef.current
    if (!audio) return

    const updateProgress = () => {
      if (audio.duration) {
        setProgress((audio.currentTime / audio.duration) * 100)
      }
    }

    audio.addEventListener('timeupdate', updateProgress)
    audio.addEventListener('ended', () => setIsPlaying(false))

    return () => {
      audio.removeEventListener('timeupdate', updateProgress)
      audio.removeEventListener('ended', () => setIsPlaying(false))
    }
  }, [src])

  const togglePlayPause = () => {
    const audio = audioRef.current
    if (!audio || !src) return

    if (isPlaying) {
      audio.pause()
    } else {
      audio.play()
    }
    setIsPlaying(!isPlaying)
  }

  if (!src) return null

  return (
    <Paper
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1300,
        borderRadius: 0,
        borderTop: 1,
        borderColor: 'divider',
      }}
      elevation={8}
    >
      <audio ref={audioRef} src={src} />
      
      {/* Mini Player Bar */}
      <Box
        sx={{
          display: isExpanded ? 'none' : 'flex',
          alignItems: 'center',
          p: 1,
          gap: 2,
        }}
      >
        {coverImage && (
          <Box
            component="img"
            src={coverImage}
            alt={title}
            sx={{ width: 48, height: 48, borderRadius: 1 }}
          />
        )}

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" noWrap>{title}</Typography>
          {subtitle && (
            <Typography variant="caption" color="text.secondary" noWrap>
              {subtitle}
            </Typography>
          )}
        </Box>

        <Stack direction="row" spacing={1}>
          <IconButton onClick={togglePlayPause}>
            {isPlaying ? <Pause /> : <PlayArrow />}
          </IconButton>
          
          <IconButton onClick={() => setIsExpanded(true)}>
            <ExpandLess />
          </IconButton>

          {onClose && (
            <IconButton onClick={onClose}>
              <Close />
            </IconButton>
          )}
        </Stack>
      </Box>

      <LinearProgress 
        variant="determinate" 
        value={progress} 
        sx={{ 
          height: 2,
          display: isExpanded ? 'none' : 'block',
        }} 
      />

      {/* Expanded Player */}
      <Collapse in={isExpanded}>
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6">Now Playing</Typography>
            <Stack direction="row">
              <IconButton onClick={() => setIsExpanded(false)}>
                <ExpandMore />
              </IconButton>
              {onClose && (
                <IconButton onClick={onClose}>
                  <Close />
                </IconButton>
              )}
            </Stack>
          </Box>
          
          <AudioPlayer
            src={src}
            title={title}
            subtitle={subtitle}
            coverImage={coverImage}
            autoPlay={isPlaying}
          />
        </Box>
      </Collapse>
    </Paper>
  )
}