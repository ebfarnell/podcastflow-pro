/**
 * AWS Secrets Manager Integration for PodcastFlow Pro
 * 
 * This module provides secure secret management with rotation support
 * and automatic caching to minimize AWS API calls.
 */

import { SecretsManagerClient, GetSecretValueCommand, UpdateSecretCommand } from '@aws-sdk/client-secrets-manager'
import { NodeCache } from 'node-cache'

// Cache secrets for 5 minutes to reduce API calls
const secretsCache = new NodeCache({ stdTTL: 300 })

interface SecretConfig {
  region?: string
  cacheEnabled?: boolean
  cacheTTL?: number
}

interface DatabaseSecrets {
  host: string
  port: number
  database: string
  username: string
  password: string
  sslMode?: string
}

interface AppSecrets {
  jwtSecret: string
  nextAuthSecret: string
  encryptionKey: string
}

interface EmailSecrets {
  host: string
  port: number
  username: string
  password: string
  from: string
  replyTo: string
}

interface ThirdPartySecrets {
  quickbooksClientId?: string
  quickbooksClientSecret?: string
  youtubeApiKey?: string
  megaphoneApiKey?: string
  megaphoneApiSecret?: string
  sentryDsn?: string
}

export class SecretsManager {
  private client: SecretsManagerClient
  private prefix: string
  private cacheEnabled: boolean
  
  constructor(config: SecretConfig = {}) {
    this.client = new SecretsManagerClient({
      region: config.region || process.env.AWS_SECRETS_MANAGER_REGION || 'us-east-1'
    })
    this.prefix = process.env.AWS_SECRETS_PREFIX || 'podcastflow-pro'
    this.cacheEnabled = config.cacheEnabled ?? true
  }
  
  /**
   * Get a secret value from AWS Secrets Manager
   */
  private async getSecret(secretName: string): Promise<any> {
    const fullSecretName = `${this.prefix}/${secretName}`
    
    // Check cache first
    if (this.cacheEnabled) {
      const cached = secretsCache.get(fullSecretName)
      if (cached) {
        console.log(`Secret ${fullSecretName} loaded from cache`)
        return cached
      }
    }
    
    try {
      const command = new GetSecretValueCommand({ SecretId: fullSecretName })
      const response = await this.client.send(command)
      
      if (!response.SecretString) {
        throw new Error(`Secret ${fullSecretName} is empty`)
      }
      
      const secretValue = JSON.parse(response.SecretString)
      
      // Cache the secret
      if (this.cacheEnabled) {
        secretsCache.set(fullSecretName, secretValue)
      }
      
      console.log(`Secret ${fullSecretName} loaded from AWS Secrets Manager`)
      return secretValue
    } catch (error) {
      console.error(`Failed to retrieve secret ${fullSecretName}:`, error)
      throw error
    }
  }
  
  /**
   * Update a secret in AWS Secrets Manager
   */
  private async updateSecret(secretName: string, secretValue: any): Promise<void> {
    const fullSecretName = `${this.prefix}/${secretName}`
    
    try {
      const command = new UpdateSecretCommand({
        SecretId: fullSecretName,
        SecretString: JSON.stringify(secretValue)
      })
      
      await this.client.send(command)
      
      // Clear cache
      if (this.cacheEnabled) {
        secretsCache.del(fullSecretName)
      }
      
      console.log(`Secret ${fullSecretName} updated successfully`)
    } catch (error) {
      console.error(`Failed to update secret ${fullSecretName}:`, error)
      throw error
    }
  }
  
  /**
   * Get database connection secrets
   */
  async getDatabaseSecrets(): Promise<DatabaseSecrets> {
    return this.getSecret('database')
  }
  
  /**
   * Get application secrets (JWT, encryption keys, etc.)
   */
  async getAppSecrets(): Promise<AppSecrets> {
    return this.getSecret('app')
  }
  
  /**
   * Get email configuration secrets
   */
  async getEmailSecrets(): Promise<EmailSecrets> {
    return this.getSecret('email')
  }
  
