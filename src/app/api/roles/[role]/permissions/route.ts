import { NextRequest, NextResponse } from 'next/server'
import { db, TABLES } from '@/lib/dynamodb'

// Define permission structure
interface Permission {
  id: string
  name: string
  description: string
  category: string
  enabled: boolean
}

// Default permissions for each role
const defaultPermissions: Record<string, Permission[]> = {
  master: [
    { id: 'users.view', name: 'users.view', description: 'View all users', category: 'User Management', enabled: true },
    { id: 'users.create', name: 'users.create', description: 'Create new users', category: 'User Management', enabled: true },
    { id: 'users.update', name: 'users.update', description: 'Update user information', category: 'User Management', enabled: true },
    { id: 'users.delete', name: 'users.delete', description: 'Delete users', category: 'User Management', enabled: true },
    { id: 'users.manage.roles', name: 'users.manage.roles', description: 'Manage user roles', category: 'User Management', enabled: true },
    { id: 'permissions.manage', name: 'permissions.manage', description: 'Manage role permissions', category: 'System', enabled: true },
    { id: 'system.config', name: 'system.config', description: 'Configure system settings', category: 'System', enabled: true },
    { id: 'analytics.view.all', name: 'analytics.view.all', description: 'View all analytics', category: 'Analytics', enabled: true },
    { id: 'billing.manage', name: 'billing.manage', description: 'Manage platform billing', category: 'Finance', enabled: true },
    { id: 'organizations.manage', name: 'organizations.manage', description: 'Manage all organizations', category: 'Organizations', enabled: true },
  ],
  admin: [
    { id: 'users.view', name: 'users.view', description: 'View all users', category: 'User Management', enabled: true },
    { id: 'users.create', name: 'users.create', description: 'Create new users', category: 'User Management', enabled: true },
    { id: 'users.update', name: 'users.update', description: 'Update user information', category: 'User Management', enabled: true },
    { id: 'users.delete', name: 'users.delete', description: 'Delete users', category: 'User Management', enabled: true },
    { id: 'users.manage.roles', name: 'users.manage.roles', description: 'Manage user roles', category: 'User Management', enabled: true },
    { id: 'permissions.manage', name: 'permissions.manage', description: 'Manage role permissions', category: 'System', enabled: true },
    { id: 'system.config', name: 'system.config', description: 'Configure system settings', category: 'System', enabled: true },
    { id: 'analytics.view.all', name: 'analytics.view.all', description: 'View all analytics', category: 'Analytics', enabled: true },
  ],
  sales: [
    { id: 'campaigns.view.own', name: 'campaigns.view.own', description: 'View own campaigns', category: 'Campaigns', enabled: true },
    { id: 'campaigns.create', name: 'campaigns.create', description: 'Create new campaigns', category: 'Campaigns', enabled: true },
    { id: 'campaigns.update.own', name: 'campaigns.update.own', description: 'Update own campaigns', category: 'Campaigns', enabled: true },
    { id: 'campaigns.delete.own', name: 'campaigns.delete.own', description: 'Delete own campaigns', category: 'Campaigns', enabled: true },
    { id: 'deals.view.own', name: 'deals.view.own', description: 'View own deals pipeline', category: 'Sales', enabled: true },
    { id: 'deals.create', name: 'deals.create', description: 'Create new deals', category: 'Sales', enabled: true },
    { id: 'deals.update.own', name: 'deals.update.own', description: 'Update own deal status', category: 'Sales', enabled: true },
    { id: 'clients.view.own', name: 'clients.view.own', description: 'View assigned clients', category: 'Clients', enabled: true },
    { id: 'clients.create', name: 'clients.create', description: 'Create new clients', category: 'Clients', enabled: true },
    { id: 'billing.view.own', name: 'billing.view.own', description: 'View own billing information', category: 'Finance', enabled: true },
    { id: 'invoices.create.own', name: 'invoices.create.own', description: 'Create invoices for own clients', category: 'Finance', enabled: true },
    { id: 'approvals.submit', name: 'approvals.submit', description: 'Submit ads for approval', category: 'Content', enabled: true },
    { id: 'analytics.view.own', name: 'analytics.view.own', description: 'View own performance analytics', category: 'Analytics', enabled: true },
  ],
  producer: [
    { id: 'shows.view.assigned', name: 'shows.view.assigned', description: 'View assigned shows', category: 'Shows', enabled: true },
    { id: 'shows.edit.assigned', name: 'shows.edit.assigned', description: 'Edit assigned shows', category: 'Shows', enabled: true },
    { id: 'episodes.manage.assigned', name: 'episodes.manage.assigned', description: 'Manage episodes', category: 'Content', enabled: true },
    { id: 'approvals.review', name: 'approvals.review', description: 'Review ad submissions', category: 'Content', enabled: true },
    { id: 'approvals.manage', name: 'approvals.manage', description: 'Approve/reject ads', category: 'Content', enabled: true },
    { id: 'analytics.view.shows', name: 'analytics.view.shows', description: 'View show analytics', category: 'Analytics', enabled: true },
    { id: 'talent.assign', name: 'talent.assign', description: 'Assign talent to episodes', category: 'Team', enabled: true },
  ],
  talent: [
    { id: 'episodes.view.assigned', name: 'episodes.view.assigned', description: 'View assigned episodes', category: 'Content', enabled: true },
    { id: 'recordings.manage', name: 'recordings.manage', description: 'Manage recordings', category: 'Content', enabled: true },
    { id: 'approvals.view.assigned', name: 'approvals.view.assigned', description: 'View assigned ad approvals', category: 'Content', enabled: true },
    { id: 'schedule.view.own', name: 'schedule.view.own', description: 'View personal schedule', category: 'Schedule', enabled: true },
    { id: 'analytics.view.own', name: 'analytics.view.own', description: 'View personal analytics', category: 'Analytics', enabled: true },
  ],
  client: [
    { id: 'campaigns.view.own', name: 'campaigns.view.own', description: 'View own campaigns', category: 'Campaigns', enabled: true },
    { id: 'reports.view.own', name: 'reports.view.own', description: 'View campaign reports', category: 'Reports', enabled: true },
    { id: 'billing.view.own', name: 'billing.view.own', description: 'View own billing', category: 'Finance', enabled: true },
    { id: 'contracts.view.own', name: 'contracts.view.own', description: 'View own contracts', category: 'Contracts', enabled: true },
  ],
}

