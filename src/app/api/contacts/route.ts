import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug, querySchema } from '@/lib/db/schema-db'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


// GET /api/contacts - Get contacts for an advertiser or agency
export async function GET(request: NextRequest) {
  try {
    // Validate session
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const advertiserId = searchParams.get('advertiserId')
    const agencyId = searchParams.get('agencyId')

    if (!advertiserId && !agencyId) {
      return NextResponse.json({ error: 'Either advertiserId or agencyId is required' }, { status: 400 })
    }

    // Get org schema
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Build query based on whether it's advertiser or agency
    let query: string
    let params: any[]

    if (advertiserId) {
      query = `
        SELECT 
          c.*
        FROM "Contact" c
        WHERE c."advertiserId" = $1 AND c."isActive" = true
        ORDER BY c."isPrimary" DESC, c."createdAt" DESC
      `
      params = [advertiserId]
    } else {
      query = `
        SELECT 
          c.*
        FROM "Contact" c
        WHERE c."agencyId" = $1 AND c."isActive" = true
        ORDER BY c."isPrimary" DESC, c."createdAt" DESC
      `
      params = [agencyId]
    }

    const contacts = await querySchema<any>(orgSlug, query, params)

    // Now fetch user data separately from public schema
    const transformedContacts = []
    for (const contact of contacts) {
      let userData = null
      
      // Check if user exists in public schema
      try {
        const userQuery = `
          SELECT 
            id,
            email,
            role,
            "isActive",
            "inviteToken",
            "inviteAcceptedAt"
          FROM "User"
          WHERE LOWER(email) = LOWER($1)
        `
        const userResult = await querySchema<any>('public', userQuery, [contact.email])
        
        if (userResult && userResult.length > 0) {
          const user = userResult[0]
          userData = {
            userId: user.id,
            userRole: user.role,
            userStatus: user.isActive ? 'active' : 
                       !user.emailVerified ? 'invited' : 
                       'deactivated'
          }
        }
      } catch (error) {
        console.log('Error fetching user data for contact:', contact.email, error)
      }

      transformedContacts.push({
        id: contact.id,
        name: contact.name,
        title: contact.title,
        email: contact.email,
        phone: contact.phone,
        isPrimary: contact.isPrimary,
        userId: userData?.userId || null,
        userStatus: userData?.userStatus || null,
        userRole: userData?.userRole || null,
        inviteStatus: contact.inviteStatus,
        invitedAt: contact.invitedAt,
        createdAt: contact.createdAt,
        updatedAt: contact.updatedAt
      })
    }

    return NextResponse.json(transformedContacts)
  } catch (error) {
    console.error('Error fetching contacts:', error)
    return NextResponse.json({ error: 'Failed to fetch contacts' }, { status: 500 })
  }
}

// POST /api/contacts - Create a new contact
export async function POST(request: NextRequest) {
  try {
    // Validate session
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only sales, admin, and master can manage contacts
    if (!['sales', 'admin', 'master'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { advertiserId, agencyId, name, title, email, phone, isPrimary } = body

    if (!name || !email) {
      return NextResponse.json({ error: 'Name and email are required' }, { status: 400 })
    }

    if (!advertiserId && !agencyId) {
      return NextResponse.json({ error: 'Either advertiserId or agencyId is required' }, { status: 400 })
    }

    if (advertiserId && agencyId) {
      return NextResponse.json({ error: 'Contact can belong to either advertiser or agency, not both' }, { status: 400 })
    }

    // Get org schema
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Check if user with this email already exists
    let existingUser = null
    try {
      const userCheckQuery = `
        SELECT id, email, role, "isActive", "inviteToken", "inviteAcceptedAt"
        FROM "User"
        WHERE LOWER(email) = LOWER($1)
      `
      const existingUsers = await querySchema<any>('public', userCheckQuery, [email])
      existingUser = existingUsers[0]
    } catch (error) {
      console.log('User not found for email:', email)
    }

    // If making this contact primary, unset other primary contacts
    if (isPrimary) {
      let updateQuery: string
      let updateParams: any[]
      
      if (advertiserId) {
        updateQuery = `UPDATE "Contact" SET "isPrimary" = false WHERE "advertiserId" = $1`
        updateParams = [advertiserId]
      } else {
        updateQuery = `UPDATE "Contact" SET "isPrimary" = false WHERE "agencyId" = $1`
        updateParams = [agencyId]
      }
      
      await querySchema(orgSlug, updateQuery, updateParams)
    }

    // Insert the new contact
    const insertQuery = `
      INSERT INTO "Contact" (
        "advertiserId", "agencyId", "name", "title", "email", "phone", 
        "userId", "isPrimary", "organizationId", "createdBy", "updatedBy"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
      RETURNING *
    `

    const result = await querySchema<any>(
      orgSlug,
      insertQuery,
      [
        advertiserId || null,
        agencyId || null,
        name,
        title || null,
        email,
        phone || null,
        existingUser?.id || null,
        isPrimary || false,
        user.organizationId,
        user.id
      ]
    )

    const newContact = result[0]

    // Include user status in response
    const contactWithStatus = {
      ...newContact,
      userStatus: existingUser ? (
        existingUser.isActive ? 'active' :
        existingUser.inviteToken && !existingUser.inviteAcceptedAt ? 'invited' :
        'deactivated'
      ) : null,
      userRole: existingUser?.role || null
    }

    return NextResponse.json(contactWithStatus)
  } catch (error) {
    console.error('Error creating contact:', error)
    return NextResponse.json({ error: 'Failed to create contact' }, { status: 500 })
  }
}

// PUT /api/contacts - Update multiple contacts
export async function PUT(request: NextRequest) {
  try {
    // Validate session
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only sales, admin, and master can manage contacts
    if (!['sales', 'admin', 'master'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { contacts } = body

    if (!Array.isArray(contacts)) {
      return NextResponse.json({ error: 'Contacts array is required' }, { status: 400 })
    }

    // Get org schema
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const updatedContacts = []

    for (const contact of contacts) {
      const { id, name, title, email, phone, isPrimary } = contact

      if (!id) continue

      // Build update query
      const updateFields = []
      const updateParams = []
      let paramIndex = 1

      if (name !== undefined) {
        updateFields.push(`"name" = $${paramIndex++}`)
        updateParams.push(name)
      }
      if (title !== undefined) {
        updateFields.push(`"title" = $${paramIndex++}`)
        updateParams.push(title)
      }
      if (email !== undefined) {
        updateFields.push(`"email" = $${paramIndex++}`)
        updateParams.push(email)
      }
      if (phone !== undefined) {
        updateFields.push(`"phone" = $${paramIndex++}`)
        updateParams.push(phone)
      }
      if (isPrimary !== undefined) {
        updateFields.push(`"isPrimary" = $${paramIndex++}`)
        updateParams.push(isPrimary)
      }

      updateFields.push(`"updatedBy" = $${paramIndex++}`)
      updateParams.push(user.id)
      updateFields.push(`"updatedAt" = NOW()`)

      updateParams.push(id)

      const updateQuery = `
        UPDATE "Contact"
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `

      const result = await querySchema<any>(orgSlug, updateQuery, updateParams)
      if (result[0]) {
        updatedContacts.push(result[0])
      }
    }

    return NextResponse.json(updatedContacts)
  } catch (error) {
    console.error('Error updating contacts:', error)
    return NextResponse.json({ error: 'Failed to update contacts' }, { status: 500 })
  }
}

// DELETE /api/contacts/[id] - handled in [id]/route.ts
