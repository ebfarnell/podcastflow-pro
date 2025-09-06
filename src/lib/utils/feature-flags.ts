/**
 * Feature flag utilities for development and production
 */

/**
 * Check if mock data is enabled
 * @returns true if mock data should be used (development mode only)
 */
export function isMockDataEnabled(): boolean {
  return process.env.ENABLE_MOCK_DATA === 'true' && process.env.NODE_ENV === 'development'
}

/**
 * Check if debug pages are enabled
 * @returns true if debug pages should be accessible
 */
export function isDebugPagesEnabled(): boolean {
  return process.env.ENABLE_DEBUG_PAGES === 'true'
}

/**
 * Check if email notifications are enabled
 * @returns true if emails should be sent
 */
export function isEmailNotificationsEnabled(): boolean {
  return process.env.ENABLE_EMAIL_NOTIFICATIONS === 'true'
}

/**
 * Get the current environment
 * @returns 'development' | 'production' | 'test'
 */
export function getEnvironment(): 'development' | 'production' | 'test' {
  const env = process.env.NODE_ENV || 'development'
  if (env === 'test') return 'test'
  if (env === 'production') return 'production'
  return 'development'
}

/**
 * Check if running in production
 * @returns true if running in production environment
 */
export function isProduction(): boolean {
  return getEnvironment() === 'production'
}

/**
 * Check if running in development
 * @returns true if running in development environment
 */
export function isDevelopment(): boolean {
  return getEnvironment() === 'development'
}

/**
 * Check if running in test environment
 * @returns true if running in test environment
 */
export function isTest(): boolean {
  return getEnvironment() === 'test'
}