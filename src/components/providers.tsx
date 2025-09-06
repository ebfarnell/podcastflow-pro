'use client'

import { ReactNode, useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Provider as ReduxProvider } from 'react-redux'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { store } from '@/store'
import { theme } from '@/lib/theme'
import { AudioProvider } from '@/contexts/AudioContext'
import { OrganizationProvider } from '@/contexts/OrganizationContext'
import { AuthProvider } from '@/contexts/AuthContext'
import { setupChunkErrorHandler } from '@/utils/chunkErrorHandler'
import { queryClient } from '@/config/queryClient'
import { APILogger } from './providers/APILogger'

interface ProvidersProps {
  children: ReactNode
}

export function Providers({ children }: ProvidersProps) {
  useEffect(() => {
    // Set up chunk error handling
    setupChunkErrorHandler()
    
    // Global handler to select all text in number inputs on focus
    const handleFocus = (event: FocusEvent) => {
      const target = event.target as HTMLInputElement
      
      // Check if it's an input element with type number or has numeric value
      if (target.tagName === 'INPUT' && 
          (target.type === 'number' || 
           target.type === 'tel' ||
           (target.type === 'text' && target.inputMode === 'numeric') ||
           (target.type === 'text' && /^[\d\.\,\-]+$/.test(target.value)))) {
        // Small delay to ensure the cursor is placed
        setTimeout(() => {
          target.select()
        }, 0)
      }
    }
    
    // Add event listener for focusin (bubbles, unlike focus)
    document.addEventListener('focusin', handleFocus)
    
    // Cleanup
    return () => {
      document.removeEventListener('focusin', handleFocus)
    }
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <ReduxProvider store={store}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <APILogger />
          <AuthProvider>
            <OrganizationProvider>
              <AudioProvider>
                {children}
              </AudioProvider>
            </OrganizationProvider>
          </AuthProvider>
        </ThemeProvider>
      </ReduxProvider>
    </QueryClientProvider>
  )
}