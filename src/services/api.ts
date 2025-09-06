import axios, { AxiosInstance, AxiosRequestConfig } from 'axios'
// Removed AWS Amplify - using custom auth

export const API_URL = process.env.NEXT_PUBLIC_API_ENDPOINT || '/api'

class ApiService {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: process.env.NEXT_PUBLIC_API_ENDPOINT || '/api',
      timeout: 30000,
      withCredentials: true, // Send cookies with requests
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      async (config) => {
        try {
          // Check for authentication token in localStorage
          if (typeof window !== 'undefined') {
            const authToken = localStorage.getItem('authToken')
            if (authToken) {
              config.headers.Authorization = `Bearer ${authToken}`
              return config
            }
          }
          
          // No AWS Amplify auth - we use custom authentication with cookies
        } catch (error) {
          // If no auth session, continue without token
          // This allows API calls to work even when not authenticated
          // No auth session available, continuing without token
        }
        return config
      },
      (error) => {
        return Promise.reject(error)
      }
    )

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => {
        return response
      },
      async (error) => {
        if (error.response?.status === 401) {
          const requestUrl = error.config?.url || ''
          
          // Check if this is a YouTube episode analytics request - these are expected to fail
          const isYouTubeAnalytics = requestUrl.includes('/analytics/episodes/') && 
                                     requestUrl.includes('youtube')
          
          // Only log errors that aren't expected YouTube analytics failures
          if (!isYouTubeAnalytics) {
            console.error('❌ API 401 Error:', {
              url: error.config?.url,
              method: error.config?.method,
              error: error.response?.data
            })
          }
          
          // Only redirect to login for authentication failures, not permission issues
          const errorMessage = error.response?.data?.error || ''
          const isAuthError = errorMessage.toLowerCase().includes('authentication') || 
                             errorMessage.toLowerCase().includes('unauthorized') ||
                             errorMessage.toLowerCase().includes('session')
          
          if (isAuthError && typeof window !== 'undefined') {
            // Don't redirect if we're already on the login page or on episode pages
            const pathname = window.location.pathname
            if (!pathname.includes('/login') && !pathname.includes('/episodes/')) {
              window.location.href = '/login'
            } else if (pathname.includes('/episodes/')) {
              // Only log for non-YouTube analytics requests
              if (!isYouTubeAnalytics) {
                console.log('🛑 API: Skipping redirect for episode page, letting component handle auth')
              }
            }
          }
        }
        return Promise.reject(error)
      }
    )
  }

  // Generic request method
  async request<T>(config: AxiosRequestConfig): Promise<T> {
    const response = await this.client.request<T>(config)
    return response.data
  }

  // Convenience methods
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get<T>(url, config)
    return response.data
  }

  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post<T>(url, data, config)
    return response.data
  }

  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.put<T>(url, data, config)
    return response.data
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete<T>(url, config)
    return response.data
  }
}

export const api = new ApiService()

// Import real API implementations with fallback
import { campaignApi as realCampaignApi, analyticsApi as realAnalyticsApi } from './real-api'

// Use real implementations - API endpoint is properly configured
const useRealApi = true

// Campaign API endpoints
export const campaignApi = useRealApi ? realCampaignApi : {
  list: (params?: any) => api.get<any>('/campaigns', { params }),
  getAll: (params?: any) => api.get<any>('/campaigns', { params }).then(data => ({ data: { campaigns: data.Items || [] } })),
  get: (id: string) => api.get<any>(`/campaigns/${id}`),
  create: (data: any) => api.post<any>('/campaigns', data),
  update: (id: string, data: any) => api.put<any>(`/campaigns/${id}`, data),
  delete: (id: string) => api.delete<any>(`/campaigns/${id}`),
  addTeamMember: (campaignId: string, data: { userId: string, teamRole: string }) => api.post<any>(`/campaigns/${campaignId}/team`, data),
  removeTeamMember: (campaignId: string, userId: string) => api.delete<any>(`/campaigns/${campaignId}/team/${userId}`),
}

// Integration API endpoints
export const integrationApi = {
  list: () => api.get<any>('/integrations'),
  connect: (platform: string, data: any) => api.post<any>(`/integrations/${platform}/connect`, data),
  disconnect: (platform: string) => api.delete<any>(`/integrations/${platform}/disconnect`),
  sync: (platform: string) => api.post<any>(`/integrations/${platform}/sync`),
}

