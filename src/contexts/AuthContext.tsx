'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
// Removed AWS Amplify - using custom auth
import { User, UserRole, hasPermission, hasAnyPermission, hasAllPermissions } from '@/types/auth'
import { api } from '@/services/api'
import { initializeApiContext } from '@/services/apiService'
import { useQueryClient } from '@tanstack/react-query'
import { warmUpCache } from '@/utils/prefetch'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  sessionTimeRemaining: number | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
  extendSession: () => void
  hasPermission: (permission: string) => boolean
  hasAnyPermission: (permissions: string[]) => boolean
  hasAllPermissions: (permissions: string[]) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [sessionTimeRemaining, setSessionTimeRemaining] = useState<number | null>(null)
  const router = useRouter()
  const queryClient = useQueryClient()

  useEffect(() => {
    // SSR Fix: Guard window.location access to prevent "location is not defined" errors
    // Skip auth check on login and invitation pages to prevent loops
    if (typeof window !== 'undefined' && 
        (window.location.pathname === '/login' || 
         window.location.pathname === '/signup' ||
         window.location.pathname === '/accept-invitation' ||
         window.location.pathname === '/reset-password')) {
      setIsLoading(false)
      return
    }
    
    // Check for debug flag to prevent auth redirects
    if (typeof window !== 'undefined' && (window as any).DISABLE_AUTH_REDIRECT) {
      console.error('🛑 AuthContext: Auth check disabled for debugging')
      setIsLoading(false)
      // Set a minimal user to prevent null errors
      setUser({
        id: 'debug-user',
        email: 'debug@podcastflow.pro',
        name: 'Debug User',
        role: 'admin',
        organizationId: 'org_podcastflow_pro',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } as any)
      return
    }
    
    checkAuth()
  }, [])

  // Update session time remaining every minute
  useEffect(() => {
    if (!user) return

    const updateSessionTime = () => {
      const sessionData = localStorage.getItem('authSession')
      if (sessionData) {
        const session = JSON.parse(sessionData)
        const now = Date.now()
        const remaining = session.expiresAt - now
        
        if (remaining <= 0) {
          // Session expired
          console.log('🔓 Session expired during use')
          logout()
        } else {
          setSessionTimeRemaining(remaining)
        }
      }
    }

    updateSessionTime() // Initial check
    const interval = setInterval(updateSessionTime, 60000) // Check every minute

    return () => clearInterval(interval)
  }, [user])

  const checkAuth = async () => {
    console.log('🔑 AuthContext - checkAuth starting at', new Date().toISOString())
    console.log('🔑 AuthContext - Current pathname:', typeof window !== 'undefined' ? window.location.pathname : 'SSR')
    
    try {
      setIsLoading(true)
      
      // First check for impersonation data in sessionStorage
      const impersonationData = sessionStorage.getItem('impersonation')
      if (impersonationData) {
        try {
          const impersonation = JSON.parse(impersonationData)
          if (impersonation.isImpersonating && impersonation.impersonatingUser) {
            console.log('🔑 AuthContext - Using impersonation user:', impersonation.impersonatingUser.email)
            setUser(impersonation.impersonatingUser)
            initializeApiContext(impersonation.impersonatingUser)
            setIsLoading(false)
            return
          }
        } catch (error) {
          console.log('🔑 AuthContext - Impersonation data parse error:', error)
          // Continue with normal auth flow
        }
      }
      
      // Check the cookie-based auth via API
      try {
        console.log('🔑 AuthContext - Checking cookie auth via /api/auth/check')
        const response = await api.get('/auth/check')
        console.log('🔑 AuthContext - Cookie auth response:', response)
        if (response.authenticated && response.user) {
          console.log('🔑 AuthContext - User authenticated via cookie:', response.user.email)
          setUser(response.user)
          initializeApiContext(response.user)
          setIsLoading(false)
          return
        }
      } catch (error) {
        console.log('🔑 AuthContext - Cookie auth failed, trying localStorage:', error)
        // Cookie auth failed, try localStorage
      }
      
      // Check for authenticated user in localStorage as fallback
      const authUserData = localStorage.getItem('authUser')
      const authToken = localStorage.getItem('authToken')
      const sessionData = localStorage.getItem('authSession')
      
      if (authUserData && authToken && sessionData) {
        const user = JSON.parse(authUserData)
        const session = JSON.parse(sessionData)
        
        // Check if session has expired
        const now = Date.now()
        
        if (now < session.expiresAt) {
          // Session is still valid
          setUser(user)
          // Re-initialize API context
          initializeApiContext(user)
          // Token will be added by API interceptor from localStorage
          setIsLoading(false)
          return
        } else {
          // Session expired, clear storage
          localStorage.removeItem('authUser')
          localStorage.removeItem('authToken')
          localStorage.removeItem('authSession')
        }
      }
      
      // No Cognito fallback - we only use our custom auth
    } catch (error) {
      // Silently handle authentication errors - this is expected on initial load
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchUserProfile = async (userId: string): Promise<User> => {
    try {
      const data = await api.get(`/users/${userId}`)
      // Handle both direct response and response.data patterns
      const response = data.data || data
      return {
        id: response.id || userId,
        email: response.email,
        name: response.name,
        role: response.role || 'client',
        organizationId: response.organizationId,
        avatar: response.avatar,
        phone: response.phone,
        status: response.status || 'active',
        createdAt: response.createdAt,
        updatedAt: response.updatedAt,
        lastLoginAt: response.lastLoginAt,
        metadata: response.metadata,
      }
    } catch (error) {
      console.error('Failed to fetch user profile:', error)
      // Re-throw the error - no Cognito fallback
      throw error
    }
  }

  const login = async (email: string, password: string) => {
    try {
      // Call the real authentication API
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Login failed')
      }

      const data = await response.json()
      const userProfile = data.user

      // Set user in state
      setUser(userProfile)
      
      // Initialize API context for organization-aware API calls
      initializeApiContext(userProfile)
      
      // Store in localStorage for persistence with session tracking
      localStorage.setItem('authUser', JSON.stringify(userProfile))
      localStorage.setItem('authToken', data.token)
      localStorage.setItem('authSession', JSON.stringify({
        loginTime: Date.now(),
        expiresAt: Date.now() + (8 * 60 * 60 * 1000) // 8 hours from now
      }))
      
      // Token will be added by API interceptor from localStorage
      
      // Warm up the cache with common data
      warmUpCache(queryClient, userProfile.role)
      
      // Redirect based on role
      redirectByRole(userProfile.role as UserRole)
    } catch (error) {
      console.error('Login failed:', error)
      throw error
    }
  }

  const logout = async () => {
    try {
      // Call logout API to clear the auth cookie
      try {
        await api.post('/auth/logout')
      } catch (apiError) {
        console.error('API logout error:', apiError)
      }
      
      // Clear auth data from localStorage
      localStorage.removeItem('authUser')
      localStorage.removeItem('authToken')
      localStorage.removeItem('authSession')
      
      // Clear sidebar state on logout
      localStorage.removeItem('podcastflow-sidebar-state')
      localStorage.removeItem('sidebarScrollPos')
      
      // API interceptor will handle missing token from localStorage
      
      // No Cognito logout - we only use our custom auth
      
      setUser(null)
      router.push('/login')
    } catch (error) {
      console.error('Logout failed:', error)
      throw error
    }
  }

  const refreshUser = async () => {
    if (user) {
      const updatedProfile = await fetchUserProfile(user.id)
      setUser(updatedProfile)
    }
  }

  const extendSession = () => {
    if (user) {
      // Extend session by another 8 hours
      const newExpiryTime = Date.now() + (8 * 60 * 60 * 1000)
      localStorage.setItem('authSession', JSON.stringify({
        loginTime: Date.now(),
        expiresAt: newExpiryTime
      }))
      setSessionTimeRemaining(newExpiryTime - Date.now())
    }
  }

  const getOrganizationIdForTestAccount = (email: string): string => {
    // Assign test accounts to default organization
    if (email.includes('@podcastflow.pro')) {
      return 'org-techstart'
    }
    // Could add other mappings here for different test domains
    return 'org-techstart'
  }

  const redirectByRole = (role: UserRole) => {
    switch (role) {
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
  }

  const checkPermission = (permission: string): boolean => {
    if (!user) return false
    return hasPermission(user.role, permission)
  }

  const checkAnyPermission = (permissions: string[]): boolean => {
    if (!user) return false
    return hasAnyPermission(user.role, permissions)
  }

  const checkAllPermissions = (permissions: string[]): boolean => {
    if (!user) return false
    return hasAllPermissions(user.role, permissions)
  }

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    sessionTimeRemaining,
    login,
    logout,
    refreshUser,
    extendSession,
    hasPermission: checkPermission,
    hasAnyPermission: checkAnyPermission,
    hasAllPermissions: checkAllPermissions,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Higher-order component for protecting routes
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  requiredPermissions?: string[]
) {
  return function AuthenticatedComponent(props: P) {
    const { user, isLoading, hasAllPermissions } = useAuth()
    const router = useRouter()

    useEffect(() => {
      // Check for debug flag first
      if (typeof window !== 'undefined' && (window as any).DISABLE_AUTH_REDIRECT) {
        console.error('🛑 withAuth: Redirect disabled for debugging')
        return
      }
      
      if (!isLoading && !user) {
        // Check if we're on a page that shouldn't redirect
        // Guard all window.location access for SSR compatibility
        if (typeof window !== 'undefined') {
          const pathname = window.location.pathname
          if (pathname === '/master/impersonate' || pathname === '/master/impersonate-standalone' || pathname === '/login') {
            return
          }
          // Only redirect to login when we're in the browser
          router.push('/login')
        }
      } else if (!isLoading && requiredPermissions && !hasAllPermissions(requiredPermissions)) {
        // router.push('/unauthorized')
      }
    }, [isLoading, user, hasAllPermissions, router])

    if (isLoading) {
      return <div>Loading...</div>
    }

    if (!user) {
      return null
    }

    if (requiredPermissions && !hasAllPermissions(requiredPermissions)) {
      return null
    }

    return <Component {...props} />
  }
}