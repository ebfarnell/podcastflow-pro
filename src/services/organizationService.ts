// Production-ready organization service with proper data isolation

export interface Organization {
  id: string
  name: string
  domain: string
  status: 'active' | 'inactive' | 'suspended'
  plan: 'starter' | 'professional' | 'enterprise'
  createdAt: string
  updatedAt: string
  settings: {
    features: string[]
    limits: {
      users: number
      campaigns: number
      storage: number
    }
  }
}

export interface OrganizationUser {
  id: string
  email: string
  name: string
  role: 'admin' | 'seller' | 'producer' | 'talent' | 'client'
  status: 'active' | 'inactive' | 'suspended'
  organizationId: string
  phone?: string
  avatar?: string
  createdAt: string
  updatedAt: string
  lastLoginAt?: string
  permissions: string[]
}

class OrganizationService {
  private organizations: Map<string, Organization> = new Map()
  private users: Map<string, OrganizationUser> = new Map()
  private usersByOrg: Map<string, Set<string>> = new Map()

  constructor() {
    this.initializeData()
  }

  private initializeData() {
    // Initialize organizations
    const orgs: Organization[] = [
      {
        id: 'org-techstart',
        name: 'TechStart Media',
        domain: 'techstart.com',
        status: 'active',
        plan: 'professional',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        settings: {
          features: ['campaigns', 'analytics', 'reporting', 'user-management'],
          limits: { users: 50, campaigns: 100, storage: 1000 }
        }
      },
      {
        id: 'org-podcastnet',
        name: 'Podcast Network Inc',
        domain: 'podcastnetwork.com',
        status: 'active',
        plan: 'enterprise',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        settings: {
          features: ['campaigns', 'analytics', 'reporting', 'user-management', 'advanced-analytics', 'api-access'],
          limits: { users: 200, campaigns: 500, storage: 5000 }
        }
      },
      {
        id: 'org-creative',
        name: 'Creative Audio Studios',
        domain: 'creativeaudio.com',
        status: 'active',
        plan: 'starter',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        settings: {
          features: ['campaigns', 'analytics', 'reporting'],
          limits: { users: 10, campaigns: 25, storage: 250 }
        }
      }
    ]

    orgs.forEach(org => {
      this.organizations.set(org.id, org)
      this.usersByOrg.set(org.id, new Set())
    })

    // Initialize users
    const users: OrganizationUser[] = [
      // TechStart Media users
      {
        id: 'admin-1',
        email: 'admin@podcastflow.pro',
        name: 'Admin User',
        role: 'admin',
        status: 'active',
        organizationId: 'org-techstart',
        phone: '+1-555-0101',
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:00:00Z',
        lastLoginAt: '2024-12-20T14:30:00Z',
        permissions: ['user:read', 'user:write', 'user:delete', 'campaign:read', 'campaign:write', 'analytics:read']
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
        updatedAt: '2024-01-20T09:00:00Z',
        lastLoginAt: '2024-12-19T16:45:00Z',
        permissions: ['campaign:read', 'campaign:write', 'client:read', 'client:write']
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
        updatedAt: '2024-02-01T11:00:00Z',
        lastLoginAt: '2024-12-20T08:15:00Z',
        permissions: ['show:read', 'show:write', 'episode:read', 'episode:write', 'campaign:read']
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
        updatedAt: '2024-02-05T13:00:00Z',
        lastLoginAt: '2024-12-18T12:00:00Z',
        permissions: ['show:read', 'episode:read', 'schedule:read']
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
        updatedAt: '2024-02-10T15:00:00Z',
        lastLoginAt: '2024-12-17T10:30:00Z',
        permissions: ['campaign:read', 'analytics:read']
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
        updatedAt: '2024-03-01T10:00:00Z',
        lastLoginAt: '2024-12-19T09:20:00Z',
        permissions: ['campaign:read', 'campaign:write', 'client:read', 'client:write']
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
        updatedAt: '2024-03-05T12:00:00Z',
        lastLoginAt: '2024-12-20T11:45:00Z',
        permissions: ['show:read', 'show:write', 'episode:read', 'episode:write']
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
        updatedAt: '2024-03-10T14:00:00Z',
        lastLoginAt: '2024-12-15T13:30:00Z',
        permissions: ['campaign:read', 'analytics:read']
      },

      // Podcast Network Inc users
      {
        id: 'user-201',
        email: 'admin@podcastnetwork.com',
        name: 'Network Admin',
        role: 'admin',
        status: 'active',
        organizationId: 'org-podcastnet',
        phone: '+1-555-0201',
        createdAt: '2024-01-10T09:00:00Z',
        updatedAt: '2024-01-10T09:00:00Z',
        lastLoginAt: '2024-12-20T15:00:00Z',
        permissions: ['user:read', 'user:write', 'user:delete', 'campaign:read', 'campaign:write', 'analytics:read']
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
        updatedAt: '2024-01-25T10:30:00Z',
        lastLoginAt: '2024-12-19T14:20:00Z',
        permissions: ['campaign:read', 'campaign:write', 'client:read', 'client:write']
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
        updatedAt: '2024-02-15T11:45:00Z',
        lastLoginAt: '2024-12-20T09:30:00Z',
        permissions: ['show:read', 'show:write', 'episode:read', 'episode:write']
      },

      // Creative Audio Studios users
      {
        id: 'user-301',
        email: 'admin@creativeaudio.com',
        name: 'Creative Admin',
        role: 'admin',
        status: 'active',
        organizationId: 'org-creative',
        phone: '+1-555-0301',
        createdAt: '2024-02-01T08:00:00Z',
        updatedAt: '2024-02-01T08:00:00Z',
        lastLoginAt: '2024-12-20T12:15:00Z',
        permissions: ['user:read', 'user:write', 'campaign:read', 'campaign:write', 'analytics:read']
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
        updatedAt: '2024-02-20T14:30:00Z',
        lastLoginAt: '2024-12-19T11:00:00Z',
        permissions: ['show:read', 'episode:read', 'schedule:read']
      }
    ]

    users.forEach(user => {
      this.users.set(user.id, user)
      this.usersByOrg.get(user.organizationId)?.add(user.id)
    })
  }

