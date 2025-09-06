import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export interface Campaign {
  id: string
  name: string
  client: string
  advertiser?: string
  advertiserName?: string
  advertiserId?: string
  agency?: string
  description?: string
  status: 'draft' | 'active' | 'completed' | 'paused' | 'archived'
  startDate: string
  endDate: string
  budget: number
  spent: number
  impressions: number
  targetImpressions?: number
  clicks: number
  conversions: number
  industry?: string
  targetAudience?: string
  ctr?: number
  cpa?: number
  createdAt: string
  updatedAt: string
}

interface CampaignState {
  campaigns: Campaign[]
  activeCampaign: Campaign | null
  isLoading: boolean
  error: string | null
}

const initialState: CampaignState = {
  campaigns: [],
  activeCampaign: null,
  isLoading: false,
  error: null,
}

const campaignSlice = createSlice({
  name: 'campaigns',
  initialState,
  reducers: {
    setCampaigns: (state, action: PayloadAction<Campaign[]>) => {
      state.campaigns = action.payload
    },
    setActiveCampaign: (state, action: PayloadAction<Campaign | null>) => {
      state.activeCampaign = action.payload
    },
    addCampaign: (state, action: PayloadAction<Campaign>) => {
      state.campaigns.push(action.payload)
    },
    updateCampaign: (state, action: PayloadAction<Campaign>) => {
      const index = state.campaigns.findIndex(c => c.id === action.payload.id)
      if (index !== -1) {
        state.campaigns[index] = action.payload
      }
    },
    deleteCampaign: (state, action: PayloadAction<string>) => {
      state.campaigns = state.campaigns.filter(c => c.id !== action.payload)
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
  setCampaigns,
  setActiveCampaign,
  addCampaign,
  updateCampaign,
  deleteCampaign,
  setLoading,
  setError,
} = campaignSlice.actions

export default campaignSlice.reducer