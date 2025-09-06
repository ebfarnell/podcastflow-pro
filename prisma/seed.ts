import { PrismaClient, UserRole, CampaignStatus, Priority, ApprovalStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seed...')

  // Create organizations
  const demoOrg = await prisma.organization.upsert({
    where: { slug: 'demo-org' },
    update: {},
    create: {
      name: 'Demo Organization',
      slug: 'demo-org',
    }
  })

  const masterOrg = await prisma.organization.upsert({
    where: { slug: 'master-org' },
    update: {},
    create: {
      name: 'Master Organization',
      slug: 'master-org',
    }
  })

  console.log('✅ Organizations created')

  // Create users
  const hashedPassword = await bcrypt.hash('password123', 10)

  const masterAdmin = await prisma.user.upsert({
    where: { email: 'michael@unfy.com' },
    update: {},
    create: {
      email: 'michael@unfy.com',
      password: await bcrypt.hash('EMunfy2025', 10),
      name: 'Michael Admin',
      role: UserRole.master,
      organizationId: masterOrg.id,
      emailVerified: true,
    }
  })

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@podcastflow.pro' },
    update: {},
    create: {
      email: 'admin@podcastflow.pro',
      password: hashedPassword,
      name: 'Admin User',
      role: UserRole.admin,
      organizationId: demoOrg.id,
      emailVerified: true,
    }
  })

  const salesUser = await prisma.user.upsert({
    where: { email: 'sales@podcastflow.pro' },
    update: {},
    create: {
      email: 'sales@podcastflow.pro',
      password: hashedPassword,
      name: 'Sarah Sales',
      role: UserRole.sales,
      organizationId: demoOrg.id,
      emailVerified: true,
    }
  })

  const producer1 = await prisma.user.upsert({
    where: { email: 'producer1@podcastflow.pro' },
    update: {},
    create: {
      email: 'producer1@podcastflow.pro',
      password: hashedPassword,
      name: 'Paul Producer',
      role: UserRole.producer,
      organizationId: demoOrg.id,
      emailVerified: true,
    }
  })

  const producer2 = await prisma.user.upsert({
    where: { email: 'producer2@podcastflow.pro' },
    update: {},
    create: {
      email: 'producer2@podcastflow.pro',
      password: hashedPassword,
      name: 'Patty Producer',
      role: UserRole.producer,
      organizationId: demoOrg.id,
      emailVerified: true,
    }
  })

  const talent1 = await prisma.user.upsert({
    where: { email: 'talent1@podcastflow.pro' },
    update: {},
    create: {
      email: 'talent1@podcastflow.pro',
      password: hashedPassword,
      name: 'Tom Talent',
      role: UserRole.talent,
      organizationId: demoOrg.id,
      emailVerified: true,
    }
  })

  const talent2 = await prisma.user.upsert({
    where: { email: 'talent2@podcastflow.pro' },
    update: {},
    create: {
      email: 'talent2@podcastflow.pro',
      password: hashedPassword,
      name: 'Tina Talent',
      role: UserRole.talent,
      organizationId: demoOrg.id,
      emailVerified: true,
    }
  })

  const clientUser = await prisma.user.upsert({
    where: { email: 'client@podcastflow.pro' },
    update: {},
    create: {
      email: 'client@podcastflow.pro',
      password: hashedPassword,
      name: 'Charlie Client',
      role: UserRole.client,
      organizationId: demoOrg.id,
      emailVerified: true,
    }
  })

  console.log('✅ Users created')

  // Create shows
  const show1 = await prisma.show.create({
    data: {
      name: 'The Morning Show',
      description: 'A daily morning podcast covering news and lifestyle',
      organizationId: demoOrg.id,
      assignedProducers: {
        connect: [{ id: producer1.id }]
      },
      assignedTalent: {
        connect: [{ id: talent1.id }]
      }
    }
  })

  const show2 = await prisma.show.create({
    data: {
      name: 'Tech Talk',
      description: 'Weekly technology and innovation podcast',
      organizationId: demoOrg.id,
      assignedProducers: {
        connect: [{ id: producer2.id }]
      },
      assignedTalent: {
        connect: [{ id: talent2.id }]
      }
    }
  })

  const show3 = await prisma.show.create({
    data: {
      name: 'Business Insights',
      description: 'Business strategy and entrepreneurship',
      organizationId: demoOrg.id,
      assignedProducers: {
        connect: [{ id: producer1.id }, { id: producer2.id }]
      },
      assignedTalent: {
        connect: [{ id: talent1.id }, { id: talent2.id }]
      }
    }
  })

  console.log('✅ Shows created')

  // Create advertisers
  const advertiser1 = await prisma.advertiser.create({
    data: {
      name: 'TechCorp Solutions',
      contactEmail: 'contact@techcorp.com',
      contactPhone: '555-0100',
      organizationId: demoOrg.id,
    }
  })

  const advertiser2 = await prisma.advertiser.create({
    data: {
      name: 'Healthy Living Co',
      contactEmail: 'ads@healthyliving.com',
      contactPhone: '555-0200',
      organizationId: demoOrg.id,
    }
  })

  const advertiser3 = await prisma.advertiser.create({
    data: {
      name: 'Finance Plus',
      contactEmail: 'marketing@financeplus.com',
      contactPhone: '555-0300',
      organizationId: demoOrg.id,
    }
  })

  console.log('✅ Advertisers created')

  // Create campaigns
  const campaign1 = await prisma.campaign.create({
    data: {
      name: 'Q1 Brand Awareness',
      advertiserId: advertiser1.id,
      organizationId: demoOrg.id,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-03-31'),
      budget: 50000,
      status: CampaignStatus.active,
    }
  })

  const campaign2 = await prisma.campaign.create({
    data: {
      name: 'New Product Launch',
      advertiserId: advertiser2.id,
      organizationId: demoOrg.id,
      startDate: new Date('2024-02-01'),
      endDate: new Date('2024-04-30'),
      budget: 75000,
      status: CampaignStatus.active,
    }
  })

  const campaign3 = await prisma.campaign.create({
    data: {
      name: 'Holiday Special',
      advertiserId: advertiser3.id,
      organizationId: demoOrg.id,
      startDate: new Date('2024-11-01'),
      endDate: new Date('2024-12-31'),
      budget: 100000,
      status: CampaignStatus.draft,
    }
  })

  console.log('✅ Campaigns created')

  // Create ad approvals
  const adApproval1 = await prisma.adApproval.create({
    data: {
      title: 'TechCorp Q1 Campaign - Morning Show',
      advertiserId: advertiser1.id,
      advertiserName: advertiser1.name,
      campaignId: campaign1.id,
      showId: show1.id,
      showName: show1.name,
      type: 'host-read',
      duration: 30,
      script: 'Looking for cutting-edge technology solutions? TechCorp Solutions has you covered with our innovative products...',
      talkingPoints: ['Industry-leading technology', '24/7 customer support', 'Special discount for listeners'],
      priority: Priority.high,
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      status: ApprovalStatus.pending,
      salesRepId: salesUser.id,
      salesRepName: salesUser.name,
      submittedBy: salesUser.id,
      organizationId: demoOrg.id,
    }
  })

  const adApproval2 = await prisma.adApproval.create({
    data: {
      title: 'Healthy Living - Tech Talk',
      advertiserId: advertiser2.id,
      advertiserName: advertiser2.name,
      campaignId: campaign2.id,
      showId: show2.id,
      showName: show2.name,
      type: 'produced',
      duration: 60,
      script: 'Transform your health with Healthy Living Co\'s new line of organic supplements...',
      talkingPoints: ['100% organic ingredients', 'Scientifically proven results', 'Money-back guarantee'],
      priority: Priority.medium,
      deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
      status: ApprovalStatus.pending,
      salesRepId: salesUser.id,
      salesRepName: salesUser.name,
      submittedBy: salesUser.id,
      organizationId: demoOrg.id,
    }
  })

  console.log('✅ Ad approvals created')

  // Create some notifications
  await prisma.notification.createMany({
    data: [
      {
        userId: producer1.id,
        type: 'ad_approval_assigned',
        title: 'New Ad Production Assignment',
        message: `You have been assigned to produce a 30s host-read spot for ${campaign1.name}`,
        adApprovalId: adApproval1.id,
      },
      {
        userId: talent1.id,
        type: 'ad_approval_assigned',
        title: 'New Ad Recording Assignment',
        message: `You have been assigned to record a 30s host-read spot for ${campaign1.name}`,
        adApprovalId: adApproval1.id,
      },
    ]
  })

  console.log('✅ Notifications created')

  console.log('🎉 Database seed completed!')
  console.log('\n📝 Login credentials:')
  console.log('Master Admin: michael@unfy.com / EMunfy2025')
  console.log('Admin: admin@podcastflow.pro / password123')
  console.log('Sales: sales@podcastflow.pro / password123')
  console.log('Producer: producer1@podcastflow.pro / password123')
  console.log('Talent: talent1@podcastflow.pro / password123')
  console.log('Client: client@podcastflow.pro / password123')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌ Seed error:', e)
    await prisma.$disconnect()
    process.exit(1)
  })