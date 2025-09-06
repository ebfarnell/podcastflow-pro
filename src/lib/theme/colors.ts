/**
 * Centralized color theme for PodcastFlow Pro
 * All colors used throughout the application should be defined here
 */

// Campaign Status Colors
export const CAMPAIGN_STATUS_COLORS = {
  active: '#ff6b35',      // Orange from logo
  scheduled: '#2196f3',   // Blue
  paused: '#ff9800',      // Orange
  draft: '#1a237e',       // Navy blue
  completed: '#2e7d32',   // Forest green
  lost: '#b71c1c',        // Darker red
  cancelled: '#757575',   // Gray
  archived: '#f9a825',    // Yellow/amber
} as const

// Type-safe color getter with fallback
export const getCampaignStatusColor = (status: string): string => {
  const normalizedStatus = status.toLowerCase()
  return CAMPAIGN_STATUS_COLORS[normalizedStatus as keyof typeof CAMPAIGN_STATUS_COLORS] || '#9e9e9e'
}

// Brand Colors
export const BRAND_COLORS = {
  primary: '#ff6b35',     // Orange from logo
  secondary: '#1a237e',   // Navy blue
  accent: '#f9a825',      // Yellow/amber
  success: '#2e7d32',     // Forest green
  error: '#b71c1c',       // Darker red
  warning: '#ff9800',     // Orange
  info: '#2196f3',        // Blue
  neutral: '#757575',     // Gray
} as const

// Role Colors (existing)
export const ROLE_COLORS = {
  master: '#000000',      // Black
  admin: '#f44336',       // Red
  sales: '#4caf50',       // Green
  producer: '#ffeb3b',    // Yellow
  talent: '#9c27b0',      // Purple
  client: '#2196f3',      // Blue
} as const

// Chart Colors (for other charts)
export const CHART_COLORS = {
  primary: BRAND_COLORS.primary,
  secondary: BRAND_COLORS.secondary,
  tertiary: BRAND_COLORS.accent,
  quaternary: BRAND_COLORS.info,
  quinary: BRAND_COLORS.success,
  senary: BRAND_COLORS.warning,
  // Additional chart colors
  series: [
    '#ff6b35', // Orange
    '#1a237e', // Navy
    '#2e7d32', // Forest green
    '#f9a825', // Yellow
    '#2196f3', // Blue
    '#b71c1c', // Dark red
    '#757575', // Gray
    '#9c27b0', // Purple
  ]
} as const

// Semantic Colors
export const SEMANTIC_COLORS = {
  // Status indicators
  success: BRAND_COLORS.success,
  error: BRAND_COLORS.error,
  warning: BRAND_COLORS.warning,
  info: BRAND_COLORS.info,
  
  // UI Elements
  text: {
    primary: '#212121',
    secondary: '#757575',
    disabled: '#9e9e9e',
    inverse: '#ffffff',
  },
  
  background: {
    default: '#ffffff',
    paper: '#fafafa',
    dark: '#1a1a1a',
  },
  
  divider: '#e0e0e0',
  
  // Actions
  action: {
    active: BRAND_COLORS.primary,
    hover: '#ff8a65',
    selected: '#ffccbc',
    disabled: '#9e9e9e',
    disabledBackground: '#e0e0e0',
  }
} as const

// MUI Theme Color Overrides
export const getMuiThemeColors = () => ({
  primary: {
    main: BRAND_COLORS.primary,
    light: '#ff8a65',
    dark: '#d84315',
    contrastText: '#ffffff',
  },
  secondary: {
    main: BRAND_COLORS.secondary,
    light: '#534bae',
    dark: '#000051',
    contrastText: '#ffffff',
  },
  error: {
    main: BRAND_COLORS.error,
    light: '#ef5350',
    dark: '#c62828',
    contrastText: '#ffffff',
  },
  warning: {
    main: BRAND_COLORS.warning,
    light: '#ffb74d',
    dark: '#f57c00',
    contrastText: '#000000',
  },
  info: {
    main: BRAND_COLORS.info,
    light: '#64b5f6',
    dark: '#1976d2',
    contrastText: '#ffffff',
  },
  success: {
    main: BRAND_COLORS.success,
    light: '#66bb6a',
    dark: '#388e3c',
    contrastText: '#ffffff',
  },
  grey: {
    50: '#fafafa',
    100: '#f5f5f5',
    200: '#eeeeee',
    300: '#e0e0e0',
    400: '#bdbdbd',
    500: '#9e9e9e',
    600: '#757575',
    700: '#616161',
    800: '#424242',
    900: '#212121',
    A100: '#f5f5f5',
    A200: '#eeeeee',
    A400: '#bdbdbd',
    A700: '#616161',
  },
})

// Export a function to get all colors for a specific campaign status
export const getCampaignStatusTheme = (status: string) => {
  const color = getCampaignStatusColor(status)
  return {
    color,
    backgroundColor: `${color}20`, // 20% opacity for backgrounds
    borderColor: color,
  }
}

// Export all colors as a single object for convenience
export const COLORS = {
  campaign: CAMPAIGN_STATUS_COLORS,
  brand: BRAND_COLORS,
  role: ROLE_COLORS,
  chart: CHART_COLORS,
  semantic: SEMANTIC_COLORS,
} as const

export default COLORS