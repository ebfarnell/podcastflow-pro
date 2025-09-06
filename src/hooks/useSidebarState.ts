'use client'

import { useState, useEffect, useCallback } from 'react'

interface SidebarState {
  expandedSections: { [key: string]: boolean }
  scrollPosition: number
}

const SIDEBAR_STATE_KEY = 'podcastflow-sidebar-state'

export function useSidebarState() {
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({})
  const [scrollPosition, setScrollPosition] = useState(0)
  const [isInitialized, setIsInitialized] = useState(false)

  // Load state from localStorage on mount
  useEffect(() => {
    // Load current state from localStorage
    const savedState = localStorage.getItem(SIDEBAR_STATE_KEY)
    if (savedState) {
      try {
        const parsed: SidebarState = JSON.parse(savedState)
        setExpandedSections(parsed.expandedSections || {})
        setScrollPosition(parsed.scrollPosition || 0)
      } catch (e) {
        console.error('Failed to parse sidebar state:', e)
      }
    }
    setIsInitialized(true)
  }, [])

  // Save state to localStorage whenever it changes
  useEffect(() => {
    if (isInitialized) {
      const state: SidebarState = {
        expandedSections,
        scrollPosition
      }
      localStorage.setItem(SIDEBAR_STATE_KEY, JSON.stringify(state))
    }
  }, [expandedSections, scrollPosition, isInitialized])

  const toggleSection = useCallback((sectionKey: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }))
  }, [])

  const updateScrollPosition = useCallback((position: number) => {
    setScrollPosition(position)
  }, [])

  const isSectionExpanded = useCallback((sectionKey: string, defaultExpanded: boolean = true) => {
    // Check if explicitly set in expandedSections
    if (sectionKey in expandedSections) {
      return expandedSections[sectionKey]
    }
    // Default to expanded for most sections, collapsed for specific ones
    if (sectionKey === 'Presale' || sectionKey === 'Postsale') {
      return false
    }
    return defaultExpanded
  }, [expandedSections])

  return {
    expandedSections,
    scrollPosition,
    toggleSection,
    updateScrollPosition,
    isSectionExpanded,
    isInitialized,
    setExpandedSections
  }
}