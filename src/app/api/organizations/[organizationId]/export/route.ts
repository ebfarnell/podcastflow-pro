import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import prisma from '@/lib/db/prisma'
import { getSchemaName } from '@/lib/db/schema-db'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


const execAsync = promisify(exec)

export async function GET(
  request: NextRequest,
  { params }: { params: { organizationId: string } }
) {
  try {
    // Validate session
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions - only master or admin of the org can export
    if (user.role !== 'master' && 
        (user.role !== 'admin' || user.organizationId !== params.organizationId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get organization details
    const organization = await prisma.organization.findUnique({
      where: { id: params.organizationId }
    })

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Generate export filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `${organization.slug}-export-${timestamp}`
    const exportDir = `/tmp/${filename}`
    const schemaName = getSchemaName(organization.slug)

    try {
      // Create export directory
      await fs.mkdir(exportDir, { recursive: true })

      // 1. Export database schema data
      const dbExportPath = path.join(exportDir, 'database.sql')
      const pgDumpCommand = `PGPASSWORD="${process.env.DATABASE_PASSWORD || 'PodcastFlow2025Prod'}" pg_dump -U podcastflow -h localhost -d podcastflow_production --schema=${schemaName} --no-owner --no-privileges -f ${dbExportPath}`
      
      await execAsync(pgDumpCommand)
      console.log(`Exported database schema ${schemaName} to ${dbExportPath}`)

      // 2. Export organization metadata
      const metadata = {
        organization: {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          plan: organization.plan,
          createdAt: organization.createdAt,
          exportedAt: new Date().toISOString()
        },
        schemaName,
        exportVersion: '1.0'
      }

      await fs.writeFile(
        path.join(exportDir, 'metadata.json'),
        JSON.stringify(metadata, null, 2)
      )

      // 3. Export users (just metadata, not passwords)
      const users = await prisma.user.findMany({
        where: { organizationId: params.id },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
          lastLoginAt: true
        }
      })

      await fs.writeFile(
        path.join(exportDir, 'users.json'),
        JSON.stringify(users, null, 2)
      )

      // 4. Create import instructions
      const importInstructions = `# ${organization.name} Data Import Instructions

## Overview
This export contains all data for organization: ${organization.name} (${organization.slug})
Export created: ${new Date().toISOString()}

## Contents
- database.sql: Complete database dump of organization schema
- metadata.json: Organization metadata
- users.json: User list (without passwords)
- files/: Uploaded files (if any)

## Import Steps

### 1. Database Import
\`\`\`bash
# Create the schema if it doesn't exist
psql -U podcastflow -d podcastflow_production -c "CREATE SCHEMA IF NOT EXISTS ${schemaName};"

# Import the data
PGPASSWORD=YourPassword psql -U podcastflow -d podcastflow_production < database.sql
\`\`\`

### 2. Verify Import
\`\`\`bash
# Check tables were created
psql -U podcastflow -d podcastflow_production -c "\\dt ${schemaName}.*"
\`\`\`

### 3. User Setup
Users will need to be recreated manually or have password reset emails sent.

## Notes
- This export contains only organization-specific data
- User passwords are not included for security
- File uploads are referenced but may need to be copied separately
`

      await fs.writeFile(
        path.join(exportDir, 'IMPORT-INSTRUCTIONS.md'),
        importInstructions
      )

      // 5. Create tarball
      const tarballPath = `/tmp/${filename}.tar.gz`
      await execAsync(`cd /tmp && tar -czf ${filename}.tar.gz ${filename}/`)

      // Read the file
      const fileBuffer = await fs.readFile(tarballPath)

      // Clean up
      await execAsync(`rm -rf ${exportDir} ${tarballPath}`)

      // Return the file
      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/gzip',
          'Content-Disposition': `attachment; filename="${filename}.tar.gz"`,
          'Content-Length': fileBuffer.length.toString()
        }
      })

    } catch (error) {
      // Clean up on error
      try {
        await execAsync(`rm -rf ${exportDir}`)
      } catch (e) {}
      
      throw error
    }

  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json(
      { error: 'Failed to export organization data' },
      { status: 500 }
    )
  }
}
