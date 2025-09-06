import { safeQuerySchema } from '@/lib/db/schema-db'

export interface CompetitiveConflict {
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

export class CompetitiveCategoryService {
  /**
   * Check for competitive conflicts for a campaign
   */
  async checkCompetitiveConflicts(
    organizationSlug: string,
    campaignId: string,
    advertiserId: string,
    startDate: Date,
    endDate: Date,
    excludeCampaignId?: string
  ): Promise<CompetitiveConflict[]> {
    const conflicts: CompetitiveConflict[] = []
    
    try {
      // Get advertiser's categories and competitive groups
      const advertiserCategoriesQuery = `
        SELECT 
          ac.*,
          c.name as "categoryName",
          cg.id as "competitiveGroupId",
          cg.name as "competitiveGroupName",
          cg."conflictMode"
        FROM "AdvertiserCategory" ac
        JOIN "Category" c ON c.id = ac."categoryId"
        LEFT JOIN "CompetitiveGroup" cg ON cg.id = ac."competitiveGroupId"
        WHERE ac."advertiserId" = $1
          AND c."isActive" = true
          AND (cg."isActive" = true OR cg.id IS NULL)
      `
      
      const { data: advertiserCategories } = await safeQuerySchema(
        organizationSlug,
        advertiserCategoriesQuery,
        [advertiserId]
      )
      
      if (!advertiserCategories || advertiserCategories.length === 0) {
        // No categories assigned, no conflicts possible
        return []
      }
      
      // For each competitive group, find conflicting campaigns
      for (const category of advertiserCategories) {
        if (!category.competitiveGroupId) {
          continue // No competitive group, no conflict
        }
        
        // Find other advertisers in the same competitive group
        const competitorsQuery = `
          SELECT DISTINCT ac."advertiserId"
          FROM "AdvertiserCategory" ac
          WHERE ac."competitiveGroupId" = $1
            AND ac."advertiserId" != $2
        `
        
        const { data: competitors } = await safeQuerySchema(
          organizationSlug,
          competitorsQuery,
          [category.competitiveGroupId, advertiserId]
        )
        
        if (!competitors || competitors.length === 0) {
          continue // No competitors in this group
        }
        
        const competitorIds = competitors.map(c => c.advertiserId)
        
        // Find overlapping campaigns from competitors
        let conflictingCampaignsQuery = `
          SELECT 
            c.id,
            c.name,
            c."advertiserId",
            c."startDate",
            c."endDate",
            c.status,
            c.probability,
            a.name as "advertiserName"
          FROM "Campaign" c
          JOIN "Advertiser" a ON a.id = c."advertiserId"
          WHERE c."advertiserId" = ANY($1)
            AND c.status NOT IN ('cancelled', 'completed', 'rejected')
            AND c.probability >= 50
            AND (
              (c."startDate" <= $2 AND c."endDate" >= $2) OR
              (c."startDate" <= $3 AND c."endDate" >= $3) OR
              (c."startDate" >= $2 AND c."endDate" <= $3)
            )
        `
        
        const params: any[] = [competitorIds, startDate, endDate]
        
        if (excludeCampaignId) {
          conflictingCampaignsQuery += ` AND c.id != $4`
          params.push(excludeCampaignId)
        }
        
        const { data: conflictingCampaigns } = await safeQuerySchema(
          organizationSlug,
          conflictingCampaignsQuery,
          params
        )
        
        if (conflictingCampaigns && conflictingCampaigns.length > 0) {
          conflicts.push({
            advertiserId,
            advertiserName: '', // Will be populated by caller
            categoryId: category.categoryId,
            categoryName: category.categoryName,
            competitiveGroupId: category.competitiveGroupId,
            competitiveGroupName: category.competitiveGroupName,
            conflictMode: category.conflictMode || 'warn',
            conflictingCampaigns: conflictingCampaigns.map(camp => ({
              id: camp.id,
              name: camp.name,
              advertiserId: camp.advertiserId,
              advertiserName: camp.advertiserName,
              startDate: camp.startDate,
              endDate: camp.endDate,
              status: camp.status,
              probability: camp.probability
            }))
          })
        }
      }
      
      return conflicts
      
    } catch (error) {
      console.error('Failed to check competitive conflicts:', error)
      return []
    }
  }
  
  /**
   * Store detected conflicts on a campaign
   */
  async storeConflicts(
    organizationSlug: string,
    campaignId: string,
    conflicts: CompetitiveConflict[]
  ) {
    try {
      const updateQuery = `
        UPDATE "Campaign"
        SET 
          "competitiveConflicts" = $2,
          "updatedAt" = NOW()
        WHERE id = $1
      `
      
      await safeQuerySchema(
        organizationSlug,
        updateQuery,
        [campaignId, JSON.stringify(conflicts)]
      )
      
    } catch (error) {
      console.error('Failed to store competitive conflicts:', error)
    }
  }
  
  /**
   * Check if campaign can proceed despite conflicts
   */
  canProceedWithConflicts(conflicts: CompetitiveConflict[]): {
    canProceed: boolean
    blockedBy: CompetitiveConflict[]
    warnings: CompetitiveConflict[]
  } {
    const blockedBy = conflicts.filter(c => c.conflictMode === 'block')
    const warnings = conflicts.filter(c => c.conflictMode === 'warn')
    
    return {
      canProceed: blockedBy.length === 0,
      blockedBy,
      warnings
    }
  }
  
  /**
   * Override conflicts with admin approval
   */
  async overrideConflicts(
    organizationSlug: string,
    campaignId: string,
    reason: string,
    overrideBy: string
  ) {
    try {
      const updateQuery = `
        UPDATE "Campaign"
        SET 
          "conflictOverride" = true,
          "conflictOverrideReason" = $2,
          "updatedAt" = NOW()
        WHERE id = $1
      `
      
      await safeQuerySchema(
        organizationSlug,
        updateQuery,
        [campaignId, `Override by ${overrideBy}: ${reason}`]
      )
      
      return true
      
    } catch (error) {
      console.error('Failed to override conflicts:', error)
      return false
    }
  }
}

export const competitiveCategoryService = new CompetitiveCategoryService()