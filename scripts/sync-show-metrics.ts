import prisma from '../src/lib/db/prisma'

async function syncShowMetrics() {
  console.log('=== SYNCING SHOW METRICS FROM ANALYTICS ===\n')

  try {
    // Get all shows
    const shows = await prisma.show.findMany({
      include: {
        episodes: {
          include: {
            analytics: true
          }
        }
      }
    })

    for (const show of shows) {
      // Calculate metrics from episode analytics
      let totalDownloads = 0
      let totalListeners = 0
      let totalRevenue = 0

      for (const episode of show.episodes) {
        for (const analytics of episode.analytics) {
          totalDownloads += analytics.downloads || 0
          totalListeners += analytics.uniqueListeners || 0
          totalRevenue += analytics.adRevenue || 0
        }
      }

      // Calculate averages
      const avgListeners = show.episodes.length > 0 
        ? Math.round(totalListeners / show.episodes.length)
        : 0

      // Update show with calculated metrics
      await prisma.show.update({
        where: { id: show.id },
        data: {
          totalDownloads,
          subscriberCount: Math.round(totalListeners * 0.8), // Estimate 80% are subscribers
          avgListeners,
          totalRevenue
        }
      })

      console.log(`Updated ${show.name}:`)
      console.log(`  Downloads: ${totalDownloads}`)
      console.log(`  Subscribers: ${Math.round(totalListeners * 0.8)}`)
      console.log(`  Avg Listeners: ${avgListeners}`)
      console.log(`  Revenue: $${totalRevenue}`)
      console.log()
    }

    console.log('✅ Show metrics synced successfully!')

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

syncShowMetrics().catch(console.error)