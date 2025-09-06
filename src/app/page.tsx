'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { LoadingScreen } from '@/components/ui/LoadingScreen'

export default function HomePage() {
  const router = useRouter()
  const { isAuthenticated, isLoading, user } = useAuth()

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated && user) {
        // Redirect based on user role
        switch (user.role) {
          case 'master':
            router.push('/master')
            break
          case 'admin':
            router.push('/dashboard')
            break
          case 'sales':
            router.push('/seller')
            break
          case 'producer':
            router.push('/producer')
            break
          case 'talent':
            router.push('/talent')
            break
          case 'client':
            router.push('/client')
            break
          default:
            router.push('/dashboard')
        }
      } else if (!isAuthenticated) {
        router.push('/login')
      }
    }
  }, [isAuthenticated, isLoading, user, router])

  return <LoadingScreen />
}