import { SvgIcon, SvgIconProps } from '@mui/material'

// QuickBooks logo icon - accurate "qb" design from official logo
export function QuickBooksIcon(props: SvgIconProps) {
  // Override the sx prop to ensure square aspect ratio
  const { sx, ...otherProps } = props
  return (
    <SvgIcon 
      {...otherProps} 
      viewBox="0 0 100 100"
      sx={{
        ...sx,
        // Ensure square aspect ratio to prevent skewing
        width: sx?.fontSize || 40,
        height: sx?.fontSize || 40,
      }}
    >
      {/* QuickBooks green circular background */}
      <circle cx="50" cy="50" r="48" fill="#2CA01C"/>
      {/* Stylized "qb" letters design - properly scaled for 100x100 viewBox */}
      <g fill="white">
        {/* Left 'q' shape */}
        <path d="M38 28C30 28 24 34 24 42v12c0 8 6 14 14 14h6v-10h-6c-3 0-6-3-6-6v-12c0-3 3-6 6-6h6V28h-6z"/>
        {/* Center vertical bar */}
        <rect x="44" y="20" width="8" height="56"/>
        {/* Right 'b' shape */}
        <path d="M52 28v6h6c3 0 6 3 6 6v12c0 3-3 6-6 6h-6v10h6c8 0 14-6 14-14v-12c0-8-6-14-14-14h-6z"/>
      </g>
    </SvgIcon>
  )
}

// Megaphone logo icon - three vertical bars like sound waves
export function MegaphoneIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      {/* Megaphone's distinctive three-bar logo */}
      <g fill="#8B7FD8">
        {/* Left bar - shortest */}
        <rect x="4" y="10" width="4" height="4" rx="2"/>
        {/* Center bar - medium */}
        <rect x="10" y="8" width="4" height="8" rx="2"/>
        {/* Right bar - tallest */}
        <rect x="16" y="6" width="4" height="12" rx="2"/>
      </g>
    </SvgIcon>
  )
}

