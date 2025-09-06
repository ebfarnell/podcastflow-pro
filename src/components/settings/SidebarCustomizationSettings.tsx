'use client'

import React, { useState, useEffect } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Switch,
  FormControlLabel,
  Alert,
  Paper,
  Divider,
  Checkbox,
  FormGroup,
  FormLabel,
  Chip,
} from '@mui/material'
import {
  DragIndicator,
  Delete,
  Add,
  Save,
  RestartAlt,
  Visibility,
  VisibilityOff,
  ExpandLess,
  ExpandMore,
} from '@mui/icons-material'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  defaultDropAnimationSideEffects,
  MouseSensor,
  TouchSensor,
  DragOverEvent,
  UniqueIdentifier,
  rectIntersection,
  getFirstCollision,
  pointerWithin,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import {
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useAuth } from '@/contexts/AuthContext'
import { getMenuStructure, MenuItem } from '@/components/layout/DashboardLayout'
import * as MuiIcons from '@mui/icons-material'
import { SidebarResetButton } from './SidebarResetButton'
import { useSidebarStoreHook } from '@/hooks/useSidebarStore'

interface CustomMenuItem {
  id: string
  text?: string
  iconName?: string
  href?: string
  type: 'item' | 'section' | 'divider'
  children?: CustomMenuItem[]
  visible: boolean
  collapsed?: boolean
  permission?: string
  permissions?: string[]
  requiresAll?: boolean
}

interface SortableItemProps {
  item: CustomMenuItem
  depth: number
  onToggleVisibility: (id: string) => void
  onToggleCollapse: (id: string) => void
}

function SortableItem({ item, depth, onToggleVisibility, onToggleCollapse }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
    isSorting,
  } = useSortable({ 
    id: item.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isSorting ? transition : undefined,
  }

  // Get the icon component
  const IconComponent = item.iconName && (MuiIcons as any)[item.iconName] 
    ? (MuiIcons as any)[item.iconName] 
    : item.type === 'section' ? MuiIcons.Folder : MuiIcons.FiberManualRecord

  if (item.type === 'divider') {
    return (
      <Box 
        ref={setNodeRef} 
        style={style}
        sx={{
          opacity: isDragging ? 0 : 1,
          transform: isDragging ? 'scale(1.05)' : 'scale(1)',
          transition: 'all 0.2s ease',
        }}
      >
        <Box 
          sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            my: 1, 
            pl: depth * 2,
            cursor: 'grab',
            '&:active': { cursor: 'grabbing' },
          }}
          {...attributes}
          {...listeners}
        >
          <DragIndicator fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
          <Divider sx={{ flex: 1 }} />
        </Box>
      </Box>
    )
  }

  return (
    <Box 
      ref={setNodeRef} 
      style={style}
      sx={{
        mb: 0.5,
        opacity: isDragging ? 0 : 1,
        transform: isDragging ? 'scale(1.03)' : 'scale(1)',
        transition: 'all 0.2s ease',
      }}
    >
      <Paper
        elevation={isDragging ? 4 : 0}
        sx={{
          pl: depth * 2 + 0.5,
          pr: 1,
          py: 0.75,
          bgcolor: isDragging ? 'action.hover' : item.visible ? 'background.paper' : 'action.disabledBackground',
          borderRadius: 1,
          border: '1px solid',
          borderColor: isDragging ? 'primary.main' : 'transparent',
          transition: 'all 0.2s ease',
          '&:hover': {
            bgcolor: item.visible ? 'action.hover' : 'action.disabledBackground',
            borderColor: 'divider',
          },
          display: 'flex',
          alignItems: 'center',
          minHeight: 42,
          position: 'relative',
        }}
      >
        <Box
          ref={setActivatorNodeRef}
          sx={{
            display: 'flex',
            alignItems: 'center',
            cursor: isDragging ? 'grabbing' : 'grab',
            mr: 0.5,
            p: 0.5,
            borderRadius: 1,
            transition: 'all 0.2s ease',
            '&:hover': {
              bgcolor: 'action.selected',
              '& .drag-icon': {
                color: 'primary.main',
                transform: 'scale(1.1)',
              },
            },
            '&:active': {
              bgcolor: 'action.selected',
            },
          }}
          {...attributes}
          {...listeners}
        >
          <DragIndicator 
            className="drag-icon" 
            fontSize="small" 
            sx={{ 
              color: 'text.secondary',
              transition: 'all 0.2s ease',
            }} 
          />
        </Box>
        <ListItemIcon sx={{ minWidth: 36 }}>
          <IconComponent sx={{ fontSize: 20, color: item.visible ? 'inherit' : 'text.disabled' }} />
        </ListItemIcon>
        <ListItemText
          primary={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {item.text || '---'}
              {item.type === 'section' && (
                <Chip 
                  label="Section" 
                  size="small" 
                  sx={{ 
                    height: 18, 
                    fontSize: '0.65rem',
                    opacity: item.visible ? 1 : 0.5,
                  }} 
                />
              )}
            </Box>
          }
          secondary={item.type === 'section' && item.href ? null : item.href}
          primaryTypographyProps={{
            fontSize: '0.875rem',
            fontWeight: item.type === 'section' ? 600 : 400,
            color: item.visible ? 'text.primary' : 'text.disabled',
          }}
          secondaryTypographyProps={{
            fontSize: '0.75rem',
            color: item.visible ? 'text.secondary' : 'text.disabled',
          }}
          sx={{ my: 0 }}
        />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 'auto' }}>
          {item.type === 'section' && item.children && item.children.length > 0 && (
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation()
                onToggleCollapse(item.id)
              }}
              sx={{ 
                p: 0.5,
                '&:hover': { bgcolor: 'action.selected' },
              }}
            >
              {item.collapsed ? <ExpandMore /> : <ExpandLess />}
            </IconButton>
          )}
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation()
              onToggleVisibility(item.id)
            }}
            sx={{ 
              p: 0.5,
              '&:hover': { bgcolor: 'action.selected' },
            }}
          >
            {item.visible ? (
              <Visibility fontSize="small" sx={{ color: 'success.main' }} />
            ) : (
              <VisibilityOff fontSize="small" sx={{ color: 'text.disabled' }} />
            )}
          </IconButton>
        </Box>
      </Paper>
      {item.children && item.children.length > 0 && item.visible && !item.collapsed && (
        <Box sx={{ pl: 2, mt: 0.5 }}>
          <SortableContext
            items={item.children.map(child => child.id)}
            strategy={verticalListSortingStrategy}
          >
            {item.children.map(child => (
              <SortableItem
                key={child.id}
                item={child}
                depth={depth + 1}
                onToggleVisibility={onToggleVisibility}
                onToggleCollapse={onToggleCollapse}
              />
            ))}
          </SortableContext>
        </Box>
      )}
    </Box>
  )
}