// Analytics API endpoints
export const analyticsApi = useRealApi ? realAnalyticsApi : {
  getDashboard: (params: any) => api.get<any>('/analytics/dashboard', { params }),
  getCampaignMetrics: (campaignId: string, params: any) => api.get<any>(`/analytics/campaigns/${campaignId}`, { params }),
  getRevenueReport: (params: any) => api.get<any>('/analytics/revenue', { params }),
  export: (type: string, params: any) => api.post<any>(`/analytics/export/${type}`, params),
}

// Import organization-aware API service
import { apiService, initializeApiContext } from './apiService'

// User API endpoints with organization isolation
export const userApi = {
  getProfile: () => api.get<any>('/user/profile'),
  updateProfile: (data: any) => api.put<any>('/user/profile', data),
  getPreferences: () => api.get<any>('/user/preferences'),
  updatePreferences: (data: any) => api.put<any>('/user/preferences', data),
  getOrganization: () => api.get<any>('/organization'),
  updateOrganization: (data: any) => api.put<any>('/organization', data),
  
  // Organization-aware user management endpoints
  list: async (params?: any) => {
    try {
      const response = await api.get<any>('/users', { params })
      return response
    } catch (error: any) {
      console.error('Failed to fetch users:', error)
      // Fallback to empty array for UI stability
      return { users: [], total: 0 }
    }
  },
  
  get: async (userId: string) => {
    try {
      const response = await api.get<any>(`/users/${userId}`)
      return response
    } catch (error: any) {
      console.error('Failed to fetch user:', error)
      throw error
    }
  },
  
  create: async (data: any) => {
    try {
      const response = await api.post<any>('/users', data)
      return response
    } catch (error: any) {
      console.error('Failed to create user:', error)
      throw error
    }
  },
  
  update: async (userId: string, data: any) => {
    try {
      const response = await api.put<any>(`/users/${userId}`, data)
      return response
    } catch (error: any) {
      console.error('Failed to update user:', error)
      throw error
    }
  },
  
  delete: async (userId: string) => {
    try {
      const response = await api.delete<any>(`/users/${userId}`)
      return response
    } catch (error: any) {
      console.error('Failed to delete user:', error)
      throw error
    }
  },
  
  updateRole: async (userId: string, role: string) => {
    try {
      const response = await api.put<any>(`/users/${userId}/role`, { role })
      return response
    } catch (error: any) {
      console.error('Failed to update user role:', error)
      throw error
    }
  },
  
  updateStatus: async (userId: string, status: string) => {
    try {
      const response = await api.put<any>(`/users/${userId}/status`, { status })
      return response
    } catch (error: any) {
      console.error('Failed to update user status:', error)
      throw error
    }
  },
}



// Billing API endpoints
export const billingApi = {
  getOverview: () => api.get<any>('/billing'),
  createSubscription: (data: any) => api.post<any>('/billing/subscription', data),
  updateSubscription: (data: any) => api.put<any>('/billing/subscription', data),
  cancelSubscription: () => api.delete<any>('/billing/subscription'),
  addPaymentMethod: (data: any) => api.post<any>('/billing/payment-methods', data),
  setDefaultPaymentMethod: (data: any) => api.put<any>('/billing/payment-methods', data),
  removePaymentMethod: (methodId: string) => api.delete<any>('/billing/payment-methods', { data: { methodId } }),
  getInvoices: () => api.get<any>('/billing/invoices'),
  getUsage: () => api.get<any>('/billing/usage'),
}

// API & Webhooks endpoints
export const apiWebhooksApi = {
  getSettings: () => api.get<any>('/api-webhooks'),
  createApiKey: (data: any) => api.post<any>('/api-webhooks/api-keys', data),
  updateApiKey: (keyId: string, data: any) => api.put<any>(`/api-webhooks/api-keys/${keyId}`, data),
  deleteApiKey: (keyId: string) => api.delete<any>(`/api-webhooks/api-keys/${keyId}`),
  createWebhook: (data: any) => api.post<any>('/api-webhooks/webhooks', data),
  updateWebhook: (webhookId: string, data: any) => api.put<any>(`/api-webhooks/webhooks/${webhookId}`, data),
  deleteWebhook: (webhookId: string) => api.delete<any>(`/api-webhooks/webhooks/${webhookId}`),
  testWebhook: (webhookId: string) => api.post<any>('/api-webhooks/webhooks/test', { webhookId }),
}


