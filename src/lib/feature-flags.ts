// Feature flags for gradual rollout and A/B testing
export const FEATURE_FLAGS = {
  POST_SALE_MIGRATION: 'post_sale_migration',
} as const

export type FeatureFlag = typeof FEATURE_FLAGS[keyof typeof FEATURE_FLAGS]

// Feature flag configuration
// This could be moved to database or environment variables for dynamic control
const featureFlagConfig: Record<FeatureFlag, {
  enabled: boolean
  enabledForRoles?: string[]
  enabledForUsers?: string[]
  rolloutPercentage?: number
}> = {
  [FEATURE_FLAGS.POST_SALE_MIGRATION]: {
    enabled: true,
    enabledForRoles: ['master', 'admin', 'sales'], // Initially enabled for admin users
    rolloutPercentage: 100, // 100% rollout for enabled roles
  },
}

export function isFeatureEnabled(
  flag: FeatureFlag,
  userRole?: string,
  userId?: string
): boolean {
  const config = featureFlagConfig[flag]
  
  if (!config || !config.enabled) {
    return false
  }

  // Check role-based access
  if (config.enabledForRoles && userRole) {
    if (!config.enabledForRoles.includes(userRole)) {
      return false
    }
  }

  // Check user-specific access
  if (config.enabledForUsers && userId) {
    if (!config.enabledForUsers.includes(userId)) {
      return false
    }
  }

  // Check rollout percentage (simple hash-based approach)
  if (config.rolloutPercentage !== undefined && config.rolloutPercentage < 100) {
    if (!userId) return false
    
    // Simple hash function to determine if user is in rollout
    const hash = userId.split('').reduce((acc, char) => {
      return acc + char.charCodeAt(0)
    }, 0)
    
    const userPercentage = hash % 100
    return userPercentage < config.rolloutPercentage
  }

  return true
}

// Helper to check if old pages should show migration notice
export function shouldShowMigrationNotice(
  userRole?: string,
  userId?: string
): boolean {
  return isFeatureEnabled(FEATURE_FLAGS.POST_SALE_MIGRATION, userRole, userId)
}

// Helper to check if old pages should redirect
export function shouldRedirectToPostSale(
  userRole?: string,
  userId?: string
): boolean {
  // For now, we don't auto-redirect, just show notices
  // This can be changed later for forced migration
  return false
}