// Store for custom role permissions (in production, this would be in DynamoDB)
const customPermissionsStore = new Map<string, Permission[]>()

export async function GET(
  request: NextRequest,
  { params }: { params: { role: string } }
) {
  try {
    const role = params.role.toLowerCase()
    
    // Verify authentication
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check if role exists
    if (!defaultPermissions[role]) {
      return NextResponse.json(
        { error: 'Role not found' },
        { status: 404 }
      )
    }

    // Try to get custom permissions from store first
    let permissions = customPermissionsStore.get(role)
    
    if (!permissions) {
      // Try to load from DynamoDB
      try {
        const result = await db.get(TABLES.SETTINGS || 'podcastflow-pro', {
          PK: `ROLE_PERMISSIONS#${role}`,
          SK: `ROLE_PERMISSIONS#${role}`
        })
        
        if (result && result.permissions) {
          permissions = result.permissions
          customPermissionsStore.set(role, permissions)
        }
      } catch (error) {
        console.log(`No custom permissions found for role ${role}, using defaults`)
      }
    }

    // If no custom permissions, use defaults
    if (!permissions) {
      permissions = defaultPermissions[role]
    }

    console.log(`✅ Returning ${permissions.length} permissions for role: ${role}`)
    
    return NextResponse.json({
      role,
      permissions,
      isDefault: !customPermissionsStore.has(role)
    })

  } catch (error) {
    console.error('❌ Role permissions API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { role: string } }
) {
  try {
    const role = params.role.toLowerCase()
    
    // Verify authentication
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check if role exists
    if (!defaultPermissions[role]) {
      return NextResponse.json(
        { error: 'Role not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { permissions } = body

    if (!Array.isArray(permissions)) {
      return NextResponse.json(
        { error: 'Invalid permissions format' },
        { status: 400 }
      )
    }

    // Update permissions in store
    customPermissionsStore.set(role, permissions)

    // Save to DynamoDB
    try {
      await db.put(TABLES.SETTINGS || 'podcastflow-pro', {
        PK: `ROLE_PERMISSIONS#${role}`,
        SK: `ROLE_PERMISSIONS#${role}`,
        role,
        permissions,
        updatedAt: new Date().toISOString()
      })
    } catch (error) {
      console.error('Failed to save permissions to DynamoDB:', error)
    }

    console.log(`✅ Updated permissions for role: ${role}`)
    
    return NextResponse.json({
      success: true,
      role,
      permissions
    })

  } catch (error) {
    console.error('❌ Role permissions update error:', error)
    return NextResponse.json(
      { error: 'Failed to update permissions' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { role: string } }
) {
  // Reset to default permissions
  try {
    const role = params.role.toLowerCase()
    
    // Verify authentication
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check if role exists
    if (!defaultPermissions[role]) {
      return NextResponse.json(
        { error: 'Role not found' },
        { status: 404 }
      )
    }

    // Remove custom permissions
    customPermissionsStore.delete(role)

    // Remove from DynamoDB
    try {
      await db.delete(TABLES.SETTINGS || 'podcastflow-pro', {
        PK: `ROLE_PERMISSIONS#${role}`,
        SK: `ROLE_PERMISSIONS#${role}`
      })
    } catch (error) {
      console.error('Failed to delete custom permissions from DynamoDB:', error)
    }

    console.log(`✅ Reset permissions to defaults for role: ${role}`)
    
    return NextResponse.json({
      success: true,
      role,
      permissions: defaultPermissions[role],
      isDefault: true
    })

  } catch (error) {
    console.error('❌ Role permissions reset error:', error)
    return NextResponse.json(
      { error: 'Failed to reset permissions' },
      { status: 500 }
    )
  }
}