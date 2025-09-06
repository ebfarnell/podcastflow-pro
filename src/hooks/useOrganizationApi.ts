import { useOrganization } from '@/contexts/OrganizationContext'
import { userApi } from '@/services/api'

/**
 * Hook that provides organization-aware API calls
 * Automatically injects the current organization ID into API calls
 */
export function useOrganizationApi() {
  const { organization, user } = useOrganization()


  // Organization operations
  const organizationOps = {
    get: () => userApi.getOrganization(),
    update: (data: any) => userApi.updateOrganization(data),
  }

  // User operations
  const userOps = {
    getProfile: () => userApi.getProfile(),
    updateProfile: (data: any) => userApi.updateProfile(data),
    getPreferences: () => userApi.getPreferences(),
    updatePreferences: (data: any) => userApi.updatePreferences(data),
  }

  return {
    organization: organizationOps,
    user: userOps,
    // Current context data
    currentOrganization: organization,
    currentUser: user,
    // Helper to check if organization is available
    hasOrganization: !!organization?.id,
  }
}

export default useOrganizationApi