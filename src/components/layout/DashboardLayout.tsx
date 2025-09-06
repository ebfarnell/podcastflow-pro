'use client'

import React, { ReactNode, useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  AppBar,
  Box,
  CssBaseline,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  Collapse,
  ListSubheader,
  Button,
} from '@mui/material'
import {
  Menu as MenuIcon,
  Dashboard,
  Campaign,
  Analytics,
  IntegrationInstructions,
  Settings,
  Logout,
  Person,
  Business,
  Groups,
  Store,
  Podcasts,
  PlayCircle,
  CalendarMonth,
  EventAvailable,
  CheckCircle,
  Article,
  Description,
  Assessment,
  AccountBalance,
  ExpandLess,
  ExpandMore,
  Backup,
  PhotoLibrary,
  Speed,
  DeleteSweep,
  Assignment,
  Security,
  LockOpen,
  Visibility,
  ShoppingCart,
  Gavel,
  PictureAsPdf,
  TrendingUp,
  MonetizationOn,
  AdminPanelSettings,
  Mic,
  AttachMoney,
  ManageAccounts,
  VideoLibrary,
  BarChart,
  Folder,
  Schedule,
  Inventory,
  EventNote,
  ContentPaste,
  Sell,
  LocalShipping,
  Email,
  Circle,
} from '@mui/icons-material'
import { useAuth } from '@/contexts/AuthContext'
import { useOrganization } from '@/contexts/OrganizationContext'
import { MiniPlayer } from '@/components/audio/MiniPlayer'
import { useAudio } from '@/contexts/AudioContext'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { PERMISSIONS } from '@/types/auth'
import { PersistentSidebar } from './PersistentSidebar'
import { useSidebarStoreHook, useInitializeSidebar } from '@/hooks/useSidebarStore'
import * as MuiIcons from '@mui/icons-material'
import { isFeatureEnabled, FEATURE_FLAGS } from '@/lib/feature-flags'

const drawerWidth = 280

export type MenuItem = {
  text?: string
  icon?: ReactNode
  href?: string
  divider?: boolean
  permission?: string
  permissions?: string[]
  requiresAll?: boolean
  children?: MenuItem[]
  section?: string
}

