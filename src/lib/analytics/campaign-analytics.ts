import prisma from '@/lib/db/prisma'
import { querySchema } from '@/lib/db/schema-db'

/**
 * Initializes a campaign's analytics totals from existing analytics records
 * This ensures the campaign totals are in sync with analytics data
 */
export async function initializeCampaignTotals(campaignId: string) {
  try {
    // Get aggregated analytics data
    const totalAnalytics = await prisma.campaignAnalytics.aggregate({
      where: { campaignId },
      _sum: {
        impressions: true,
        clicks: true,
        conversions: true,
        spent: true
      }
    })

    // Update campaign totals only if there's actual analytics data
    if (totalAnalytics._sum.impressions || totalAnalytics._sum.clicks) {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          impressions: totalAnalytics._sum.impressions || 0,
          clicks: totalAnalytics._sum.clicks || 0,
          conversions: totalAnalytics._sum.conversions || 0,
          spent: totalAnalytics._sum.spent || 0
        }
      })

      console.log('✅ Campaign totals initialized from analytics data:', {
        campaignId,
        impressions: totalAnalytics._sum.impressions || 0,
        clicks: totalAnalytics._sum.clicks || 0,
        conversions: totalAnalytics._sum.conversions || 0,
        spent: totalAnalytics._sum.spent || 0
      })
    }

  } catch (error) {
    console.error('❌ Error initializing campaign totals:', error)
  }
}

/**
 * Gets aggregated campaign analytics with real calculated metrics
 * Returns zero values if no analytics data exists (no mock data)
 */
export async function getCampaignMetrics(campaignId: string, orgSlug?: string) {
  try {
    // If no orgSlug provided, try to use direct query (for backward compatibility)
    // This will fail if campaign is not in public schema
    let campaign
    
    if (orgSlug) {
      // Use schema-aware query
      campaign = await querySchema(orgSlug, (schemaClient) => 
        schemaClient.campaign.findUnique({
          where: { id: campaignId }
        })
      )
    } else {
      // Try direct query (will fail for org-specific campaigns)
      try {
        campaign = await prisma.campaign.findUnique({
          where: { id: campaignId }
        })
      } catch (error) {
        console.warn('Campaign not found in public schema, org slug required')
        return null
      }
    }

    if (!campaign) {
      return null
    }

    // Use the campaign's stored totals (which come from real analytics data)
    const totalImpressions = campaign.impressions || 0
    const totalClicks = campaign.clicks || 0
    const totalConversions = campaign.conversions || 0
    const totalSpent = campaign.spent || 0

    // Calculate metrics from actual data
    const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
    const conversionRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0
    const cpc = totalClicks > 0 ? totalSpent / totalClicks : 0
    const cpa = totalConversions > 0 ? totalSpent / totalConversions : 0

    return {
      impressions: totalImpressions,
      clicks: totalClicks,
      conversions: totalConversions,
      spent: totalSpent,
      ctr: parseFloat(ctr.toFixed(2)) + '%',
      conversionRate: parseFloat(conversionRate.toFixed(2)) + '%',
      cpc: '$' + parseFloat(cpc.toFixed(2)),
      cpa: '$' + parseFloat(cpa.toFixed(2))
    }

  } catch (error) {
    console.error('❌ Error getting campaign metrics:', error)
    return {
      impressions: 0,
      clicks: 0,
      conversions: 0,
      spent: 0,
      ctr: '0%',
      conversionRate: '0%',
      cpc: '$0',
      cpa: '$0'
    }
  }
}

/**
 * Gets metrics for multiple campaigns in a single query
 * Returns an array of metrics objects with campaignId
 */
export async function getCampaignMetricsBatch(campaignIds: string[], orgSlug: string) {
  try {
    if (!campaignIds || campaignIds.length === 0) {
      return []
    }

    // Create placeholders for the IN clause
    const placeholders = campaignIds.map((_, index) => `$${index + 1}`).join(', ')
    
    // Get all campaigns with their metrics in a single query
    const campaignsQuery = `
      SELECT 
        id as "campaignId",
        impressions,
        clicks,
        conversions,
        spent,
        budget
      FROM "Campaign"
      WHERE id IN (${placeholders})
    `
    
    const campaigns = await querySchema<any>(orgSlug, campaignsQuery, campaignIds)
    
    // Transform to metrics format
    return campaigns.map(campaign => {
      const totalImpressions = campaign.impressions || 0
      const totalClicks = campaign.clicks || 0
      const totalConversions = campaign.conversions || 0
      const totalSpent = campaign.spent || 0
      
      // Calculate metrics from actual data
      const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
      const conversionRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0
      const cpc = totalClicks > 0 ? totalSpent / totalClicks : 0
      const cpm = totalImpressions > 0 ? (totalSpent / totalImpressions) * 1000 : 0
      const cpa = totalConversions > 0 ? totalSpent / totalConversions : 0
      
      return {
        campaignId: campaign.campaignId,
        impressions: totalImpressions,
        clicks: totalClicks,
        conversions: totalConversions,
        spend: totalSpent,
        ctr: parseFloat(ctr.toFixed(2)),
        conversionRate: parseFloat(conversionRate.toFixed(2)),
        cpc: parseFloat(cpc.toFixed(2)),
        cpm: parseFloat(cpm.toFixed(2)),
        cpa: parseFloat(cpa.toFixed(2))
      }
    })
  } catch (error) {
    console.error('❌ Error getting campaign metrics batch:', error)
    return []
  }
}