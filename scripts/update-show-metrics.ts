import prisma from '../src/lib/db/prisma'

async function updateShowMetrics() {
  console.log('=== UPDATING SHOW METRICS ===\n')

  try {
    const shows = await prisma.show.findMany({
      include: {
        episodes: {
          where: { status: 'published' }
        },
        _count: {
          select: { episodes: true }
        }
      }
    })

    for (const show of shows) {
      // Calculate some realistic metrics based on episodes
      const publishedEpisodes = show.episodes.length
      const baseListeners = 1000 + Math.floor(Math.random() * 4000)
      const growthRate = 5 + Math.floor(Math.random() * 15)
      
      const metrics = {
        totalSubscribers: baseListeners + publishedEpisodes * 150,
        newSubscribers: Math.floor(baseListeners * 0.1),
        lostSubscribers: Math.floor(baseListeners * 0.02),
        subscriberGrowth: growthRate,
        averageListeners: baseListeners,
        totalDownloads: baseListeners * publishedEpisodes * 1.5,
        monthlyDownloads: baseListeners * 4 * 1.5, // 4 episodes per month average
        averageCompletion: 65 + Math.floor(Math.random() * 20),
        totalRevenue: publishedEpisodes * 500 + Math.random() * 2000,
        monthlyRevenue: 2000 + Math.random() * 3000,
        averageCPM: 25 + Math.random() * 10,
        totalEpisodes: show._count.episodes,
        publishedEpisodes: publishedEpisodes,
        averageEpisodeLength: 1800 + Math.floor(Math.random() * 1800), // 30-60 minutes
      }

      // Find existing metrics record
      const existing = await prisma.showMetrics.findFirst({
        where: { 
          showId: show.id,
          organizationId: show.organizationId
        }
      })

      if (!existing) {
        console.log(`No metrics found for ${show.name}, skipping...`)
        continue
      }

      // Update the show metrics
      const updated = await prisma.showMetrics.update({
        where: { id: existing.id },
        data: metrics
      })

      console.log(`Updated metrics for ${show.name}:`)
      console.log(`  - Subscribers: ${metrics.totalSubscribers}`)
      console.log(`  - Avg Listeners: ${metrics.averageListeners}`)
      console.log(`  - Monthly Downloads: ${metrics.monthlyDownloads}`)
      console.log(`  - Growth Rate: ${metrics.subscriberGrowth}%`)
    }

    console.log('\n✅ All show metrics updated!')

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

updateShowMetrics().catch(console.error)