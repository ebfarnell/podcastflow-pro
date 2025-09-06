import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug, querySchema } from '@/lib/db/schema-db'
import { accessLogger } from '@/lib/security/access-logger'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get session and verify authentication
    const authToken = request.cookies.get('auth-token')?.value
    if (!authToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // CRITICAL SECURITY FIX: Use schema-aware queries for multi-tenant data
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }
    
    // Check if master is accessing cross-org data
    if (user.role === 'master' && user.organizationId !== orgSlug) {
      await accessLogger.logMasterCrossOrgAccess(
        user.id,
        user.organizationId!,
        orgSlug,
        'GET',
        `/api/campaigns/${params.id}/versions`,
        request
      )
    }

    // Fetch campaign
    const campaignQuery = `SELECT id, name FROM "Campaign" WHERE id = $1`
    const campaigns = await querySchema<any>(orgSlug, campaignQuery, [params.id])
    
    if (!campaigns || campaigns.length === 0) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }
    
    const campaign = campaigns[0]

    // Fetch campaign versions with user details
    const versionsQuery = `
      SELECT 
        cv.*,
        uc.id as creator_id, uc.name as creator_name, uc.email as creator_email,
        ua.id as approver_id, ua.name as approver_name, ua.email as approver_email
      FROM "CampaignVersion" cv
      LEFT JOIN public."User" uc ON uc.id = cv."createdBy"
      LEFT JOIN public."User" ua ON ua.id = cv."approvedBy"
      WHERE cv."campaignId" = $1
      ORDER BY cv.version DESC
    `
    const versionsRaw = await querySchema<any>(orgSlug, versionsQuery, [params.id])
    
    // Transform versions to match expected format
    const versions = versionsRaw.map(v => ({
      ...v,
      createdBy: v.creator_id ? {
        id: v.creator_id,
        name: v.creator_name,
        email: v.creator_email
      } : null,
      approvedBy: v.approver_id ? {
        id: v.approver_id,
        name: v.approver_name,
        email: v.approver_email
      } : null
    }))
    
    // Reconstruct campaign object with versions
    campaign.versions = versions

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Get change history using schema-aware queries
    const changeHistoryQuery = `
      SELECT 
        ch.*,
        u.id as changer_id, u.name as changer_name, u.email as changer_email
      FROM "CampaignChangeHistory" ch
      LEFT JOIN public."User" u ON u.id = ch."changedById"
      WHERE ch."campaignId" = $1
      ORDER BY ch."changedAt" DESC
      LIMIT 50
    `
    const changeHistoryRaw = await querySchema<any>(orgSlug, changeHistoryQuery, [params.id])
    
    // Transform change history to match expected format
    const changeHistory = changeHistoryRaw.map(ch => ({
      ...ch,
      changedBy: ch.changer_id ? {
        id: ch.changer_id,
        name: ch.changer_name,
        email: ch.changer_email
      } : null
    }))

    // Get current version details
    const currentVersion = campaign.versions.find(v => v.isCurrent) || campaign.versions[0]

    return NextResponse.json({
      campaign,
      versions: campaign.versions,
      currentVersion,
      changeHistory,
      versionCount: campaign.versions.length
    })
  } catch (error) {
    console.error('Error fetching campaign versions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get session and verify authentication
    const authToken = request.cookies.get('auth-token')?.value
    if (!authToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // CRITICAL SECURITY FIX: Use schema-aware queries for multi-tenant data
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }
    
    // Check if master is accessing cross-org data
    if (user.role === 'master' && user.organizationId !== orgSlug) {
      await accessLogger.logMasterCrossOrgAccess(
        user.id,
        user.organizationId!,
        orgSlug,
        'POST',
        `/api/campaigns/${params.id}/versions`,
        request
      )
    }

    const body = await request.json()
    const { action, versionId, comment, changes } = body

    // Verify campaign exists using schema-aware query
    const campaignQuery = `
      SELECT 
        c.*,
        cv.id as latest_version_id, cv.version as latest_version
      FROM "Campaign" c
      LEFT JOIN "CampaignVersion" cv ON cv."campaignId" = c.id
      WHERE c.id = $1
      ORDER BY cv.version DESC
      LIMIT 1
    `
    const campaignRaw = await querySchema<any>(orgSlug, campaignQuery, [params.id])

    if (!campaignRaw || campaignRaw.length === 0) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    const campaign = campaignRaw[0]

    if (action === 'create_version') {
      const latestVersion = campaign.latest_version || 0
      const newVersionNumber = latestVersion + 1

      // Create new version using schema-aware query
      const createVersionQuery = `
        INSERT INTO "CampaignVersion" (
          "campaignId", version, name, description, budget, "startDate", "endDate", 
          status, metadata, "createdById", "isCurrent", "createdAt", "updatedAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *
      `
      const metadata = {
        originalData: {
          name: campaign.name,
          description: campaign.description,
          budget: campaign.budget,
          startDate: campaign.startDate,
          endDate: campaign.endDate,
          status: campaign.status
        },
        changes: changes || [],
        comment: comment || `Version ${newVersionNumber} created`
      }
      
      const newVersions = await querySchema<any>(orgSlug, createVersionQuery, [
        params.id,
        newVersionNumber,
        campaign.name,
        campaign.description || null,
        campaign.budget || 0,
        campaign.startDate,
        campaign.endDate,
        campaign.status,
        JSON.stringify(metadata),
        user.id
      ])
      
      const newVersion = newVersions[0]

      // Mark previous versions as not current using schema-aware query
      const updatePreviousVersionsQuery = `
        UPDATE "CampaignVersion" 
        SET "isCurrent" = false 
        WHERE "campaignId" = $1 AND id != $2
      `
      await querySchema(orgSlug, updatePreviousVersionsQuery, [params.id, newVersion.id])

      // Mark new version as current using schema-aware query
      const updateCurrentVersionQuery = `
        UPDATE "CampaignVersion" 
        SET "isCurrent" = true 
        WHERE id = $1
      `
      await querySchema(orgSlug, updateCurrentVersionQuery, [newVersion.id])

      // Log the change using schema-aware query
      const logChangeQuery = `
        INSERT INTO "CampaignChangeHistory" (
          "campaignId", "versionId", "changeType", "fieldName", "oldValue", 
          "newValue", comment, "changedById", "changedAt", "createdAt", "updatedAt"
        ) VALUES ($1, $2, 'version_created', 'version', $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `
      await querySchema(orgSlug, logChangeQuery, [
        params.id,
        newVersion.id,
        latestVersion.toString(),
        newVersionNumber.toString(),
        comment || `Version ${newVersionNumber} created`,
        user.id
      ])

      return NextResponse.json({
        message: `Version ${newVersionNumber} created successfully`,
        version: newVersion
      })
    } else if (action === 'restore_version') {
      if (!versionId) {
        return NextResponse.json({ error: 'Version ID required' }, { status: 400 })
      }

      // Get the version to restore using schema-aware query
      const versionQuery = `
        SELECT * FROM "CampaignVersion" 
        WHERE id = $1 AND "campaignId" = $2
      `
      const versions = await querySchema<any>(orgSlug, versionQuery, [versionId, params.id])

      if (!versions || versions.length === 0) {
        return NextResponse.json({ error: 'Version not found' }, { status: 404 })
      }

      const versionToRestore = versions[0]

      // Update campaign with version data using schema-aware query
      const updateCampaignQuery = `
        UPDATE "Campaign" 
        SET 
          name = $2, description = $3, budget = $4, "startDate" = $5, 
          "endDate" = $6, status = $7, "updatedAt" = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `
      const updatedCampaigns = await querySchema<any>(orgSlug, updateCampaignQuery, [
        params.id,
        versionToRestore.name,
        versionToRestore.description,
        versionToRestore.budget,
        versionToRestore.startDate,
        versionToRestore.endDate,
        versionToRestore.status
      ])

      // Mark all versions as not current using schema-aware query
      const markVersionsNotCurrentQuery = `
        UPDATE "CampaignVersion" 
        SET "isCurrent" = false 
        WHERE "campaignId" = $1
      `
      await querySchema(orgSlug, markVersionsNotCurrentQuery, [params.id])

      // Mark this version as current using schema-aware query
      const markVersionCurrentQuery = `
        UPDATE "CampaignVersion" 
        SET "isCurrent" = true 
        WHERE id = $1
      `
      await querySchema(orgSlug, markVersionCurrentQuery, [versionId])

      // Log the restoration using schema-aware query
      const logRestorationQuery = `
        INSERT INTO "CampaignChangeHistory" (
          "campaignId", "versionId", "changeType", "fieldName", "oldValue", 
          "newValue", comment, "changedById", "changedAt", "createdAt", "updatedAt"
        ) VALUES ($1, $2, 'version_restored', 'version', 'current', $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `
      await querySchema(orgSlug, logRestorationQuery, [
        params.id,
        versionId,
        versionToRestore.version.toString(),
        comment || `Restored to version ${versionToRestore.version}`,
        user.id
      ])

      return NextResponse.json({
        message: `Restored to version ${versionToRestore.version}`,
        campaign: updatedCampaigns[0]
      })
    } else if (action === 'approve_version') {
      if (!versionId) {
        return NextResponse.json({ error: 'Version ID required' }, { status: 400 })
      }

      // Check permissions
      if (!['master', 'admin'].includes(user.role)) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
      }

      // Approve version using schema-aware query
      const approveVersionQuery = `
        UPDATE "CampaignVersion" 
        SET 
          "isApproved" = true, "approvedAt" = CURRENT_TIMESTAMP, 
          "approvedById" = $2, "approvalComment" = $3
        WHERE id = $1
        RETURNING *
      `
      const approvedVersions = await querySchema<any>(orgSlug, approveVersionQuery, [
        versionId, user.id, comment || null
      ])

      if (!approvedVersions || approvedVersions.length === 0) {
        return NextResponse.json({ error: 'Version not found' }, { status: 404 })
      }

      const approvedVersion = approvedVersions[0]

      // Log the approval using schema-aware query
      const logApprovalQuery = `
        INSERT INTO "CampaignChangeHistory" (
          "campaignId", "versionId", "changeType", "fieldName", "oldValue", 
          "newValue", comment, "changedById", "changedAt", "createdAt", "updatedAt"
        ) VALUES ($1, $2, 'version_approved', 'approval', 'pending', 'approved', $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `
      await querySchema(orgSlug, logApprovalQuery, [
        params.id,
        versionId,
        comment || `Version ${approvedVersion.version} approved`,
        user.id
      ])

      return NextResponse.json({
        message: `Version ${approvedVersion.version} approved`,
        version: approvedVersion
      })
    } else if (action === 'compare_versions') {
      const { versionId1, versionId2 } = body

      if (!versionId1 || !versionId2) {
        return NextResponse.json({ error: 'Two version IDs required for comparison' }, { status: 400 })
      }

      // Get both versions using schema-aware queries
      const version1Query = `
        SELECT * FROM "CampaignVersion" 
        WHERE id = $1 AND "campaignId" = $2
      `
      const version2Query = `
        SELECT * FROM "CampaignVersion" 
        WHERE id = $1 AND "campaignId" = $2
      `
      
      const [version1Result, version2Result] = await Promise.all([
        querySchema<any>(orgSlug, version1Query, [versionId1, params.id]),
        querySchema<any>(orgSlug, version2Query, [versionId2, params.id])
      ])

      const version1 = version1Result[0]
      const version2 = version2Result[0]

      if (!version1 || !version2) {
        return NextResponse.json({ error: 'One or both versions not found' }, { status: 404 })
      }

      // Compare versions
      const differences = []
      const fields = ['name', 'description', 'budget', 'startDate', 'endDate', 'status']

      for (const field of fields) {
        const value1 = (version1 as any)[field]
        const value2 = (version2 as any)[field]
        
        if (JSON.stringify(value1) !== JSON.stringify(value2)) {
          differences.push({
            field,
            version1: {
              version: version1.version,
              value: value1
            },
            version2: {
              version: version2.version,
              value: value2
            }
          })
        }
      }

      return NextResponse.json({
        version1,
        version2,
        differences,
        hasDifferences: differences.length > 0
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Error managing campaign versions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
