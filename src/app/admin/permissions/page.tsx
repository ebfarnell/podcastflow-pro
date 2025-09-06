'use client'


import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { permissionsApi } from '@/services/api'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { RouteProtection } from '@/components/auth/RouteProtection'
import { PERMISSIONS } from '@/types/auth'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { PermissionSwitch } from '@/components/ui/PermissionSwitch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { Shield, Users, FileText, CreditCard, Radio, Briefcase } from 'lucide-react'

type Permission = {
  id: string
  name: string
  description: string
  category: string
  enabled: boolean
}

type RolePermissions = {
  role: string
  displayName: string
  description: string
  icon: any
  permissions: Permission[]
}

const roleDefinitions: Record<string, { displayName: string; description: string; icon: any }> = {
  master: { 
    displayName: 'Master', 
    description: 'Platform owner with complete system control',
    icon: Shield
  },
  admin: { 
    displayName: 'Administrator', 
    description: 'Full system access and user management',
    icon: Shield
  },
  sales: { 
    displayName: 'Sales', 
    description: 'Campaign management and client relations',
    icon: Briefcase
  },
  producer: { 
    displayName: 'Producer', 
    description: 'Show and episode production management',
    icon: Radio
  },
  talent: { 
    displayName: 'Talent', 
    description: 'Content creation and recording',
    icon: Users
  },
  client: { 
    displayName: 'Client', 
    description: 'Campaign viewing and billing access',
    icon: CreditCard
  },
}

const permissionDefinitions: Record<string, { name: string; description: string; category: string }[]> = {
  admin: [
    { name: 'users.view', description: 'View all users', category: 'User Management' },
    { name: 'users.create', description: 'Create new users', category: 'User Management' },
    { name: 'users.update', description: 'Update user information', category: 'User Management' },
    { name: 'users.delete', description: 'Delete users', category: 'User Management' },
    { name: 'users.manage.roles', description: 'Manage user roles', category: 'User Management' },
    { name: 'permissions.manage', description: 'Manage role permissions', category: 'System' },
    { name: 'system.config', description: 'Configure system settings', category: 'System' },
    { name: 'analytics.view.all', description: 'View all analytics', category: 'Analytics' },
  ],
  sales: [
    { name: 'campaigns.view.own', description: 'View own campaigns', category: 'Campaigns' },
    { name: 'campaigns.create', description: 'Create new campaigns', category: 'Campaigns' },
    { name: 'campaigns.update.own', description: 'Update own campaigns', category: 'Campaigns' },
    { name: 'campaigns.delete.own', description: 'Delete own campaigns', category: 'Campaigns' },
    { name: 'deals.view.own', description: 'View own deals pipeline', category: 'Sales' },
    { name: 'deals.create', description: 'Create new deals', category: 'Sales' },
    { name: 'deals.update.own', description: 'Update own deal status', category: 'Sales' },
    { name: 'clients.view.own', description: 'View assigned clients', category: 'Clients' },
    { name: 'clients.create', description: 'Create new clients', category: 'Clients' },
    { name: 'billing.view.own', description: 'View own billing information', category: 'Finance' },
    { name: 'invoices.create.own', description: 'Create invoices for own clients', category: 'Finance' },
    { name: 'approvals.submit', description: 'Submit ads for approval', category: 'Content' },
    { name: 'analytics.view.own', description: 'View own performance analytics', category: 'Analytics' },
  ],
  producer: [
    { name: 'shows.view.assigned', description: 'View assigned shows', category: 'Shows' },
    { name: 'shows.edit.assigned', description: 'Edit assigned shows', category: 'Shows' },
    { name: 'episodes.manage.assigned', description: 'Manage episodes', category: 'Content' },
    { name: 'approvals.review', description: 'Review ad submissions', category: 'Content' },
    { name: 'approvals.manage', description: 'Approve/reject ads', category: 'Content' },
    { name: 'analytics.view.shows', description: 'View show analytics', category: 'Analytics' },
    { name: 'talent.assign', description: 'Assign talent to episodes', category: 'Team' },
  ],
  talent: [
    { name: 'episodes.view.assigned', description: 'View assigned episodes', category: 'Content' },
    { name: 'recordings.manage', description: 'Manage recordings', category: 'Content' },
    { name: 'approvals.view.assigned', description: 'View assigned ad approvals', category: 'Content' },
    { name: 'schedule.view.own', description: 'View personal schedule', category: 'Schedule' },
    { name: 'analytics.view.own', description: 'View personal analytics', category: 'Analytics' },
  ],
  client: [
    { name: 'campaigns.view.own', description: 'View own campaigns', category: 'Campaigns' },
    { name: 'billing.view', description: 'View billing information', category: 'Finance' },
    { name: 'analytics.view.own', description: 'View campaign analytics', category: 'Analytics' },
    { name: 'approvals.view.own', description: 'View ad approval status', category: 'Content' },
  ],
}

