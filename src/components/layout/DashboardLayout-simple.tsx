'use client'

import { ReactNode } from 'react'
import { Box } from '@mui/material'
import { DashboardLayout as FullDashboardLayout } from '@/components/layout/DashboardLayout'

interface DashboardLayoutProps {
  children: ReactNode
}

export function DashboardLayoutSimple({ children }: DashboardLayoutProps) {
  // Always use the full DashboardLayout
  return <FullDashboardLayout>{children}</FullDashboardLayout>
}