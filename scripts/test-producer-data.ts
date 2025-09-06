import prisma from '../src/lib/db/prisma'

async function testProducerData() {
  console.log('=== TESTING PRODUCER DATA ===\n')

  try {
    // Get producer user
    const producer = await prisma.user.findFirst({
      where: { email: 'producer@podcastflow.pro' },
      include: {
        organization: true
      }
    })

    if (!producer) {
      console.log('Producer user not found!')
      return
    }

    console.log('Producer:', producer.name, '(', producer.email, ')')
    console.log('Organization:', producer.organization?.name)

    // Get shows assigned to producer
    const shows = await prisma.show.findMany({
      where: {
        organizationId: producer.organizationId!,
        assignedProducers: {
          some: { id: producer.id }
        }
      },
      include: {
        _count: {
          select: {
            episodes: true
          }
        }
      }
    })

    console.log('\nShows assigned to producer:', shows.length)
    for (const show of shows) {
      console.log(`- ${show.name}: ${show._count.episodes} episodes`)
      console.log(`  Active: ${show.isActive}`)
      console.log(`  Subscribers: ${show.subscriberCount || 0}`)
      console.log(`  Downloads: ${show.totalDownloads || 0}`)
    }

    // Get episodes for producer's shows
    const showIds = shows.map(s => s.id)
    const episodes = await prisma.episode.findMany({
      where: {
        showId: { in: showIds }
      },
      include: {
        show: {
          select: { name: true }
        }
      }
    })

    console.log('\nTotal episodes for producer shows:', episodes.length)
    
    // Group by show
    const episodesByShow = episodes.reduce((acc, ep) => {
      if (!acc[ep.show.name]) acc[ep.show.name] = 0
      acc[ep.show.name]++
      return acc
    }, {} as Record<string, number>)

    console.log('\nEpisodes by show:')
    Object.entries(episodesByShow).forEach(([show, count]) => {
      console.log(`- ${show}: ${count} episodes`)
    })

    // Check analytics data
    const analytics = await prisma.episodeAnalytics.aggregate({
      where: {
        episode: {
          showId: { in: showIds }
        }
      },
      _sum: {
        downloads: true,
        uniqueListeners: true
      }
    })

    console.log('\nAnalytics totals:')
    console.log('- Total downloads:', analytics._sum.downloads || 0)
    console.log('- Total listeners:', analytics._sum.uniqueListeners || 0)

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testProducerData().catch(console.error)