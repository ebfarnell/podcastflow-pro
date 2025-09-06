import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

interface CompetitiveConflict {
  advertiserId: string
  advertiserName: string
  categoryId: string
  categoryName: string
  competitiveGroupId: string
  competitiveGroupName: string
  conflictMode: 'warn' | 'block'
  conflictingCampaigns: Array<{
    id: string
    name: string
    advertiserId: string
    advertiserName: string
    startDate: Date
    endDate: Date
    status: string
    probability: number
  }>
}

interface Category {
  id: string
  name: string
  description?: string
  parentId?: string
  parentName?: string
  isActive: boolean
  childCount: number
  advertiserCount: number
}

interface CompetitiveGroup {
  id: string
  name: string
  description?: string
  conflictMode: 'warn' | 'block'
  isActive: boolean
  advertiserCount: number
  sampleAdvertisers?: string[]
}

export function useCompetitiveConflicts(campaignId?: string) {
  const queryClient = useQueryClient()
  const [conflicts, setConflicts] = useState<CompetitiveConflict[]>([])
  
  // Fetch campaign data to get conflicts
  const { data: campaign, isLoading: campaignLoading } = useQuery({
    queryKey: ['campaign', campaignId],
    queryFn: async () => {
      if (!campaignId) return null
      
      const response = await fetch(`/api/campaigns/${campaignId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch campaign')
      }
      return response.json()
    },
    enabled: !!campaignId
  })
  
  // Parse conflicts from campaign data
  useEffect(() => {
    if (campaign?.competitiveConflicts) {
      try {
        const parsed = typeof campaign.competitiveConflicts === 'string' 
          ? JSON.parse(campaign.competitiveConflicts)
          : campaign.competitiveConflicts
        setConflicts(parsed)
      } catch (e) {
        console.error('Failed to parse competitive conflicts:', e)
        setConflicts([])
      }
    } else {
      setConflicts([])
    }
  }, [campaign])
  
  // Check conflicts for a campaign
  const checkConflicts = useMutation({
    mutationFn: async ({
      campaignId,
      advertiserId,
      startDate,
      endDate
    }: {
      campaignId: string
      advertiserId: string
      startDate: Date
      endDate: Date
    }) => {
      const response = await fetch('/api/competitive-conflicts/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId,
          advertiserId,
          startDate,
          endDate
        })
      })
      
      if (!response.ok) {
        throw new Error('Failed to check conflicts')
      }
      
      return response.json()
    }
  })
  
  // Override conflicts (admin only)
  const overrideConflicts = useMutation({
    mutationFn: async ({
      campaignId,
      reason
    }: {
      campaignId: string
      reason: string
    }) => {
      const response = await fetch(`/api/campaigns/${campaignId}/override-conflicts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      })
      
      if (!response.ok) {
        throw new Error('Failed to override conflicts')
      }
      
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] })
    }
  })
  
  // Count conflicts by type
  const conflictSummary = useCallback(() => {
    const summary = {
      total: conflicts.length,
      blocking: 0,
      warnings: 0,
      affectedCampaigns: new Set<string>()
    }
    
    conflicts.forEach(conflict => {
      if (conflict.conflictMode === 'block') {
        summary.blocking++
      } else {
        summary.warnings++
      }
      
      conflict.conflictingCampaigns.forEach(camp => {
        summary.affectedCampaigns.add(camp.id)
      })
    })
    
    return {
      ...summary,
      affectedCampaignsCount: summary.affectedCampaigns.size
    }
  }, [conflicts])
  
  // Check if campaign can proceed
  const canProceed = useCallback(() => {
    return !conflicts.some(c => c.conflictMode === 'block') || campaign?.conflictOverride
  }, [conflicts, campaign])
  
  return {
    conflicts,
    campaign,
    isLoading: campaignLoading,
    checkConflicts,
    overrideConflicts,
    conflictSummary,
    canProceed,
    hasConflicts: conflicts.length > 0,
    hasBlockingConflicts: conflicts.some(c => c.conflictMode === 'block'),
    isOverridden: campaign?.conflictOverride || false
  }
}

// Hook for managing categories
export function useCategories() {
  const queryClient = useQueryClient()
  
  // Fetch categories
  const { data: categories = [], isLoading, error, refetch } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await fetch('/api/categories')
      if (!response.ok) {
        throw new Error('Failed to fetch categories')
      }
      return response.json()
    }
  })
  
  // Create category
  const createCategory = useMutation({
    mutationFn: async (data: {
      name: string
      description?: string
      parentId?: string
      isActive?: boolean
    }) => {
      const response = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create category')
      }
      
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
    }
  })
  
  // Build category tree
  const categoryTree = useCallback(() => {
    const tree: any[] = []
    const map = new Map<string, any>()
    
    // First pass: create map
    categories.forEach((cat: Category) => {
      map.set(cat.id, { ...cat, children: [] })
    })
    
    // Second pass: build tree
    categories.forEach((cat: Category) => {
      const node = map.get(cat.id)
      if (cat.parentId) {
        const parent = map.get(cat.parentId)
        if (parent) {
          parent.children.push(node)
        }
      } else {
        tree.push(node)
      }
    })
    
    return tree
  }, [categories])
  
  return {
    categories,
    isLoading,
    error,
    refetch,
    createCategory,
    categoryTree
  }
}

// Hook for managing competitive groups
export function useCompetitiveGroups() {
  const queryClient = useQueryClient()
  
  // Fetch competitive groups
  const { data: groups = [], isLoading, error, refetch } = useQuery({
    queryKey: ['competitive-groups'],
    queryFn: async () => {
      const response = await fetch('/api/competitive-groups')
      if (!response.ok) {
        throw new Error('Failed to fetch competitive groups')
      }
      return response.json()
    }
  })
  
  // Create competitive group
  const createGroup = useMutation({
    mutationFn: async (data: {
      name: string
      description?: string
      conflictMode?: 'warn' | 'block'
      isActive?: boolean
      advertiserIds?: string[]
    }) => {
      const response = await fetch('/api/competitive-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create competitive group')
      }
      
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competitive-groups'] })
    }
  })
  
  return {
    groups,
    isLoading,
    error,
    refetch,
    createGroup
  }
}