'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AnalyticsDetailedRedirect() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to the new Performance Analytics Center which now includes detailed analytics
    router.replace('/analytics')
  }, [router])

  return null
}