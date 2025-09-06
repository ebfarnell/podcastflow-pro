import axios, { AxiosInstance } from 'axios'
// Removed AWS Amplify - using custom auth

class Api {
  private instance: AxiosInstance

  constructor() {
    this.instance = axios.create({
      baseURL: process.env.NEXT_PUBLIC_API_ENDPOINT || '/api',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Request interceptor to add auth token from localStorage
    this.instance.interceptors.request.use(
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
          // No session available
        }
        return config
      },
      (error) => {
        return Promise.reject(error)
      }
    )

    // Response interceptor for error handling
    this.instance.interceptors.response.use(
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

  // HTTP methods
  async get(url: string, config?: any) {
    return this.instance.get(url, config)
  }

  async post(url: string, data?: any, config?: any) {
    return this.instance.post(url, data, config)
  }

  async put(url: string, data?: any, config?: any) {
    return this.instance.put(url, data, config)
  }

  async delete(url: string, config?: any) {
    return this.instance.delete(url, config)
  }

  async patch(url: string, data?: any, config?: any) {
    return this.instance.patch(url, data, config)
  }
}

// Create singleton instance
export const api = new Api()

// API endpoints
export const endpoints = {
  campaigns: '/campaigns',
  shows: '/shows',
  episodes: '/episodes',
  analytics: '/analytics',
  users: '/users',
  clients: '/clients',
  adApprovals: '/ad-approvals',
  auth: '/auth',
  billing: '/billing',
  reports: '/reports',
  activities: '/activities',
  permissions: '/permissions',
  notifications: '/notifications',
  teams: '/teams',
  organizations: '/organizations',
  websocket: process.env.NEXT_PUBLIC_WEBSOCKET_ENDPOINT || '',
} as const

export default api