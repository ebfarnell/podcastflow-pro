import prisma from '../src/lib/db/prisma'

async function checkAllUsers() {
  console.log('=== CHECKING ALL USERS ===\n')

  try {
    const users = await prisma.user.findMany({
      include: { organization: true },
      orderBy: { createdAt: 'asc' }
    })

    console.log(`Total users: ${users.length}`)
    users.forEach(user => {
      console.log(`
  - User:
    ID: ${user.id}
    Name: ${user.name}
    Email: ${user.email}
    Role: ${user.role}
    OrganizationID: ${user.organizationId}
    Organization: ${user.organization?.name || 'None'}
    Active: ${user.isActive}`)
    })

    // Check which producer is assigned to shows
    console.log('\n=== CHECKING SHOW ASSIGNMENTS ===')
    const shows = await prisma.show.findMany({
      include: {
        assignedProducers: true,
        assignedTalent: true
      }
    })

    shows.forEach(show => {
      console.log(`\nShow: ${show.name}`)
      console.log(`  Assigned Producers:`)
      show.assignedProducers.forEach(producer => {
        console.log(`    - ${producer.name} (${producer.email}) - ID: ${producer.id}`)
      })
      console.log(`  Assigned Talent:`)
      show.assignedTalent.forEach(talent => {
        console.log(`    - ${talent.name} (${talent.email}) - ID: ${talent.id}`)
      })
    })

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkAllUsers().catch(console.error)