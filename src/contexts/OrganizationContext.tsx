'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { useAuth } from './AuthContext'

export interface Organization {
  id: string
  name: string
  domain: string
  settings?: {
    features: string[]
    limits: {
      users: number
      campaigns: number
      storage: number
    }
  }
}

interface OrganizationContextType {
  currentOrganization: Organization | null
  organizations: Organization[]
  isLoading: boolean
  setCurrentOrganization: (org: Organization) => void
  canAccessResource: (resourceOrgId: string) => boolean
  isMasterAccount: () => boolean
  getOrganizationUsers: () => Promise<any[]>
  getOrganizationData: <T>(endpoint: string, params?: any) => Promise<T>
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined)

// Default organizations for the system
const defaultOrganizations: Organization[] = [
  {
    id: 'org-techstart',
    name: 'TechStart Media',
    domain: 'techstart.com',
    settings: {
      features: ['campaigns', 'analytics', 'reporting'],
      limits: { users: 50, campaigns: 100, storage: 1000 }
    }
  },
  {
    id: 'org-podcastnet',
    name: 'Podcast Network Inc',
    domain: 'podcastnetwork.com',
    settings: {
      features: ['campaigns', 'analytics', 'reporting', 'advanced-analytics'],
      limits: { users: 100, campaigns: 200, storage: 2000 }
    }
  },
  {
    id: 'org-creative',
    name: 'Creative Audio Studios',
    domain: 'creativeaudio.com',
    settings: {
      features: ['campaigns', 'analytics'],
      limits: { users: 25, campaigns: 50, storage: 500 }
    }
  }
]

