import { Box } from '@mui/material'
import { ResponsiveContainer } from 'recharts'
import { ReactNode } from 'react'

interface ChartContainerProps {
  height?: number
  children: ReactNode
  minHeight?: number
}

export function ChartContainer({ height = 300, minHeight, children }: ChartContainerProps) {
  return (
    <Box sx={{ 
      width: '100%', 
      height: height, 
      minHeight: minHeight || height,
      position: 'relative',
      overflow: 'visible'
    }}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </Box>
  )
}