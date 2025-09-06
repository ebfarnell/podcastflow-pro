'use client'

import { useEffect } from 'react'
import React from 'react'
import { useSidebarStore, type MenuItem, addIdsToMenuStructure } from '@/stores/sidebarStore'
import * as MuiIcons from '@mui/icons-material'
import { Folder, Circle } from '@mui/icons-material'

/**
 * Hook that provides sidebar state management with Zustand store
 * Replaces the old useSidebarState hook with global store integration
 */
export function useSidebarStoreHook() {
  const store = useSidebarStore()

  return {
    // State
    expandedSections: store.expandedSections,
    scrollPosition: store.scrollPosition,
    isInitialized: store.isInitialized,
    isLoading: store.isLoading,
    menuStructure: store.menuStructure,
    customMenuStructure: store.customMenuStructure,
    
    // Actions
    toggleSection: store.toggleSection,
    updateScrollPosition: store.updateScrollPosition,
    isSectionExpanded: store.isSectionExpanded,
    initializeSidebar: store.initializeSidebar,
    updateMenuStructure: store.updateMenuStructure,
    resetToDefaults: store.resetToDefaults,
    clearSession: store.clearSession,
    
    // Backend sync actions
    refreshFromBackend: store.refreshFromBackend,
    
    // Session customization actions
    updateMenuItem: store.updateMenuItem,
    reorderMenuItems: store.reorderMenuItems,
    toggleItemVisibility: store.toggleItemVisibility,
    
    // Legacy compatibility
    setExpandedSections: (sections: { [key: string]: boolean }) => {
      // For compatibility with existing code, update all sections at once
      Object.keys(sections).forEach(key => {
        if (store.expandedSections[key] !== sections[key]) {
          store.toggleSection(key)
        }
      })
    }
  }
}

/**
 * Hook to initialize sidebar on user login
 * Should be called from AuthContext or DashboardLayout
 */