// Organization-specific user data
const organizationUsers = {
  'org-techstart': [
    {
      id: 'admin-1',
      email: 'admin@podcastflow.pro',
      name: 'Admin User',
      role: 'admin',
      status: 'active',
      organizationId: 'org-techstart',
      phone: '+1-555-0101',
      createdAt: '2024-01-15T10:00:00Z',
      lastLoginAt: '2024-12-20T14:30:00Z'
    },
    {
      id: 'seller-1',
      email: 'seller@podcastflow.pro',
      name: 'Sales Representative',
      role: 'seller',
      status: 'active',
      organizationId: 'org-techstart',
      phone: '+1-555-0102',
      createdAt: '2024-01-20T09:00:00Z',
      lastLoginAt: '2024-12-19T16:45:00Z'
    },
    {
      id: 'producer-1',
      email: 'producer@podcastflow.pro',
      name: 'Show Producer',
      role: 'producer',
      status: 'active',
      organizationId: 'org-techstart',
      phone: '+1-555-0103',
      createdAt: '2024-02-01T11:00:00Z',
      lastLoginAt: '2024-12-20T08:15:00Z'
    },
    {
      id: 'talent-1',
      email: 'talent@podcastflow.pro',
      name: 'Podcast Host',
      role: 'talent',
      status: 'active',
      organizationId: 'org-techstart',
      phone: '+1-555-0104',
      createdAt: '2024-02-05T13:00:00Z',
      lastLoginAt: '2024-12-18T12:00:00Z'
    },
    {
      id: 'client-1',
      email: 'client@podcastflow.pro',
      name: 'Client User',
      role: 'client',
      status: 'active',
      organizationId: 'org-techstart',
      phone: '+1-555-0105',
      createdAt: '2024-02-10T15:00:00Z',
      lastLoginAt: '2024-12-17T10:30:00Z'
    },
    {
      id: 'user-101',
      email: 'sarah.johnson@techstart.com',
      name: 'Sarah Johnson',
      role: 'seller',
      status: 'active',
      organizationId: 'org-techstart',
      phone: '+1-555-0106',
      createdAt: '2024-03-01T10:00:00Z',
      lastLoginAt: '2024-12-19T09:20:00Z'
    },
    {
      id: 'user-102',
      email: 'mike.wilson@techstart.com',
      name: 'Mike Wilson',
      role: 'producer',
      status: 'active',
      organizationId: 'org-techstart',
      phone: '+1-555-0107',
      createdAt: '2024-03-05T12:00:00Z',
      lastLoginAt: '2024-12-20T11:45:00Z'
    },
    {
      id: 'user-103',
      email: 'anna.davis@techstart.com',
      name: 'Anna Davis',
      role: 'client',
      status: 'inactive',
      organizationId: 'org-techstart',
      phone: '+1-555-0108',
      createdAt: '2024-03-10T14:00:00Z',
      lastLoginAt: '2024-12-15T13:30:00Z'
    }
  ],
  'org-podcastnet': [
    {
      id: 'user-201',
      email: 'admin@podcastnetwork.com',
      name: 'Network Admin',
      role: 'admin',
      status: 'active',
      organizationId: 'org-podcastnet',
      phone: '+1-555-0201',
      createdAt: '2024-01-10T09:00:00Z',
      lastLoginAt: '2024-12-20T15:00:00Z'
    },
    {
      id: 'user-202',
      email: 'sales@podcastnetwork.com',
      name: 'Network Sales',
      role: 'seller',
      status: 'active',
      organizationId: 'org-podcastnet',
      phone: '+1-555-0202',
      createdAt: '2024-01-25T10:30:00Z',
      lastLoginAt: '2024-12-19T14:20:00Z'
    },
    {
      id: 'user-203',
      email: 'producer@podcastnetwork.com',
      name: 'Network Producer',
      role: 'producer',
      status: 'active',
      organizationId: 'org-podcastnet',
      phone: '+1-555-0203',
      createdAt: '2024-02-15T11:45:00Z',
      lastLoginAt: '2024-12-20T09:30:00Z'
    }
  ],
  'org-creative': [
    {
      id: 'user-301',
      email: 'admin@creativeaudio.com',
      name: 'Creative Admin',
      role: 'admin',
      status: 'active',
      organizationId: 'org-creative',
      phone: '+1-555-0301',
      createdAt: '2024-02-01T08:00:00Z',
      lastLoginAt: '2024-12-20T12:15:00Z'
    },
    {
      id: 'user-302',
      email: 'talent@creativeaudio.com',
      name: 'Creative Talent',
      role: 'talent',
      status: 'active',
      organizationId: 'org-creative',
      phone: '+1-555-0302',
      createdAt: '2024-02-20T14:30:00Z',
      lastLoginAt: '2024-12-19T11:00:00Z'
    }
  ]
}

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null)
  const [organizations, setOrganizations] = useState<Organization[]>(defaultOrganizations)
  const [isLoading, setIsLoading] = useState(true)
  const [hasFetchedOrg, setHasFetchedOrg] = useState(false)

  // Reset fetch flag when user changes
  useEffect(() => {
    if (!user) {
      setHasFetchedOrg(false)
      setCurrentOrganization(null)
      setIsLoading(false)
    }
  }, [user])

  useEffect(() => {
    const loadOrganizations = async () => {
      // Prevent duplicate fetches
      if (!user || hasFetchedOrg) {
        setIsLoading(false)
        return
      }

      setHasFetchedOrg(true)
      
      try {
        // For impersonated users, use their organizationId directly from the session
        const impersonationData = sessionStorage.getItem('impersonation')
        let targetOrgId = user.organizationId
        
        if (impersonationData) {
          const impersonation = JSON.parse(impersonationData)
          if (impersonation.organizationId) {
            targetOrgId = impersonation.organizationId
          }
        }

        // If user has an organizationId, fetch the real organization data
        if (targetOrgId) {
          // Use the proper base URL for API calls
          const baseUrl = typeof window !== 'undefined' 
            ? window.location.origin 
            : process.env.NEXT_PUBLIC_APP_URL || 'https://app.podcastflow.pro'
          const response = await fetch(`${baseUrl}/api/organizations/${targetOrgId}`, {
            credentials: 'include'
          })
          if (response.ok) {
            const orgData = await response.json()
            const realOrg: Organization = {
              id: orgData.id,
              name: orgData.name,
              domain: orgData.domain || '',
              settings: {
                features: ['campaigns', 'analytics', 'reporting', 'advanced-analytics'], // All features for real orgs
                limits: { users: 1000, campaigns: 1000, storage: 10000 }
              }
            }
            setCurrentOrganization(realOrg)
            setOrganizations([realOrg, ...defaultOrganizations])
          } else {
            // Fallback to default organization logic
            const userOrgId = getDefaultOrganizationForUser(user)
            const org = defaultOrganizations.find(o => o.id === userOrgId)
            if (org) {
              setCurrentOrganization(org)
            }
          }
        } else {
          // Set organization based on user email domain for test accounts
          const userOrgId = getDefaultOrganizationForUser(user)
          const org = defaultOrganizations.find(o => o.id === userOrgId)
          if (org) {
            setCurrentOrganization(org)
          }
        }
      } catch (error) {
        console.error('Failed to load organization data:', error)
        // Fallback to default organization logic
        const userOrgId = user.organizationId || getDefaultOrganizationForUser(user)
        const org = defaultOrganizations.find(o => o.id === userOrgId)
        if (org) {
          setCurrentOrganization(org)
        }
      } finally {
        setIsLoading(false)
      }
    }

    loadOrganizations()
  }, [user, hasFetchedOrg])

  const getDefaultOrganizationForUser = (user: any): string => {
    // For test accounts, assign to default organization
    if (user.email?.includes('@podcastflow.pro')) {
      return 'org-techstart'
    }
    // For other accounts, try to determine org from email domain
    if (user.email?.includes('@podcastnetwork.com')) return 'org-podcastnet'
    if (user.email?.includes('@creativeaudio.com')) return 'org-creative'
    
    // Default fallback
    return 'org-techstart'
  }

  const canAccessResource = (resourceOrgId: string): boolean => {
    // Master accounts can access everything
    if (user?.role === 'master') {
      return true
    }
    
    // Regular users can only access their organization's resources
    return currentOrganization?.id === resourceOrgId
  }

  const isMasterAccount = (): boolean => {
    return user?.role === 'master'
  }

  const getOrganizationUsers = async (): Promise<any[]> => {
    // Master account gets all users across all organizations
    if (isMasterAccount()) {
      const allUsers = Object.values(organizationUsers).flat()
      return allUsers.map(user => ({
        ...user,
        organizationName: organizations.find(org => org.id === user.organizationId)?.name
      }))
    }
    
    // Regular accounts get only their organization's users
    if (!currentOrganization) return []
    
    return organizationUsers[currentOrganization.id as keyof typeof organizationUsers] || []
  }

  const getOrganizationData = async <T,>(endpoint: string, params?: any): Promise<T> => {
    // This would normally make an API call with organization context
    // For now, we'll simulate organization-filtered data
    
    const orgId = currentOrganization?.id || 'org-techstart'
    
    // Add organization context to all API calls
    const enrichedParams = {
      ...params,
      organizationId: orgId,
      isMaster: isMasterAccount()
    }
    
    // Simulate API response based on organization
    if (endpoint === '/users') {
      const users = await getOrganizationUsers()
      return { users, total: users.length } as T
    }
    
    // For other endpoints, return empty data for now
    return { data: [], total: 0 } as T
  }

  const value: OrganizationContextType = {
    currentOrganization,
    organizations,
    isLoading,
    setCurrentOrganization,
    canAccessResource,
    isMasterAccount,
    getOrganizationUsers,
    getOrganizationData
  }

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  )
}

export function useOrganization() {
  const context = useContext(OrganizationContext)
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider')
  }
  return context
}