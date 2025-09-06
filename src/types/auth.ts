export type UserRole = 'master' | 'admin' | 'sales' | 'producer' | 'talent' | 'client';

export interface Organization {
  id: string;
  name: string;
  domain?: string;
  plan: 'starter' | 'professional' | 'enterprise';
  status: 'active' | 'suspended' | 'trial';
  features: string[];
  limits: {
    users?: number;
    campaigns?: number;
    shows?: number;
    storage?: number;
  };
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  metadata?: Record<string, any>;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  organizationId: string;
  avatar?: string;
  phone?: string;
  status: 'active' | 'inactive' | 'suspended';
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  metadata?: Record<string, any>;
}

export interface Permission {
  resource: string;
  actions: string[];
  conditions?: Record<string, any>;
}

export interface RolePermissions {
  role: UserRole;
  permissions: Permission[];
}

export const PERMISSIONS = {
  // Master permissions
  MASTER_VIEW_ALL: 'master:view_all',
  MASTER_MANAGE_ORGS: 'master:manage_organizations',
  MASTER_IMPERSONATE: 'master:impersonate',
  MASTER_BILLING: 'master:billing',
  MASTER_FEATURES: 'master:features',
  
  // Dashboard
  DASHBOARD_VIEW: 'dashboard:view',
  DASHBOARD_ANALYTICS: 'dashboard:analytics',
  
  // Users
  USERS_VIEW: 'users:view',
  USERS_CREATE: 'users:create',
  USERS_UPDATE: 'users:update',
  USERS_DELETE: 'users:delete',
  USERS_ASSIGN_ROLE: 'users:assign_role',
  
  // Organizations
  ORGS_VIEW: 'organizations:view',
  ORGS_CREATE: 'organizations:create',
  ORGS_UPDATE: 'organizations:update',
  ORGS_DELETE: 'organizations:delete',
  ORGS_MANAGE_FEATURES: 'organizations:manage_features',
  
  // Campaigns
  CAMPAIGNS_VIEW: 'campaigns:view',
  CAMPAIGNS_CREATE: 'campaigns:create',
  CAMPAIGNS_UPDATE: 'campaigns:update',
  CAMPAIGNS_DELETE: 'campaigns:delete',
  CAMPAIGNS_APPROVE: 'campaigns:approve',
  CAMPAIGNS_SCHEDULE: 'campaigns:schedule',
  CAMPAIGNS_VERSION_CONTROL: 'campaigns:version_control',
  
  // Orders
  ORDERS_VIEW: 'orders:view',
  ORDERS_CREATE: 'orders:create',
  ORDERS_UPDATE: 'orders:update',
  ORDERS_DELETE: 'orders:delete',
  ORDERS_APPROVE: 'orders:approve',
  ORDERS_SCHEDULE: 'orders:schedule',
  ORDERS_INVENTORY: 'orders:inventory',
  ORDERS_VERSION_CONTROL: 'orders:version_control',
  
  // Shows
  SHOWS_VIEW: 'shows:view',
  SHOWS_CREATE: 'shows:create',
  SHOWS_UPDATE: 'shows:update',
  SHOWS_DELETE: 'shows:delete',
  SHOWS_ASSIGN: 'shows:assign',
  SHOWS_PLACEMENTS: 'shows:placements',
  SHOWS_REVENUE_SHARING: 'shows:revenue_sharing',
  
  // Episodes
  EPISODES_VIEW: 'episodes:view',
  EPISODES_CREATE: 'episodes:create',
  EPISODES_UPDATE: 'episodes:update',
  EPISODES_DELETE: 'episodes:delete',
  EPISODES_PUBLISH: 'episodes:publish',
  EPISODES_TALENT_MANAGE: 'episodes:talent_manage',
  
  // Advertisers
  ADVERTISERS_VIEW: 'advertisers:view',
  ADVERTISERS_CREATE: 'advertisers:create',
  ADVERTISERS_UPDATE: 'advertisers:update',
  ADVERTISERS_DELETE: 'advertisers:delete',
  
  // Agencies
  AGENCIES_VIEW: 'agencies:view',
  AGENCIES_CREATE: 'agencies:create',
  AGENCIES_UPDATE: 'agencies:update',
  AGENCIES_DELETE: 'agencies:delete',
  
  // Contracts & IOs
  CONTRACTS_VIEW: 'contracts:view',
  CONTRACTS_CREATE: 'contracts:create',
  CONTRACTS_UPDATE: 'contracts:update',
  CONTRACTS_DELETE: 'contracts:delete',
  CONTRACTS_APPROVE: 'contracts:approve',
  CONTRACTS_SEND: 'contracts:send',
  CONTRACTS_SIGN: 'contracts:sign',
  CONTRACTS_EXECUTE: 'contracts:execute',
  CONTRACTS_TEMPLATES: 'contracts:templates',
  
  // Ad Approvals
  APPROVALS_VIEW: 'approvals:view',
  APPROVALS_CREATE: 'approvals:create',
  APPROVALS_UPDATE: 'approvals:update',
  APPROVALS_APPROVE: 'approvals:approve',
  APPROVALS_REJECT: 'approvals:reject',
  APPROVALS_RATE_DISCREPANCY: 'approvals:rate_discrepancy',
  
  // Executive Reports
  EXECUTIVE_REPORTS_VIEW: 'executive_reports:view',
  EXECUTIVE_REPORTS_PL: 'executive_reports:profit_loss',
  EXECUTIVE_REPORTS_REVENUE: 'executive_reports:revenue_projections',
  
  // Budget Management
  BUDGET_VIEW: 'budget:view',
  BUDGET_CREATE: 'budget:create',
  BUDGET_UPDATE: 'budget:update',
  BUDGET_DELETE: 'budget:delete',
  BUDGET_SALARIES: 'budget:salaries',
  BUDGET_BONUSES: 'budget:bonuses',
  BUDGET_COMMISSIONS: 'budget:commissions',
  BUDGET_REVENUE_SHARES: 'budget:revenue_shares',
  
  // Billing
  BILLING_VIEW: 'billing:view',
  BILLING_CREATE: 'billing:create',
  BILLING_UPDATE: 'billing:update',
  BILLING_EXPORT: 'billing:export',
  
  // Reports
  REPORTS_VIEW: 'reports:view',
  REPORTS_CREATE: 'reports:create',
  REPORTS_EXPORT: 'reports:export',
  REPORTS_CUSTOM: 'reports:custom',
  
  // QuickBooks Integration
  QUICKBOOKS_VIEW: 'quickbooks:view',
  QUICKBOOKS_SYNC: 'quickbooks:sync',
  QUICKBOOKS_CONFIGURE: 'quickbooks:configure',
  
  // Settings
  SETTINGS_VIEW: 'settings:view',
  SETTINGS_UPDATE: 'settings:update',
  SETTINGS_ADMIN: 'settings:admin',
  
  // Integrations
  INTEGRATIONS_VIEW: 'integrations:view',
  INTEGRATIONS_MANAGE: 'integrations:manage',
} as const;

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  master: Object.values(PERMISSIONS), // Master has all permissions
  
  admin: [
    // Dashboard
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.DASHBOARD_ANALYTICS,
    
    // Users
    PERMISSIONS.USERS_VIEW,
    PERMISSIONS.USERS_CREATE,
    PERMISSIONS.USERS_UPDATE,
    PERMISSIONS.USERS_DELETE,
    PERMISSIONS.USERS_ASSIGN_ROLE,
    
    // Organizations (limited)
    PERMISSIONS.ORGS_VIEW,
    PERMISSIONS.ORGS_UPDATE,
    
    // Campaigns
    PERMISSIONS.CAMPAIGNS_VIEW,
    PERMISSIONS.CAMPAIGNS_CREATE,
    PERMISSIONS.CAMPAIGNS_UPDATE,
    PERMISSIONS.CAMPAIGNS_DELETE,
    PERMISSIONS.CAMPAIGNS_APPROVE,
    PERMISSIONS.CAMPAIGNS_SCHEDULE,
    PERMISSIONS.CAMPAIGNS_VERSION_CONTROL,
    
    // Orders
    PERMISSIONS.ORDERS_VIEW,
    PERMISSIONS.ORDERS_CREATE,
    PERMISSIONS.ORDERS_UPDATE,
    PERMISSIONS.ORDERS_DELETE,
    PERMISSIONS.ORDERS_APPROVE,
    PERMISSIONS.ORDERS_SCHEDULE,
    PERMISSIONS.ORDERS_INVENTORY,
    PERMISSIONS.ORDERS_VERSION_CONTROL,
    
    // Shows
    PERMISSIONS.SHOWS_VIEW,
    PERMISSIONS.SHOWS_CREATE,
    PERMISSIONS.SHOWS_UPDATE,
    PERMISSIONS.SHOWS_DELETE,
    PERMISSIONS.SHOWS_ASSIGN,
    PERMISSIONS.SHOWS_PLACEMENTS,
    PERMISSIONS.SHOWS_REVENUE_SHARING,
    
    // Episodes
    PERMISSIONS.EPISODES_VIEW,
    PERMISSIONS.EPISODES_CREATE,
    PERMISSIONS.EPISODES_UPDATE,
    PERMISSIONS.EPISODES_DELETE,
    PERMISSIONS.EPISODES_PUBLISH,
    PERMISSIONS.EPISODES_TALENT_MANAGE,
    
    // Advertisers & Agencies
    PERMISSIONS.ADVERTISERS_VIEW,
    PERMISSIONS.ADVERTISERS_CREATE,
    PERMISSIONS.ADVERTISERS_UPDATE,
    PERMISSIONS.ADVERTISERS_DELETE,
    PERMISSIONS.AGENCIES_VIEW,
    PERMISSIONS.AGENCIES_CREATE,
    PERMISSIONS.AGENCIES_UPDATE,
    PERMISSIONS.AGENCIES_DELETE,
    
    // Contracts
    PERMISSIONS.CONTRACTS_VIEW,
    PERMISSIONS.CONTRACTS_CREATE,
    PERMISSIONS.CONTRACTS_UPDATE,
    PERMISSIONS.CONTRACTS_DELETE,
    PERMISSIONS.CONTRACTS_APPROVE,
    PERMISSIONS.CONTRACTS_SEND,
    PERMISSIONS.CONTRACTS_EXECUTE,
    PERMISSIONS.CONTRACTS_TEMPLATES,
    
    // Approvals
    PERMISSIONS.APPROVALS_VIEW,
    PERMISSIONS.APPROVALS_CREATE,
    PERMISSIONS.APPROVALS_UPDATE,
    PERMISSIONS.APPROVALS_APPROVE,
    PERMISSIONS.APPROVALS_REJECT,
    PERMISSIONS.APPROVALS_RATE_DISCREPANCY,
    
    // Executive Reports
    PERMISSIONS.EXECUTIVE_REPORTS_VIEW,
    PERMISSIONS.EXECUTIVE_REPORTS_PL,
    PERMISSIONS.EXECUTIVE_REPORTS_REVENUE,
    
    // Budget
    PERMISSIONS.BUDGET_VIEW,
    PERMISSIONS.BUDGET_CREATE,
    PERMISSIONS.BUDGET_UPDATE,
    PERMISSIONS.BUDGET_DELETE,
    PERMISSIONS.BUDGET_SALARIES,
    PERMISSIONS.BUDGET_BONUSES,
    PERMISSIONS.BUDGET_COMMISSIONS,
    PERMISSIONS.BUDGET_REVENUE_SHARES,
    
    // Billing & Reports
    PERMISSIONS.BILLING_VIEW,
    PERMISSIONS.BILLING_CREATE,
    PERMISSIONS.BILLING_UPDATE,
    PERMISSIONS.BILLING_EXPORT,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.REPORTS_CREATE,
    PERMISSIONS.REPORTS_EXPORT,
    PERMISSIONS.REPORTS_CUSTOM,
    
    // QuickBooks
    PERMISSIONS.QUICKBOOKS_VIEW,
    PERMISSIONS.QUICKBOOKS_SYNC,
    PERMISSIONS.QUICKBOOKS_CONFIGURE,
    
    // Settings & Integrations
    PERMISSIONS.SETTINGS_VIEW,
    PERMISSIONS.SETTINGS_UPDATE,
    PERMISSIONS.SETTINGS_ADMIN,
    PERMISSIONS.INTEGRATIONS_VIEW,
    PERMISSIONS.INTEGRATIONS_MANAGE,
  ],
  
  sales: [
    // Dashboard
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.DASHBOARD_ANALYTICS,
    
    // Campaigns (sales focus)
    PERMISSIONS.CAMPAIGNS_VIEW,
    PERMISSIONS.CAMPAIGNS_CREATE,
    PERMISSIONS.CAMPAIGNS_UPDATE,
    PERMISSIONS.CAMPAIGNS_DELETE,
    PERMISSIONS.CAMPAIGNS_SCHEDULE,
    
    // Orders (sales focus)
    PERMISSIONS.ORDERS_VIEW,
    PERMISSIONS.ORDERS_CREATE,
    PERMISSIONS.ORDERS_UPDATE,
    PERMISSIONS.ORDERS_DELETE,
    PERMISSIONS.ORDERS_SCHEDULE,
    PERMISSIONS.ORDERS_INVENTORY,
    
    // Shows & Episodes (view only)
    PERMISSIONS.SHOWS_VIEW,
    PERMISSIONS.EPISODES_VIEW,
    
    // Advertisers & Agencies (sales)
    PERMISSIONS.ADVERTISERS_VIEW,
    PERMISSIONS.ADVERTISERS_CREATE,
    PERMISSIONS.ADVERTISERS_UPDATE,
    PERMISSIONS.AGENCIES_VIEW,
    PERMISSIONS.AGENCIES_CREATE,
    PERMISSIONS.AGENCIES_UPDATE,
    
    // Contracts (sales)
    PERMISSIONS.CONTRACTS_VIEW,
    PERMISSIONS.CONTRACTS_CREATE,
    PERMISSIONS.CONTRACTS_UPDATE,
    PERMISSIONS.CONTRACTS_SEND,
    
    // Approvals
    PERMISSIONS.APPROVALS_VIEW,
    PERMISSIONS.APPROVALS_CREATE,
    PERMISSIONS.APPROVALS_UPDATE,
    
    // Reports (limited)
    PERMISSIONS.BILLING_VIEW,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.REPORTS_CREATE,
    PERMISSIONS.REPORTS_EXPORT,
    
    // Settings (basic)
    PERMISSIONS.SETTINGS_VIEW,
    PERMISSIONS.SETTINGS_UPDATE,
  ],
  
  producer: [
    // Dashboard
    PERMISSIONS.DASHBOARD_VIEW,
    
    // Shows (production focus)
    PERMISSIONS.SHOWS_VIEW,
    PERMISSIONS.SHOWS_UPDATE,
    PERMISSIONS.SHOWS_PLACEMENTS,
    
    // Episodes (full management)
    PERMISSIONS.EPISODES_VIEW,
    PERMISSIONS.EPISODES_CREATE,
    PERMISSIONS.EPISODES_UPDATE,
    PERMISSIONS.EPISODES_DELETE,
    PERMISSIONS.EPISODES_PUBLISH,
    PERMISSIONS.EPISODES_TALENT_MANAGE,
    
    // Approvals (content related)
    PERMISSIONS.APPROVALS_VIEW,
    PERMISSIONS.APPROVALS_UPDATE,
    PERMISSIONS.APPROVALS_APPROVE,
    PERMISSIONS.APPROVALS_REJECT,
    
    // Reports (view only)
    PERMISSIONS.REPORTS_VIEW,
    
    // Settings (basic)
    PERMISSIONS.SETTINGS_VIEW,
  ],
  
  talent: [
    // Dashboard (limited)
    PERMISSIONS.DASHBOARD_VIEW,
    
    // Shows (view only)
    PERMISSIONS.SHOWS_VIEW,
    
    // Episodes (view and talent management)
    PERMISSIONS.EPISODES_VIEW,
    PERMISSIONS.EPISODES_TALENT_MANAGE,
    
    // Approvals (talent specific)
    PERMISSIONS.APPROVALS_VIEW,
    PERMISSIONS.APPROVALS_APPROVE,
    PERMISSIONS.APPROVALS_REJECT,
    
    // Settings (basic)
    PERMISSIONS.SETTINGS_VIEW,
    PERMISSIONS.SETTINGS_UPDATE,
  ],
  
  client: [
    // Dashboard (read only)
    PERMISSIONS.DASHBOARD_VIEW,
    
    // Campaigns (view only)
    PERMISSIONS.CAMPAIGNS_VIEW,
    
    // Orders (view only)
    PERMISSIONS.ORDERS_VIEW,
    
    // Contracts (view only)
    PERMISSIONS.CONTRACTS_VIEW,
    
    // Approvals (view only)
    PERMISSIONS.APPROVALS_VIEW,
    
    // Reports & Billing (view only)
    PERMISSIONS.BILLING_VIEW,
    PERMISSIONS.REPORTS_VIEW,
    
    // Settings (basic)
    PERMISSIONS.SETTINGS_VIEW,
  ],
};

