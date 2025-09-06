'use client'

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

export interface MenuItem {
  text?: string
  icon?: React.ReactNode
  href?: string
  divider?: boolean
  section?: string
  permission?: string
  permissions?: string[]
  requiresAll?: boolean
  children?: MenuItem[]
  visible?: boolean
  collapsed?: boolean
  iconName?: string
  type?: 'item' | 'section' | 'divider'
  id?: string
  order?: number
}

export interface SidebarState {
  // Core sidebar data
  menuStructure: MenuItem[] | null
  customMenuStructure: MenuItem[] | null
  userDefaultMenuStructure: MenuItem[] | null
  
  // Session state
  expandedSections: { [key: string]: boolean }
  scrollPosition: number
  isInitialized: boolean
  isLoading: boolean
  
  // Actions
  initializeSidebar: (userDefaults: MenuItem[], expandedState?: { [key: string]: boolean }) => void
  updateMenuStructure: (structure: MenuItem[]) => void
  toggleSection: (sectionKey: string) => void
  updateScrollPosition: (position: number) => void
  isSectionExpanded: (sectionKey: string, defaultExpanded?: boolean) => boolean
  resetToDefaults: () => void
  clearSession: () => void
  
  // Backend sync actions
  refreshFromBackend: () => Promise<void>
  
  // Customization actions (for temporary session changes)
  updateMenuItem: (id: string, updates: Partial<MenuItem>) => void
  reorderMenuItems: (startIndex: number, endIndex: number) => void
  toggleItemVisibility: (id: string) => void
}

const initialState = {
  menuStructure: null,
  customMenuStructure: null,
  userDefaultMenuStructure: null,
  expandedSections: {},
  scrollPosition: 0,
  isInitialized: false,
  isLoading: false,
}

export const useSidebarStore = create<SidebarState>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    initializeSidebar: (userDefaults: MenuItem[], expandedState = {}) => {
      set({
        userDefaultMenuStructure: userDefaults,
        customMenuStructure: userDefaults,
        menuStructure: userDefaults,
        expandedSections: expandedState,
        isInitialized: true,
        isLoading: false,
      })
    },

    updateMenuStructure: (structure: MenuItem[]) => {
      set({
        customMenuStructure: structure,
        menuStructure: structure,
      })
    },

    toggleSection: (sectionKey: string) => {
      const { expandedSections } = get()
      set({
        expandedSections: {
          ...expandedSections,
          [sectionKey]: !expandedSections[sectionKey]
        }
      })
    },

    updateScrollPosition: (position: number) => {
      set({ scrollPosition: position })
    },

    isSectionExpanded: (sectionKey: string, defaultExpanded = true) => {
      const { expandedSections } = get()
      
      // Check if explicitly set in expandedSections
      if (sectionKey in expandedSections) {
        return expandedSections[sectionKey]
      }
      
      // Default to expanded for most sections, collapsed for specific ones
      if (sectionKey === 'Presale' || sectionKey === 'Postsale') {
        return false
      }
      
      return defaultExpanded
    },

    resetToDefaults: () => {
      const { userDefaultMenuStructure } = get()
      if (userDefaultMenuStructure) {
        set({
          customMenuStructure: userDefaultMenuStructure,
          menuStructure: userDefaultMenuStructure,
          expandedSections: {},
          scrollPosition: 0,
        })
      }
    },

    clearSession: () => {
      set(initialState)
    },

    refreshFromBackend: async () => {
      try {
        const response = await fetch('/api/user/preferences')
        if (!response.ok) {
          console.warn('Failed to refresh sidebar from backend')
          return
        }

        const data = await response.json()
        const { userDefaultMenuStructure } = get()
        
        if (data.sidebarCustomization) {
          // Re-process the customization data the same way as initialization
          const customization = data.sidebarCustomization
          
          // Use the same conversion logic as in the hook
          // This should be extracted to a shared utility, but for now we'll inline it
          const menuStructure = userDefaultMenuStructure || []
          const expandedState: { [key: string]: boolean } = {}
          
          // Extract collapsed/expanded state
          const extractExpandedState = (items: any[]) => {
            items.forEach((item: any) => {
              if (item.type === 'section' && item.text) {
                expandedState[item.text] = !item.collapsed
              }
              if (item.children) {
                extractExpandedState(item.children)
              }
            })
          }
          extractExpandedState(customization)
          
          set({
            userDefaultMenuStructure: menuStructure,
            customMenuStructure: menuStructure,
            menuStructure: menuStructure,
            expandedSections: expandedState,
          })
        }
      } catch (error) {
        console.error('Error refreshing sidebar from backend:', error)
      }
    },

    // Temporary session customization actions
    updateMenuItem: (id: string, updates: Partial<MenuItem>) => {
      const { customMenuStructure } = get()
      if (!customMenuStructure) return

      const updateItemInTree = (items: MenuItem[]): MenuItem[] => {
        return items.map(item => {
          if (item.id === id) {
            return { ...item, ...updates }
          }
          if (item.children) {
            return { ...item, children: updateItemInTree(item.children) }
          }
          return item
        })
      }

      const updatedStructure = updateItemInTree(customMenuStructure)
      set({
        customMenuStructure: updatedStructure,
        menuStructure: updatedStructure,
      })
    },

    reorderMenuItems: (startIndex: number, endIndex: number) => {
      const { customMenuStructure } = get()
      if (!customMenuStructure) return

      const reordered = Array.from(customMenuStructure)
      const [removed] = reordered.splice(startIndex, 1)
      reordered.splice(endIndex, 0, removed)

      set({
        customMenuStructure: reordered,
        menuStructure: reordered,
      })
    },

    toggleItemVisibility: (id: string) => {
      const { updateMenuItem } = get()
      const { customMenuStructure } = get()
      if (!customMenuStructure) return

      const findItem = (items: MenuItem[]): MenuItem | null => {
        for (const item of items) {
          if (item.id === id) return item
          if (item.children) {
            const found = findItem(item.children)
            if (found) return found
          }
        }
        return null
      }

      const item = findItem(customMenuStructure)
      if (item) {
        updateMenuItem(id, { visible: !item.visible })
      }
    },
  }))
)

// Helper function to generate unique IDs for menu items
export const generateMenuItemId = (item: MenuItem, parentId = '', index = 0): string => {
  if (item.id) return item.id
  
  if (item.divider) return `${parentId}_divider_${index}`
  if (item.section) return `${parentId}_section_${item.section.replace(/\s+/g, '_').toLowerCase()}`
  if (item.text) return `${parentId}_item_${item.text.replace(/\s+/g, '_').toLowerCase()}`
  
  return `${parentId}_unknown_${index}`
}

// Helper function to add IDs to menu structure
export const addIdsToMenuStructure = (items: MenuItem[], parentId = ''): MenuItem[] => {
  return items.map((item, index) => {
    const id = generateMenuItemId(item, parentId, index)
    const updatedItem = { ...item, id }
    
    if (item.children) {
      updatedItem.children = addIdsToMenuStructure(item.children, id)
    }
    
    return updatedItem
  })
}