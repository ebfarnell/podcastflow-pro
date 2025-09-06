import { spawn } from 'child_process'
import fs from 'fs/promises'
import path from 'path'
import { getSchemaName } from '@/lib/db/schema-db'

export interface BackupJob {
  id: string
  organizationId: string
  organizationSlug: string
  type: 'backup' | 'export'
  scope: 'db' | 'db+files' | 'csv'
  userId: string
  userEmail: string
  notes?: string
  entities?: string[]
  timeout?: number // in ms, default 10 minutes
}

export interface BackupJobResult {
  success: boolean
  jobId: string
  files?: string[]
  size?: number
  error?: string
  duration?: number
}

const MAX_JOB_TIMEOUT = 10 * 60 * 1000 // 10 minutes

export class BackupWorker {
  private static activeJobs = new Map<string, NodeJS.Timeout>()

  static async runJob(job: BackupJob): Promise<BackupJobResult> {
    const startTime = Date.now()
    const timeout = Math.min(job.timeout || MAX_JOB_TIMEOUT, MAX_JOB_TIMEOUT)
    
    console.log(`🚀 Starting backup job ${job.id} for org ${job.organizationId}`)

    // Set timeout for job
    const timeoutHandle = setTimeout(() => {
      console.error(`⏱️ Job ${job.id} timed out after ${timeout}ms`)
      this.activeJobs.delete(job.id)
    }, timeout)
    
    this.activeJobs.set(job.id, timeoutHandle)

    try {
      let result: BackupJobResult
      
      if (job.type === 'backup') {
        result = await this.runBackupJob(job)
      } else if (job.type === 'export') {
        result = await this.runExportJob(job)
      } else {
        throw new Error(`Unknown job type: ${job.type}`)
      }
      
      clearTimeout(timeoutHandle)
      this.activeJobs.delete(job.id)
      
      const duration = Date.now() - startTime
      console.log(`✅ Job ${job.id} completed in ${duration}ms`)
      
      return { ...result, duration }
      
    } catch (error) {
      clearTimeout(timeoutHandle)
      this.activeJobs.delete(job.id)
      
      const duration = Date.now() - startTime
      console.error(`❌ Job ${job.id} failed after ${duration}ms:`, error)
      
      return {
        success: false,
        jobId: job.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration
      }
    }
  }

  private static async runBackupJob(job: BackupJob): Promise<BackupJobResult> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
    const backupDir = `/home/ec2-user/backups/${job.organizationId}`
    await fs.mkdir(backupDir, { recursive: true })
    
    const files: string[] = []
    let totalSize = 0
    
    // Database backup
    if (job.scope === 'db' || job.scope === 'db+files') {
      const schemaName = getSchemaName(job.organizationSlug)
      const dbBackupFile = path.join(backupDir, `db-${timestamp}.sql.gz`)
      
      await this.runCommand(
        'pg_dump',
        [
          '-U', 'podcastflow',
          '-h', 'localhost',
          '-d', 'podcastflow_production',
          '--schema', schemaName,
          '--schema', 'public',
          '--no-owner',
          '--no-privileges'
        ],
        {
          env: { ...process.env, PGPASSWORD: 'PodcastFlow2025Prod' },
          pipeToGzip: dbBackupFile
        }
      )
      
      const stats = await fs.stat(dbBackupFile)
      files.push(dbBackupFile)
      totalSize += stats.size
      
      console.log(`✅ Database backup created: ${dbBackupFile} (${this.formatBytes(stats.size)})`)
    }
    
    // Files backup
    if (job.scope === 'db+files') {
      const filesDir = `/home/ec2-user/uploads/${job.organizationId}`
      try {
        await fs.access(filesDir)
        const filesBackupFile = path.join(backupDir, `files-${timestamp}.tar.gz`)
        
        await this.runCommand(
          'tar',
          ['-czf', filesBackupFile, '-C', '/home/ec2-user/uploads', `${job.organizationId}/`]
        )
        
        const stats = await fs.stat(filesBackupFile)
        files.push(filesBackupFile)
        totalSize += stats.size
        
        console.log(`✅ Files backup created: ${filesBackupFile} (${this.formatBytes(stats.size)})`)
      } catch {
        console.log('No files directory found for org, skipping files backup')
      }
    }
    
    // Create manifest
    const manifestFile = path.join(backupDir, `manifest-${timestamp}.json`)
    const manifest = {
      jobId: job.id,
      organizationId: job.organizationId,
      organizationSlug: job.organizationSlug,
      schemaName: getSchemaName(job.organizationSlug),
      createdAt: new Date().toISOString(),
      createdBy: job.userEmail,
      scope: job.scope,
      notes: job.notes,
      files: files.map(f => path.basename(f)),
      totalSize
    }
    
    await fs.writeFile(manifestFile, JSON.stringify(manifest, null, 2))
    files.push(manifestFile)
    
    return {
      success: true,
      jobId: job.id,
      files,
      size: totalSize
    }
  }

  private static async runExportJob(job: BackupJob): Promise<BackupJobResult> {
    // Export job would be implemented similarly
    // For now, return a placeholder
    return {
      success: true,
      jobId: job.id,
      files: [],
      size: 0
    }
  }

  private static runCommand(
    command: string,
    args: string[],
    options?: { env?: NodeJS.ProcessEnv; pipeToGzip?: string }
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn(command, args, {
        env: options?.env || process.env,
        shell: false
      })
      
      let gzipProc: any
      if (options?.pipeToGzip) {
        gzipProc = spawn('gzip', [], { shell: false })
        proc.stdout.pipe(gzipProc.stdin)
        
        const writeStream = require('fs').createWriteStream(options.pipeToGzip)
        gzipProc.stdout.pipe(writeStream)
        
        writeStream.on('finish', () => resolve())
        writeStream.on('error', reject)
      }
      
      let stderr = ''
      proc.stderr.on('data', (data) => {
        stderr += data.toString()
      })
      
      proc.on('error', reject)
      proc.on('exit', (code) => {
        if (code !== 0) {
          reject(new Error(`Command failed with code ${code}: ${stderr}`))
        } else if (!options?.pipeToGzip) {
          resolve()
        }
      })
      
      if (gzipProc) {
        gzipProc.on('error', reject)
      }
    })
  }

  private static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  static cancelJob(jobId: string): boolean {
    const timeout = this.activeJobs.get(jobId)
    if (timeout) {
      clearTimeout(timeout)
      this.activeJobs.delete(jobId)
      console.log(`🛑 Job ${jobId} cancelled`)
      return true
    }
    return false
  }

  static getActiveJobs(): string[] {
    return Array.from(this.activeJobs.keys())
  }
}