import prisma from '../src/lib/db/prisma'

async function testShowAPI() {
  console.log('=== TESTING SHOW API ENDPOINTS ===\n')

  try {
    // Get a show
    const show = await prisma.show.findFirst({
      where: { id: 'show1' }
    })

    if (!show) {
      console.log('Show not found!')
      return
    }

    console.log('Testing with show:', show.name, '(ID:', show.id, ')')

    // Test the same queries the API would run
    console.log('\n1. Testing show detail query:')
    const showDetail = await prisma.show.findUnique({
      where: { id: show.id },
      include: {
        _count: {
          select: {
            episodes: true,
          }
        },
        episodes: {
          take: 5,
          orderBy: {
            episodeNumber: 'desc'
          },
          select: {
            id: true,
            episodeNumber: true,
            title: true,
            duration: true,
            airDate: true,
            status: true,
          }
        }
      }
    })

    if (showDetail) {
      console.log('✅ Show found successfully')
      console.log('  Episodes count:', showDetail._count.episodes)
      console.log('  Recent episodes:', showDetail.episodes.length)
    }

    // Test episode aggregate
    console.log('\n2. Testing episode aggregate:')
    const episodeStats = await prisma.episode.aggregate({
      where: { showId: show.id },
      _avg: {
        duration: true,
      },
      _count: {
        id: true,
      }
    })

    console.log('  Total episodes:', episodeStats._count.id)
    console.log('  Average duration:', episodeStats._avg.duration, 'seconds')

    // Test campaign revenue query
    console.log('\n3. Testing campaign revenue query:')
    const campaignRevenue = await prisma.campaign.aggregate({
      where: {
        orders: {
          some: {
            orderItems: {
              some: {
                showId: show.id
              }
            }
          }
        }
      },
      _sum: {
        budget: true,
        spent: true,
      }
    })

    console.log('  Total budget:', campaignRevenue._sum.budget || 0)
    console.log('  Total spent:', campaignRevenue._sum.spent || 0)

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testShowAPI().catch(console.error)