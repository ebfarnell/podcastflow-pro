'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function FilesRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to settings page with file manager tab
    router.replace('/settings?tab=files')
  }, [router])

  return null
}