export function hasPermission(userRole: UserRole, permission: string): boolean {
  return ROLE_PERMISSIONS[userRole]?.includes(permission) || false;
}

export function hasAnyPermission(userRole: UserRole, permissions: string[]): boolean {
  return permissions.some(permission => hasPermission(userRole, permission));
}

export function hasAllPermissions(userRole: UserRole, permissions: string[]): boolean {
  return permissions.every(permission => hasPermission(userRole, permission));
}

// Organization features
export const ORGANIZATION_FEATURES = {
  CAMPAIGNS: 'campaigns',
  SHOWS: 'shows',
  EPISODES: 'episodes',
  AD_APPROVALS: 'ad_approvals',
  ANALYTICS: 'analytics',
  ADVANCED_ANALYTICS: 'advanced_analytics',
  BILLING: 'billing',
  INTEGRATIONS: 'integrations',
  API_ACCESS: 'api_access',
  WEBHOOKS: 'webhooks',
  CUSTOM_BRANDING: 'custom_branding',
  SSO: 'sso',
  AUDIT_LOGS: 'audit_logs',
  BACKUPS: 'backups',
  PRIORITY_SUPPORT: 'priority_support',
} as const;

export const PLAN_FEATURES: Record<string, string[]> = {
  starter: [
    ORGANIZATION_FEATURES.CAMPAIGNS,
    ORGANIZATION_FEATURES.SHOWS,
    ORGANIZATION_FEATURES.EPISODES,
    ORGANIZATION_FEATURES.AD_APPROVALS,
    ORGANIZATION_FEATURES.ANALYTICS,
    ORGANIZATION_FEATURES.BILLING,
  ],
  professional: [
    ORGANIZATION_FEATURES.CAMPAIGNS,
    ORGANIZATION_FEATURES.SHOWS,
    ORGANIZATION_FEATURES.EPISODES,
    ORGANIZATION_FEATURES.AD_APPROVALS,
    ORGANIZATION_FEATURES.ANALYTICS,
    ORGANIZATION_FEATURES.ADVANCED_ANALYTICS,
    ORGANIZATION_FEATURES.BILLING,
    ORGANIZATION_FEATURES.INTEGRATIONS,
    ORGANIZATION_FEATURES.API_ACCESS,
    ORGANIZATION_FEATURES.AUDIT_LOGS,
    ORGANIZATION_FEATURES.BACKUPS,
  ],
  enterprise: Object.values(ORGANIZATION_FEATURES),
};