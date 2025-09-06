import { api } from './api'

// Master API endpoints for platform administration
export interface MasterAnalytics {
  totalUsers: number
  activeUsers: number
  totalOrganizations: number
  totalRevenue: number
  storageUsed: number
  apiCalls: number
  uptime: number
  avgResponseTime: number
  usageData: {
    metric: string
    used: number
    limit: number
    unit: string
  }[]
  organizations: {
    name: string
    users: number
    revenue: number
    plan: string
  }[]
}

export interface MasterBilling {
  timeRange?: {
    selected: string
    start: string
    end: string
    label: string
  }
  metrics: {
    totalRevenue: number
    monthlyRecurring: number
    overdueAmount: number
    churnRate: number
  }
  realtimeMetrics?: {
    overdueAccounts: number
    revenueGrowth: number
    subscriptionGrowth: number
    averageRevenuePerUser: number
    lifetimeValue: number
  }
  records: {
    id: string
    organizationId: string
    organizationName: string
    plan: string
    amount: number
    status: 'paid' | 'pending' | 'overdue' | 'failed' | 'voided'
    dueDate: string
    lastPayment: string
    description?: string
    invoiceNumber?: string
    createdAt?: string
  }[]
}

export interface InvoiceData {
  organizationId: string
  organizationName: string
  amount: number
  description: string
  dueDate: string
  status: 'pending' | 'paid' | 'overdue' | 'failed' | 'voided'
  plan?: string
  currency?: string
  type?: string
}

export interface PlatformSettings {
  platformName: string
  supportEmail: string
  maintenanceMode: boolean
  registrationEnabled: boolean
  defaultUserRole: string
  enforceSSL: boolean
  sessionTimeout: number
  passwordMinLength: number
  requireMFA: boolean
  allowedDomains: string
  emailNotifications: boolean
  systemAlerts: boolean
  maintenanceNotices: boolean
  weeklyReports: boolean
  maxUploadSize: number
  storageQuota: number
  backupRetention: number
  rateLimitEnabled: boolean
  requestsPerMinute: number
  apiVersioning: boolean
}

export interface GlobalUser {
  id: string
  email: string
  name: string
  role: string
  status: 'active' | 'inactive' | 'suspended'
  organizationId: string
  organizationName?: string
  createdAt: string
  lastLoginAt?: string
}

