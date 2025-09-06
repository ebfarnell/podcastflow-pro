'use client'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Box,
  Card,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Divider,
} from '@mui/material'
import {
  Person as PersonIcon,
  Business as BusinessIcon,
  Security as SecurityIcon,
  Notifications as NotificationsIcon,
  Api as ApiIcon,
  Backup as BackupIcon,
  Email as EmailIcon,
  Folder as FolderIcon,
  ViewSidebar as ViewSidebarIcon,
  Description as DescriptionIcon,
  Receipt as ReceiptIcon,
  AccountTree as AccountTreeIcon,
} from '@mui/icons-material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { RouteProtection } from '@/components/auth/RouteProtection'
import { PERMISSIONS } from '@/types/auth'
import { ProfileSettings } from '@/components/settings/ProfileSettings'
import { OrganizationSettings } from '@/components/settings/OrganizationSettings'
import { EnhancedSecuritySettings } from '@/components/settings/EnhancedSecuritySettings'
import SecurityDashboard from '@/components/settings/SecurityDashboard'
import { NotificationSettings } from '@/components/settings/NotificationSettings'
import { ApiSettings } from '@/components/settings/ApiSettings'
import { BackupSettings } from '@/components/settings/BackupSettings'
import { MasterEmailSettings } from '@/components/settings/MasterEmailSettings'
import { OrganizationEmailSettings } from '@/components/settings/OrganizationEmailSettings'
import { EnhancedEmailSettings } from '@/components/settings/EnhancedEmailSettings'
import { UserEmailPreferences } from '@/components/settings/UserEmailPreferences'
import { FileManagerSettings } from '@/components/settings/FileManagerSettings'
import { SidebarCustomizationSettings } from '@/components/settings/SidebarCustomizationSettings'
import { ContractTemplateSettings } from '@/components/settings/ContractTemplateSettings'
import { BillingAutomationSettings } from '@/components/settings/BillingAutomationSettings'
import WorkflowAutomation from '@/components/settings/WorkflowAutomation'
import { useAuth } from '@/contexts/AuthContext'

interface SettingsSection {
  id: string
  title: string
  icon: React.ReactNode
  component: React.ReactNode
}

const settingsSections: SettingsSection[] = [
  {
    id: 'profile',
    title: 'Profile',
    icon: <PersonIcon />,
    component: <ProfileSettings />,
  },
  {
    id: 'organization',
    title: 'Organization',
    icon: <BusinessIcon />,
    component: <OrganizationSettings />,
  },
  {
    id: 'security',
    title: 'Security',
    icon: <SecurityIcon />,
    component: <EnhancedSecuritySettings />,
  },
  {
    id: 'security-dashboard',
    title: 'Security Dashboard',
    icon: <SecurityIcon />,
    component: <SecurityDashboard />,
  },
  {
    id: 'notifications',
    title: 'Notifications',
    icon: <NotificationsIcon />,
    component: <NotificationSettings />,
  },
  {
    id: 'billing-automation',
    title: 'Billing Automation',
    icon: <ReceiptIcon />,
    component: <BillingAutomationSettings />,
  },
  {
    id: 'contract-templates',
    title: 'Contract Templates',
    icon: <DescriptionIcon />,
    component: <ContractTemplateSettings />,
  },
  {
    id: 'workflow',
    title: 'Workflow Automation',
    icon: <AccountTreeIcon />,
    component: <WorkflowAutomation />,
  },
  {
    id: 'email',
    title: 'Email Settings',
    icon: <EmailIcon />,
    component: null, // Will be set dynamically based on user role
  },
  {
    id: 'api',
    title: 'API & Webhooks',
    icon: <ApiIcon />,
    component: <ApiSettings />,
  },
  {
    id: 'backup',
    title: 'Backup & Export',
    icon: <BackupIcon />,
    component: <BackupSettings />,
  },
  {
    id: 'files',
    title: 'File Manager',
    icon: <FolderIcon />,
    component: <FileManagerSettings />,
  },
  {
    id: 'sidebar',
    title: 'Sidebar Customization',
    icon: <ViewSidebarIcon />,
    component: <SidebarCustomizationSettings />,
  },
]

export default function SettingsPage() {
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const [activeSection, setActiveSection] = useState('profile')

  // Determine which email settings component to show based on role
  const getEmailSettingsComponent = () => {
    if (user?.role === 'master') {
      return <MasterEmailSettings />
    } else if (user?.role === 'admin') {
      // Use enhanced email settings for admin users
      return <EnhancedEmailSettings />
    } else {
      return <UserEmailPreferences />
    }
  }

  // Update settings sections based on user role
  const availableSettingsSections = settingsSections
    .filter(section => {
      // Contract templates, billing automation, and workflow only for admin/master
      if (section.id === 'contract-templates' || section.id === 'billing-automation' || section.id === 'workflow') {
        return user?.role === 'admin' || user?.role === 'master'
      }
      return true
    })
    .map(section => {
      if (section.id === 'email') {
        return {
          ...section,
          title: user?.role === 'master' ? 'Platform Email' : user?.role === 'admin' ? 'Email Settings' : 'Email Preferences',
          component: getEmailSettingsComponent()
        }
      }
      return section
    })

  useEffect(() => {
    // Check if there's a tab query parameter
    const tab = searchParams.get('tab')
    if (tab && availableSettingsSections.some(s => s.id === tab)) {
      setActiveSection(tab)
    }
  }, [searchParams, availableSettingsSections])

  const currentSection = availableSettingsSections.find(s => s.id === activeSection)

  return (
    <RouteProtection requiredPermission={PERMISSIONS.SETTINGS_VIEW}>
      <DashboardLayout>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ color: 'text.primary' }}>
          Settings
        </Typography>

        <Box sx={{ display: 'flex', gap: 3, mt: 3 }}>
          {/* Sidebar */}
          <Card sx={{ width: 280, flexShrink: 0 }}>
            <List disablePadding>
              {availableSettingsSections.map((section, index) => (
                <div key={section.id}>
                  <ListItem disablePadding>
                    <ListItemButton
                      selected={activeSection === section.id}
                      onClick={() => setActiveSection(section.id)}
                    >
                      <ListItemIcon>{section.icon}</ListItemIcon>
                      <ListItemText primary={section.title} />
                    </ListItemButton>
                  </ListItem>
                  {index < availableSettingsSections.length - 1 && <Divider />}
                </div>
              ))}
            </List>
          </Card>

          {/* Content */}
          <Box sx={{ flex: 1 }}>
            {currentSection?.component}
          </Box>
        </Box>
      </Box>
    </DashboardLayout>
    </RouteProtection>
  )
}