export const getMenuStructure = (userRole: string, userId?: string): MenuItem[] => {
  // Base menu for all authenticated users
  const baseMenu: MenuItem[] = [
    { text: 'Dashboard', icon: <Dashboard />, href: '/dashboard', permission: PERMISSIONS.DASHBOARD_VIEW },
  ]
  
  // Check if Post-Sale Management should be shown
  const showPostSaleManagement = isFeatureEnabled(FEATURE_FLAGS.POST_SALE_MIGRATION, userRole, userId)

  // Master admin menu
  if (userRole === 'master') {
    return [
      ...baseMenu,
      { divider: true },
      {
        section: 'Platform Management',
        icon: <AdminPanelSettings />,
        children: [
          { text: 'Platform Overview', icon: <Dashboard />, href: '/master', permission: PERMISSIONS.MASTER_VIEW_ALL },
          { text: 'Organizations', icon: <Business />, href: '/master/organizations', permission: PERMISSIONS.MASTER_MANAGE_ORGS },
          { text: 'Global Users', icon: <Groups />, href: '/master/users', permission: PERMISSIONS.MASTER_VIEW_ALL },
          { text: 'Platform Settings', icon: <Settings />, href: '/master/settings', permission: PERMISSIONS.MASTER_FEATURES },
          { text: 'Global Analytics', icon: <Analytics />, href: '/master/analytics', permission: PERMISSIONS.MASTER_VIEW_ALL },
          { text: 'System Monitoring', icon: <Speed />, href: '/monitoring', permission: PERMISSIONS.MASTER_VIEW_ALL },
          { text: 'View as Organization', icon: <Visibility />, href: '/master/impersonate-standalone', permission: PERMISSIONS.MASTER_IMPERSONATE },
        ]
      },
      { divider: true },
      {
        section: 'Finance & Reports',
        icon: <AccountBalance />,
        children: [
          { text: 'Master Billing', icon: <MonetizationOn />, href: '/master/billing', permission: PERMISSIONS.MASTER_VIEW_ALL },
          { text: 'Performance Analytics Center', icon: <Analytics />, href: '/analytics', permission: PERMISSIONS.DASHBOARD_ANALYTICS },
          { text: 'Reports', icon: <Assessment />, href: '/reports', permission: PERMISSIONS.REPORTS_VIEW },
        ]
      },
      {
        section: 'System & Tools',
        icon: <Settings />,
        children: [
          { text: 'Activity Feed', icon: <Description />, href: '/activities', permission: PERMISSIONS.DASHBOARD_VIEW },
          { text: 'Integrations', icon: <IntegrationInstructions />, href: '/integrations', permission: PERMISSIONS.DASHBOARD_VIEW },
          { text: 'Backup & Restore', icon: <Backup />, href: '/backups', permission: PERMISSIONS.SETTINGS_ADMIN },
          { text: 'Settings', icon: <Settings />, href: '/settings', permission: PERMISSIONS.SETTINGS_VIEW },
        ]
      }
    ]
  }

  // Admin menu
  if (userRole === 'admin') {
    return [
      ...baseMenu,
      { divider: true },
      {
        section: 'CRM',
        icon: <Business />,
        children: [
          { text: 'Pipeline', icon: <Assessment />, href: '/pipeline', permission: PERMISSIONS.CAMPAIGNS_VIEW },
          { text: 'Advertisers', icon: <Store />, href: '/advertisers', permission: PERMISSIONS.ADVERTISERS_VIEW },
          { text: 'Agencies', icon: <Business />, href: '/agencies', permission: PERMISSIONS.AGENCIES_VIEW },
        ]
      },
      {
        section: 'Sales & Campaigns',
        icon: <AttachMoney />,
        children: [
          { text: 'Pre-Sale Management', icon: <Sell />, href: '/presale', permission: PERMISSIONS.CAMPAIGNS_VIEW },
          ...(showPostSaleManagement ? [
            { text: 'Post-Sale Management', icon: <LocalShipping />, href: '/post-sale', permission: PERMISSIONS.CAMPAIGNS_VIEW }
          ] : [
            { text: 'Creative Library', icon: <PhotoLibrary />, href: '/creatives', permission: PERMISSIONS.CAMPAIGNS_VIEW },
            { text: 'Orders', icon: <ShoppingCart />, href: '/orders', permission: PERMISSIONS.ORDERS_VIEW },
            { text: 'Contracts & IOs', icon: <Gavel />, href: '/contracts', permission: PERMISSIONS.CONTRACTS_VIEW },
            { text: 'Ad Approvals', icon: <CheckCircle />, href: '/ad-approvals', permission: PERMISSIONS.APPROVALS_VIEW },
          ]),
        ]
      },
      {
        section: 'Content Management',
        icon: <Podcasts />,
        children: [
          { text: 'Shows', icon: <Podcasts />, href: '/shows', permission: PERMISSIONS.SHOWS_VIEW },
          { text: 'Episodes', icon: <PlayCircle />, href: '/episodes', permission: PERMISSIONS.EPISODES_VIEW },
        ]
      },
      {
        section: 'Finance & Analytics',
        icon: <BarChart />,
        children: [
          { text: 'Financial Management Hub', icon: <AccountBalance />, href: '/financials', permission: PERMISSIONS.BILLING_VIEW },
          { text: 'Strategic Budget Planning', icon: <TrendingUp />, href: '/budget', permission: PERMISSIONS.BUDGET_VIEW },
          { text: 'Performance Analytics Center', icon: <Analytics />, href: '/analytics', permission: PERMISSIONS.DASHBOARD_ANALYTICS },
          { text: 'Reports', icon: <Assessment />, href: '/reports', permission: PERMISSIONS.REPORTS_VIEW },
        ]
      },
      {
        section: 'Administration',
        icon: <ManageAccounts />,
        children: [
          { text: 'Pending Approvals', icon: <CheckCircle />, href: '/admin/approvals', permission: PERMISSIONS.APPROVALS_VIEW },
          { text: 'User Management', icon: <Groups />, href: '/admin/users', permission: PERMISSIONS.USERS_VIEW },
          { text: 'Role Permissions', icon: <Security />, href: '/admin/permissions', permission: PERMISSIONS.SETTINGS_ADMIN },
          { text: 'Email Analytics', icon: <Email />, href: '/admin/email-analytics', permission: PERMISSIONS.ANALYTICS_VIEW },
        ]
      },
      { divider: true },
      { text: 'Calendar', icon: <CalendarMonth />, href: '/calendar', permissions: [PERMISSIONS.CAMPAIGNS_SCHEDULE, PERMISSIONS.ORDERS_SCHEDULE], requiresAll: false },
      { text: 'Integrations', icon: <IntegrationInstructions />, href: '/integrations', permission: PERMISSIONS.DASHBOARD_VIEW },
      { text: 'Settings', icon: <Settings />, href: '/settings', permission: PERMISSIONS.SETTINGS_VIEW },
    ]
  }

  // Sales menu
  if (userRole === 'sales') {
    return [
      ...baseMenu,
      { divider: true },
      {
        section: 'CRM',
        icon: <Business />,
        children: [
          { text: 'Pipeline', icon: <Assessment />, href: '/pipeline', permission: PERMISSIONS.CAMPAIGNS_VIEW },
          { text: 'Advertisers', icon: <Store />, href: '/advertisers', permission: PERMISSIONS.ADVERTISERS_VIEW },
          { text: 'Agencies', icon: <Business />, href: '/agencies', permission: PERMISSIONS.AGENCIES_VIEW },
        ]
      },
      {
        section: 'Sales Management',
        icon: <AttachMoney />,
        children: [
          { text: 'Pre-Sale Management', icon: <Sell />, href: '/presale', permission: PERMISSIONS.CAMPAIGNS_VIEW },
          ...(showPostSaleManagement ? [
            { text: 'Post-Sale Management', icon: <LocalShipping />, href: '/post-sale', permission: PERMISSIONS.CAMPAIGNS_VIEW }
          ] : [
            { text: 'Creative Library', icon: <PhotoLibrary />, href: '/creatives', permission: PERMISSIONS.CAMPAIGNS_VIEW },
            { text: 'Orders', icon: <ShoppingCart />, href: '/orders', permission: PERMISSIONS.ORDERS_VIEW },
            { text: 'Contracts & IOs', icon: <Gavel />, href: '/contracts', permission: PERMISSIONS.CONTRACTS_VIEW },
          ]),
        ]
      },
      {
        section: 'Content',
        icon: <VideoLibrary />,
        children: [
          { text: 'Shows', icon: <Podcasts />, href: '/shows', permission: PERMISSIONS.SHOWS_VIEW },
          { text: 'Episodes', icon: <PlayCircle />, href: '/episodes', permission: PERMISSIONS.EPISODES_VIEW },
        ]
      },
      { divider: true },
      ...(showPostSaleManagement ? [] : [{ text: 'Ad Approvals', icon: <CheckCircle />, href: '/ad-approvals', permission: PERMISSIONS.APPROVALS_VIEW }]),
      { text: 'Billing', icon: <AccountBalance />, href: '/seller/billing', permission: PERMISSIONS.BILLING_VIEW },
      { text: 'Reports', icon: <Assessment />, href: '/reports', permission: PERMISSIONS.REPORTS_VIEW },
      { text: 'Calendar', icon: <CalendarMonth />, href: '/calendar', permissions: [PERMISSIONS.CAMPAIGNS_SCHEDULE, PERMISSIONS.ORDERS_SCHEDULE], requiresAll: false },
    ]
  }

  // Producer menu
  if (userRole === 'producer') {
    return [
      ...baseMenu,
      { text: 'Production Tasks', icon: <Assignment />, href: '/producer/dashboard', permission: PERMISSIONS.EPISODES_CREATE },
      { divider: true },
      {
        section: 'My Production',
        icon: <Mic />,
        children: [
          { text: 'My Shows', icon: <Podcasts />, href: '/producer/shows', permissions: [PERMISSIONS.SHOWS_VIEW, PERMISSIONS.EPISODES_CREATE], requiresAll: true },
          { text: 'My Episodes', icon: <PlayCircle />, href: '/producer/episodes', permission: PERMISSIONS.EPISODES_CREATE },
        ]
      },
      { divider: true },
      { text: 'Ad Approvals', icon: <CheckCircle />, href: '/ad-approvals', permission: PERMISSIONS.APPROVALS_VIEW },
      { text: 'Calendar', icon: <CalendarMonth />, href: '/calendar', permission: PERMISSIONS.EPISODES_CREATE },
    ]
  }

  // Talent menu
  if (userRole === 'talent') {
    return [
      ...baseMenu,
      { text: 'Recording Tasks', icon: <Assignment />, href: '/talent/dashboard', permission: PERMISSIONS.EPISODES_TALENT_MANAGE },
      { divider: true },
      {
        section: 'My Work',
        icon: <Mic />,
        children: [
          { text: 'My Episodes', icon: <PlayCircle />, href: '/talent/episodes', permission: PERMISSIONS.EPISODES_TALENT_MANAGE },
          { text: 'Recordings', icon: <Podcasts />, href: '/talent/recordings', permission: PERMISSIONS.EPISODES_TALENT_MANAGE },
          { text: 'Schedule', icon: <CalendarMonth />, href: '/talent/schedule', permission: PERMISSIONS.EPISODES_TALENT_MANAGE },
        ]
      },
      { divider: true },
      { text: 'Availability', icon: <EventAvailable />, href: '/availability', permission: PERMISSIONS.EPISODES_TALENT_MANAGE },
    ]
  }

  // Client menu
  if (userRole === 'client') {
    return [
      ...baseMenu,
      { divider: true },
      {
        section: 'My Advertising',
        icon: <Campaign />,
        children: [
          { text: 'My Campaigns', icon: <Campaign />, href: '/client/campaigns', permission: PERMISSIONS.CAMPAIGNS_VIEW },
          { text: 'My Orders', icon: <ShoppingCart />, href: '/client/orders', permission: PERMISSIONS.ORDERS_VIEW },
          { text: 'My Contracts', icon: <Gavel />, href: '/client/contracts', permission: PERMISSIONS.CONTRACTS_VIEW },
        ]
      },
      { divider: true },
      { text: 'My Reports', icon: <Assessment />, href: '/client/reports', permission: PERMISSIONS.REPORTS_VIEW },
      { text: 'Billing', icon: <AccountBalance />, href: '/client/billing', permission: PERMISSIONS.BILLING_VIEW },
    ]
  }

  // Default fallback
  return baseMenu
}