// Advertiser API endpoints
export const advertiserApi = {
  list: () => api.get<any>('/advertisers'),
  get: (advertiserId: string) => api.get<any>(`/advertisers/${advertiserId}`),
  create: (data: any) => api.post<any>('/advertisers', data),
  update: (advertiserId: string, data: any) => api.put<any>(`/advertisers/${advertiserId}`, data),
  delete: (advertiserId: string) => api.delete<any>(`/advertisers/${advertiserId}`),
}

// Agency API endpoints  
export const agencyApi = {
  list: () => api.get<any>('/agencies'),
  get: (agencyId: string) => api.get<any>(`/agencies/${agencyId}`),
  create: (data: any) => api.post<any>('/agencies', data),
  update: (agencyId: string, data: any) => api.put<any>(`/agencies/${agencyId}`, data),
  delete: (agencyId: string) => api.delete<any>(`/agencies/${agencyId}`),
}

// Ad Approvals API endpoints
export const approvalsApi = {
  list: () => api.get<any>('/ad-approvals'),
  get: (approvalId: string) => api.get<any>(`/ad-approvals/${approvalId}`),
  create: (data: any) => api.post<any>('/ad-approvals', data),
  update: (approvalId: string, data: any) => api.put<any>(`/ad-approvals/${approvalId}`, data),
  approve: (approvalId: string, data: any) => api.put<any>(`/ad-approvals/${approvalId}/approve`, data),
  reject: (approvalId: string, data: any) => api.put<any>(`/ad-approvals/${approvalId}/reject`, data),
  requestRevision: (approvalId: string, data: any) => api.put<any>(`/ad-approvals/${approvalId}/revision`, data),
  delete: (approvalId: string) => api.delete<any>(`/ad-approvals/${approvalId}`),
}

// Contracts API endpoints
export const contractsApi = {
  list: () => api.get<any>('/contracts'),
  get: (contractId: string) => api.get<any>(`/contracts/${contractId}`),
  create: (data: any) => api.post<any>('/contracts', data),
  update: (contractId: string, data: any) => api.put<any>(`/contracts/${contractId}`, data),
  delete: (contractId: string) => api.delete<any>(`/contracts/${contractId}`),
  sign: (contractId: string, data: any) => api.put<any>(`/contracts/${contractId}/sign`, data),
  terminate: (contractId: string, data: any) => api.put<any>(`/contracts/${contractId}/terminate`, data),
}

// Shows API endpoints
export const showsApi = {
  list: (params?: any) => api.get<any>('/shows', { params }),
  get: (showId: string) => api.get<any>(`/shows/${showId}`),
  create: (data: any) => api.post<any>('/shows', data),
  update: (showId: string, data: any) => api.put<any>(`/shows/${showId}`, data),
  delete: (showId: string, config?: any) => api.delete<any>(`/shows/${showId}`, config),
  assignProducer: (showId: string, producerId: string) => api.post<any>(`/shows/${showId}/assignments`, { userId: producerId, role: 'producer' }),
  assignTalent: (showId: string, talentId: string) => api.post<any>(`/shows/${showId}/assignments`, { userId: talentId, role: 'talent' }),
  unassign: (showId: string, userId: string) => api.delete<any>(`/shows/${showId}/assignments/${userId}`),
}

// Episodes API endpoints
export const episodesApi = {
  list: (params?: any) => api.get<any>('/episodes', { params }),
  get: (episodeId: string) => api.get<any>(`/episodes/${episodeId}`),
  create: (data: any) => api.post<any>('/episodes', data),
  update: (episodeId: string, data: any) => api.put<any>(`/episodes/${episodeId}`, data),
  delete: (episodeId: string) => api.delete<any>(`/episodes/${episodeId}`),
  // Episode talent assignments are managed through show assignments
  // Individual episode talent assignment removed for security reasons
}

// Clients API endpoints
export const clientsApi = {
  list: (params?: any) => api.get<any>('/clients', { params }),
  get: (clientId: string) => api.get<any>(`/clients/${clientId}`),
  create: (data: any) => api.post<any>('/clients', data),
  update: (clientId: string, data: any) => api.put<any>(`/clients/${clientId}`, data),
  delete: (clientId: string) => api.delete<any>(`/clients/${clientId}`),
  getCampaigns: (clientId: string) => api.get<any>(`/clients/${clientId}/campaigns`),
}

