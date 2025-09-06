import { apiClient } from './client'

export interface Proposal {
  id: string
  title: string
  proposalNumber: string
  advertiserName?: string
  advertiserId?: string
  agencyName?: string
  agencyId?: string
  status: string
  totalAmount: number
  validUntil?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface ProposalFilters {
  status?: string
  advertiserId?: string
  agencyId?: string
}

export const proposalApi = {
  list: async (filters?: ProposalFilters): Promise<Proposal[]> => {
    const params = new URLSearchParams()
    if (filters?.status) params.append('status', filters.status)
    if (filters?.advertiserId) params.append('advertiserId', filters.advertiserId)
    if (filters?.agencyId) params.append('agencyId', filters.agencyId)
    
    return apiClient.get(`/proposals?${params.toString()}`)
  },

  get: async (id: string): Promise<Proposal> => {
    return apiClient.get(`/proposals/${id}`)
  },

  create: async (data: Partial<Proposal>): Promise<Proposal> => {
    return apiClient.post('/proposals', data)
  },

  update: async (id: string, data: Partial<Proposal>): Promise<Proposal> => {
    return apiClient.put(`/proposals/${id}`, data)
  },

  delete: async (id: string): Promise<void> => {
    return apiClient.delete(`/proposals/${id}`)
  },

  submitForApproval: async (id: string): Promise<Proposal> => {
    return apiClient.post(`/proposals/${id}/submit-for-approval`, {})
  },

  approve: async (id: string): Promise<Proposal> => {
    return apiClient.post(`/proposals/${id}/approve`, {})
  },

  reject: async (id: string, reason: string): Promise<Proposal> => {
    return apiClient.post(`/proposals/${id}/reject`, { reason })
  },

  export: async (id: string, format: 'pdf' | 'docx' = 'pdf'): Promise<Blob> => {
    const response = await fetch(`/api/proposals/${id}/export?format=${format}`, {
      method: 'GET',
      credentials: 'include',
    })
    
    if (!response.ok) {
      throw new Error('Export failed')
    }
    
    return response.blob()
  },

  getTemplates: async (): Promise<any[]> => {
    return apiClient.get('/proposal-templates')
  }
}