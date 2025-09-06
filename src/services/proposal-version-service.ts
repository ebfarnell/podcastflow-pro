import { querySchema } from '@/lib/db/schema-db'

interface ChangeRecord {
  type: 'created' | 'updated' | 'deleted' | 'status_changed'
  old?: any
  new?: any
  description?: string
}

interface Changes {
  [field: string]: ChangeRecord
}

export class ProposalVersionService {
  static compareObjects(oldObj: any, newObj: any, prefix = ''): Changes {
    const changes: Changes = {}
    const allKeys = new Set([
      ...Object.keys(oldObj || {}),
      ...Object.keys(newObj || {})
    ])

    allKeys.forEach(key => {
      const fieldName = prefix ? `${prefix}.${key}` : key
      const oldValue = oldObj?.[key]
      const newValue = newObj?.[key]

      // Skip comparison for certain fields
      if (['updatedAt', 'createdAt', 'id'].includes(key)) return

      // Handle null/undefined cases
      if (oldValue === undefined && newValue !== undefined) {
        changes[fieldName] = {
          type: 'created',
          new: newValue,
          description: `Added ${fieldName}`
        }
      } else if (oldValue !== undefined && newValue === undefined) {
        changes[fieldName] = {
          type: 'deleted',
          old: oldValue,
          description: `Removed ${fieldName}`
        }
      } else if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        // Special handling for status changes
        if (key === 'status' || key === 'approvalStatus') {
          changes[fieldName] = {
            type: 'status_changed',
            old: oldValue,
            new: newValue,
            description: `Status changed from ${oldValue} to ${newValue}`
          }
        } else {
          changes[fieldName] = {
            type: 'updated',
            old: oldValue,
            new: newValue
          }
        }
      }
    })

    return changes
  }

  static async trackProposalChange(
    orgSlug: string,
    proposalId: string,
    oldData: any,
    newData: any,
    changedBy: string,
    changeReason?: string
  ) {
    try {
      // Compare the old and new data
      const changes = this.compareObjects(oldData, newData)

      // If no changes detected, don't create a version
      if (Object.keys(changes).length === 0) {
        return null
      }

      // Get current version
      const versionQuery = `
        SELECT COALESCE(MAX(version), 0) as "maxVersion"
        FROM "ProposalRevision"
        WHERE "proposalId" = $1
      `
      const versionResult = await querySchema(orgSlug, versionQuery, [proposalId])
      const newVersion = (versionResult[0]?.maxVersion || 0) + 1

      // Create revision record
      const revisionId = 'rev_' + Math.random().toString(36).substr(2, 16)
      const createRevisionQuery = `
        INSERT INTO "ProposalRevision" (
          id,
          "proposalId",
          version,
          changes,
          "changedBy",
          "changeReason",
          "proposalSnapshot"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `

      const snapshot = {
        ...newData,
        versionInfo: {
          version: newVersion,
          timestamp: new Date().toISOString(),
          changedBy
        }
      }

      const result = await querySchema(
        orgSlug,
        createRevisionQuery,
        [
          revisionId,
          proposalId,
          newVersion,
          JSON.stringify(changes),
          changedBy,
          changeReason || null,
          JSON.stringify(snapshot)
        ]
      )

      // Update proposal version
      await querySchema(
        orgSlug,
        `UPDATE "Proposal" SET version = $1 WHERE id = $2`,
        [newVersion, proposalId]
      )

      return result[0]
    } catch (error) {
      console.error('Error tracking proposal change:', error)
      throw error
    }
  }

  static async getProposalAtVersion(
    orgSlug: string,
    proposalId: string,
    version: number
  ) {
    try {
      const query = `
        SELECT "proposalSnapshot"
        FROM "ProposalRevision"
        WHERE "proposalId" = $1 AND version = $2
      `
      const result = await querySchema(orgSlug, query, [proposalId, version])
      
      if (result.length > 0 && result[0].proposalSnapshot) {
        return typeof result[0].proposalSnapshot === 'string' 
          ? JSON.parse(result[0].proposalSnapshot)
          : result[0].proposalSnapshot
      }

      return null
    } catch (error) {
      console.error('Error getting proposal at version:', error)
      throw error
    }
  }

  static async restoreVersion(
    orgSlug: string,
    proposalId: string,
    version: number,
    restoredBy: string
  ) {
    try {
      // Get the snapshot at the specified version
      const snapshot = await this.getProposalAtVersion(orgSlug, proposalId, version)
      
      if (!snapshot) {
        throw new Error('Version snapshot not found')
      }

      // Get current proposal data for comparison
      const currentQuery = `SELECT * FROM "Proposal" WHERE id = $1`
      const currentResult = await querySchema(orgSlug, currentQuery, [proposalId])
      const currentData = currentResult[0]

      // Update proposal with snapshot data (excluding certain fields)
      const { id, createdAt, updatedAt, version: _, versionInfo, ...restoredData } = snapshot
      
      const updateFields = Object.keys(restoredData)
        .map((field, index) => `"${field}" = $${index + 2}`)
        .join(', ')
      
      const updateQuery = `
        UPDATE "Proposal" 
        SET ${updateFields}, "updatedAt" = NOW()
        WHERE id = $1
        RETURNING *
      `
      
      const updateValues = [proposalId, ...Object.values(restoredData)]
      const updatedResult = await querySchema(orgSlug, updateQuery, updateValues)

      // Track the restoration as a new version
      await this.trackProposalChange(
        orgSlug,
        proposalId,
        currentData,
        updatedResult[0],
        restoredBy,
        `Restored to version ${version}`
      )

      return updatedResult[0]
    } catch (error) {
      console.error('Error restoring version:', error)
      throw error
    }
  }
}