// Master API service
export const masterApi = {
  // Analytics endpoints
  analytics: {
    async getGlobalMetrics(timeRange = '30d'): Promise<MasterAnalytics> {
      const response = await api.get<MasterAnalytics>(`/master/analytics?timeRange=${timeRange}`)
      return response
    },

    async exportReport(format: string, data: any): Promise<Blob> {
      try {
        const response = await api.post<Blob>('/master/analytics/export', { format, ...data }, {
          responseType: 'blob'
        })
        return response
      } catch (error) {
        console.error('Error exporting analytics report:', error)
        throw error
      }
    }
  },

  // Billing endpoints
  billing: {
    async getOverview(timeRange: string = 'ytd'): Promise<MasterBilling> {
      const response = await api.get<MasterBilling>(`/master/billing?timeRange=${timeRange}`)
      return response
    },

    async updatePaymentStatus(recordId: string, status: string): Promise<void> {
      try {
        await api.put(`/master/billing/${recordId}/status`, { status })
      } catch (error) {
        console.error('Error updating payment status:', error)
        throw error
      }
    },

    async sendReminder(recordId: string): Promise<void> {
      try {
        await api.post(`/master/billing/${recordId}/reminder`)
      } catch (error) {
        console.error('Error sending payment reminder:', error)
        throw error
      }
    },

    async suspendAccount(recordId: string): Promise<void> {
      try {
        await api.post(`/master/billing/${recordId}/suspend`)
      } catch (error) {
        console.error('Error suspending account:', error)
        throw error
      }
    },

    async downloadInvoice(recordId: string): Promise<Blob> {
      try {
        const response = await api.get<Blob>(`/master/invoices/${recordId}/download`, {
          responseType: 'blob'
        })
        return response
      } catch (error) {
        console.error('Error downloading invoice:', error)
        throw error
      }
    },

    async createInvoice(invoiceData: InvoiceData): Promise<any> {
      try {
        const response = await api.post('/master/invoices', invoiceData)
        return response
      } catch (error) {
        console.error('Error creating invoice:', error)
        throw error
      }
    },

    async updateInvoice(invoiceId: string, updates: Partial<InvoiceData>): Promise<any> {
      try {
        const response = await api.put(`/master/invoices/${invoiceId}`, updates)
        return response
      } catch (error) {
        console.error('Error updating invoice:', error)
        throw error
      }
    },

    async deleteInvoice(invoiceId: string): Promise<any> {
      try {
        const result = await api.delete(`/master/invoices/${invoiceId}`)
        return result
      } catch (error) {
        console.error('❌ Error in masterApi.billing.deleteInvoice:', error)
        throw error
      }
    },

    async updateInvoiceStatus(invoiceId: string, status: string): Promise<void> {
      try {
        await api.put(`/master/invoices/${invoiceId}`, { status })
      } catch (error) {
        console.error('Error updating invoice status:', error)
        throw error
      }
    }
  },

  // Settings endpoints
  settings: {
    async getPlatformSettings(): Promise<PlatformSettings> {
      const response = await api.get<PlatformSettings>('/master/settings')
      return response
    },

    async updatePlatformSettings(settings: Partial<PlatformSettings>): Promise<PlatformSettings> {
      try {
        const response = await api.put<PlatformSettings>('/master/settings', settings)
        return response
      } catch (error) {
        console.error('Error updating platform settings:', error)
        throw error
      }
    }
  },

  // Users endpoints
  users: {
    async getGlobalUsers(params?: { role?: string; status?: string; search?: string }): Promise<GlobalUser[]> {
      const response = await api.get<{ users: GlobalUser[] }>('/master/users', { params })
      return response.users || response as any || []
    },

    async getUserDetails(userId: string): Promise<GlobalUser | null> {
      try {
        const response = await api.get<{ user: GlobalUser }>(`/master/users/${userId}`)
        return response.user
      } catch (error) {
        console.error('Error fetching user details:', error)
        return null
      }
    },

    async updateUserStatus(userId: string, status: string): Promise<void> {
      try {
        await api.put(`/master/users/${userId}/status`, { status })
      } catch (error) {
        console.error('Error updating user status:', error)
        throw error
      }
    },

    async impersonateUser(userId: string): Promise<{ token: string }> {
      try {
        const response = await api.post<{ token: string }>(`/master/users/${userId}/impersonate`)
        return response
      } catch (error) {
        console.error('Error impersonating user:', error)
        throw error
      }
    },

    async deleteUser(userId: string, permanent: boolean = false): Promise<void> {
      try {
        const params = permanent ? '?permanent=true' : ''
        await api.delete(`/master/users/${userId}${params}`)
      } catch (error) {
        console.error('Error deleting user:', error)
        throw error
      }
    }
  },

  // Organizations endpoints
  organizations: {
    async list(): Promise<any[]> {
      try {
        const response = await api.get<{ organizations: any[] }>('/master/organizations')
        return response.organizations || []
      } catch (error) {
        console.error('Error fetching organizations:', error)
        return []
      }
    },

    async getAll(): Promise<{ organizations: any[] }> {
      try {
        const response = await api.get<{ organizations: any[] }>('/master/organizations')
        return response
      } catch (error) {
        console.error('Error fetching organizations:', error)
        return { organizations: [] }
      }
    },

    async get(organizationId: string): Promise<any | null> {
      try {
        const response = await api.get<any>(`/master/organizations/${organizationId}`)
        return response
      } catch (error) {
        console.error('Error fetching organization:', error)
        return null
      }
    },

    async update(organizationId: string, data: any): Promise<any> {
      try {
        const response = await api.put<any>(`/master/organizations/${organizationId}`, data)
        return response
      } catch (error) {
        console.error('Error updating organization:', error)
        throw error
      }
    },

    async suspend(organizationId: string): Promise<void> {
      try {
        await api.post(`/master/organizations/${organizationId}/suspend`)
      } catch (error) {
        console.error('Error suspending organization:', error)
        throw error
      }
    }
  }
}