// Campaign Workflow Types

export interface AdRequest {
  id: string
  orderId: string
  showId: string
  episodeId?: string | null
  assignedToId: string
  assignedToRole: 'producer' | 'talent'
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  dueDate?: Date | string | null
  title: string
  description?: string | null
  requirements?: any
  deliverables?: any[]
  notes?: string | null
  completedAt?: Date | string | null
  completedBy?: string | null
  createdAt: Date | string
  updatedAt: Date | string
  createdBy: string
  organizationId: string
  
  // Relations
  order?: Order
  show?: Show
  episode?: Episode
  assignedTo?: User
  createdByUser?: User
}

export interface CreativeRequest {
  id: string
  orderId: string
  campaignId: string
  assignedToId: string
  status: 'pending' | 'in_progress' | 'submitted' | 'approved' | 'revision_needed'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  dueDate?: Date | string | null
  title: string
  description?: string | null
  requiredAssets: CreativeAsset[]
  submittedAssets: SubmittedAsset[]
  feedbackHistory: FeedbackEntry[]
  submittedAt?: Date | string | null
  approvedAt?: Date | string | null
  approvedBy?: string | null
  createdAt: Date | string
  updatedAt: Date | string
  createdBy: string
  organizationId: string
  
  // Relations
  order?: Order
  campaign?: Campaign
  assignedTo?: User
  createdByUser?: User
}

export interface CreativeAsset {
  type: 'script' | 'audio' | 'video' | 'artwork' | 'guidelines' | 'other'
  required: boolean
  description: string
}

export interface SubmittedAsset {
  type: string
  name: string
  url: string
  uploadedAt: Date | string
  uploadedBy: string
  fileSize?: number
  mimeType?: string
}

export interface FeedbackEntry {
  userId: string
  userName: string
  feedback: string
  timestamp: Date | string
}

export interface ShowRateHistory {
  id: string
  showId: string
  placementType: 'preroll' | 'midroll' | 'postroll'
  rate: number
  effectiveDate: Date | string
  expiryDate?: Date | string | null
  notes?: string | null
  createdAt: Date | string
  createdBy: string
  organizationId: string
  
  // Relations
  show?: Show
}

export interface CategoryExclusivity {
  id: string
  showId: string
  category: string
  level: 'episode' | 'show' | 'network'
  advertiserId?: string | null
  campaignId?: string | null
  startDate: Date | string
  endDate: Date | string
  isActive: boolean
  notes?: string | null
  createdAt: Date | string
  updatedAt: Date | string
  createdBy: string
  organizationId: string
  
  // Relations
  show?: Show
  advertiser?: Advertiser
  campaign?: Campaign
}

export interface CampaignApproval {
  id: string
  campaignId: string
  requestedBy: string
  status: 'pending' | 'approved' | 'rejected'
  hasRateDiscrepancy: boolean
  discrepancyDetails?: any
  discrepancyAmount?: number
  discrepancyPercentage?: number
  reviewedBy?: string | null
  reviewedAt?: Date | string | null
  reviewNotes?: string | null
  metadata?: any
  createdAt: Date | string
  updatedAt: Date | string
  
  // Relations
  campaign?: Campaign
  requestedByUser?: User
  reviewedByUser?: User
}

export interface WorkflowSettings {
  autoReserveAt90: boolean
  requireAdminApprovalAt90: boolean
  autoCreateOrderOnApproval: boolean
  autoAssignAdRequests: boolean
  notifyOnStatusChange: boolean
  reservationExpiryHours: number
}

export interface ContractTemplate {
  id: string
  organizationId: string
  name: string
  description?: string | null
  templateHtml: string
  variables: string[]
  isDefault: boolean
  isActive: boolean
  createdAt: Date | string
  updatedAt: Date | string
  createdBy: string
  updatedBy: string
}

// Import existing types for relations
import type { Order, Show, Episode, User, Campaign, Advertiser } from './index'