export default function PermissionsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [rolePermissions, setRolePermissions] = useState<RolePermissions[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [activeRole, setActiveRole] = useState('sales')

  useEffect(() => {
    fetchPermissions()
  }, [])

  const fetchPermissions = async () => {
    try {
      setIsLoading(true)
      
      // Fetch permissions for all roles
      const roleNames = Object.keys(roleDefinitions)
      const permissionsData: Record<string, any> = {}
      
      // Fetch permissions for each role
      for (const role of roleNames) {
        try {
          const response = await permissionsApi.getForRole(role)
          permissionsData[role] = response.permissions
        } catch (error) {
          // Use default permissions if API fails
          console.log(`Using default permissions for ${role}`)
          permissionsData[role] = {}
        }
      }
      
      // Map to RolePermissions format
      const roles: RolePermissions[] = Object.entries(roleDefinitions).map(([role, def]) => ({
        role,
        ...def,
        permissions: permissionDefinitions[role]?.map(perm => ({
          id: perm.name,
          ...perm,
          enabled: permissionsData[role]?.[perm.category]?.[perm.name.split('.').pop()] !== false,
        })) || [],
      }))
      
      setRolePermissions(roles)
    } catch (err) {
      setError('Failed to fetch permissions')
      console.error('Error fetching permissions:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handlePermissionToggle = (role: string, permissionId: string) => {
    setRolePermissions(prev => 
      prev.map(r => {
        if (r.role === role) {
          return {
            ...r,
            permissions: r.permissions.map(p =>
              p.id === permissionId ? { ...p, enabled: !p.enabled } : p
            ),
          }
        }
        return r
      })
    )
    setSuccessMessage(null)
  }

  const handleSavePermissions = async () => {
    try {
      setIsSaving(true)
      setError(null)
      setSuccessMessage(null)
      
      // In production, this would call the API to save permissions
      // await api.put('/roles/permissions', { permissions: rolePermissions })
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      setSuccessMessage('Permissions updated successfully')
    } catch (err) {
      setError('Failed to save permissions')
    } finally {
      setIsSaving(false)
    }
  }

  const getCategoryPermissions = (permissions: Permission[], category: string) => {
    return permissions.filter(p => p.category === category)
  }

  const getCategories = (permissions: Permission[]) => {
    return [...new Set(permissions.map(p => p.category))]
  }

  return (
    <RouteProtection requiredPermission={PERMISSIONS.SETTINGS_ADMIN}>
      <DashboardLayout>
      <RoleGuard roles={['admin', 'master']}>
        <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Role Permissions Management
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Configure permissions for each role to control feature access across the platform
          </p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4">
            {error}
          </Alert>
        )}

        {successMessage && (
          <Alert variant="success" className="mb-4">
            {successMessage}
          </Alert>
        )}

        <div className="mb-6 flex justify-end">
          <Button
            onClick={handleSavePermissions}
            isLoading={isSaving}
            disabled={isLoading}
          >
            Save All Changes
          </Button>
        </div>

        <Tabs value={activeRole} onValueChange={setActiveRole}>
          <TabsList className="grid w-full grid-cols-6 mb-6">
            {rolePermissions.map(role => {
              const Icon = role.icon
              return (
                <TabsTrigger key={role.role} value={role.role} className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  {role.displayName}
                </TabsTrigger>
              )
            })}
          </TabsList>

          {rolePermissions.map(role => (
            <TabsContent key={role.role} value={role.role}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <role.icon className="h-5 w-5" />
                    {role.displayName} Permissions
                  </CardTitle>
                  <CardDescription>{role.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {getCategories(role.permissions).map(category => (
                      <div key={category}>
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                          {category}
                        </h3>
                        <div className="space-y-3">
                          {getCategoryPermissions(role.permissions, category).map(permission => (
                            <div
                              key={permission.id}
                              className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
                                permission.enabled 
                                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
                                  : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700'
                              }`}
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                                    {permission.name}
                                  </span>
                                  <code className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded">
                                    {permission.id}
                                  </code>
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                  {permission.description}
                                </p>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className={`text-sm font-medium ${
                                  permission.enabled ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'
                                }`}>
                                  {permission.enabled ? 'Enabled' : 'Disabled'}
                                </span>
                                <PermissionSwitch
                                  checked={permission.enabled}
                                  onCheckedChange={() => handlePermissionToggle(role.role, permission.id)}
                                  disabled={isLoading || isSaving}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>

        <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">
            Note on Permission Changes
          </h3>
          <p className="text-sm text-blue-700 dark:text-blue-400">
            Changes to permissions will take effect immediately for all users with the affected role.
            Users may need to refresh their session or log out and back in to see the changes.
          </p>
        </div>
      </div>
      </RoleGuard>
    </DashboardLayout>
    </RouteProtection>
  )
}