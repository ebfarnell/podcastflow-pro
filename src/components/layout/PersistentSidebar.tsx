'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useSidebarStoreHook } from '@/hooks/useSidebarStore'

interface PersistentSidebarProps {
  children: React.ReactNode
  className?: string
}

export function PersistentSidebar({ children, className }: PersistentSidebarProps) {
  const sidebarRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const scrollPositionRef = useRef<number>(0)
  const isRestoringRef = useRef(false)
  const { scrollPosition, updateScrollPosition } = useSidebarStoreHook()

  // Save scroll position before route changes
  useEffect(() => {
    const saveScrollPosition = () => {
      if (sidebarRef.current && !isRestoringRef.current) {
        const scrollElement = sidebarRef.current.querySelector('.sidebar-scroll-list')
        if (scrollElement) {
          scrollPositionRef.current = scrollElement.scrollTop
          updateScrollPosition(scrollElement.scrollTop) // Use Zustand store instead of localStorage
        }
      }
    }

    // Save position when component unmounts or route changes
    return () => {
      saveScrollPosition()
    }
  }, [pathname])

  // Restore scroll position after route changes
  useEffect(() => {
    const restoreScrollPosition = () => {
      isRestoringRef.current = true
      const scrollPos = scrollPosition || scrollPositionRef.current

      if (scrollPos > 0 && sidebarRef.current) {
        const attemptRestore = (attempts = 0) => {
          const scrollElement = sidebarRef.current?.querySelector('.sidebar-scroll-list')
          if (scrollElement && scrollElement.scrollHeight > scrollElement.clientHeight) {
            scrollElement.scrollTop = scrollPos
            
            // Verify scroll was applied
            setTimeout(() => {
              if (scrollElement.scrollTop !== scrollPos && attempts < 10) {
                attemptRestore(attempts + 1)
              } else {
                isRestoringRef.current = false
              }
            }, 10)
          } else if (attempts < 10) {
            // Retry if element not ready
            setTimeout(() => attemptRestore(attempts + 1), 20)
          } else {
            isRestoringRef.current = false
          }
        }

        // Start restore attempts
        requestAnimationFrame(() => {
          attemptRestore()
        })
      } else {
        isRestoringRef.current = false
      }
    }

    restoreScrollPosition()
  }, [pathname])

  // Add scroll listener to continuously save position
  useEffect(() => {
    let scrollTimeout: NodeJS.Timeout
    
    const handleScroll = (e: Event) => {
      if (!isRestoringRef.current) {
        clearTimeout(scrollTimeout)
        scrollTimeout = setTimeout(() => {
          const target = e.target as HTMLElement
          scrollPositionRef.current = target.scrollTop
          localStorage.setItem('sidebarScrollPos', target.scrollTop.toString())
        }, 50)
      }
    }

    // Wait for element to be ready
    const timer = setTimeout(() => {
      if (sidebarRef.current) {
        const scrollElement = sidebarRef.current.querySelector('.sidebar-scroll-list')
        if (scrollElement) {
          scrollElement.addEventListener('scroll', handleScroll, { passive: true })
        }
      }
    }, 100)

    return () => {
      clearTimeout(timer)
      clearTimeout(scrollTimeout)
      if (sidebarRef.current) {
        const scrollElement = sidebarRef.current.querySelector('.sidebar-scroll-list')
        if (scrollElement) {
          scrollElement.removeEventListener('scroll', handleScroll)
        }
      }
    }
  }, [])

  return (
    <div ref={sidebarRef} className={className}>
      {children}
    </div>
  )
}