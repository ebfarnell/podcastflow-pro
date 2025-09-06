#!/usr/bin/env node

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

// Configure AWS
AWS.config.update({ region: 'us-east-1' });
const dynamodb = new AWS.DynamoDB.DocumentClient();

const TABLE_NAME = 'podcastflow-pro';

// Seed data
const seedData = {
  shows: [
    {
      id: 'SH002',
      name: 'Business Insights Daily',
      host: 'Michael Chen',
      category: 'Business',
      description: 'Daily insights into market trends and business strategies',
      averageListeners: 25000,
      frequency: 'daily',
      status: 'active',
      episodeLength: 30,
      createdAt: '2024-01-15T08:00:00Z',
      updatedAt: '2024-07-02T15:20:00Z'
    },
    {
      id: 'SH003',
      name: 'Health & Wellness Hour',
      host: 'Dr. Lisa Rodriguez',
      category: 'Health',
      description: 'Expert advice on health, fitness, and mental wellness',
      averageListeners: 18000,
      frequency: 'weekly',
      status: 'active',
      episodeLength: 60,
      createdAt: '2024-02-01T10:00:00Z',
      updatedAt: '2024-07-02T11:45:00Z'
    },
    {
      id: 'SH004',
      name: 'Creative Minds Podcast',
      host: 'Alex Thompson',
      category: 'Arts & Culture',
      description: 'Conversations with artists, designers, and creative professionals',
      averageListeners: 12000,
      frequency: 'weekly',
      status: 'active',
      episodeLength: 45,
      createdAt: '2024-03-01T14:00:00Z',
      updatedAt: '2024-07-01T16:30:00Z'
    },
    {
      id: 'SH005',
      name: 'Financial Freedom Focus',
      host: 'Jennifer Walsh',
      category: 'Finance',
      description: 'Practical advice for achieving financial independence',
      averageListeners: 22000,
      frequency: 'bi-weekly',
      status: 'active',
      episodeLength: 40,
      createdAt: '2024-04-01T09:00:00Z',
      updatedAt: '2024-07-02T08:15:00Z'
    }
  ],

  episodes: [
    {
      id: 'EP002',
      showId: 'SH002',
      title: 'Market Trends Q3 2024',
      description: 'Analysis of emerging market trends and investment opportunities',
      publishDate: '2024-07-02',
      status: 'published',
      duration: 1800,
      listenerCount: 28000,
      adSlots: [
        { position: 'pre-roll', duration: 30, rate: 200 },
        { position: 'mid-roll', duration: 60, rate: 350 }
      ],
      createdAt: '2024-06-28T10:00:00Z',
      updatedAt: '2024-07-02T14:30:00Z'
    },
    {
      id: 'EP003',
      showId: 'SH003',
      title: 'Summer Fitness Strategies',
      description: 'Effective workout routines and nutrition tips for summer',
      publishDate: '2024-06-30',
      status: 'published',
      duration: 3600,
      listenerCount: 19500,
      adSlots: [
        { position: 'pre-roll', duration: 30, rate: 180 },
        { position: 'mid-roll', duration: 60, rate: 320 },
        { position: 'post-roll', duration: 30, rate: 150 }
      ],
      createdAt: '2024-06-25T09:00:00Z',
      updatedAt: '2024-06-30T18:45:00Z'
    },
    {
      id: 'EP004',
      showId: 'SH004',
      title: 'Digital Art Revolution',
      description: 'How digital tools are transforming the art world',
      publishDate: '2024-07-01',
      status: 'published',
      duration: 2700,
      listenerCount: 14000,
      adSlots: [
        { position: 'mid-roll', duration: 60, rate: 280 }
      ],
      createdAt: '2024-06-26T11:00:00Z',
      updatedAt: '2024-07-01T13:20:00Z'
    },
    {
      id: 'EP005',
      showId: 'SH005',
      title: 'Investment Strategies for Beginners',
      description: 'Essential investment principles for new investors',
      publishDate: '2024-06-28',
      status: 'published',
      duration: 2400,
      listenerCount: 24500,
      adSlots: [
        { position: 'pre-roll', duration: 30, rate: 220 },
        { position: 'mid-roll', duration: 60, rate: 380 }
      ],
      createdAt: '2024-06-22T08:00:00Z',
      updatedAt: '2024-06-28T16:10:00Z'
    },
    {
      id: 'EP006',
      showId: 'SH002',
      title: 'Startup Funding Landscape 2024',
      description: 'Current state of venture capital and startup funding',
      publishDate: '2024-07-04',
      status: 'scheduled',
      duration: 1800,
      listenerCount: 0,
      adSlots: [
        { position: 'pre-roll', duration: 30, rate: 200 },
        { position: 'mid-roll', duration: 60, rate: 350 }
      ],
      createdAt: '2024-07-01T12:00:00Z',
      updatedAt: '2024-07-02T09:30:00Z'
    }
  ],

  campaigns: [
    {
      id: 'CAM003',
      name: 'FinTech Innovation Campaign',
      client: 'TechCorp Solutions',
      status: 'active',
      startDate: '2024-07-01',
      endDate: '2024-09-30',
      budget: 75000,
      spent: 15000,
      impressions: 850000,
      clicks: 28000,
      conversions: 890,
      createdAt: '2024-06-15T10:00:00Z',
      updatedAt: '2024-07-02T14:30:00Z'
    },
    {
      id: 'CAM004',
      name: 'Health & Wellness Q3',
      client: 'Wellness Partners Inc',
      status: 'active',
      startDate: '2024-06-15',
      endDate: '2024-08-15',
      budget: 45000,
      spent: 22500,
      impressions: 620000,
      clicks: 18500,
      conversions: 445,
      createdAt: '2024-06-01T09:00:00Z',
      updatedAt: '2024-07-01T16:45:00Z'
    },
    {
      id: 'CAM005',
      name: 'Creative Tools Promotion',
      client: 'Design Studios LLC',
      status: 'paused',
      startDate: '2024-05-01',
      endDate: '2024-07-31',
      budget: 35000,
      spent: 28000,
      impressions: 420000,
      clicks: 15200,
      conversions: 356,
      createdAt: '2024-04-15T11:00:00Z',
      updatedAt: '2024-06-30T10:20:00Z'
    }
  ],

  organizations: [
    {
      id: 'ORG001',
      name: 'PodcastFlow Pro Demo',
      plan: 'enterprise',
      status: 'active',
      createdAt: '2024-01-01T00:00:00Z',
      settings: {
        timezone: 'America/New_York',
        currency: 'USD',
        notifications: true
      }
    }
  ],

  users: [
    {
      id: 'USR001',
      email: 'demo@podcastflow.com',
      name: 'Demo User',
      role: 'owner',
      organizationId: 'ORG001',
      createdAt: '2024-01-01T00:00:00Z'
    }
  ]
};

