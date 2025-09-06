import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import prisma from '@/lib/db/prisma'
import { getSchemaName, safeQuerySchema } from '@/lib/db/schema-db'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'
import archiver from 'archiver'
import { createWriteStream } from 'fs'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

const execAsync = promisify(exec)

// CSV generation helper
async function generateCSV(headers: string[], rows: any[]): Promise<string> {
  const escapeCSV = (value: any): string => {
    if (value === null || value === undefined) return ''
    const str = String(value)
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }
  
  const csvRows = [
    headers.join(','),
    ...rows.map(row => 
      headers.map(header => escapeCSV(row[header])).join(',')
    )
  ]
  
  return csvRows.join('\n')
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      )
    }

    // Only admin/master users can export data
    if (!['admin', 'master'].includes(user.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { entities = [] } = body

    // Get organization
    const org = await prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { id: true, slug: true, name: true }
    })

    if (!org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
    const exportDir = `/home/ec2-user/backups/${org.id}/exports`
    const exportPath = path.join(exportDir, `export-${timestamp}`)
    
    // Ensure export directory exists
    await fs.mkdir(exportPath, { recursive: true })

    // Default entities if none specified
    const entitiesToExport = entities.length > 0 ? entities : [
      'advertisers', 'agencies', 'shows', 'episodes', 'campaigns',
      'orders', 'schedules', 'invoices', 'payments', 'users'
    ]

    const exportMetadata: any = {
      organizationId: org.id,
      organizationName: org.name,
      organizationSlug: org.slug,
      schemaName: getSchemaName(org.slug),
      exportedAt: new Date().toISOString(),
      exportedBy: user.email,
      entities: [],
      totalRows: 0
    }

    console.log(`📤 Starting CSV export for org ${org.id}`)

    // Export each entity
    for (const entity of entitiesToExport) {
      try {
        let query = ''
        let headers: string[] = []
        
        switch (entity) {
          case 'advertisers':
            query = 'SELECT * FROM "Advertiser" ORDER BY "createdAt"'
            headers = ['id', 'name', 'agencyId', 'sellerId', 'createdAt', 'updatedAt', 'active']
            break
            
          case 'agencies':
            query = 'SELECT * FROM "Agency" ORDER BY "createdAt"'
            headers = ['id', 'name', 'sellerId', 'createdAt', 'updatedAt', 'active']
            break
            
          case 'shows':
            query = 'SELECT * FROM "Show" ORDER BY "createdAt"'
            headers = ['id', 'name', 'channel', 'categoryId', 'description', 'createdAt', 'updatedAt']
            break
            
          case 'episodes':
            query = 'SELECT * FROM "Episode" ORDER BY "showId", "episodeNumber"'
            headers = ['id', 'showId', 'title', 'episodeNumber', 'airDate', 'duration', 'status', 'createdAt', 'updatedAt']
            break
            
          case 'campaigns':
            query = 'SELECT * FROM "Campaign" ORDER BY "createdAt"'
            headers = ['id', 'name', 'advertiserId', 'agencyId', 'status', 'stage', 'goalBudget', 'actualSpend', 'startDate', 'endDate', 'createdAt', 'updatedAt']
            break
            
          case 'orders':
            query = 'SELECT * FROM "Order" ORDER BY "createdAt"'
            headers = ['id', 'campaignId', 'orderNumber', 'status', 'totalValue', 'createdAt', 'updatedAt']
            break
            
          case 'schedules':
            query = 'SELECT * FROM "CampaignSchedule" ORDER BY "createdAt"'
            headers = ['id', 'campaignId', 'showId', 'episodeId', 'airDate', 'placement', 'rate', 'actualSpend', 'status', 'createdAt']
            break
            
          case 'invoices':
            query = 'SELECT * FROM "Invoice" ORDER BY "createdAt"'
            headers = ['id', 'orderId', 'invoiceNumber', 'periodStart', 'periodEnd', 'issueDate', 'dueDate', 'total', 'paid', 'status']
            break
            
          case 'payments':
            query = 'SELECT * FROM "Payment" ORDER BY "createdAt"'
            headers = ['id', 'invoiceId', 'amount', 'method', 'transactionId', 'receivedAt', 'createdAt']
            break
            
          case 'users':
            // Users are in public schema but filter by org
            const users = await prisma.user.findMany({
              where: { organizationId: org.id },
              select: {
                id: true,
                email: true,
                name: true,
                role: true,
                createdAt: true,
                lastLoginAt: true,
                isActive: true
              },
              orderBy: { createdAt: 'asc' }
            })
            
            if (users.length > 0) {
              const csvContent = await generateCSV(
                ['id', 'email', 'name', 'role', 'createdAt', 'lastLoginAt', 'isActive'],
                users
              )
              
              const csvFile = path.join(exportPath, `${entity}.csv`)
              await fs.writeFile(csvFile, csvContent, 'utf8')
              
              exportMetadata.entities.push({
                name: entity,
                rowCount: users.length,
                file: `${entity}.csv`
              })
              exportMetadata.totalRows += users.length
              
              console.log(`✅ Exported ${users.length} ${entity}`)
            }
            continue // Skip the org schema query for users
            
          default:
            console.log(`⚠️ Unsupported entity: ${entity}`)
            continue
        }
        
        // Query org schema for business data
        const { data, error } = await safeQuerySchema(org.slug, query)
        
        if (error) {
          console.error(`Failed to export ${entity}:`, error)
          continue
        }
        
        if (data.length > 0) {
          const csvContent = await generateCSV(headers, data)
          const csvFile = path.join(exportPath, `${entity}.csv`)
          await fs.writeFile(csvFile, csvContent, 'utf8')
          
          exportMetadata.entities.push({
            name: entity,
            rowCount: data.length,
            file: `${entity}.csv`
          })
          exportMetadata.totalRows += data.length
          
          console.log(`✅ Exported ${data.length} ${entity}`)
        }
        
      } catch (error) {
        console.error(`Failed to export ${entity}:`, error)
      }
    }

    // Write metadata
    const metadataFile = path.join(exportPath, 'metadata.json')
    await fs.writeFile(metadataFile, JSON.stringify(exportMetadata, null, 2))

    // Create ZIP archive
    const zipFile = path.join(exportDir, `export-${timestamp}.zip`)
    const output = createWriteStream(zipFile)
    const archive = archiver('zip', { zlib: { level: 9 } })

    archive.pipe(output)
    archive.directory(exportPath, false)
    
    await new Promise((resolve, reject) => {
      output.on('close', resolve)
      archive.on('error', reject)
      archive.finalize()
    })

    // Get ZIP file size
    const zipStats = await fs.stat(zipFile)
    
    // Clean up temporary export directory
    await execAsync(`rm -rf ${exportPath}`)
    
    console.log(`✅ Export completed: ${zipFile} (${formatBytes(zipStats.size)})`)
    
    return NextResponse.json({
      id: `export-${timestamp}.zip`,
      status: 'ready',
      message: 'Export completed successfully',
      location: zipFile,
      size: formatBytes(zipStats.size),
      entities: exportMetadata.entities,
      totalRows: exportMetadata.totalRows
    }, { status: 201 })

  } catch (error) {
    console.error('❌ Export API Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Export failed' },
      { status: 500 }
    )
  }
}

// Helper function to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}