interface DashboardLayoutProps {
  children: ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  // All hooks must be called at the top level, before any conditional logic
  const router = useRouter()
  const { user, logout, isLoading, hasPermission, hasAnyPermission, hasAllPermissions } = useAuth()
  const { currentOrganization, isLoading: orgLoading } = useOrganization()
  const { currentTrack, stop } = useAudio()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [impersonationData, setImpersonationData] = useState<any>(null)
  const { 
    toggleSection, 
    isSectionExpanded, 
    scrollPosition, 
    updateScrollPosition,
    isInitialized: sidebarInitialized,
    menuStructure,
    customMenuStructure
  } = useSidebarStoreHook()
  
  const { initializeFromUser, handleLogout: clearSidebarSession } = useInitializeSidebar()
  
  // Define the handleSectionClick callback using useCallback BEFORE any conditions
  const handleSectionClick = useCallback((section: string) => {
    toggleSection(section)
  }, [toggleSection])

  // Check for impersonation on mount
  useEffect(() => {
    const data = sessionStorage.getItem('impersonation')
    if (data) {
      try {
        setImpersonationData(JSON.parse(data))
      } catch (e) {
        console.error('Failed to parse impersonation data:', e)
      }
    }
  }, [])

  // Initialize sidebar with user's customization on login
  useEffect(() => {
    if (user && !sidebarInitialized) {
      const defaultMenuStructure = getMenuStructure(user.role, user.id)
      initializeFromUser(user, defaultMenuStructure)
    }
  }, [user, sidebarInitialized, initializeFromUser])
  
