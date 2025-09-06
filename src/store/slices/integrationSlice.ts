import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export interface Integration {
  id: string
  name: string
  platform: string
  status: 'connected' | 'disconnected' | 'error'
  tier: 'critical' | 'important' | 'optional'
  lastSync?: string
  config?: Record<string, any>
}

interface IntegrationState {
  integrations: Integration[]
  isLoading: boolean
  error: string | null
}

const initialState: IntegrationState = {
  integrations: [],
  isLoading: false,
  error: null,
}

const integrationSlice = createSlice({
  name: 'integrations',
  initialState,
  reducers: {
    setIntegrations: (state, action: PayloadAction<Integration[]>) => {
      state.integrations = action.payload
    },
    updateIntegration: (state, action: PayloadAction<Integration>) => {
      const index = state.integrations.findIndex(i => i.id === action.payload.id)
      if (index !== -1) {
        state.integrations[index] = action.payload
      }
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload
    },
  },
})

export const {
  setIntegrations,
  updateIntegration,
  setLoading,
  setError,
} = integrationSlice.actions

export default integrationSlice.reducer