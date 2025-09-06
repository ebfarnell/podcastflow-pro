import axios, { AxiosInstance } from 'axios'
// Removed AWS Amplify - using custom auth

// Mock data for development
const mockCampaigns = [
  {
    id: '1',
    name: 'Summer Podcast Campaign 2024',
    client: 'Tech Innovators Inc',
    status: 'active',
    startDate: '2024-06-01',
    endDate: '2024-08-31',
    budget: 50000,
    spent: 32500,
    impressions: 1250000,
    clicks: 35000,
    conversions: 1200,
    createdAt: '2024-05-15T10:00:00Z',
    updatedAt: '2024-07-01T14:30:00Z',
  },
  {
    id: '2',
    name: 'Holiday Special Promotion',
    client: 'Retail Giants Co',
    status: 'paused',
    startDate: '2024-11-15',
    endDate: '2024-12-31',
    budget: 75000,
    spent: 12000,
    impressions: 450000,
    clicks: 12000,
    conversions: 450,
    createdAt: '2024-10-01T09:00:00Z',
    updatedAt: '2024-11-20T16:45:00Z',
  },
  {
    id: '3',
    name: 'Q1 Brand Awareness Drive',
    client: 'Startup Ventures LLC',
    status: 'draft',
    startDate: '2025-01-01',
    endDate: '2025-03-31',
    budget: 25000,
    spent: 0,
    impressions: 0,
    clicks: 0,
    conversions: 0,
    createdAt: '2024-12-15T11:00:00Z',
    updatedAt: '2024-12-15T11:00:00Z',
  },
]

// Use the relative path for production
const API_BASE_URL = process.env.NEXT_PUBLIC_API_ENDPOINT || '/api'

class ApiService {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Request interceptor for auth
    this.client.interceptors.request.use(
      async (config) => {
        try {
          // Check for authentication token in localStorage
          if (typeof window !== 'undefined') {
            const authToken = localStorage.getItem('authToken')
            if (authToken) {
              config.headers.Authorization = `Bearer ${authToken}`
            }
          }
        } catch (error) {
          // No auth session available, continue without auth header
        }
        return config
      },
      (error) => {
        return Promise.reject(error)
      }
    )

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // Unauthorized - redirect to login
          if (typeof window !== 'undefined') {
            window.location.href = '/login'
          }
        }
        return Promise.reject(error)
      }
    )
  }

  async request<T = any>(config: any): Promise<T> {
    const response = await this.client.request(config)
    return response.data
  }

  async get<T = any>(url: string, config?: any): Promise<T> {
    const response = await this.client.get(url, config)
    return response.data
  }

  async post<T = any>(url: string, data?: any, config?: any): Promise<T> {
    const response = await this.client.post(url, data, config)
    return response.data
  }

  async put<T = any>(url: string, data?: any, config?: any): Promise<T> {
    const response = await this.client.put(url, data, config)
    return response.data
  }

  async delete<T = any>(url: string, config?: any): Promise<T> {
    const response = await this.client.delete(url, config)
    return response.data
  }
}

// Create a singleton instance
export const api = new ApiService()