  // Organization methods
  getOrganization(orgId: string): Organization | null {
    return this.organizations.get(orgId) || null
  }

  getAllOrganizations(): Organization[] {
    return Array.from(this.organizations.values())
  }

  // User methods with organization isolation
  getUsersByOrganization(orgId: string, filters?: {
    role?: string
    status?: string
    search?: string
  }): OrganizationUser[] {
    const orgUserIds = this.usersByOrg.get(orgId) || new Set()
    let users = Array.from(orgUserIds).map(id => this.users.get(id)!).filter(Boolean)

    if (filters) {
      if (filters.role && filters.role !== 'all') {
        users = users.filter(user => user.role === filters.role)
      }
      if (filters.status && filters.status !== 'all') {
        users = users.filter(user => user.status === filters.status)
      }
      if (filters.search) {
        const search = filters.search.toLowerCase()
        users = users.filter(user => 
          user.name.toLowerCase().includes(search) ||
          user.email.toLowerCase().includes(search)
        )
      }
    }

    return users.sort((a, b) => a.name.localeCompare(b.name))
  }

  getAllUsers(): OrganizationUser[] {
    return Array.from(this.users.values()).sort((a, b) => a.name.localeCompare(b.name))
  }

  getUser(userId: string): OrganizationUser | null {
    return this.users.get(userId) || null
  }

  getUserByEmail(email: string): OrganizationUser | null {
    return Array.from(this.users.values()).find(user => user.email === email) || null
  }

  createUser(userData: Omit<OrganizationUser, 'id' | 'createdAt' | 'updatedAt'>): OrganizationUser {
    const id = `user-${Date.now()}`
    const now = new Date().toISOString()
    
    const user: OrganizationUser = {
      ...userData,
      id,
      createdAt: now,
      updatedAt: now
    }

    this.users.set(id, user)
    this.usersByOrg.get(userData.organizationId)?.add(id)

    return user
  }

  updateUser(userId: string, updates: Partial<OrganizationUser>): OrganizationUser | null {
    const user = this.users.get(userId)
    if (!user) return null

    const updatedUser = {
      ...user,
      ...updates,
      updatedAt: new Date().toISOString()
    }

    this.users.set(userId, updatedUser)
    return updatedUser
  }

  deleteUser(userId: string): boolean {
    const user = this.users.get(userId)
    if (!user) return false

    this.users.delete(userId)
    this.usersByOrg.get(user.organizationId)?.delete(userId)
    return true
  }

  // Security methods
  canAccessUser(requesterOrgId: string, targetUserId: string, requesterRole: string): boolean {
    // Master accounts can access all users
    if (requesterRole === 'master') return true

    const targetUser = this.users.get(targetUserId)
    if (!targetUser) return false

    // Users can only access users in their organization
    return targetUser.organizationId === requesterOrgId
  }

  canAccessOrganization(requesterOrgId: string, targetOrgId: string, requesterRole: string): boolean {
    // Master accounts can access all organizations
    if (requesterRole === 'master') return true

    // Users can only access their own organization
    return requesterOrgId === targetOrgId
  }

  hasPermission(userId: string, permission: string): boolean {
    const user = this.users.get(userId)
    if (!user) return false

    return user.permissions.includes(permission)
  }
}

// Singleton instance
export const organizationService = new OrganizationService()