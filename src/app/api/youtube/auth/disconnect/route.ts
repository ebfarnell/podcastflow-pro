/**

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'

 * YouTube OAuth Disconnection
 * POST /api/youtube/auth/disconnect
 * 
 * Disconnects YouTube integration and removes all connected channels.
 */


export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    if (!['admin', 'master'].includes(user.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Delete configuration
    await prisma.youTubeApiConfig.deleteMany({
      where: { organizationId: user.organizationId }
    })

    // Also delete all connected channels from organization schema
    try {
      const orgSlug = await prisma.organization.findUnique({
        where: { id: user.organizationId },
        select: { slug: true }
      })

      if (orgSlug?.slug) {
        const schema = `org_${orgSlug.slug.replace(/-/g, '_')}`
        
        // Delete all YouTube channels for this organization
        await prisma.$executeRawUnsafe(
          `DELETE FROM "${schema}"."YouTubeChannel"`
        )
      }
    } catch (error) {
      // Schema or table might not exist, ignore
      console.log('Could not delete YouTube channels:', error)
    }

    return NextResponse.json({
      success: true,
      message: 'YouTube integration disconnected successfully'
    })
  } catch (error: any) {
    console.error('Error disconnecting YouTube:', error)
    
    return NextResponse.json(
      { error: 'Failed to disconnect YouTube' },
      { status: 500 }
    )
  }
}
