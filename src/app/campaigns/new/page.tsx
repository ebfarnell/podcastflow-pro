'use client'

import { useState, useEffect } from 'react'

/**
 * SSR-Compatible Wrapper for New Campaign Page
 * 
 * This component serves as a client-side wrapper that dynamically imports
 * the actual campaign creation page to avoid SSR issues.
 * 
 * Why this pattern is necessary:
 * 1. The campaign creation page uses MUI DatePicker components which access
 *    browser-only APIs during initialization
 * 2. DatePicker's popper configuration and other internal logic can't be
 *    easily wrapped with typeof window checks
 * 3. Next.js App Router's dynamic imports with ssr: false weren't sufficient
 *    for deeply nested component issues
 * 
 * How it works:
 * 1. This wrapper is marked as 'use client' to ensure client-side rendering
 * 2. The actual page content is dynamically imported inside useEffect
 * 3. This ensures all browser-dependent code only runs after hydration
 * 4. Shows a loading state while the client-side code is being loaded
 * 
 * SSR Build Impact:
 * - This page shows as ~509 B in build output (client-side only)
 * - Prevents "location is not defined" and similar SSR errors
 * - Maintains full functionality while ensuring SSR compatibility
 */
export default function NewCampaignPage() {
  // State to hold the dynamically imported page component
  const [PageContent, setPageContent] = useState<any>(null)
  
  useEffect(() => {
    // Dynamically import the full page implementation
    // This ensures all DatePicker and other browser-dependent
    // components are only loaded on the client
    import('./page-client').then(mod => {
      setPageContent(() => mod.default)
    })
  }, [])

  // Show loading state while the client component is being loaded
  if (!PageContent) {
    return (
      <div style={{ padding: '20px' }}>
        <h1>Loading Campaign Creator...</h1>
      </div>
    )
  }

  // Render the dynamically imported component
  return <PageContent />
}