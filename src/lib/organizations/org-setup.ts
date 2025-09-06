import prisma from '@/lib/db/prisma'
import { createOrganizationSchema } from '@/lib/db/schema-db'

export interface CreateOrganizationData {
  name: string
  slug: string
  email?: string
  phone?: string
  address?: string
  city?: string
  state?: string
  postalCode?: string
  country?: string
  plan?: string
}

export async function createOrganizationWithSchema(data: CreateOrganizationData) {
  try {
    // Start a transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create organization in public schema
      const schemaName = `org_${data.slug.replace(/-/g, '_')}`
      const organization = await tx.organization.create({
        data: {
          name: data.name,
          slug: data.slug,
          schemaName: schemaName,
          email: data.email,
          phone: data.phone,
          address: data.address,
          city: data.city,
          state: data.state,
          postalCode: data.postalCode,
          country: data.country || 'US',
          plan: data.plan || 'professional',
          isActive: true,
          status: 'active'
        }
      })
      
      console.log(`Created organization: ${organization.name} (${organization.id})`)
      
      // 2. Create schema and tables for the organization
      await createOrganizationSchema(organization.id, organization.slug)
      
      console.log(`Created schema for organization: ${organization.slug}`)
      
      return organization
    })
    
    return { success: true, organization: result }
  } catch (error) {
    console.error('Failed to create organization with schema:', error)
    return { success: false, error: error.message }
  }
}

// Hook into existing organization creation
export async function setupExistingOrganization(orgId: string) {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: orgId }
    })
    
    if (!org) {
      throw new Error('Organization not found')
    }
    
    // Create schema for existing organization
    await createOrganizationSchema(org.id, org.slug)
    
    console.log(`Schema created for existing organization: ${org.slug}`)
    return { success: true }
  } catch (error) {
    console.error('Failed to setup organization schema:', error)
    return { success: false, error: error.message }
  }
}