export function useInitializeSidebar() {
  const initializeSidebar = useSidebarStore(state => state.initializeSidebar)
  const clearSession = useSidebarStore(state => state.clearSession)
  const isInitialized = useSidebarStore(state => state.isInitialized)

  const loadUserSidebarDefaults = async (user: any) => {
    try {
      // Fetch user's saved sidebar customization
      const response = await fetch('/api/user/preferences')
      if (!response.ok) {
        console.warn('Failed to load user preferences')
        return null
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error('Error loading user sidebar defaults:', error)
      return null
    }
  }

  const initializeFromUser = async (user: any, defaultMenuStructure: MenuItem[]) => {
    if (!user || isInitialized) return

    const userPreferences = await loadUserSidebarDefaults(user)
    
    let menuStructure = defaultMenuStructure
    let expandedState: { [key: string]: boolean } = {}

    // If user has saved customization, use it
    if (userPreferences?.sidebarCustomization) {
      const customization = userPreferences.sidebarCustomization
      
      // Icon name mapping for legacy customizations
      const iconMap: { [key: string]: string } = {
        // Main items
        'Dashboard': 'Dashboard',
        'Pipeline': 'Assessment',
        'Calendar': 'CalendarMonth',
        'Integrations': 'IntegrationInstructions',
        'Settings': 'Settings',
        'Activity Feed': 'Description',
        'Backup & Restore': 'Backup',
        'Availability': 'EventAvailable',
        'Notifications': 'Notifications',
        'Profile': 'Person',
        
        // Sections
        'Platform Management': 'AdminPanelSettings',
        'Finance & Reports': 'AccountBalance',
        'System & Tools': 'Settings',
        'CRM': 'Business',
        'Sales & Campaigns': 'AttachMoney',
        'Sales Management': 'AttachMoney',
        'Content Management': 'Podcasts',
        'Content': 'VideoLibrary',
        'Finance & Analytics': 'BarChart',
        'Administration': 'ManageAccounts',
        'My Production': 'Mic',
        'My Work': 'Mic',
        'My Advertising': 'Campaign',
        'Presale': 'Sell',
        'Pre-Sale Management': 'Sell',
        'Post-Sale Management': 'LocalShipping',
        'Postsale': 'LocalShipping',
        
        // Platform Management items
        'Platform Overview': 'Dashboard',
        'Organizations': 'Business',
        'Global Users': 'Groups',
        'Platform Settings': 'Settings',
        'Global Analytics': 'Analytics',
        'System Monitoring': 'Speed',
        'View as Organization': 'Visibility',
        
        // Finance items
        'Master Billing': 'MonetizationOn',
        'Performance Analytics Center': 'Analytics',
        'Financial Management Hub': 'AccountBalance',
        'Strategic Budget Planning': 'TrendingUp',
        'Reports': 'Assessment',
        'Budget Management': 'MonetizationOn',
        'Financials': 'AccountBalance',
        'Billing': 'AccountBalance',
        
        // CRM items
        'Pipeline': 'Assessment',
        'Advertisers': 'Store',
        'Agencies': 'Business',
        
        // Campaign items
        'Campaigns': 'Campaign',
        'Reservations': 'Schedule',
        'Inventory': 'Inventory',
        'Schedule Builder': 'EventNote',
        'Proposals': 'ContentPaste',
        'Proposal Templates': 'Description',
        'Creative Library': 'PhotoLibrary',
        'Orders': 'ShoppingCart',
        'Contracts & IOs': 'Gavel',
        'Ad Approvals': 'CheckCircle',
        
        // Content items
        'Shows': 'Podcasts',
        'Episodes': 'PlayCircle',
        'My Shows': 'Podcasts',
        'My Episodes': 'PlayCircle',
        'Recordings': 'Podcasts',
        'Schedule': 'CalendarMonth',
        
        // Admin items
        'Pending Approvals': 'CheckCircle',
        'User Management': 'Groups',
        'Role Permissions': 'Security',
        'Email Analytics': 'Email',
        'Deletion Requests': 'DeleteSweep',
        
        // Producer/Talent items
        'Production Tasks': 'Assignment',
        'Recording Tasks': 'Assignment',
        
        // Client items
        'My Campaigns': 'Campaign',
        'My Orders': 'ShoppingCart',
        'My Contracts': 'Gavel',
        'My Reports': 'Assessment'
      }

      // Fix any missing iconName fields in saved customization
      const fixIconNames = (items: any[]) => {
        items.forEach(item => {
          if (!item.iconName && (item.text || item.section)) {
            const key = item.text || item.section
            item.iconName = iconMap[key] || 'Circle'
          }
          // Also fix incorrect icon names
          if (item.iconName && (item.text || item.section)) {
            const key = item.text || item.section
            const correctIconName = iconMap[key]
            if (correctIconName && item.iconName !== correctIconName) {
              console.log(`Fixing icon for "${key}": ${item.iconName} → ${correctIconName}`)
              item.iconName = correctIconName
            }
          }
          if (item.children) {
            fixIconNames(item.children)
          }
        })
      }
      
      fixIconNames(customization)

      // Convert saved customization to MenuItem format with React icon elements
      const convertToMenuItem = (item: any): MenuItem => {
        const menuItem: MenuItem = {}
        
        if (item.type === 'divider') {
          menuItem.divider = true
        } else if (item.type === 'section') {
          menuItem.section = item.text
          menuItem.iconName = item.iconName
          
          // Convert iconName to React element
          if (item.iconName) {
            const IconComponent = (MuiIcons as any)[item.iconName]
            if (IconComponent) {
              menuItem.icon = React.createElement(IconComponent)
            } else {
              console.warn(`Section icon not found for "${item.text}": ${item.iconName}`, item)
              menuItem.icon = React.createElement(Folder)
            }
          } else {
            menuItem.icon = React.createElement(Folder)
          }
          
          if (item.children) {
            menuItem.children = item.children
              .filter((child: any) => child.visible)
              .map(convertToMenuItem)
          }
        } else {
          menuItem.text = item.text
          menuItem.href = item.href
          menuItem.iconName = item.iconName
          
          // Convert iconName to React element
          if (item.iconName) {
            const IconComponent = (MuiIcons as any)[item.iconName]
            if (IconComponent) {
              menuItem.icon = React.createElement(IconComponent)
            } else {
              console.warn(`Icon not found for "${item.text}": ${item.iconName}`, item)
              menuItem.icon = React.createElement(Circle)
            }
          } else {
            menuItem.icon = React.createElement(Circle)
          }
          
          menuItem.permission = item.permission
          menuItem.permissions = item.permissions
          menuItem.requiresAll = item.requiresAll
        }
        
        return menuItem
      }

      menuStructure = customization
        .filter((item: any) => item.visible)
        .map(convertToMenuItem)

      // Extract collapsed/expanded state from customization
      const extractExpandedState = (items: any[]) => {
        items.forEach((item: any) => {
          if (item.type === 'section' && item.text) {
            // Store true if expanded (not collapsed), false if collapsed
            expandedState[item.text] = !item.collapsed
          }
          if (item.children) {
            extractExpandedState(item.children)
          }
        })
      }
      extractExpandedState(customization)
    }

    // Add unique IDs to menu structure for tracking
    const menuWithIds = addIdsToMenuStructure(menuStructure)
    
    // Initialize the store
    initializeSidebar(menuWithIds, expandedState)
  }

  const handleLogout = () => {
    clearSession()
  }

  return {
    initializeFromUser,
    handleLogout,
    isInitialized
  }
}