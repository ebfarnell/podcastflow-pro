/**
 * Handles chunk loading errors by forcing a page reload
 * This helps when users have cached old chunk references
 */

const CHUNK_LOAD_ERROR_REGEX = /Loading chunk \d+ failed/
const CHUNK_FAILED_ERROR_REGEX = /ChunkLoadError/

export function setupChunkErrorHandler() {
  if (typeof window === 'undefined') return

  // Track if we've already reloaded to prevent infinite loops
  const hasReloaded = sessionStorage.getItem('chunk-error-reload')
  
  window.addEventListener('error', (event) => {
    const error = event.error || event.message || ''
    const errorString = error.toString()
    
    // Check if this is a chunk loading error
    if (
      CHUNK_LOAD_ERROR_REGEX.test(errorString) ||
      CHUNK_FAILED_ERROR_REGEX.test(errorString) ||
      errorString.includes('Failed to fetch dynamically imported module')
    ) {
      console.warn('Chunk loading error detected:', errorString)
      
      // Only reload once per session to prevent loops
      if (!hasReloaded) {
        sessionStorage.setItem('chunk-error-reload', 'true')
        console.log('Reloading page to fetch latest chunks...')
        
        // Clear any service worker caches if they exist
        if ('caches' in window) {
          caches.keys().then(names => {
            names.forEach(name => caches.delete(name))
          })
        }
        
        // Force a hard reload
        window.location.reload()
      } else {
        console.error('Chunk loading error persists after reload. Please clear your browser cache.')
        
        // Show user-friendly error message
        const message = document.createElement('div')
        message.style.cssText = `
          position: fixed;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          background: #f44336;
          color: white;
          padding: 16px 24px;
          border-radius: 4px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.2);
          z-index: 9999;
          font-family: sans-serif;
        `
        message.innerHTML = `
          <strong>Loading Error</strong><br>
          Please clear your browser cache and refresh the page.<br>
          <small>Press Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)</small>
        `
        document.body.appendChild(message)
        
        // Remove message after 10 seconds
        setTimeout(() => message.remove(), 10000)
      }
    }
  })
  
  // Also handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason?.toString() || ''
    
    if (
      error.includes('Failed to fetch dynamically imported module') ||
      error.includes('ChunkLoadError')
    ) {
      console.warn('Chunk loading error in promise:', error)
      
      if (!hasReloaded) {
        sessionStorage.setItem('chunk-error-reload', 'true')
        window.location.reload()
      }
    }
  })
}

// Clear the reload flag on successful page load
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    // Clear the flag after a successful load
    setTimeout(() => {
      sessionStorage.removeItem('chunk-error-reload')
    }, 1000)
  })
}