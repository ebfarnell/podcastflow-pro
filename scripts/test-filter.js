const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

async function testFiltering() {
  console.log('🔍 Testing DynamoDB filtering...\n');
  
  // First, get all campaigns
  const allCampaigns = await docClient.send(new ScanCommand({
    TableName: 'PodcastFlowPro',
    FilterExpression: 'begins_with(PK, :pk)',
    ExpressionAttributeValues: {
      ':pk': 'CAMPAIGN#'
    }
  }));
  
  console.log('📊 All campaigns:');
  allCampaigns.Items.forEach(c => {
    console.log(`  - ${c.name} (org: ${c.organizationId})`);
  });
  
  console.log('\n🔍 Testing filter for test-org...');
  const testOrgCampaigns = await docClient.send(new ScanCommand({
    TableName: 'PodcastFlowPro',
    FilterExpression: 'begins_with(PK, :pk) AND organizationId = :orgId',
    ExpressionAttributeValues: {
      ':pk': 'CAMPAIGN#',
      ':orgId': 'test-org'
    }
  }));
  
  console.log(`Found ${testOrgCampaigns.Items.length} campaigns for test-org`);
  testOrgCampaigns.Items.forEach(c => {
    console.log(`  - ${c.name} (org: ${c.organizationId})`);
  });
  
  console.log('\n🔍 Testing filter for default-org...');
  const defaultOrgCampaigns = await docClient.send(new ScanCommand({
    TableName: 'PodcastFlowPro',
    FilterExpression: 'begins_with(PK, :pk) AND organizationId = :orgId',
    ExpressionAttributeValues: {
      ':pk': 'CAMPAIGN#',
      ':orgId': 'default-org'
    }
  }));
  
  console.log(`Found ${defaultOrgCampaigns.Items.length} campaigns for default-org`);
  defaultOrgCampaigns.Items.forEach(c => {
    console.log(`  - ${c.name} (org: ${c.organizationId})`);
  });
}

testFiltering().catch(console.error);