const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function removeDeletionRequestsFromSidebar() {
  try {
    console.log('🔍 Looking for users with Deletion Requests in sidebar...')
    
    // Find all users with sidebar customization
    const users = await prisma.user.findMany({
      where: {
        preferences: {
          not: null
        }
      },
      select: {
        id: true,
        email: true,
        preferences: true
      }
    })

    console.log(`Found ${users.length} users with preferences`)

    let updatedCount = 0
    
    for (const user of users) {
      try {
        const preferences = user.preferences
        
        if (preferences && 
            preferences.sidebarCustomization && 
            Array.isArray(preferences.sidebarCustomization)) {
          
          // Convert preferences to string if it's not already
          const prefString = typeof preferences === 'string' 
            ? preferences 
            : JSON.stringify(preferences)
          
          // Check if Deletion Requests exists in the customization
          if (prefString.includes('Deletion Requests')) {
            console.log(`\n📋 Processing user: ${user.email}`)
            
            // Parse the preferences
            const parsedPrefs = typeof preferences === 'string' 
              ? JSON.parse(preferences) 
              : preferences
            
            // Function to recursively remove Deletion Requests items
            const removeDeleteRequestItems = (items) => {
              return items.filter(item => {
                // Remove if it's Deletion Requests
                if (item.text === 'Deletion Requests') {
                  console.log('  ❌ Removing Deletion Requests menu item')
                  return false
                }
                
                // Recursively check children
                if (item.children) {
                  item.children = removeDeleteRequestItems(item.children)
                }
                
                return true
              })
            }
            
            // Remove Deletion Requests from the customization
            parsedPrefs.sidebarCustomization = removeDeleteRequestItems(parsedPrefs.sidebarCustomization)
            
            // Update the user's preferences
            await prisma.user.update({
              where: { id: user.id },
              data: {
                preferences: parsedPrefs
              }
            })
            
            console.log('  ✅ Updated preferences')
            updatedCount++
          }
        }
      } catch (err) {
        console.error(`  ❌ Error processing user ${user.email}:`, err.message)
      }
    }

    console.log(`\n✅ Completed! Updated ${updatedCount} users`)
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

removeDeletionRequestsFromSidebar()