// Campaign Service
export const campaignService = {
  async list(params?: any) {
    try {
      const response = await api.get('/campaigns', { params })
      const campaigns = response.Items?.map((item: any) => ({
        id: item.id,
        name: item.name,
        client: item.client,
        agency: item.agency,
        description: item.description,
        status: item.status,
        startDate: item.startDate,
        endDate: item.endDate,
        budget: item.budget || 0,
        spent: item.spent || 0,
        impressions: item.impressions || 0,
        targetImpressions: item.targetImpressions || item.impressions || 0,
        clicks: item.clicks || 0,
        conversions: item.conversions || 0,
        industry: item.industry,
        targetAudience: item.targetAudience,
        accountTeam: item.accountTeam || [],
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })) || []
      
      return {
        campaigns,
        count: response.Count || campaigns.length,
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error)
      // Return mock data as fallback
      return {
        campaigns: mockCampaigns,
        count: mockCampaigns.length,
      }
    }
  },

  async getAll(params?: any) {
    try {
      const result = await this.list(params)
      return { data: { campaigns: result.campaigns } }
    } catch (error) {
      return { data: { campaigns: [] }, error }
    }
  },

  async get(id: string) {
    try {
      const response = await api.get(`/campaigns/${id}`)
      
      console.log('🔍 REAL API: Raw response from GET /campaigns/' + id, response)
      
      const campaign = {
        id: response.id,
        name: response.name,
        client: response.client,
        agency: response.agency,
        description: response.description,
        status: response.status,
        startDate: response.startDate,
        endDate: response.endDate,
        budget: response.budget || 0,
        spent: response.spent || 0,
        impressions: response.impressions || 0,
        targetImpressions: response.targetImpressions || response.impressions || 0,
        clicks: response.clicks || 0,
        conversions: response.conversions || 0,
        industry: response.industry,
        targetAudience: response.targetAudience,
        accountTeam: response.accountTeam || [],
        createdAt: response.createdAt,
        updatedAt: response.updatedAt,
      }
      
      console.log('🔍 REAL API: Mapped campaign data:', campaign)
      
      return campaign
    } catch (error) {
      console.error('Error fetching campaign:', error)
      return mockCampaigns.find(c => c.id === id) || null
    }
  },

  async create(campaignData: any) {
    try {
      console.log('Creating campaign with data:', campaignData)
      const response = await api.post('/campaigns', campaignData)
      console.log('Campaign creation response:', response)
      
      if (!response || !response.id) {
        throw new Error('Invalid response from campaign creation API')
      }
      
      return response
    } catch (error: any) {
      console.error('Error creating campaign:', error)
      console.error('Error details:', error.response?.data || error.message)
      throw new Error(`Failed to create campaign: ${error.response?.data?.message || error.message || 'Unknown error'}`)
    }
  },

  async update(id: string, campaignData: any) {
    try {
      const response = await api.put(`/campaigns/${id}`, campaignData)
      return response
    } catch (error) {
      console.error('Error updating campaign:', error)
      throw error
    }
  },

  async delete(id: string) {
    try {
      await api.delete(`/campaigns/${id}`)
    } catch (error) {
      console.error('Error deleting campaign:', error)
      throw error
    }
  },

  async addTeamMember(campaignId: string, memberData: any) {
    try {
      const response = await api.post(`/campaigns/${campaignId}/team`, memberData)
      return response
    } catch (error) {
      console.error('Error adding team member:', error)
      throw error
    }
  },

  async removeTeamMember(campaignId: string, memberId: string) {
    try {
      await api.delete(`/campaigns/${campaignId}/team/${memberId}`)
    } catch (error) {
      console.error('Error removing team member:', error)
      throw error
    }
  },
}

// Integration Service
export const integrationService = {
  list: () => api.get('/integrations'),
  connect: (platform: string, credentials: any) => api.post(`/integrations/${platform}/connect`, credentials),
  disconnect: (platform: string) => api.delete(`/integrations/${platform}/disconnect`),
  sync: (platform: string) => api.post(`/integrations/${platform}/sync`),
}

// User Service
export const userService = {
  getProfile: () => api.get('/user/profile'),
  updateProfile: (data: any) => api.put('/user/profile', data),
  getPreferences: () => api.get('/user/preferences'),
  updatePreferences: (data: any) => api.put('/user/preferences', data),
  getOrganization: () => api.get('/organization'),
  updateOrganization: (data: any) => api.put('/organization', data),
  list: (params?: any) => api.get('/users', { params }),
  get: (id: string) => api.get(`/users/${id}`),
  create: (data: any) => api.post('/users', data),
  update: (id: string, data: any) => api.put(`/users/${id}`, data),
  delete: (id: string) => api.delete(`/users/${id}`),
  updateRole: (id: string, role: string) => api.put(`/users/${id}/role`, { role }),
}


