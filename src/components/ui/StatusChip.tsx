import { Chip, ChipProps } from '@mui/material'
import { getCampaignStatusColor, getCampaignStatusTheme } from '@/lib/theme/colors'

interface StatusChipProps extends Omit<ChipProps, 'color'> {
  status: string
  type?: 'campaign' | 'show' | 'order' | 'invoice'
}

/**
 * Unified Status Chip component that uses centralized colors
 * Ensures consistent status display across the application
 */
export function StatusChip({ status, type = 'campaign', size = 'small', ...props }: StatusChipProps) {
  const normalizedStatus = status.toLowerCase()
  
  // Get appropriate color based on type
  const getColor = () => {
    switch (type) {
      case 'campaign':
        return getCampaignStatusColor(normalizedStatus)
      case 'show':
        // Shows often use same statuses as campaigns
        return getCampaignStatusColor(normalizedStatus)
      case 'order':
      case 'invoice':
        // These might have different status sets
        // For now, use campaign colors as default
        return getCampaignStatusColor(normalizedStatus)
      default:
        return getCampaignStatusColor(normalizedStatus)
    }
  }
  
  const color = getColor()
  
  return (
    <Chip
      label={status.charAt(0).toUpperCase() + status.slice(1)}
      size={size}
      sx={{
        backgroundColor: `${color}20`,
        color: color,
        borderColor: color,
        fontWeight: 500,
        ...props.sx
      }}
      {...props}
    />
  )
}

// Export a helper function for getting MUI chip color props
export function getMuiChipColor(status: string): ChipProps['color'] {
  const normalizedStatus = status.toLowerCase()
  
  // Map to MUI chip colors for backward compatibility
  switch (normalizedStatus) {
    case 'active':
    case 'completed':
      return 'success'
    case 'paused':
    case 'pending':
      return 'warning'
    case 'draft':
      return 'info'
    case 'cancelled':
    case 'lost':
      return 'error'
    default:
      return 'default'
  }
}