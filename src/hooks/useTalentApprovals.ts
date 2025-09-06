import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

interface TalentApproval {
  id: string
  campaignId: string
  campaignName: string
  showId: string
  showName: string
  talentId: string
  talentName: string
  talentEmail: string
  spotType: 'host_read' | 'endorsement' | 'pre_produced'
  status: 'pending' | 'approved' | 'denied' | 'expired'
  requestedAt: Date
  requestedBy: string
  requestedByName: string
  respondedAt?: Date
  respondedBy?: string
  respondedByName?: string
  comments?: string
  denialReason?: string
  expiresAt?: Date
  summaryData?: any
}

interface UseTalentApprovalsOptions {
  campaignId?: string
  showId?: string
  talentId?: string
  status?: string
}

export function useTalentApprovals(options: UseTalentApprovalsOptions = {}) {
  const queryClient = useQueryClient()
  
  // Build query params
  const queryParams = new URLSearchParams()
  if (options.campaignId) queryParams.append('campaignId', options.campaignId)
  if (options.showId) queryParams.append('showId', options.showId)
  if (options.talentId) queryParams.append('talentId', options.talentId)
  if (options.status) queryParams.append('status', options.status)
  
  const queryString = queryParams.toString()
  const url = `/api/talent-approvals${queryString ? `?${queryString}` : ''}`
  
  // Fetch approvals
  const { data: approvals = [], isLoading, error, refetch } = useQuery({
    queryKey: ['talent-approvals', options],
    queryFn: async () => {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error('Failed to fetch talent approvals')
      }
      return response.json()
    },
    refetchInterval: 30000 // Refresh every 30 seconds
  })
  
  // Create approval request
  const createApproval = useMutation({
    mutationFn: async (data: {
      campaignId: string
      showId: string
      talentId: string
      spotType: 'host_read' | 'endorsement' | 'pre_produced'
      summaryData?: any
      expiresAt?: Date
    }) => {
      const response = await fetch('/api/talent-approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create approval request')
      }
      
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['talent-approvals'] })
    }
  })
  
  // Respond to approval request
  const respondToApproval = useMutation({
    mutationFn: async ({
      approvalId,
      action,
      comments,
      denialReason
    }: {
      approvalId: string
      action: 'approve' | 'deny'
      comments?: string
      denialReason?: string
    }) => {
      const response = await fetch(`/api/talent-approvals/${approvalId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, comments, denialReason })
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to respond to approval')
      }
      
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['talent-approvals'] })
    }
  })
  
  // Delete approval request (admin only)
  const deleteApproval = useMutation({
    mutationFn: async (approvalId: string) => {
      const response = await fetch(`/api/talent-approvals/${approvalId}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete approval')
      }
      
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['talent-approvals'] })
    }
  })
  
  // Count approvals by status
  const countByStatus = useCallback(() => {
    const counts = {
      pending: 0,
      approved: 0,
      denied: 0,
      expired: 0,
      total: approvals.length
    }
    
    approvals.forEach((approval: TalentApproval) => {
      counts[approval.status]++
    })
    
    return counts
  }, [approvals])
  
  // Check if campaign has pending approvals
  const hasPendingApprovals = useCallback((campaignId: string) => {
    return approvals.some(
      (a: TalentApproval) => a.campaignId === campaignId && a.status === 'pending'
    )
  }, [approvals])
  
  // Check if campaign has denied approvals
  const hasDeniedApprovals = useCallback((campaignId: string) => {
    return approvals.some(
      (a: TalentApproval) => a.campaignId === campaignId && a.status === 'denied'
    )
  }, [approvals])
  
  return {
    approvals,
    isLoading,
    error,
    refetch,
    createApproval,
    respondToApproval,
    deleteApproval,
    countByStatus,
    hasPendingApprovals,
    hasDeniedApprovals
  }
}