// Security Service
export const securityService = {
  getSettings: () => api.get('/security'),
  updatePassword: (data: any) => api.put('/security/password', data),
  get2FAStatus: () => api.get('/security/2fa'),
  enable2FA: () => api.post('/security/2fa'),
  verify2FA: (data: any) => api.put('/security/2fa', data),
  disable2FA: () => api.delete('/security/2fa'),
  getSessions: () => api.get('/security/sessions'),
  revokeSession: (sessionId: string) => api.delete('/security/sessions', { data: { sessionId } }),
  updatePreferences: (data: any) => api.put('/security/preferences', data),
}

// Billing Service
export const billingService = {
  getOverview: () => api.get('/billing'),
  createSubscription: (data: any) => api.post('/billing/subscription', data),
  updateSubscription: (data: any) => api.put('/billing/subscription', data),
  cancelSubscription: () => api.delete('/billing/subscription'),
  addPaymentMethod: (data: any) => api.post('/billing/payment-methods', data),
  setDefaultPaymentMethod: (data: any) => api.put('/billing/payment-methods', data),
  removePaymentMethod: (methodId: string) => api.delete('/billing/payment-methods', { data: { methodId } }),
  getInvoices: () => api.get('/billing/invoices'),
  getUsage: () => api.get('/billing/usage'),
}

// Advertiser Service
export const advertiserService = {
  list: () => api.get('/advertisers'),
  get: (id: string) => api.get(`/advertisers/${id}`),
  create: (data: any) => api.post('/advertisers', data),
  update: (id: string, data: any) => api.put(`/advertisers/${id}`, data),
  delete: (id: string) => api.delete(`/advertisers/${id}`),
}

// Agency Service
export const agencyService = {
  list: () => api.get('/agencies'),
  get: (id: string) => api.get(`/agencies/${id}`),
  create: (data: any) => api.post('/agencies', data),
  update: (id: string, data: any) => api.put(`/agencies/${id}`, data),
  delete: (id: string) => api.delete(`/agencies/${id}`),
}

// Ad Approval Service
export const adApprovalService = {
  list: () => api.get('/ad-approvals'),
  get: (id: string) => api.get(`/ad-approvals/${id}`),
  create: (data: any) => api.post('/ad-approvals', data),
  update: (id: string, data: any) => api.put(`/ad-approvals/${id}`, data),
  approve: (id: string, data: any) => api.put(`/ad-approvals/${id}/approve`, data),
  reject: (id: string, data: any) => api.put(`/ad-approvals/${id}/reject`, data),
  requestRevision: (id: string, data: any) => api.put(`/ad-approvals/${id}/revision`, data),
  delete: (id: string) => api.delete(`/ad-approvals/${id}`),
}

// Contract Service
export const contractService = {
  list: () => api.get('/contracts'),
  get: (id: string) => api.get(`/contracts/${id}`),
  create: (data: any) => api.post('/contracts', data),
  update: (id: string, data: any) => api.put(`/contracts/${id}`, data),
  delete: (id: string) => api.delete(`/contracts/${id}`),
  sign: (id: string, data: any) => api.put(`/contracts/${id}/sign`, data),
  terminate: (id: string, data: any) => api.put(`/contracts/${id}/terminate`, data),
}

// Show Service
export const showService = {
  list: (params?: any) => api.get('/shows', { params }),
  get: (id: string) => api.get(`/shows/${id}`),
  create: (data: any) => api.post('/shows', data),
  update: (id: string, data: any) => api.put(`/shows/${id}`, data),
  delete: (id: string) => api.delete(`/shows/${id}`),
  assignProducer: (showId: string, producerId: string) => api.post(`/shows/${showId}/assignments`, { producerId }),
  assignTalent: (showId: string, talentIds: string[]) => api.post(`/shows/${showId}/assignments`, { talentIds }),
  unassign: (showId: string, assignmentId: string) => api.delete(`/shows/${showId}/assignments/${assignmentId}`),
}

