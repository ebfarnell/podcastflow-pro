import prisma from '../src/lib/db/prisma'

async function checkProducerData() {
  console.log('=== CHECKING PRODUCER DATA ===\n')

  try {
    // 1. Check producer user
    console.log('1. PRODUCER USER:')
    const producerUser = await prisma.user.findFirst({
      where: { email: 'producer@podcastflow.com' },
      include: { organization: true }
    })

    if (producerUser) {
      console.log(`
  - Producer User:
    ID: ${producerUser.id}
    Email: ${producerUser.email}
    OrganizationID: ${producerUser.organizationId}
    Organization: ${producerUser.organization?.name}
    Role: ${producerUser.role}`)
    } else {
      console.log('Producer user not found!')
    }

    // 2. Check shows
    console.log('\n2. SHOWS:')
    const shows = await prisma.show.findMany({
      include: {
        organization: true,
        assignedProducers: true,
        assignedTalent: true,
        _count: {
          select: { episodes: true }
        }
      }
    })

    console.log(`Total shows: ${shows.length}`)
    shows.forEach(show => {
      console.log(`
  - Show: ${show.name}
    ID: ${show.id}
    OrganizationID: ${show.organizationId}
    Organization: ${show.organization.name}
    Status: ${show.isActive ? 'active' : 'inactive'}
    Episodes: ${show._count.episodes}
    Assigned Producers: ${show.assignedProducers.map(p => p.name).join(', ') || 'None'}
    Assigned Talent: ${show.assignedTalent.map(t => t.name).join(', ') || 'None'}`)
    })

    // 3. Check if producer is assigned to any shows
    if (producerUser) {
      console.log('\n3. PRODUCER ASSIGNED SHOWS:')
      const producerShows = await prisma.show.findMany({
        where: {
          assignedProducers: {
            some: {
              id: producerUser.id
            }
          }
        }
      })
      
      console.log(`Producer is assigned to ${producerShows.length} shows`)
      if (producerShows.length === 0) {
        console.log('WARNING: Producer is not assigned to any shows!')
      }
    }

    // 4. Check organization match
    if (producerUser && shows.length > 0) {
      console.log('\n4. ORGANIZATION MATCH CHECK:')
      const orgMatchShows = shows.filter(show => show.organizationId === producerUser.organizationId)
      console.log(`Shows in producer's organization: ${orgMatchShows.length}`)
      
      if (orgMatchShows.length === 0) {
        console.log('WARNING: No shows match producer organizationId!')
        console.log(`Producer org: ${producerUser.organizationId}`)
        console.log(`Show orgs: ${[...new Set(shows.map(s => s.organizationId))].join(', ')}`)
      }
    }

    // 5. Check episodes
    console.log('\n5. EPISODES:')
    const episodes = await prisma.episode.findMany({
      include: {
        show: true,
        creator: true
      },
      take: 10
    })

    console.log(`Total episodes (showing first 10): ${episodes.length}`)
    episodes.forEach(episode => {
      console.log(`
  - Episode: ${episode.title}
    ID: ${episode.id}
    ShowID: ${episode.showId}
    Show: ${episode.show.name}
    Status: ${episode.status}
    CreatedBy: ${episode.creator?.name || 'Unknown'}`)
    })

    // 6. Check episode analytics
    console.log('\n6. EPISODE ANALYTICS:')
    const analytics = await prisma.episodeAnalytics.findMany({
      take: 5,
      orderBy: { date: 'desc' }
    })

    console.log(`Total analytics records (showing first 5): ${analytics.length}`)
    analytics.forEach(record => {
      console.log(`
  - Analytics:
    EpisodeID: ${record.episodeId}
    Date: ${record.date.toISOString()}
    Downloads: ${record.downloads}
    Listeners: ${record.uniqueListeners}`)
    })

    // 7. Check show metrics
    console.log('\n7. SHOW METRICS:')
    const showMetrics = await prisma.showMetrics.findMany({
      include: { show: true }
    })

    console.log(`Total show metrics: ${showMetrics.length}`)
    showMetrics.forEach(metric => {
      console.log(`
  - Show Metrics:
    Show: ${metric.show.name}
    Subscribers: ${metric.totalSubscribers}
    Avg Listeners: ${metric.averageListeners}
    Monthly Downloads: ${metric.monthlyDownloads}`)
    })

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkProducerData().catch(console.error)