  // Define all handler functions BEFORE early returns
  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen)
  }

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleProfileMenuClose = () => {
    setAnchorEl(null)
  }

  const handleLogout = async () => {
    clearSidebarSession() // Clear Zustand sidebar state
    await logout()
    handleProfileMenuClose()
  }

  const handleExitImpersonation = async () => {
    // Clear impersonation data
    sessionStorage.removeItem('impersonation')
    // Clear sidebar session state
    clearSidebarSession()
    // Logout current session and redirect to master login
    await logout()
    router.push('/login')
  }
  
  const filterMenuItems = (items: MenuItem[]): MenuItem[] => {
    return items.filter(item => {
      // Always include dividers and sections
      if (item.divider || item.section) return true
      
      // Check single permission
      if (item.permission) {
        return hasPermission(item.permission)
      }
      
      // Check multiple permissions
      if (item.permissions) {
        if (item.requiresAll) {
          return hasAllPermissions(item.permissions)
        } else {
          return hasAnyPermission(item.permissions)
        }
      }
      
      // If no permission specified, show by default
      return true
    }).map(item => {
      // Recursively filter children
      if (item.children) {
        return {
          ...item,
          children: filterMenuItems(item.children)
        }
      }
      return item
    })
  }
  
  // Define renderMenuItem before early returns to avoid hook issues
  const renderMenuItem = useCallback((item: MenuItem, index: number, depth: number = 0): React.ReactNode => {
    if (item.divider) {
      return <Divider key={`divider-${index}`} sx={{ my: 1 }} />
    }

    if (item.section && item.children) {
      const sectionKey = item.section
      const isOpen = isSectionExpanded(sectionKey)
      const hasVisibleChildren = item.children.some(child => !child.divider)
      
      if (!hasVisibleChildren) return null

      return (
        <Box key={`section-${sectionKey}`}>
          <ListItemButton 
            onClick={(e) => {
              e.stopPropagation()
              handleSectionClick(sectionKey)
            }} 
            sx={{ pl: depth * 2 + 2 }}>
            <ListItemIcon sx={{ minWidth: 40 }}>
              {item.icon}
            </ListItemIcon>
            <ListItemText 
              primary={item.section}
              primaryTypographyProps={{
                fontSize: '0.875rem',
                fontWeight: 'medium',
                color: 'text.secondary',
              }}
            />
            {isOpen ? <ExpandLess /> : <ExpandMore />}
          </ListItemButton>
          <Collapse in={isOpen} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {item.children.map((child, childIndex) => renderMenuItem(child, childIndex, depth + 1))}
            </List>
          </Collapse>
        </Box>
      )
    }

    if (item.text && item.href) {
      return (
        <ListItem key={item.text} disablePadding>
          <ListItemButton 
            component={Link} 
            href={item.href}
            sx={{
              pl: depth * 2 + 2,
              '&:hover': {
                bgcolor: 'action.hover',
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
            <ListItemText 
              primary={item.text} 
              primaryTypographyProps={{
                fontSize: '0.875rem',
                color: 'text.primary',
              }}
            />
          </ListItemButton>
        </ListItem>
      )
    }

    return null
  }, [isSectionExpanded, handleSectionClick])

  // Show loading spinner while authentication or organization is being checked
  if (isLoading || orgLoading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh',
        flexDirection: 'column',
        gap: 2
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{
            width: 40,
            height: 40,
            border: '4px solid #e3f2fd',
            borderTop: '4px solid #2196f3',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            '@keyframes spin': {
              '0%': { transform: 'rotate(0deg)' },
              '100%': { transform: 'rotate(360deg)' }
            }
          }} />
          <Typography variant="h6" color="text.secondary">
            Loading PodcastFlow Pro...
          </Typography>
        </Box>
      </Box>
    )
  }

  // Only redirect to login if not loading and no user
  if (!isLoading && !user) {
    // Check if we're on the impersonate page - don't redirect yet
    if (typeof window !== 'undefined' && window.location.pathname.includes('impersonate')) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          <Typography>Loading...</Typography>
        </Box>
      )
    }
    
    // TEMPORARY: Check for debug flag to prevent redirect
    if (typeof window !== 'undefined' && (window as any).DISABLE_AUTH_REDIRECT) {
      console.error('🛑 DashboardLayout: Redirect disabled for debugging')
      // Continue rendering without user - for debugging only
    } else if (typeof window !== 'undefined' && window.location.pathname.includes('/episodes/')) {
      console.error('🛑 DashboardLayout: Skipping redirect for episode page debugging')
      // Continue rendering without user - for debugging only
    } else {
      router.push('/login')
      return null
    }
  }

  // TEMPORARY: Allow rendering without user for debugging
  // if (!user) {
  //   return null
  // }

  // Get menu structure after ensuring user exists
  // TEMPORARY: Use fallback for debugging when user is null
  const userRole = user?.role || 'client'
  const userId = user?.id || 'debug'
  const currentMenuStructure = menuStructure || getMenuStructure(userRole, userId)
  const filteredMenu = filterMenuItems(currentMenuStructure)


  const drawer = (
    <PersistentSidebar>
      <Toolbar sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 2, minHeight: 80 }}>
        <Box
          component="img"
          sx={{
            height: 45,
            width: 'auto',
            display: 'block',
          }}
          src="/images/logos/logo-icon-only.png"
          alt="PodcastFlow Pro"
        />
      </Toolbar>
      <Divider sx={{ mt: 0 }} />
      <List
        className="sidebar-scroll-list"
        sx={{
          width: '100%',
          maxWidth: 360,
          bgcolor: 'background.paper',
          overflowY: 'auto',
          maxHeight: 'calc(100vh - 80px)',
        }}
      >
        {filteredMenu.map((item, index) => renderMenuItem(item, index))}
      </List>
    </PersistentSidebar>
  )

  return (
    <Box sx={{ display: 'flex', backgroundColor: 'transparent', minHeight: '100vh' }}>
      <CssBaseline />
      {/* Impersonation Banner */}
      {impersonationData && impersonationData.isImpersonating && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bgcolor: 'warning.main',
            color: 'warning.contrastText',
            py: 1,
            px: 2,
            zIndex: 1300,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
            Impersonating: {impersonationData.impersonatingUser?.name || impersonationData.impersonatingUser?.email || 'User'}
          </Typography>
          <Button
            size="small"
            variant="contained"
            color="inherit"
            onClick={handleExitImpersonation}
            sx={{
              bgcolor: 'rgba(0,0,0,0.2)',
              '&:hover': { bgcolor: 'rgba(0,0,0,0.3)' }
            }}
          >
            Exit Impersonation
          </Button>
        </Box>
      )}
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(10px)',
          color: 'text.primary',
          top: impersonationData?.isImpersonating ? '40px' : 0,
        }}
      >
        <Toolbar>
          <IconButton
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' }, color: 'text.primary' }}
          >
            <MenuIcon />
          </IconButton>
          <Box sx={{ flexGrow: 1 }} />
          <Box sx={{ '& .MuiIconButton-root': { color: 'text.primary' } }}>
            <NotificationBell />
          </Box>
          <IconButton onClick={handleProfileMenuOpen} sx={{ p: 0, ml: 2 }}>
            <Avatar sx={{ bgcolor: 'secondary.main', color: 'white' }}>
              {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
            </Avatar>
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleProfileMenuClose}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
          >
            <MenuItem onClick={() => router.push('/profile')}>
              <ListItemIcon>
                <Person fontSize="small" />
              </ListItemIcon>
              <Box>
                <Typography variant="body2">
                  {user?.name || user?.email || 'Guest'}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
                  {user?.role || 'guest'}
                </Typography>
              </Box>
            </MenuItem>
            {currentOrganization && (
              <MenuItem onClick={() => router.push('/settings')}>
                <ListItemIcon>
                  <Business fontSize="small" />
                </ListItemIcon>
                <Box>
                  <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                    {currentOrganization.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Enterprise plan
                  </Typography>
                </Box>
              </MenuItem>
            )}
            <Divider />
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <Logout fontSize="small" />
              </ListItemIcon>
              Logout
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { 
              boxSizing: 'border-box', 
              width: drawerWidth,
              top: impersonationData?.isImpersonating ? '40px' : 0,
              overflow: 'visible',
            },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { 
              boxSizing: 'border-box', 
              width: drawerWidth,
              top: impersonationData?.isImpersonating ? '40px' : 0,
              height: impersonationData?.isImpersonating ? 'calc(100% - 40px)' : '100%',
              overflow: 'visible',
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{ 
          flexGrow: 1, 
          p: 3, 
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          mt: impersonationData?.isImpersonating ? 12 : 8
        }}
      >
        {children}
        {currentTrack && <MiniPlayer />}
      </Box>
    </Box>
  )
}