// Episode Service
export const episodeService = {
  list: (params?: any) => api.get('/episodes', { params }),
  get: (id: string) => api.get(`/episodes/${id}`),
  create: (data: any) => api.post('/episodes', data),
  update: (id: string, data: any) => api.put(`/episodes/${id}`, data),
  delete: (id: string) => api.delete(`/episodes/${id}`),
  assignTalent: (episodeId: string, talentId: string) => api.post(`/episodes/${episodeId}/talent`, { talentId }),
  removeTalent: (episodeId: string, talentId: string) => api.delete(`/episodes/${episodeId}/talent/${talentId}`),
}

// Client Service
export const clientService = {
  list: (params?: any) => api.get('/clients', { params }),
  get: (id: string) => api.get(`/clients/${id}`),
  create: (data: any) => api.post('/clients', data),
  update: (id: string, data: any) => api.put(`/clients/${id}`, data),
  delete: (id: string) => api.delete(`/clients/${id}`),
  getCampaigns: (id: string) => api.get(`/clients/${id}/campaigns`),
}

// Notification Service
export const notificationService = {
  list: (params?: any) => api.get('/notifications', { params }),
  get: (id: string) => api.get(`/notifications/${id}`),
  create: (data: any) => api.post('/notifications', data),
  update: (id: string, data: any) => api.put(`/notifications/${id}`, data),
  delete: (id: string) => api.delete(`/notifications/${id}`),
  markAsRead: (id: string) => api.post(`/notifications/${id}/read`),
  markBatchAsRead: (ids: string[]) => api.post('/notifications/batch-read', { notificationIds: ids }),
  deleteBatch: (ids: string[]) => api.delete('/notifications/batch-delete', { data: { notificationIds: ids } }),
}

// Activity Service
export const activityService = {
  list: (params?: any) => api.get('/activities', { params }),
  get: (id: string) => api.get(`/activities/${id}`),
  log: (data: any) => api.post('/activities', data),
}

// Backup Service
export const backupService = {
  list: (params?: any) => api.get('/backups', { params }),
  get: (id: string) => api.get(`/backups/${id}`),
  create: (data: any) => api.post('/backups', data),
  restore: (data: any) => api.post('/backups/restore', data),
  delete: (id: string) => api.delete(`/backups/${id}`),
  download: (id: string) => api.get(`/backups/${id}/download`),
  getSchedule: () => api.get('/backups/schedule'),
  updateSchedule: (data: any) => api.put('/backups/schedule', data),
}

// Monitoring Service
export const monitoringService = {
  getSystemHealth: () => api.get('/monitoring/health'),
  getMetrics: (params?: any) => api.get('/monitoring/metrics', { params }),
  getAlerts: (params?: any) => api.get('/monitoring/alerts', { params }),
  acknowledgeAlert: (id: string) => api.put(`/monitoring/alerts/${id}/acknowledge`),
  resolveAlert: (id: string) => api.put(`/monitoring/alerts/${id}/resolve`),
  getServiceStatus: (service: string) => api.get(`/monitoring/services/${service}`),
  getLogs: (params?: any) => api.get('/monitoring/logs', { params }),
}

// Permission Service
export const permissionService = {
  getForRole: (role: string) => api.get(`/roles/${role}/permissions`),
  updateForRole: (role: string, permissions: string[]) => api.put(`/roles/${role}/permissions`, permissions),
  getAll: () => api.get('/roles/permissions'),
}

// Organization Service (for master role)
export const organizationService = {
  list: () => api.get('/organizations'),
  get: (id: string) => api.get(`/organizations/${id}`),
  create: (data: any) => api.post('/organizations', data),
  update: (id: string, data: any) => api.put(`/organizations/${id}`, data),
  delete: (id: string) => api.delete(`/organizations/${id}`),
  updateStatus: (id: string, status: string) => api.put(`/organizations/${id}/status`, { status }),
  updateFeatures: (id: string, features: any) => api.put(`/organizations/${id}/features`, features),
}