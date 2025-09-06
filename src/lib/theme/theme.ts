import { createTheme } from '@mui/material/styles'
import { getMuiThemeColors, BRAND_COLORS, SEMANTIC_COLORS } from './colors'

// Create the MUI theme with our centralized colors
export const theme = createTheme({
  palette: {
    ...getMuiThemeColors(),
    mode: 'light',
    background: {
      default: SEMANTIC_COLORS.background.default,
      paper: SEMANTIC_COLORS.background.paper,
    },
    text: {
      primary: SEMANTIC_COLORS.text.primary,
      secondary: SEMANTIC_COLORS.text.secondary,
      disabled: SEMANTIC_COLORS.text.disabled,
    },
    divider: SEMANTIC_COLORS.divider,
    action: {
      active: SEMANTIC_COLORS.action.active,
      hover: SEMANTIC_COLORS.action.hover,
      selected: SEMANTIC_COLORS.action.selected,
      disabled: SEMANTIC_COLORS.action.disabled,
      disabledBackground: SEMANTIC_COLORS.action.disabledBackground,
    },
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
      '"Apple Color Emoji"',
      '"Segoe UI Emoji"',
      '"Segoe UI Symbol"',
    ].join(','),
    h1: {
      fontWeight: 600,
    },
    h2: {
      fontWeight: 600,
    },
    h3: {
      fontWeight: 600,
    },
    h4: {
      fontWeight: 600,
    },
    h5: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 600,
    },
    button: {
      textTransform: 'none',
      fontWeight: 500,
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '8px 16px',
        },
        containedPrimary: {
          backgroundColor: BRAND_COLORS.primary,
          '&:hover': {
            backgroundColor: '#ff8a65',
          },
        },
        containedSecondary: {
          backgroundColor: BRAND_COLORS.secondary,
          '&:hover': {
            backgroundColor: '#534bae',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          fontWeight: 500,
        },
        // Custom color variants for our status chips
        colorPrimary: {
          backgroundColor: `${BRAND_COLORS.primary}20`,
          color: BRAND_COLORS.primary,
          borderColor: BRAND_COLORS.primary,
        },
        colorSecondary: {
          backgroundColor: `${BRAND_COLORS.secondary}20`,
          color: BRAND_COLORS.secondary,
          borderColor: BRAND_COLORS.secondary,
        },
        colorError: {
          backgroundColor: `${BRAND_COLORS.error}20`,
          color: BRAND_COLORS.error,
          borderColor: BRAND_COLORS.error,
        },
        colorWarning: {
          backgroundColor: `${BRAND_COLORS.warning}20`,
          color: BRAND_COLORS.warning,
          borderColor: BRAND_COLORS.warning,
        },
        colorInfo: {
          backgroundColor: `${BRAND_COLORS.info}20`,
          color: BRAND_COLORS.info,
          borderColor: BRAND_COLORS.info,
        },
        colorSuccess: {
          backgroundColor: `${BRAND_COLORS.success}20`,
          color: BRAND_COLORS.success,
          borderColor: BRAND_COLORS.success,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
        elevation1: {
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: `1px solid ${SEMANTIC_COLORS.divider}`,
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: SEMANTIC_COLORS.divider,
        },
      },
    },
  },
})

// Dark theme variant
export const darkTheme = createTheme({
  ...theme,
  palette: {
    ...theme.palette,
    mode: 'dark',
    background: {
      default: '#121212',
      paper: '#1e1e1e',
    },
    text: {
      primary: SEMANTIC_COLORS.text.inverse,
      secondary: 'rgba(255, 255, 255, 0.7)',
      disabled: 'rgba(255, 255, 255, 0.5)',
    },
    divider: 'rgba(255, 255, 255, 0.12)',
  },
})

export default theme