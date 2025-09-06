#!/usr/bin/env node

// Script to update all campaigns without organizationId to have a default organizationId
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const { DynamoDBDocumentClient, ScanCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb')

// Initialize DynamoDB client
const client = new DynamoDBClient({ 
  region: process.env.AWS_REGION || 'us-east-1'
})
const docClient = DynamoDBDocumentClient.from(client)

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'PodcastFlowPro'
const DEFAULT_ORG_ID = 'default-org' // This is the default organization

async function updateCampaigns() {
  try {
    console.log('🔍 Scanning for campaigns without organizationId...')
    
    // Scan for all campaigns
    const scanResult = await docClient.send(new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: 'begins_with(PK, :pk) AND attribute_not_exists(organizationId)',
      ExpressionAttributeValues: {
        ':pk': 'CAMPAIGN#'
      }
    }))

    const campaignsToUpdate = scanResult.Items || []
    console.log(`📊 Found ${campaignsToUpdate.length} campaigns without organizationId`)

    if (campaignsToUpdate.length === 0) {
      console.log('✅ All campaigns already have organizationId!')
      return
    }

    // Update each campaign
    for (const campaign of campaignsToUpdate) {
      console.log(`\n📝 Updating campaign: ${campaign.name || campaign.id}`)
      console.log(`   ID: ${campaign.id}`)
      
      try {
        await docClient.send(new UpdateCommand({
          TableName: TABLE_NAME,
          Key: {
            PK: campaign.PK,
            SK: campaign.SK
          },
          UpdateExpression: 'SET organizationId = :orgId',
          ExpressionAttributeValues: {
            ':orgId': DEFAULT_ORG_ID
          }
        }))
        
        console.log(`   ✅ Updated with organizationId: ${DEFAULT_ORG_ID}`)
      } catch (error) {
        console.error(`   ❌ Failed to update: ${error.message}`)
      }
    }

    console.log('\n✅ Campaign update complete!')
    
    // Verify the updates
    console.log('\n🔍 Verifying updates...')
    const verifyResult = await docClient.send(new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: 'begins_with(PK, :pk) AND attribute_not_exists(organizationId)',
      ExpressionAttributeValues: {
        ':pk': 'CAMPAIGN#'
      }
    }))
    
    console.log(`📊 Campaigns still without organizationId: ${verifyResult.Items?.length || 0}`)
    
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

// Run the update
updateCampaigns()