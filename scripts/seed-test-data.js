const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = 'podcastflow-pro';

// Sample advertisers
const advertisers = [
  {
    name: 'TechCorp Solutions',
    industry: 'technology',
    email: 'contact@techcorp.com',
    contactPerson: 'John Smith',
    status: 'active'
  },
  {
    name: 'Retail Giant Inc',
    industry: 'retail',
    email: 'marketing@retailgiant.com',
    contactPerson: 'Sarah Johnson',
    status: 'active'
  },
  {
    name: 'HealthPlus Medical',
    industry: 'healthcare',
    email: 'ads@healthplus.com',
    contactPerson: 'Dr. Mike Chen',
    status: 'active'
  },
  {
    name: 'Finance Pro Services',
    industry: 'finance',
    email: 'media@financepro.com',
    contactPerson: 'Lisa Anderson',
    status: 'active'
  },
  {
    name: 'EduLearn Platform',
    industry: 'education',
    email: 'partnerships@edulearn.com',
    contactPerson: 'David Wilson',
    status: 'active'
  }
];

// Sample agencies
const agencies = [
  {
    name: 'Creative Media Agency',
    contactPerson: 'Jennifer Roberts',
    email: 'hello@creativemedia.com',
    phone: '+1-555-0123',
    website: 'https://creativemedia.com',
    status: 'active',
    rating: 4.8
  },
  {
    name: 'Digital Marketing Solutions',
    contactPerson: 'Mark Thompson',
    email: 'info@digitalms.com',
    phone: '+1-555-0456',
    website: 'https://digitalms.com',
    status: 'active',
    rating: 4.5
  },
  {
    name: 'Brand Boost Agency',
    contactPerson: 'Emily Davis',
    email: 'contact@brandboost.com',
    phone: '+1-555-0789',
    website: 'https://brandboost.com',
    status: 'pending',
    rating: 4.2
  },
  {
    name: 'Media Masters Group',
    contactPerson: 'Robert Lee',
    email: 'team@mediamasters.com',
    phone: '+1-555-0321',
    website: 'https://mediamasters.com',
    status: 'active',
    rating: 4.9
  }
];

async function seedAdvertisers() {
  console.log('Seeding advertisers...');
  
  for (const advertiser of advertisers) {
    const advertiserId = uuidv4();
    const now = new Date().toISOString();
    
    const item = {
      PK: `ADVERTISER#${advertiserId}`,
      SK: `ADVERTISER#${advertiserId}`,
      GSI1PK: 'ADVERTISERS',
      GSI1SK: now,
      id: advertiserId,
      ...advertiser,
      createdAt: now,
      updatedAt: now
    };
    
    try {
      await dynamodb.put({
        TableName: TABLE_NAME,
        Item: item
      }).promise();
      
      console.log(`✅ Created advertiser: ${advertiser.name}`);
    } catch (error) {
      console.error(`❌ Failed to create advertiser ${advertiser.name}:`, error.message);
    }
  }
}

async function seedAgencies() {
  console.log('Seeding agencies...');
  
  for (const agency of agencies) {
    const agencyId = uuidv4();
    const now = new Date().toISOString();
    
    const item = {
      PK: `AGENCY#${agencyId}`,
      SK: `AGENCY#${agencyId}`,
      GSI1PK: 'AGENCIES',
      GSI1SK: now,
      id: agencyId,
      ...agency,
      createdAt: now,
      updatedAt: now
    };
    
    try {
      await dynamodb.put({
        TableName: TABLE_NAME,
        Item: item
      }).promise();
      
      console.log(`✅ Created agency: ${agency.name}`);
    } catch (error) {
      console.error(`❌ Failed to create agency ${agency.name}:`, error.message);
    }
  }
}

async function main() {
  try {
    console.log('🌱 Starting data seeding...');
    await seedAdvertisers();
    await seedAgencies();
    console.log('✅ Data seeding completed successfully!');
  } catch (error) {
    console.error('❌ Data seeding failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { seedAdvertisers, seedAgencies };