'use client'

import React from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { UserRole } from '@/types/auth'

// Feature configuration by role
const FEATURE_FLAGS: Record<string, UserRole[]> = {
  // Dashboard features
  'dashboard.analytics': ['admin', 'seller', 'producer'],
  'dashboard.revenue': ['admin', 'seller'],
  'dashboard.performance': ['admin', 'producer', 'talent'],
  
  // Campaign features
  'campaigns.create': ['admin', 'seller'],
  'campaigns.edit': ['admin', 'seller'],
  'campaigns.delete': ['admin', 'seller'],
  'campaigns.approve': ['admin'],
  
  // Show features
  'shows.create': ['admin'],
  'shows.edit': ['admin', 'producer'],
  'shows.delete': ['admin'],
  'shows.assign': ['admin'],
  
  // Episode features
  'episodes.create': ['admin', 'producer'],
  'episodes.edit': ['admin', 'producer'],
  'episodes.delete': ['admin', 'producer'],
  'episodes.publish': ['admin', 'producer'],
  
  // Billing features
  'billing.view': ['admin', 'seller', 'client'],
  'billing.export': ['admin', 'seller'],
  'billing.manage': ['admin'],
  
  // User management
  'users.manage': ['admin'],
  'users.invite': ['admin'],
  'users.roles': ['admin'],
  
  // Settings
  'settings.organization': ['admin'],
  'settings.integrations': ['admin', 'seller'],
  'settings.security': ['admin'],
  
  // Reports
  'reports.financial': ['admin', 'seller'],
  'reports.performance': ['admin', 'producer'],
  'reports.export': ['admin', 'seller', 'producer'],
}

interface FeatureFlagProps {
  feature: string
  children: React.ReactNode
  fallback?: React.ReactNode
  invert?: boolean
}

export default function FeatureFlag({
  feature,
  children,
  fallback = null,
  invert = false,
}: FeatureFlagProps) {
  const { user } = useAuth()
  
  if (!user) {
    return <>{fallback}</>
  }

  const allowedRoles = FEATURE_FLAGS[feature] || []
  const hasFeature = allowedRoles.includes(user.role)
  
  // If invert is true, show content when user doesn't have the feature
  const shouldShow = invert ? !hasFeature : hasFeature

  return <>{shouldShow ? children : fallback}</>
}

// Hook for programmatic feature checking
export function useFeatureFlag(feature: string): boolean {
  const { user } = useAuth()
  
  if (!user) return false
  
  const allowedRoles = FEATURE_FLAGS[feature] || []
  return allowedRoles.includes(user.role)
}

// Convenience components for common features
export function IfCanCreateCampaigns({ children }: { children: React.ReactNode }) {
  return <FeatureFlag feature="campaigns.create">{children}</FeatureFlag>
}

export function IfCanManageUsers({ children }: { children: React.ReactNode }) {
  return <FeatureFlag feature="users.manage">{children}</FeatureFlag>
}

export function IfCanViewBilling({ children }: { children: React.ReactNode }) {
  return <FeatureFlag feature="billing.view">{children}</FeatureFlag>
}

export function IfCanPublishEpisodes({ children }: { children: React.ReactNode }) {
  return <FeatureFlag feature="episodes.publish">{children}</FeatureFlag>
}