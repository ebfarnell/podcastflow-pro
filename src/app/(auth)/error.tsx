'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/Button'

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Auth error:', error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="text-center">
        <h2 className="mb-4 text-2xl font-bold">Authentication Error</h2>
        <p className="mb-6 text-gray-600 dark:text-gray-400">
          There was an issue with authentication. Please try logging in again.
        </p>
        <div className="space-x-4">
          <Button onClick={reset}>Try again</Button>
          <Button
            variant="outline"
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.location.href = '/login'
              }
            }}
          >
            Go to Login
          </Button>
        </div>
      </div>
    </div>
  )
}