  /**
   * Get third-party integration secrets
   */
  async getThirdPartySecrets(): Promise<ThirdPartySecrets> {
    return this.getSecret('third-party')
  }
  
  /**
   * Rotate database password
   */
  async rotateDatabasePassword(newPassword: string): Promise<void> {
    const currentSecrets = await this.getDatabaseSecrets()
    const updatedSecrets = {
      ...currentSecrets,
      password: newPassword,
      passwordRotatedAt: new Date().toISOString()
    }
    
    await this.updateSecret('database', updatedSecrets)
  }
  
  /**
   * Rotate application secrets
   */
  async rotateAppSecrets(): Promise<void> {
    const crypto = require('crypto')
    
    const newSecrets: AppSecrets = {
      jwtSecret: crypto.randomBytes(64).toString('base64'),
      nextAuthSecret: crypto.randomBytes(64).toString('base64'),
      encryptionKey: crypto.randomBytes(32).toString('base64')
    }
    
    await this.updateSecret('app', {
      ...newSecrets,
      rotatedAt: new Date().toISOString()
    })
  }
  
  /**
   * Clear all cached secrets
   */
  clearCache(): void {
    secretsCache.flushAll()
    console.log('Secrets cache cleared')
  }
  
  /**
   * Get connection string with secrets
   */
  async getDatabaseUrl(): Promise<string> {
    const secrets = await this.getDatabaseSecrets()
    const sslParam = secrets.sslMode ? `?sslmode=${secrets.sslMode}` : ''
    return `postgresql://${secrets.username}:${secrets.password}@${secrets.host}:${secrets.port}/${secrets.database}${sslParam}`
  }
}

// Singleton instance
let secretsManager: SecretsManager | null = null

export function getSecretsManager(): SecretsManager {
  if (!secretsManager) {
    secretsManager = new SecretsManager()
  }
  return secretsManager
}

/**
 * Load all secrets into environment variables
 * This should be called once during application startup
 */
export async function loadSecretsToEnv(): Promise<void> {
  const manager = getSecretsManager()
  
  try {
    // Load database secrets
    const dbUrl = await manager.getDatabaseUrl()
    process.env.DATABASE_URL = dbUrl
    
    // Load app secrets
    const appSecrets = await manager.getAppSecrets()
    process.env.JWT_SECRET = appSecrets.jwtSecret
    process.env.NEXTAUTH_SECRET = appSecrets.nextAuthSecret
    
    // Load email secrets
    const emailSecrets = await manager.getEmailSecrets()
    process.env.EMAIL_HOST = emailSecrets.host
    process.env.EMAIL_PORT = emailSecrets.port.toString()
    process.env.EMAIL_USER = emailSecrets.username
    process.env.EMAIL_PASSWORD = emailSecrets.password
    process.env.EMAIL_FROM = emailSecrets.from
    process.env.EMAIL_REPLY_TO = emailSecrets.replyTo
    
    // Load third-party secrets
    const thirdPartySecrets = await manager.getThirdPartySecrets()
    if (thirdPartySecrets.quickbooksClientId) {
      process.env.QUICKBOOKS_CLIENT_ID = thirdPartySecrets.quickbooksClientId
      process.env.QUICKBOOKS_CLIENT_SECRET = thirdPartySecrets.quickbooksClientSecret
    }
    if (thirdPartySecrets.youtubeApiKey) {
      process.env.YOUTUBE_API_KEY = thirdPartySecrets.youtubeApiKey
    }
    if (thirdPartySecrets.sentryDsn) {
      process.env.SENTRY_DSN = thirdPartySecrets.sentryDsn
    }
    
    console.log('✅ All secrets loaded from AWS Secrets Manager')
  } catch (error) {
    console.error('❌ Failed to load secrets:', error)
    
    // Fall back to environment variables if Secrets Manager fails
    console.log('⚠️  Using environment variables as fallback')
  }
}

/**
 * Middleware to ensure secrets are loaded
 */
export async function ensureSecretsLoaded(): Promise<void> {
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('your_password_here')) {
    await loadSecretsToEnv()
  }
}