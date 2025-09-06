import axios, { AxiosInstance } from 'axios'
// Removed AWS Amplify - using custom auth

class MasterApiService {
  private instance: AxiosInstance

  constructor() {
    this.instance = axios.create({
      baseURL: process.env.NEXT_PUBLIC_API_ENDPOINT || '/api',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Request interceptor to add auth token
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
          console.log('No auth session available')
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

  async get<T = any>(url: string, config?: any): Promise<T> {
    return this.instance.get(url, config)
  }

  async post<T = any>(url: string, data?: any, config?: any): Promise<T> {
    return this.instance.post(url, data, config)
  }

  async put<T = any>(url: string, data?: any, config?: any): Promise<T> {
    return this.instance.put(url, data, config)
  }

  async delete<T = any>(url: string, config?: any): Promise<T> {
    return this.instance.delete(url, config)
  }

  async patch<T = any>(url: string, data?: any, config?: any): Promise<T> {
    return this.instance.patch(url, data, config)
  }
}

export const masterApi = new MasterApiService()