'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

interface AudioTrack {
  src: string
  title: string
  subtitle: string
  coverImage?: string
}

interface AudioContextType {
  currentTrack: AudioTrack | null
  isPlaying: boolean
  play: (track: AudioTrack) => void
  pause: () => void
  stop: () => void
}

const AudioContext = createContext<AudioContextType | undefined>(undefined)

export function AudioProvider({ children }: { children: ReactNode }) {
  const [currentTrack, setCurrentTrack] = useState<AudioTrack | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  const play = (track: AudioTrack) => {
    setCurrentTrack(track)
    setIsPlaying(true)
  }

  const pause = () => {
    setIsPlaying(false)
  }

  const stop = () => {
    setCurrentTrack(null)
    setIsPlaying(false)
  }

  return (
    <AudioContext.Provider value={{ currentTrack, isPlaying, play, pause, stop }}>
      {children}
    </AudioContext.Provider>
  )
}

export function useAudio() {
  const context = useContext(AudioContext)
  if (context === undefined) {
    throw new Error('useAudio must be used within an AudioProvider')
  }
  return context
}