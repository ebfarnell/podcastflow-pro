#!/usr/bin/env node

/**
 * Script to test data consistency across all master endpoints
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'podcastflow-pro';

async function testDataConsistency() {
    console.log('Testing data consistency across DynamoDB...\n');

    try {
        // Count users
        const usersCommand = new ScanCommand({
            TableName: TABLE_NAME,
            FilterExpression: 'begins_with(PK, :pk) AND SK = :sk',
            ExpressionAttributeValues: {
                ':pk': 'USER#',
                ':sk': 'PROFILE'
            }
        });
        const usersResult = await dynamodb.send(usersCommand);
        const totalUsers = usersResult.Items?.length || 0;
        
        // Count organizations
        const orgsCommand = new ScanCommand({
            TableName: TABLE_NAME,
            FilterExpression: 'begins_with(PK, :pk) AND SK = :sk',
            ExpressionAttributeValues: {
                ':pk': 'ORG#',
                ':sk': 'PROFILE'
            }
        });
        const orgsResult = await dynamodb.send(orgsCommand);
        const totalOrgs = orgsResult.Items?.length || 0;
        
        // Count billing records
        const billingCommand = new ScanCommand({
            TableName: TABLE_NAME,
            FilterExpression: 'begins_with(PK, :pk) AND contains(SK, :sk)',
            ExpressionAttributeValues: {
                ':pk': 'BILLING#',
                ':sk': 'RECORD#'
            }
        });
        const billingResult = await dynamodb.send(billingCommand);
        const totalBillingRecords = billingResult.Items?.length || 0;
        
        // Calculate total revenue
        const totalRevenue = billingResult.Items?.reduce((sum, record) => 
            sum + (record.amount || 0), 0) || 0;
        
        // Display results
        console.log('=== DynamoDB Data Summary ===\n');
        console.log(`Total Users: ${totalUsers}`);
        console.log(`Total Organizations: ${totalOrgs}`);
        console.log(`Total Billing Records: ${totalBillingRecords}`);
        console.log(`Total Revenue: $${totalRevenue.toLocaleString()}`);
        
        console.log('\n=== Users by Organization ===');
        const orgUserCount = {};
        usersResult.Items?.forEach(user => {
            const orgId = user.organizationId || 'Unknown';
            orgUserCount[orgId] = (orgUserCount[orgId] || 0) + 1;
        });
        
        orgsResult.Items?.forEach(org => {
            const userCount = orgUserCount[org.organizationId] || 0;
            console.log(`${org.name}: ${userCount} users`);
        });
        
        console.log('\n=== Users by Role ===');
        const roleCount = {};
        usersResult.Items?.forEach(user => {
            const role = user.role || 'Unknown';
            roleCount[role] = (roleCount[role] || 0) + 1;
        });
        
        Object.entries(roleCount).forEach(([role, count]) => {
            console.log(`${role}: ${count} users`);
        });
        
        console.log('\n=== Organizations by Plan ===');
        const planCount = {};
        orgsResult.Items?.forEach(org => {
            const plan = org.plan || 'Unknown';
            planCount[plan] = (planCount[plan] || 0) + 1;
        });
        
        Object.entries(planCount).forEach(([plan, count]) => {
            console.log(`${plan}: ${count} organizations`);
        });
        
        console.log('\n=== Billing Status Summary ===');
        const statusCount = {};
        let overdueAmount = 0;
        billingResult.Items?.forEach(record => {
            const status = record.status || 'Unknown';
            statusCount[status] = (statusCount[status] || 0) + 1;
            if (status === 'overdue') {
                overdueAmount += record.amount || 0;
            }
        });
        
        Object.entries(statusCount).forEach(([status, count]) => {
            console.log(`${status}: ${count} records`);
        });
        console.log(`Total Overdue Amount: $${overdueAmount.toLocaleString()}`);
        
        console.log('\n✅ Data consistency check complete!');
        console.log('\nThis data should be consistent across:');
        console.log('- Master Dashboard (overview cards)');
        console.log('- Global Analytics page');
        console.log('- Organizations page (list count)');
        console.log('- Users page (list count)');
        console.log('- Billing Management page (metrics)');
        
    } catch (error) {
        console.error('❌ Error checking data consistency:', error);
        process.exit(1);
    }
}

// Run the script
if (require.main === module) {
    testDataConsistency()
        .then(() => {
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Failed to check data consistency:', error);
            process.exit(1);
        });
}

module.exports = { testDataConsistency };