// Drop indicator component
function DropIndicator() {
  return (
    <Box
      sx={{
        height: 3,
        mx: 2,
        my: 0.5,
        bgcolor: 'primary.main',
        borderRadius: 1.5,
        opacity: 0.8,
        animation: 'pulse 1s infinite',
        '@keyframes pulse': {
          '0%': { opacity: 0.6 },
          '50%': { opacity: 1 },
          '100%': { opacity: 0.6 },
        },
      }}
    />
  )
}

// Drag overlay component for better visual feedback
function DragOverlayItem({ item }: { item: CustomMenuItem }) {
  const IconComponent = item.iconName && (MuiIcons as any)[item.iconName] 
    ? (MuiIcons as any)[item.iconName] 
    : item.type === 'section' ? MuiIcons.Folder : MuiIcons.FiberManualRecord

  return (
    <Paper
      elevation={8}
      sx={{
        px: 2,
        py: 1,
        bgcolor: 'background.paper',
        borderRadius: 1,
        border: '2px solid',
        borderColor: 'primary.main',
        display: 'flex',
        alignItems: 'center',
        minWidth: 200,
        opacity: 0.9,
        transform: 'rotate(2deg)',
        cursor: 'grabbing',
      }}
    >
      <DragIndicator fontSize="small" sx={{ mr: 1.5, color: 'primary.main' }} />
      <ListItemIcon sx={{ minWidth: 36 }}>
        <IconComponent sx={{ fontSize: 20, color: 'primary.main' }} />
      </ListItemIcon>
      <Typography variant="body2" sx={{ fontWeight: 500 }}>
        {item.text || '---'}
      </Typography>
    </Paper>
  )
}

