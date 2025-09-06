#!/usr/bin/env node

/**
 * Script to populate DynamoDB with sample data for testing master functionality
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'podcastflow-pro';

async function populateSampleData() {
    console.log('Populating DynamoDB with sample data...');

    try {
        // Platform Settings
        await putItem({
            PK: 'PLATFORM',
            SK: 'SETTINGS',
            platformName: 'PodcastFlow Pro',
            supportEmail: 'support@podcastflow.pro',
            maintenanceMode: false,
            registrationEnabled: true,
            defaultUserRole: 'client',
            enforceSSL: true,
            sessionTimeout: 24,
            passwordMinLength: 8,
            requireMFA: false,
            allowedDomains: '',
            emailNotifications: true,
            systemAlerts: true,
            maintenanceNotices: true,
            weeklyReports: true,
            maxUploadSize: 100,
            storageQuota: 1000,
            backupRetention: 30,
            rateLimitEnabled: true,
            requestsPerMinute: 1000,
            apiVersioning: true,
            updatedAt: new Date().toISOString()
        });

        // Sample Users
        const users = [
            {
                PK: 'USER#e4386438-00a1-70aa-a64c-df7787ee3989',
                SK: 'PROFILE',
                userId: 'e4386438-00a1-70aa-a64c-df7787ee3989',
                email: 'michael@unfy.com',
                name: 'Michael Master',
                role: 'master',
                status: 'active',
                organizationId: 'platform',
                phone: '+1-555-0123',
                avatar: '',
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: new Date().toISOString(),
                lastLogin: new Date().toISOString()
            },
            {
                PK: 'USER#admin-user-123',
                SK: 'PROFILE',
                userId: 'admin-user-123',
                email: 'admin@acme.com',
                name: 'Admin User',
                role: 'admin',
                status: 'active',
                organizationId: 'acme-corp',
                phone: '+1-555-0124',
                avatar: '',
                createdAt: '2024-06-01T00:00:00Z',
                updatedAt: new Date().toISOString(),
                lastLogin: '2025-07-05T00:00:00Z'
            },
            {
                PK: 'USER#seller-user-123',
                SK: 'PROFILE',
                userId: 'seller-user-123',
                email: 'seller@acme.com',
                name: 'Sales Person',
                role: 'seller',
                status: 'active',
                organizationId: 'acme-corp',
                phone: '+1-555-0125',
                avatar: '',
                createdAt: '2024-06-15T00:00:00Z',
                updatedAt: new Date().toISOString(),
                lastLogin: '2025-07-04T00:00:00Z'
            },
            {
                PK: 'USER#client-user-123',
                SK: 'PROFILE',
                userId: 'client-user-123',
                email: 'client@startup.com',
                name: 'Client User',
                role: 'client',
                status: 'active',
                organizationId: 'tech-startup',
                phone: '+1-555-0126',
                avatar: '',
                createdAt: '2024-03-15T00:00:00Z',
                updatedAt: new Date().toISOString(),
                lastLogin: '2025-07-03T00:00:00Z'
            }
        ];

        for (const user of users) {
            await putItem(user);
            
            // Add user preferences
            await putItem({
                PK: user.PK,
                SK: 'PREFERENCES',
                notifications: true,
                theme: 'light',
                language: 'en',
                timezone: 'America/New_York',
                updatedAt: new Date().toISOString()
            });
        }

        // Sample Organizations
        const organizations = [
            {
                PK: 'ORG#acme-corp',
                SK: 'PROFILE',
                organizationId: 'acme-corp',
                name: 'Acme Corp',
                domain: 'acme.com',
                plan: 'enterprise',
                status: 'active',
                features: ['advanced-analytics', 'custom-branding', 'api-access'],
                limits: { users: 100, storage: 500, apiCalls: 10000 },
                createdAt: '2024-01-15T00:00:00Z',
                updatedAt: new Date().toISOString(),
                createdBy: 'admin-user-123'
            },
            {
                PK: 'ORG#tech-startup',
                SK: 'PROFILE',
                organizationId: 'tech-startup',
                name: 'Tech Startup',
                domain: 'startup.com',
                plan: 'professional',
                status: 'active',
                features: ['basic-analytics', 'team-collaboration'],
                limits: { users: 25, storage: 100, apiCalls: 5000 },
                createdAt: '2024-03-01T00:00:00Z',
                updatedAt: new Date().toISOString(),
                createdBy: 'client-user-123'
            },
            {
                PK: 'ORG#media-company',
                SK: 'PROFILE',
                organizationId: 'media-company',
                name: 'Media Company',
                domain: 'media.com',
                plan: 'enterprise',
                status: 'active',
                features: ['advanced-analytics', 'custom-branding', 'api-access', 'white-label'],
                limits: { users: 200, storage: 1000, apiCalls: 20000 },
                createdAt: '2024-02-01T00:00:00Z',
                updatedAt: new Date().toISOString(),
                createdBy: 'admin-user-124'
            }
        ];

        for (const org of organizations) {
            await putItem(org);
            
            // Add organization settings
            await putItem({
                PK: org.PK,
                SK: 'SETTINGS',
                allowedDomains: [org.domain],
                requireApproval: org.plan === 'enterprise',
                ssoEnabled: org.plan === 'enterprise',
                customBranding: org.plan === 'enterprise' ? { logo: '', colors: {} } : {},
                updatedAt: new Date().toISOString()
            });
        }

        // Sample Analytics Data
        const today = new Date().toISOString().split('T')[0];
        await putItem({
            PK: 'ANALYTICS',
            SK: `GLOBAL#${today}`,
            date: today,
            totalUsers: 1247,
            activeUsers: 892,
            totalOrganizations: 45,
            totalRevenue: 124750,
            storageUsed: 2.4,
            apiCalls: 1234567,
            uptime: 99.9,
            avgResponseTime: 145,
            createdAt: new Date().toISOString()
        });

        // Sample organization analytics
        const orgAnalytics = [
            {
                PK: 'ANALYTICS',
                SK: `ORG#acme-corp#${today}`,
                organizationId: 'acme-corp',
                date: today,
                users: 25,
                revenue: 12500,
                plan: 'Enterprise',
                storageUsed: 450,
                apiCalls: 85000,
                activeUsers: 20,
                createdAt: new Date().toISOString()
            },
            {
                PK: 'ANALYTICS',
                SK: `ORG#tech-startup#${today}`,
                organizationId: 'tech-startup',
                date: today,
                users: 12,
                revenue: 2400,
                plan: 'Professional',
                storageUsed: 75,
                apiCalls: 12000,
                activeUsers: 8,
                createdAt: new Date().toISOString()
            }
        ];

        for (const analytics of orgAnalytics) {
            await putItem(analytics);
        }

        // Sample Billing Data
        const billingRecords = [
            {
                PK: 'BILLING#acme-corp',
                SK: `RECORD#${today}`,
                organizationId: 'acme-corp',
                organizationName: 'Acme Corp',
                plan: 'Enterprise',
                amount: 12500,
                status: 'paid',
                dueDate: '2025-07-15T00:00:00Z',
                lastPayment: '2025-06-15T00:00:00Z',
                invoiceUrl: 'https://invoices.podcastflow.pro/acme-corp-202507.pdf',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                PK: 'BILLING#tech-startup',
                SK: `RECORD#${today}`,
                organizationId: 'tech-startup',
                organizationName: 'Tech Startup',
                plan: 'Professional',
                amount: 2400,
                status: 'pending',
                dueDate: '2025-07-20T00:00:00Z',
                lastPayment: '2025-06-20T00:00:00Z',
                invoiceUrl: 'https://invoices.podcastflow.pro/tech-startup-202507.pdf',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        ];

        for (const billing of billingRecords) {
            await putItem(billing);
        }

        // Billing Metrics
        await putItem({
            PK: 'BILLING',
            SK: `METRICS#${today}`,
            date: today,
            totalRevenue: 124750,
            monthlyRecurring: 98200,
            overdueAmount: 3420,
            churnRate: 2.5,
            createdAt: new Date().toISOString()
        });

        console.log('✅ Sample data populated successfully!');

    } catch (error) {
        console.error('❌ Error populating sample data:', error);
        process.exit(1);
    }
}

async function putItem(item) {
    const command = new PutCommand({
        TableName: TABLE_NAME,
        Item: item
    });
    
    await dynamodb.send(command);
    console.log(`✓ Added item: ${item.PK}#${item.SK}`);
}

// Run the script
if (require.main === module) {
    populateSampleData()
        .then(() => {
            console.log('🎉 All sample data has been populated!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Failed to populate sample data:', error);
            process.exit(1);
        });
}

module.exports = { populateSampleData };