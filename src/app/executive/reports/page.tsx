'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ExecutiveReportsRedirect() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to the new Financial Management Hub which now includes Executive Reports functionality
    router.replace('/financials')
  }, [router])

  return null
}