export function SidebarCustomizationSettings() {
  const { user, hasPermission, hasAnyPermission, hasAllPermissions } = useAuth()
  const { refreshFromBackend } = useSidebarStoreHook()
  const [menuItems, setMenuItems] = useState<CustomMenuItem[]>([])
  const [originalMenuItems, setOriginalMenuItems] = useState<CustomMenuItem[]>([])
  const [hiddenItemsDialog, setHiddenItemsDialog] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  
  // Track if there are unsaved changes
  const hasUnsavedChanges = JSON.stringify(menuItems) !== JSON.stringify(originalMenuItems)

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 5,
        delay: 0,
        tolerance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 100,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Map of menu text/section names to their icon names
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
    'Executive Reports': 'TrendingUp',
    'Analytics': 'Analytics',
    'Performance Analytics Center': 'Analytics',
    'Detailed Analytics': 'Assessment',
    'Reports': 'Assessment',
    'Budget Management': 'MonetizationOn',
    'Financial Management Hub': 'AccountBalance',
    'Strategic Budget Planning': 'TrendingUp',
    'Financials': 'AccountBalance',
    'Billing': 'AccountBalance',
    
    // CRM items
    'Advertisers': 'Store',
    'Agencies': 'Business',
    
    // Campaign items
    'Pre-Sale Management': 'Sell',
    'Post-Sale Management': 'LocalShipping',
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

  // Helper to extract icon name from menu item
  const getIconName = (item: MenuItem): string => {
    const key = item.text || item.section || ''
    return iconMap[key] || 'Circle'
  }

  // Convert MenuItem to CustomMenuItem
  const convertMenuItem = (item: MenuItem, parentId = '', index = 0, existingItem?: CustomMenuItem): CustomMenuItem | null => {
    if (!item) return null
    
    const id = item.text || item.section || `${parentId}-divider-${index}`
    
    const customItem: CustomMenuItem = {
      id: id.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
      text: item.text || item.section,
      href: item.href,
      type: item.divider ? 'divider' : item.section ? 'section' : 'item',
      visible: existingItem?.visible !== undefined ? existingItem.visible : true,
      collapsed: existingItem?.collapsed !== undefined ? existingItem.collapsed : false,
      iconName: getIconName(item),
      permission: item.permission,
      permissions: item.permissions,
      requiresAll: item.requiresAll,
    }
    
    if (item.children) {
      customItem.children = item.children
        .map((child, idx) => {
          const existingChild = existingItem?.children?.find(c => 
            c.text === child.text || c.text === child.section
          )
          return convertMenuItem(child, customItem.id, idx, existingChild)
        })
        .filter((child): child is CustomMenuItem => child !== null)
    }
    
    return customItem
  }

  // Check if user has permission for menu item
  const hasMenuPermission = (item: CustomMenuItem): boolean => {
    if (!item.permission && !item.permissions) return true
    
    if (item.permission) {
      return hasPermission(item.permission)
    }
    
    if (item.permissions) {
      if (item.requiresAll) {
        return hasAllPermissions(item.permissions)
      } else {
        return hasAnyPermission(item.permissions)
      }
    }
    
    return true
  }

  // Load menu structure
  useEffect(() => {
    const loadMenuStructure = async () => {
      try {
        // First try to load saved preferences
        const response = await fetch('/api/user/preferences')
        if (response.ok) {
          const data = await response.json()
          if (data.sidebarCustomization) {
            setMenuItems(data.sidebarCustomization)
            setOriginalMenuItems(data.sidebarCustomization) // Track original state
            setIsLoading(false)
            return
          }
        }
      } catch (error) {
        console.error('Failed to load preferences:', error)
      }

      // Load default menu structure
      if (!user) return
      
      const menuStructure = getMenuStructure(user.role)
      const converted = menuStructure
        .map((item, index) => convertMenuItem(item, '', index))
        .filter((item): item is CustomMenuItem => item !== null)
      
      setMenuItems(converted)
      setOriginalMenuItems(converted) // Track original state
      setIsLoading(false)
    }

    loadMenuStructure()
  }, [user])

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (active.id !== over?.id && over) {
      setMenuItems((items) => {
        const activeItem = findItemById(items, active.id as string)
        const overItem = findItemById(items, over.id as string)
        
        if (!activeItem || !overItem) return items
        
        // Simple reordering for top-level items
        const oldIndex = items.findIndex(item => item.id === active.id)
        const newIndex = items.findIndex(item => item.id === over.id)
        
        if (oldIndex !== -1 && newIndex !== -1) {
          return arrayMove(items, oldIndex, newIndex)
        }
        
        // TODO: Handle nested drag and drop
        return items
      })
    }
    
    setActiveId(null)
  }

  const handleToggleVisibility = (id: string) => {
    setMenuItems(items =>
      updateItemInTree(items, id, item => ({ ...item, visible: !item.visible }))
    )
  }

  const handleToggleCollapse = (id: string) => {
    setMenuItems(items =>
      updateItemInTree(items, id, item => ({ ...item, collapsed: !item.collapsed }))
    )
  }

  const handleSave = async () => {
    if (!hasUnsavedChanges) return
    
    setIsSaving(true)
    setErrorMessage('')
    setSuccessMessage('')
    
    try {
      const response = await fetch('/api/user/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sidebarCustomization: menuItems,
          sidebarCustomizationVersion: 2
        })
      })

      if (response.ok) {
        // Update the original state to match current state (no more unsaved changes)
        setOriginalMenuItems([...menuItems])
        
        // Refresh the Zustand store from the backend to get the updated state
        await refreshFromBackend()
        
        setSuccessMessage('Sidebar customization saved successfully!')
        setTimeout(() => setSuccessMessage(''), 3000)
      } else {
        const errorData = await response.json()
        setErrorMessage(errorData.error || 'Failed to save customization')
        setTimeout(() => setErrorMessage(''), 5000)
      }
    } catch (error) {
      console.error('Failed to save customizations:', error)
      setErrorMessage('Failed to save customization. Please try again.')
      setTimeout(() => setErrorMessage(''), 5000)
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = () => {
    if (!user) return
    
    const menuStructure = getMenuStructure(user.role)
    const converted = menuStructure
      .map((item, index) => convertMenuItem(item, '', index))
      .filter((item): item is CustomMenuItem => item !== null)
    
    setMenuItems(converted)
    setSuccessMessage('Sidebar reset to default!')
    setTimeout(() => setSuccessMessage(''), 3000)
  }

  const handleShowHidden = (itemId: string) => {
    handleToggleVisibility(itemId)
    setHiddenItemsDialog(false)
  }

  // Get all hidden items that user has permission to see
  const getHiddenItems = (items: CustomMenuItem[]): CustomMenuItem[] => {
    const hidden: CustomMenuItem[] = []
    
    const traverse = (itemList: CustomMenuItem[]) => {
      itemList.forEach(item => {
        if (!item.visible && item.type !== 'divider' && hasMenuPermission(item)) {
          hidden.push(item)
        }
        if (item.children) {
          traverse(item.children)
        }
      })
    }
    
    traverse(items)
    return hidden
  }

  // Helper functions
  const findItemById = (items: CustomMenuItem[], id: string): CustomMenuItem | null => {
    for (const item of items) {
      if (item.id === id) {
        return item
      }
      if (item.children) {
        const found = findItemById(item.children, id)
        if (found) return found
      }
    }
    return null
  }

  const updateItemInTree = (
    items: CustomMenuItem[],
    id: string,
    updater: (item: CustomMenuItem) => CustomMenuItem
  ): CustomMenuItem[] => {
    return items.map(item => {
      if (item.id === id) {
        return updater(item)
      }
      if (item.children) {
        return {
          ...item,
          children: updateItemInTree(item.children, id, updater)
        }
      }
      return item
    })
  }

  if (isLoading) {
    return <Typography>Loading sidebar structure...</Typography>
  }

  const hiddenItems = getHiddenItems(menuItems)

  return (
    <Box>
      <Card>
        <CardContent>
          <Typography variant="h5" component="h2" gutterBottom>
            Sidebar Customization
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Customize your sidebar by reordering items and toggling visibility. The page will automatically refresh after saving changes.
          </Typography>

          {successMessage && (
            <Alert severity="success" sx={{ mb: 2 }}>
              {successMessage}
            </Alert>
          )}

          {errorMessage && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errorMessage}
            </Alert>
          )}

          {hasUnsavedChanges && (
            <Alert severity="info" sx={{ mb: 2 }}>
              You have unsaved changes. Click "Save Changes" to persist them to your profile.
            </Alert>
          )}

          <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<Add />}
              onClick={() => setHiddenItemsDialog(true)}
              size="small"
              disabled={hiddenItems.length === 0}
            >
              Show Hidden Items ({hiddenItems.length})
            </Button>
            <Box sx={{ flexGrow: 1 }} />
            <Button
              variant="outlined"
              startIcon={<RestartAlt />}
              onClick={handleReset}
              size="small"
            >
              Reset
            </Button>
            <SidebarResetButton />
            <Button
              variant="contained"
              startIcon={isSaving ? undefined : <Save />}
              onClick={handleSave}
              size="small"
              disabled={!hasUnsavedChanges || isSaving}
              sx={{
                bgcolor: hasUnsavedChanges ? 'primary.main' : 'action.disabledBackground',
                '&:hover': {
                  bgcolor: hasUnsavedChanges ? 'primary.dark' : 'action.disabledBackground',
                },
              }}
            >
              {isSaving ? 'Saving...' : hasUnsavedChanges ? 'Save Changes' : 'No Changes'}
            </Button>
          </Box>

          <Paper 
            variant="outlined" 
            sx={{ 
              p: 2,
              borderRadius: 2,
              borderColor: 'divider',
              backgroundColor: 'background.default',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <DragIndicator sx={{ color: 'text.secondary' }} />
              <Typography variant="subtitle2" color="text.secondary">
                Drag items to reorder
              </Typography>
              <Typography variant="caption" sx={{ mx: 1 }}>•</Typography>
              <Visibility sx={{ color: 'text.secondary', fontSize: 20 }} />
              <Typography variant="subtitle2" color="text.secondary">
                Toggle visibility
              </Typography>
              <Typography variant="caption" sx={{ mx: 1 }}>•</Typography>
              <ExpandLess sx={{ color: 'text.secondary', fontSize: 20 }} />
              <Typography variant="subtitle2" color="text.secondary">
                Expand/Collapse
              </Typography>
            </Box>
            <Divider sx={{ mb: 2 }} />
            
            <DndContext
              sensors={sensors}
              collisionDetection={pointerWithin}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              autoScroll={{
                threshold: {
                  x: 0,
                  y: 0.2,
                },
                interval: 5,
              }}
            >
              <SortableContext
                items={menuItems.map(item => item.id)}
                strategy={verticalListSortingStrategy}
              >
                <Box 
                  sx={{ 
                    maxHeight: '60vh', 
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    pr: 1,
                    '&::-webkit-scrollbar': {
                      width: '8px',
                    },
                    '&::-webkit-scrollbar-track': {
                      bgcolor: 'action.hover',
                      borderRadius: '4px',
                    },
                    '&::-webkit-scrollbar-thumb': {
                      bgcolor: 'action.selected',
                      borderRadius: '4px',
                      '&:hover': {
                        bgcolor: 'action.disabled',
                      },
                    },
                  }}
                >
                  {menuItems.map(item => (
                    <SortableItem
                      key={item.id}
                      item={item}
                      depth={0}
                      onToggleVisibility={handleToggleVisibility}
                      onToggleCollapse={handleToggleCollapse}
                    />
                  ))}
                </Box>
              </SortableContext>
              <DragOverlay
                dropAnimation={{
                  sideEffects: defaultDropAnimationSideEffects({
                    styles: {
                      active: {
                        opacity: '0.5',
                      },
                    },
                  }),
                }}
              >
                {activeId ? (
                  <DragOverlayItem 
                    item={findItemById(menuItems, activeId) || { 
                      id: activeId, 
                      visible: true, 
                      type: 'item' 
                    }} 
                  />
                ) : null}
              </DragOverlay>
            </DndContext>
          </Paper>
        </CardContent>
      </Card>

      {/* Hidden Items Dialog */}
      <Dialog 
        open={hiddenItemsDialog} 
        onClose={() => setHiddenItemsDialog(false)} 
        maxWidth="sm" 
        fullWidth
      >
        <DialogTitle>Hidden Menu Items</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select items to show in your sidebar:
          </Typography>
          <FormGroup>
            {hiddenItems.map(item => (
              <FormControlLabel
                key={item.id}
                control={
                  <Checkbox
                    onChange={() => handleShowHidden(item.id)}
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {item.iconName && (
                      <Box component="span" sx={{ display: 'flex' }}>
                        {React.createElement(
                          (MuiIcons as any)[item.iconName] || MuiIcons.Circle,
                          { fontSize: 'small' }
                        )}
                      </Box>
                    )}
                    <span>{item.text}</span>
                    {item.type === 'section' && (
                      <Typography variant="caption" color="text.secondary">
                        (Section)
                      </Typography>
                    )}
                  </Box>
                }
              />
            ))}
          </FormGroup>
          {hiddenItems.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              All available items are already visible in your sidebar.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHiddenItemsDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}