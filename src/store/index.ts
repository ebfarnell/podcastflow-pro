import { configureStore } from '@reduxjs/toolkit'
import authReducer from './slices/authSlice'
import campaignReducer from './slices/campaignSlice'
import integrationReducer from './slices/integrationSlice'
import notificationReducer from './slices/notificationSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    campaigns: campaignReducer,
    integrations: integrationReducer,
    notifications: notificationReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch