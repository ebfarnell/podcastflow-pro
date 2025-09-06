import { ProductShipment } from '@/components/campaigns/ProductTrackingModal'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_ENDPOINT || process.env.NEXT_PUBLIC_API_URL || '/api'

interface TrackingApiResponse<T = any> {
  data?: T
  error?: string
  message?: string
}

interface CreateShipmentRequest {
  productName: string
  carrier: 'UPS' | 'FedEx' | 'USPS' | 'DHL' | 'Other'
  trackingNumber: string
  recipientName: string
  recipientAddress?: string
  shippedDate: string
  estimatedDelivery?: string
  status: 'shipped' | 'in_transit' | 'delivered' | 'failed' | 'returned'
  notes?: string
}

interface UpdateShipmentStatusRequest {
  status: 'shipped' | 'in_transit' | 'delivered' | 'failed' | 'returned'
  notes?: string
}

interface TrackingData {
  carrier: string
  trackingNumber: string
  status: string
  statusDetails: string
  estimatedDelivery?: string
  actualDelivery?: string
  currentLocation?: {
    city?: string
    state?: string
    country?: string
  }
  activities: {
    timestamp: string
    location?: any
    description: string
    status: string
  }[]
  lastUpdated: string
}

class TrackingApiService {
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<TrackingApiResponse<T>> {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      return { data }
    } catch (error) {
      console.error('API request failed:', error)
      return {
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  /**
   * Create a new shipment for a campaign
   */
  async createShipment(campaignId: string, shipmentData: CreateShipmentRequest): Promise<TrackingApiResponse<ProductShipment>> {
    return this.makeRequest<ProductShipment>(`/campaigns/${campaignId}/shipments`, {
      method: 'POST',
      body: JSON.stringify(shipmentData),
    })
  }

  /**
   * Get all shipments for a campaign
   */
  async getCampaignShipments(campaignId: string): Promise<TrackingApiResponse<{ shipments: ProductShipment[] }>> {
    return this.makeRequest<{ shipments: ProductShipment[] }>(`/campaigns/${campaignId}/shipments`)
  }

  /**
   * Update shipment status manually
   */
  async updateShipmentStatus(
    shipmentId: string, 
    statusData: UpdateShipmentStatusRequest
  ): Promise<TrackingApiResponse<{ updated: boolean }>> {
    return this.makeRequest<{ updated: boolean }>(`/shipments/${shipmentId}/status`, {
      method: 'PUT',
      body: JSON.stringify(statusData),
    })
  }

  /**
   * Force tracking update for a specific shipment
   */
  async trackShipment(shipmentId: string): Promise<TrackingApiResponse<{ trackingData: TrackingData }>> {
    return this.makeRequest<{ trackingData: TrackingData }>(`/shipments/${shipmentId}/track`, {
      method: 'POST',
    })
  }

  /**
   * Get active shipments that need tracking
   */
  async getActiveShipments(limit = 100): Promise<TrackingApiResponse<{ shipments: ProductShipment[] }>> {
    return this.makeRequest<{ shipments: ProductShipment[] }>(`/shipments/active?limit=${limit}`)
  }

  /**
   * Batch update tracking for multiple shipments
   */
  async batchUpdateTracking(shipmentIds: string[]): Promise<TrackingApiResponse<{
    totalProcessed: number
    successful: number
    failed: number
    results: Array<{
      shipmentId: string
      success: boolean
      trackingData?: TrackingData
      error?: string
    }>
  }>> {
    return this.makeRequest(`/shipments/batch-track`, {
      method: 'POST',
      body: JSON.stringify({ shipmentIds }),
    })
  }

  /**
   * Get tracking information for a specific tracking number
   * This is a convenience method that bypasses our shipment system
   */
  async getTrackingInfo(carrier: string, trackingNumber: string): Promise<TrackingApiResponse<TrackingData>> {
    return this.makeRequest<TrackingData>(`/tracking/${carrier}/${trackingNumber}`)
  }
}

// Export singleton instance
export const trackingApi = new TrackingApiService()

// Export types for use in components
export type {
  CreateShipmentRequest,
  UpdateShipmentStatusRequest,
  TrackingData,
  TrackingApiResponse
}