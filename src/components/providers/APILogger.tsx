'use client'

import { useEffect } from 'react'
import { setupAPILogger } from '@/utils/api-logger'

export function APILogger() {
  useEffect(() => {
    // Enable API logging
    console.log('🔍 API Logger enabled - All fetch calls will be logged to console')
    console.log('To disable API logging, add ?debug=false to the URL')
    
    // Check if explicitly disabled
    if (window.location.search.includes('debug=false')) {
      console.log('API Logger disabled via URL parameter')
      return
    }
    
    setupAPILogger()
  }, [])

  return null
}