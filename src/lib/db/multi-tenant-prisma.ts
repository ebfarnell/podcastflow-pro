import { PrismaClient } from '@prisma/client'
import { User } from '@prisma/client'

// Cache Prisma clients per schema
const prismaClients: Map<string, PrismaClient> = new Map()

// Get the schema name for an organization
export function getSchemaName(orgSlug: string): string {
  // Sanitize the slug to be a valid schema name
  const sanitized = orgSlug.toLowerCase().replace(/-/g, '_')
  return `org_${sanitized}`
}

// Get organization slug from user
export async function getOrgSlugFromUser(userId: string): Promise<string | null> {
  const baseClient = getBasePrismaClient()
  const user = await baseClient.user.findUnique({
    where: { id: userId },
    include: { organization: true }
  })
  
  return user?.organization?.slug || null
}

// Get base Prisma client (public schema)
export function getBasePrismaClient(): PrismaClient {
  if (!prismaClients.has('public')) {
    const client = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL
        }
      }
    })
    prismaClients.set('public', client)
  }
  
  return prismaClients.get('public')!
}

// Get Prisma client for a specific organization
export function getOrgPrismaClient(orgSlug: string): PrismaClient {
  const schemaName = getSchemaName(orgSlug)
  
  if (!prismaClients.has(schemaName)) {
    // Create a new Prisma client with schema in the connection string
    const baseUrl = process.env.DATABASE_URL!
    const url = new URL(baseUrl)
    
    // Add schema to search path
    const currentSchema = url.searchParams.get('schema') || 'public'
    url.searchParams.set('schema', `${schemaName},${currentSchema}`)
    
    const client = new PrismaClient({
      datasources: {
        db: {
          url: url.toString()
        }
      }
    })
    
    prismaClients.set(schemaName, client)
  }
  
  return prismaClients.get(schemaName)!
}

// Extended Prisma client that routes queries to correct schema
export class MultiTenantPrismaClient {
  private baseClient: PrismaClient
  private orgSlug?: string
  
  constructor(orgSlug?: string) {
    this.baseClient = getBasePrismaClient()
    this.orgSlug = orgSlug
  }
  
  // Get the appropriate client based on the model
  private getClient(modelName: string): PrismaClient {
    // These models remain in public schema
    const publicModels = [
      'user', 'organization', 'session', 'billingPlan', 
      'systemMetric', 'monitoringAlert', 'serviceHealth'
    ]
    
    if (publicModels.includes(modelName.toLowerCase()) || !this.orgSlug) {
      return this.baseClient
    }
    
    return getOrgPrismaClient(this.orgSlug)
  }
  
  // Proxy access to models
  get user() { return this.baseClient.user }
  get organization() { return this.baseClient.organization }
  get session() { return this.baseClient.session }
  get billingPlan() { return this.baseClient.billingPlan }
  
  // Organization-specific models
  get campaign() { return this.getClient('campaign').campaign }
  get show() { return this.getClient('show').show }
  get episode() { return this.getClient('episode').episode }
  get agency() { return this.getClient('agency').agency }
  get advertiser() { return this.getClient('advertiser').advertiser }
  get adApproval() { return this.getClient('adApproval').adApproval }
  get order() { return this.getClient('order').order }
  get invoice() { return this.getClient('invoice').invoice }
  get contract() { return this.getClient('contract').contract }
  
  // Transaction support
  async $transaction(fn: (tx: any) => Promise<any>) {
    const client = this.orgSlug ? getOrgPrismaClient(this.orgSlug) : this.baseClient
    return client.$transaction(fn)
  }
  
  // Raw query support
  get $queryRaw() {
    const client = this.orgSlug ? getOrgPrismaClient(this.orgSlug) : this.baseClient
    return client.$queryRaw
  }
  
  // Disconnect all clients
  static async disconnectAll() {
    for (const [_, client] of prismaClients) {
      await client.$disconnect()
    }
    prismaClients.clear()
  }
}

// Helper to get client from request context
export async function getPrismaFromContext(userId?: string, organizationSlug?: string): Promise<MultiTenantPrismaClient> {
  // If we have an explicit organization slug, use it
  if (organizationSlug) {
    return new MultiTenantPrismaClient(organizationSlug)
  }
  
  // If we have a user ID, get their organization
  if (userId) {
    const orgSlug = await getOrgSlugFromUser(userId)
    if (orgSlug) {
      return new MultiTenantPrismaClient(orgSlug)
    }
  }
  
  // Default to base client
  return new MultiTenantPrismaClient()
}

// For master account - get all organization slugs
export async function getAllOrgSlugs(): Promise<string[]> {
  const baseClient = getBasePrismaClient()
  const orgs = await baseClient.organization.findMany({
    where: { isActive: true },
    select: { slug: true }
  })
  
  return orgs.map(org => org.slug)
}

// Master account helper to query across all orgs
export async function queryAllOrgs<T>(
  modelName: string,
  queryFn: (client: PrismaClient) => Promise<T[]>
): Promise<Array<T & { _orgSlug: string }>> {
  const orgSlugs = await getAllOrgSlugs()
  const results: Array<T & { _orgSlug: string }> = []
  
  for (const slug of orgSlugs) {
    const client = getOrgPrismaClient(slug)
    const orgResults = await queryFn(client)
    
    // Add org slug to each result
    for (const result of orgResults) {
      results.push({ ...result, _orgSlug: slug })
    }
  }
  
  return results
}