// Notifications API endpoints
export const notificationsApi = {
  list: (params?: any) => api.get<any>('/notifications', { params }),
  get: (notificationId: string) => api.get<any>(`/notifications/${notificationId}`),
  create: (data: any) => api.post<any>('/notifications', data),
  update: (notificationId: string, data: any) => api.put<any>(`/notifications/${notificationId}`, data),
  delete: (notificationId: string) => api.delete<any>(`/notifications/${notificationId}`),
  markAsRead: (notificationId: string) => api.post<any>(`/notifications/${notificationId}/read`),
  markBatchAsRead: (notificationIds: string[]) => api.post<any>('/notifications/batch-read', { notificationIds }),
  deleteBatch: (notificationIds: string[]) => api.delete<any>('/notifications/batch-delete', { data: { notificationIds } }),
}

// Activities API endpoints
export const activitiesApi = {
  list: (params?: any) => api.get<any>('/activities', { params }),
  get: (activityId: string) => api.get<any>(`/activities/${activityId}`),
  log: (data: any) => api.post<any>('/activities', data),
}

// Backup API endpoints
export const backupApi = {
  list: (params?: any) => api.get<any>('/backups', { params }),
  get: (backupId: string) => api.get<any>(`/backups/${backupId}`),
  create: (data: any) => api.post<any>('/backups', data),
  restore: (data: any) => api.post<any>('/backups/restore', data),
  delete: (backupId: string) => api.delete<any>(`/backups/${backupId}`),
  download: (backupId: string) => api.get<any>(`/backups/${backupId}/download`),
  getSchedule: () => api.get<any>('/backups/schedule'),
  updateSchedule: (data: any) => api.put<any>('/backups/schedule', data),
}

// Monitoring API endpoints
export const monitoringApi = {
  getSystemHealth: () => api.get<any>('/monitoring?type=health'),
  getMetrics: (params?: any) => {
    const timeRange = params?.timeRange || '1h'
    const hours = timeRange === '24h' ? 24 : timeRange === '7d' ? 168 : 1
    return api.get<any>(`/monitoring?type=metrics&timeRange=${timeRange}&hours=${hours}`)
  },
  getAlerts: (params?: any) => {
    const url = params?.unresolved 
      ? '/monitoring?type=alerts&unresolved=true' 
      : '/monitoring?type=alerts'
    return api.get<any>(url)
  },
  acknowledgeAlert: (alertId: string) => api.post<any>('/monitoring', { action: 'acknowledge_alert', data: { alertId } }),
  resolveAlert: (alertId: string, note?: string) => api.post<any>('/monitoring', { action: 'resolve_alert', data: { alertId, note } }),
  getServiceStatus: (service: string) => api.get<any>(`/monitoring?type=health&service=${service}`),
  getLogs: (params?: any) => api.get<any>('/monitoring?type=logs', { params }),
  getDashboard: () => api.get<any>('/monitoring?type=dashboard'),
}

// Security API endpoints
export const securityApi = {
  getSettings: () => api.get<any>('/security'),
  updateSettings: (data: any) => api.put<any>('/security', data),
  updatePassword: (data: { currentPassword: string; newPassword: string }) => api.put<any>('/security/password', data),
  enable2FA: () => api.post<any>('/security/2fa', { twoFactorEnabled: true }),
  disable2FA: () => api.put<any>('/security', { twoFactorEnabled: false }),
  verify2FA: (code: string) => api.post<any>('/security/2fa', { code }),
  terminateSession: (sessionId: string) => api.put<any>('/security', { sessionId, action: 'terminate' }),
  terminateAllSessions: () => api.put<any>('/security', { action: 'terminateAll' }),
  updatePreferences: (preferences: { loginAlerts: boolean; suspiciousActivityAlerts: boolean }) => 
    api.put<any>('/security', { securityPreferences: { 
      notifyOnNewLogin: preferences.loginAlerts,
      notifyOnPasswordChange: preferences.suspiciousActivityAlerts
    }}),
}

// Permissions API endpoints
export const permissionsApi = {
  getForRole: (role: string) => api.get<any>(`/roles/${role}/permissions`),
  updateForRole: (role: string, permissions: any) => api.put<any>(`/roles/${role}/permissions`, permissions),
  getAll: () => api.get<any>('/roles/permissions'),
}