'use client'

import { ReactNode, useEffect, useState } from 'react'

interface ClientOnlyWrapperProps {
  children: ReactNode
  fallback?: ReactNode
}

/**
 * Wrapper component that ensures children are only rendered on the client side.
 * This prevents SSR issues with components that access browser APIs.
 * 
 * @param children - Components to render only on client side
 * @param fallback - Optional loading state to show during SSR/hydration
 */
export function ClientOnlyWrapper({ children, fallback }: ClientOnlyWrapperProps) {
  const [hasMounted, setHasMounted] = useState(false)

  useEffect(() => {
    setHasMounted(true)
  }, [])

  if (!hasMounted) {
    return <>{fallback || null}</>
  }

  return <>{children}</>
}