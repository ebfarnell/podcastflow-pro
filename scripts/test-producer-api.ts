import prisma from '../src/lib/db/prisma'

async function testProducerAPI() {
  console.log('=== TESTING PRODUCER API ACCESS ===\n')

  try {
    // Get producer user
    const producerUser = await prisma.user.findFirst({
      where: { email: 'producer@podcastflow.pro' },
      include: { organization: true }
    })

    if (!producerUser) {
      console.log('Producer user not found!')
      return
    }

    console.log('Producer User:', {
      id: producerUser.id,
      name: producerUser.name,
      email: producerUser.email,
      role: producerUser.role,
      organizationId: producerUser.organizationId
    })

    // Test what shows API would return for this producer
    console.log('\n=== TESTING SHOWS QUERY ===')

    // Build the same query as the API
    const where: any = {
      organizationId: producerUser.organizationId,
    }

    // Add producer filter
    if (producerUser.role === 'producer') {
      where.assignedProducers = {
        some: {
          id: producerUser.id
        }
      }
    }

    console.log('Query where clause:', JSON.stringify(where, null, 2))

    const shows = await prisma.show.findMany({
      where,
      include: {
        assignedProducers: true,
        assignedTalent: true,
        episodes: {
          where: { status: 'published' },
          select: { id: true }
        },
        _count: {
          select: { episodes: true }
        }
      }
    })

    console.log(`\nShows found: ${shows.length}`)
    shows.forEach(show => {
      console.log(`
- Show: ${show.name}
  ID: ${show.id}
  Episodes: ${show._count.episodes}
  Assigned Producers: ${show.assignedProducers.map(p => p.name).join(', ')}`)
    })

    // Check show metrics
    console.log('\n=== CHECKING SHOW METRICS ===')
    for (const show of shows) {
      const metrics = await prisma.showMetrics.findUnique({
        where: {
          showId_organizationId: {
            showId: show.id,
            organizationId: producerUser.organizationId!
          }
        }
      })

      if (metrics) {
        console.log(`
- Metrics for ${show.name}:
  Subscribers: ${metrics.totalSubscribers}
  Avg Listeners: ${metrics.averageListeners}
  Monthly Downloads: ${metrics.monthlyDownloads}`)
      } else {
        console.log(`- No metrics found for ${show.name}`)
      }
    }

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testProducerAPI().catch(console.error)