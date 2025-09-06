import { apiClient } from './client'

export interface Reservation {
  id: string
  orderNumber: string
  advertiserName?: string
  advertiserId?: string
  campaignId?: string
  status: string
  totalSlots: number
  totalAmount: number
  notes?: string
  expiresAt?: string
  createdAt: string
  updatedAt: string
}

export interface ReservationFilters {
  status?: string
  advertiserId?: string
  campaignId?: string
  startDate?: string
  endDate?: string
}

export interface Order {
  id: string
  orderNumber: string
  type: string
  status: string
  advertiserName?: string
  advertiserId?: string
  agencyName?: string
  agencyId?: string
  campaignId?: string
  totalAmount: number
  paidAmount: number
  startDate?: string
  endDate?: string
  createdAt: string
  updatedAt: string
}

export const orderApi = {
  list: async (filters?: any): Promise<Order[]> => {
    const params = new URLSearchParams()
    if (filters?.status) params.append('status', filters.status)
    if (filters?.type) params.append('type', filters.type)
    if (filters?.advertiserId) params.append('advertiserId', filters.advertiserId)
    
    return apiClient.get(`/orders?${params.toString()}`)
  },

  get: async (id: string): Promise<Order> => {
    return apiClient.get(`/orders/${id}`)
  },

  create: async (data: Partial<Order>): Promise<Order> => {
    return apiClient.post('/orders', data)
  },

  update: async (id: string, data: Partial<Order>): Promise<Order> => {
    return apiClient.put(`/orders/${id}`, data)
  },

  getReservations: async (filters?: ReservationFilters): Promise<Reservation[]> => {
    const params = new URLSearchParams()
    if (filters?.status) params.append('status', filters.status)
    if (filters?.advertiserId) params.append('advertiserId', filters.advertiserId)
    if (filters?.campaignId) params.append('campaignId', filters.campaignId)
    
    return apiClient.get(`/reservations?${params.toString()}`)
  },

  getReservation: async (id: string): Promise<Reservation> => {
    return apiClient.get(`/reservations/${id}`)
  },

  createReservation: async (data: any): Promise<Reservation> => {
    return apiClient.post('/reservations', data)
  },

  confirmReservation: async (id: string): Promise<Reservation> => {
    return apiClient.post(`/reservations/${id}/confirm`, {})
  },

  getReservationStats: async (): Promise<any> => {
    return apiClient.get('/reservations/stats')
  }
}