// Helper function to create DynamoDB items
function createDynamoItem(type, item) {
  const timestamp = new Date().toISOString();
  
  switch (type) {
    case 'show':
      return {
        PK: `SHOW#${item.id}`,
        SK: `SHOW#${item.id}`,
        GSI1PK: 'SHOW',
        GSI1SK: item.createdAt,
        id: item.id,
        name: item.name,
        host: item.host,
        category: item.category,
        description: item.description,
        averageListeners: item.averageListeners,
        frequency: item.frequency,
        status: item.status,
        episodeLength: item.episodeLength,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      };
      
    case 'episode':
      return {
        PK: `EPISODE#${item.id}`,
        SK: `EPISODE#${item.id}`,
        GSI1PK: 'EPISODE',
        GSI1SK: item.publishDate,
        id: item.id,
        showId: item.showId,
        title: item.title,
        description: item.description,
        publishDate: item.publishDate,
        status: item.status,
        duration: item.duration,
        listenerCount: item.listenerCount,
        adSlots: item.adSlots,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      };
      
    case 'campaign':
      return {
        PK: `CAMPAIGN#${item.id}`,
        SK: `CAMPAIGN#${item.id}`,
        GSI1PK: 'CAMPAIGNS',
        GSI1SK: item.createdAt,
        id: item.id,
        name: item.name,
        client: item.client,
        status: item.status,
        startDate: item.startDate,
        endDate: item.endDate,
        budget: item.budget,
        spent: item.spent,
        impressions: item.impressions,
        clicks: item.clicks,
        conversions: item.conversions,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      };
      
    case 'organization':
      return {
        PK: `ORG#${item.id}`,
        SK: `ORG#${item.id}`,
        GSI1PK: 'ORGANIZATION',
        GSI1SK: item.createdAt,
        id: item.id,
        name: item.name,
        plan: item.plan,
        status: item.status,
        createdAt: item.createdAt,
        settings: item.settings
      };
      
    case 'user':
      return {
        PK: `USER#${item.id}`,
        SK: `USER#${item.id}`,
        GSI1PK: 'USER',
        GSI1SK: item.createdAt,
        id: item.id,
        email: item.email,
        name: item.name,
        role: item.role,
        organizationId: item.organizationId,
        createdAt: item.createdAt
      };
      
    default:
      throw new Error(`Unknown type: ${type}`);
  }
}

// Batch write function
async function batchWrite(items) {
  const batches = [];
  
  // DynamoDB batch write supports up to 25 items
  for (let i = 0; i < items.length; i += 25) {
    batches.push(items.slice(i, i + 25));
  }
  
  for (const batch of batches) {
    const params = {
      RequestItems: {
        [TABLE_NAME]: batch.map(item => ({
          PutRequest: { Item: item }
        }))
      }
    };
    
    try {
      console.log(`Writing batch of ${batch.length} items...`);
      await dynamodb.batchWrite(params).promise();
      console.log(`✓ Batch written successfully`);
    } catch (error) {
      console.error(`✗ Error writing batch:`, error);
      throw error;
    }
  }
}

// Main seeding function
async function seedDatabase() {
  console.log('🌱 Starting database seeding...');
  
  try {
    // Prepare all items
    const allItems = [];
    
    // Add shows
    seedData.shows.forEach(show => {
      allItems.push(createDynamoItem('show', show));
    });
    
    // Add episodes
    seedData.episodes.forEach(episode => {
      allItems.push(createDynamoItem('episode', episode));
    });
    
    // Add campaigns
    seedData.campaigns.forEach(campaign => {
      allItems.push(createDynamoItem('campaign', campaign));
    });
    
    // Add organizations
    seedData.organizations.forEach(org => {
      allItems.push(createDynamoItem('organization', org));
    });
    
    // Add users
    seedData.users.forEach(user => {
      allItems.push(createDynamoItem('user', user));
    });
    
    console.log(`📝 Prepared ${allItems.length} items for seeding`);
    
    // Write all items to DynamoDB
    await batchWrite(allItems);
    
    console.log('🎉 Database seeding completed successfully!');
    console.log(`
📊 Seeded Data Summary:
  • ${seedData.shows.length} Shows
  • ${seedData.episodes.length} Episodes  
  • ${seedData.campaigns.length} Campaigns
  • ${seedData.organizations.length} Organizations
  • ${seedData.users.length} Users
    `);
    
  } catch (error) {
    console.error('❌ Database seeding failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase, seedData };