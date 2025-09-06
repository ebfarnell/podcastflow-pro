'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/Button'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="text-center">
        <h2 className="mb-4 text-2xl font-bold">Something went wrong!</h2>
        <p className="mb-6 text-gray-600 dark:text-gray-400">
          An error occurred while loading this page.
        </p>
        <Button
          onClick={reset}
          className="mr-4"
        >
          Try again
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            if (typeof window !== 'undefined') {
              window.location.href = '/dashboard'
            }
          }}
        >
          Go to Dashboard
        </Button>
      </div>
    </div>
  )
}