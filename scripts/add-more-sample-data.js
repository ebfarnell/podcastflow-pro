#!/usr/bin/env node

/**
 * Script to add more sample organizations and users to DynamoDB
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'podcastflow-pro';

async function addMoreSampleData() {
    console.log('Adding more sample data to DynamoDB...');

    try {
        // Additional Organizations
        const newOrganizations = [
            {
                PK: 'ORG#podcast-network',
                SK: 'PROFILE',
                organizationId: 'podcast-network',
                name: 'Podcast Network',
                domain: 'podcastnetwork.com',
                plan: 'professional',
                status: 'active',
                features: ['basic-analytics', 'team-collaboration', 'custom-branding'],
                limits: { users: 50, storage: 250, apiCalls: 7500 },
                createdAt: '2024-04-01T00:00:00Z',
                updatedAt: new Date().toISOString(),
                createdBy: 'network-admin-123'
            },
            {
                PK: 'ORG#creative-agency',
                SK: 'PROFILE',
                organizationId: 'creative-agency',
                name: 'Creative Agency',
                domain: 'creative.agency',
                plan: 'starter',
                status: 'active',
                features: ['basic-analytics'],
                limits: { users: 10, storage: 50, apiCalls: 2500 },
                createdAt: '2024-05-01T00:00:00Z',
                updatedAt: new Date().toISOString(),
                createdBy: 'agency-owner-123'
            }
        ];

        // Additional Users
        const newUsers = [
            {
                PK: 'USER#network-admin-123',
                SK: 'PROFILE',
                userId: 'network-admin-123',
                email: 'admin@podcastnetwork.com',
                name: 'Network Admin',
                role: 'admin',
                status: 'active',
                organizationId: 'podcast-network',
                phone: '+1-555-0127',
                avatar: '',
                createdAt: '2024-04-01T00:00:00Z',
                updatedAt: new Date().toISOString(),
                lastLogin: '2025-07-06T00:00:00Z'
            },
            {
                PK: 'USER#producer-user-123',
                SK: 'PROFILE',
                userId: 'producer-user-123',
                email: 'producer@podcastnetwork.com',
                name: 'Producer User',
                role: 'producer',
                status: 'active',
                organizationId: 'podcast-network',
                phone: '+1-555-0128',
                avatar: '',
                createdAt: '2024-04-15T00:00:00Z',
                updatedAt: new Date().toISOString(),
                lastLogin: '2025-07-05T00:00:00Z'
            },
            {
                PK: 'USER#agency-owner-123',
                SK: 'PROFILE',
                userId: 'agency-owner-123',
                email: 'owner@creative.agency',
                name: 'Agency Owner',
                role: 'admin',
                status: 'active',
                organizationId: 'creative-agency',
                phone: '+1-555-0129',
                avatar: '',
                createdAt: '2024-05-01T00:00:00Z',
                updatedAt: new Date().toISOString(),
                lastLogin: '2025-07-06T00:00:00Z'
            },
            {
                PK: 'USER#talent-user-123',
                SK: 'PROFILE',
                userId: 'talent-user-123',
                email: 'talent@creative.agency',
                name: 'Talent User',
                role: 'talent',
                status: 'active',
                organizationId: 'creative-agency',
                phone: '+1-555-0130',
                avatar: '',
                createdAt: '2024-05-15T00:00:00Z',
                updatedAt: new Date().toISOString(),
                lastLogin: '2025-07-04T00:00:00Z'
            },
            {
                PK: 'USER#producer2-user-123',
                SK: 'PROFILE',
                userId: 'producer2-user-123',
                email: 'producer2@media.com',
                name: 'Media Producer',
                role: 'producer',
                status: 'active',
                organizationId: 'media-company',
                phone: '+1-555-0131',
                avatar: '',
                createdAt: '2024-02-15T00:00:00Z',
                updatedAt: new Date().toISOString(),
                lastLogin: '2025-07-05T00:00:00Z'
            }
        ];

        // Additional Billing Records
        const newBillingRecords = [
            {
                PK: 'BILLING#podcast-network',
                SK: 'RECORD#2025-07-06',
                organizationId: 'podcast-network',
                organizationName: 'Podcast Network',
                plan: 'Professional',
                amount: 3600,
                status: 'paid',
                dueDate: '2025-07-18T00:00:00Z',
                lastPayment: '2025-06-18T00:00:00Z',
                invoiceUrl: 'https://invoices.podcastflow.pro/podcast-network-202507.pdf',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                PK: 'BILLING#creative-agency',
                SK: 'RECORD#2025-07-06',
                organizationId: 'creative-agency',
                organizationName: 'Creative Agency',
                plan: 'Starter',
                amount: 800,
                status: 'overdue',
                dueDate: '2025-06-25T00:00:00Z',
                lastPayment: '2025-05-25T00:00:00Z',
                invoiceUrl: 'https://invoices.podcastflow.pro/creative-agency-202507.pdf',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                PK: 'BILLING#media-company',
                SK: 'RECORD#2025-07-06',
                organizationId: 'media-company',
                organizationName: 'Media Company',
                plan: 'Enterprise',
                amount: 22500,
                status: 'paid',
                dueDate: '2025-07-10T00:00:00Z',
                lastPayment: '2025-06-10T00:00:00Z',
                invoiceUrl: 'https://invoices.podcastflow.pro/media-company-202507.pdf',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        ];

        // Add all new data
        console.log('Adding organizations...');
        for (const org of newOrganizations) {
            await putItem(org);
            
            // Add organization settings
            await putItem({
                PK: org.PK,
                SK: 'SETTINGS',
                allowedDomains: [org.domain],
                requireApproval: org.plan === 'enterprise',
                ssoEnabled: false,
                customBranding: {},
                updatedAt: new Date().toISOString()
            });
        }

        console.log('Adding users...');
        for (const user of newUsers) {
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

        console.log('Adding billing records...');
        for (const billing of newBillingRecords) {
            await putItem(billing);
        }

        console.log('✅ Additional sample data added successfully!');

    } catch (error) {
        console.error('❌ Error adding sample data:', error);
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
    addMoreSampleData()
        .then(() => {
            console.log('🎉 All additional sample data has been added!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Failed to add sample data:', error);
            process.exit(1);
        });
}

module.exports = { addMoreSampleData };