import prisma from '@/lib/db/prisma'
import { Pool } from 'pg'

async function seedOrgCampaigns() {
  console.log('🚀 Starting campaign seeding in organization schemas...')
  
  try {
    // Get PodcastFlow Pro organization
    const org = await prisma.organization.findFirst({
      where: { slug: 'podcastflow-pro' }
    })
    
    if (!org) {
      throw new Error('PodcastFlow Pro organization not found')
    }
    
    console.log(`✅ Found organization: ${org.name} (${org.id})`)
    
    // Create pool for org schema
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      options: `-c search_path=org_podcastflow_pro,public`
    })
    
    // Get advertisers from org schema
    const advertisersResult = await pool.query(
      `SELECT * FROM "Advertiser" WHERE "organizationId" = $1 LIMIT 10`,
      [org.id]
    )
    
    const advertisers = advertisersResult.rows
    console.log(`📊 Found ${advertisers.length} advertisers in org schema`)
    
    if (advertisers.length === 0) {
      console.log('⚠️  No advertisers found. Creating some test advertisers first...')
      
      // Create test advertisers
      const testAdvertisers = [
        { name: 'Tech Innovators Inc', industry: 'Technology', website: 'https://techinnovators.example.com' },
        { name: 'Green Energy Solutions', industry: 'Energy', website: 'https://greenenergy.example.com' },
        { name: 'Health & Wellness Co', industry: 'Healthcare', website: 'https://healthwellness.example.com' },
        { name: 'Global Finance Corp', industry: 'Financial Services', website: 'https://globalfinance.example.com' },
        { name: 'Smart Home Systems', industry: 'Technology', website: 'https://smarthome.example.com' }
      ]
      
      for (const advertiser of testAdvertisers) {
        const result = await pool.query(
          `INSERT INTO "Advertiser" (id, "organizationId", name, industry, website, "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
           RETURNING *`,
          [
            `adv_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
            org.id,
            advertiser.name,
            advertiser.industry,
            advertiser.website
          ]
        )
        advertisers.push(result.rows[0])
        console.log(`✅ Created advertiser: ${advertiser.name}`)
      }
    }
    
    // Get a user for createdBy field
    const user = await prisma.user.findFirst({
      where: { 
        organizationId: org.id,
        role: { in: ['sales', 'admin', 'master'] }
      }
    })
    
    if (!user) {
      throw new Error('No sales/admin user found in organization')
    }
    
    console.log(`👤 Using user: ${user.name} (${user.role})`)
    
    // Create campaigns for each advertiser
    let campaignCount = 0
    const campaignStatuses = ['proposal', 'active', 'completed', 'pending']
    const campaignProbabilities = [10, 35, 65, 90]
    const campaignTypes = [
      'Q1 Brand Awareness',
      'Product Launch Campaign',
      'Holiday Promotion',
      'Summer Series',
      'Year-End Push',
      'Engagement Drive'
    ]
    
    for (const advertiser of advertisers) {
      // Create 2-3 campaigns per advertiser
      const numCampaigns = 2 + Math.floor(Math.random() * 2)
      
      for (let i = 0; i < numCampaigns; i++) {
        const campaignId = `cmp_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`
        const daysAgo = Math.floor(Math.random() * 90) + 30
        const duration = Math.floor(Math.random() * 60) + 30
        const startDate = new Date()
        startDate.setDate(startDate.getDate() - daysAgo)
        const endDate = new Date(startDate)
        endDate.setDate(endDate.getDate() + duration)
        
        // Determine status based on dates
        let status
        if (endDate < new Date()) {
          status = 'completed'
        } else if (startDate > new Date()) {
          status = 'proposal'
        } else {
          status = 'active'
        }
        
        const budget = Math.floor(Math.random() * 90000) + 10000
        const spent = status === 'completed' ? Math.floor(budget * 0.8 + Math.random() * budget * 0.2) :
                      status === 'active' ? Math.floor(budget * 0.3 + Math.random() * budget * 0.4) : 0
        
        const campaignType = campaignTypes[Math.floor(Math.random() * campaignTypes.length)]
        const probability = campaignProbabilities[Math.floor(Math.random() * campaignProbabilities.length)]
        
        await pool.query(
          `INSERT INTO "Campaign" (
            id, name, "advertiserId", "organizationId", "createdBy",
            "startDate", "endDate", budget, status, probability,
            "createdAt", "updatedAt", spent, impressions, clicks,
            conversions, "targetImpressions"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
          [
            campaignId,
            `${advertiser.name} - ${campaignType} ${startDate.getFullYear()}`,
            advertiser.id,
            org.id,
            user.id,
            startDate,
            endDate,
            budget,
            status,
            probability,
            new Date(startDate.getTime() - 7 * 24 * 60 * 60 * 1000), // Created 7 days before start
            new Date(),
            spent,
            status === 'completed' ? Math.floor(Math.random() * 100000) + 10000 :
            status === 'active' ? Math.floor(Math.random() * 50000) + 5000 : 0,
            status === 'completed' ? Math.floor(Math.random() * 1000) + 100 :
            status === 'active' ? Math.floor(Math.random() * 500) + 50 : 0,
            status === 'completed' ? Math.floor(Math.random() * 100) + 10 :
            status === 'active' ? Math.floor(Math.random() * 50) + 5 : 0,
            Math.floor(Math.random() * 150000) + 50000
          ]
        )
        
        campaignCount++
        console.log(`✅ Created campaign: ${campaignType} for ${advertiser.name} (${status})`)
      }
    }
    
    // Get campaign statistics
    const statsResult = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
        COUNT(CASE WHEN status = 'proposal' THEN 1 END) as proposal,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending
      FROM "Campaign"
      WHERE "organizationId" = $1
    `, [org.id])
    
    const stats = statsResult.rows[0]
    
    console.log('\n📊 Campaign Statistics:')
    console.log(`   Total campaigns: ${stats.total}`)
    console.log(`   Active: ${stats.active}`)
    console.log(`   Proposals: ${stats.proposal}`)
    console.log(`   Completed: ${stats.completed}`)
    console.log(`   Pending: ${stats.pending}`)
    
    await pool.end()
    console.log('\n✅ Campaign seeding complete!')
    
  } catch (error) {
    console.error('❌ Error seeding campaigns:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the seeding
seedOrgCampaigns()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })