import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { UserService } from '@/lib/auth/user-service'
import prisma from '@/lib/db/prisma'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


// GET /api/master/invoices/[id] - Get specific invoice
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Check authentication and master/admin role
    const cookieStore = cookies()
    const authToken = cookieStore.get('auth-token')

    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user || (user.role !== 'master' && user.role !== 'admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const invoiceId = params.id
    
    console.log('📋 Fetching invoice:', invoiceId)

    // Get invoice from database
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        organization: true,
        payments: true,
        items: {
          include: {
            campaign: true
          }
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      invoice
    })

  } catch (error) {
    console.error('❌ Master invoice GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch invoice' },
      { status: 500 }
    )
  }
}

// PUT /api/master/invoices/[id] - Update invoice
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Check authentication and master/admin role
    const cookieStore = cookies()
    const authToken = cookieStore.get('auth-token')

    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user || (user.role !== 'master' && user.role !== 'admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const invoiceId = params.id
    const body = await request.json()
    
    console.log('✏️ Updating invoice:', invoiceId, 'with data:', body)

    // Build update data
    const updateData: any = {}
    
    // Only update fields that were provided
    if (body.status !== undefined) updateData.status = body.status
    if (body.amount !== undefined) updateData.amount = parseFloat(body.amount)
    if (body.description !== undefined) updateData.description = body.description
    if (body.dueDate !== undefined) updateData.dueDate = new Date(body.dueDate)
    if (body.paidDate !== undefined) updateData.paidDate = body.paidDate ? new Date(body.paidDate) : null
    if (body.notes !== undefined) updateData.notes = body.notes
    if (body.taxAmount !== undefined) updateData.taxAmount = body.taxAmount ? parseFloat(body.taxAmount) : null
    if (body.discountAmount !== undefined) updateData.discountAmount = body.discountAmount ? parseFloat(body.discountAmount) : null
    
    // Recalculate total if amount, tax, or discount changed
    if (body.amount !== undefined || body.taxAmount !== undefined || body.discountAmount !== undefined) {
      const amount = body.amount || 0
      const taxAmount = body.taxAmount || 0
      const discountAmount = body.discountAmount || 0
      updateData.totalAmount = amount + taxAmount - discountAmount
    }

    // Update the invoice
    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: updateData,
      include: {
        organization: true,
        payments: true,
        items: true
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Invoice updated successfully',
      invoice: updatedInvoice
    })

  } catch (error) {
    console.error('❌ Master invoice PUT error:', error)
    return NextResponse.json(
      { error: 'Failed to update invoice' },
      { status: 500 }
    )
  }
}

// DELETE /api/master/invoices/[id] - Delete invoice
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    console.log('🗑️ DELETE request received for invoice:', params.id)
    
    // Check authentication and master/admin role
    const cookieStore = cookies()
    const authToken = cookieStore.get('auth-token')

    console.log('🔐 Checking authentication token:', authToken ? 'Token exists' : 'No token')

    if (!authToken) {
      console.log('❌ No auth token found')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken.value)
    console.log('👤 User validation result:', user ? `${user.email} (${user.role})` : 'No user found')
    
    if (!user || (user.role !== 'master' && user.role !== 'admin')) {
      console.log('❌ User not authorized:', user?.role)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const invoiceId = params.id

    console.log('🗑️ Processing delete request for invoice:', invoiceId, 'by user:', user.email)

    // Try to find the invoice across all organization schemas
    let deletedInvoice = null
    let deletedFromSchema = null
    let organizationName = ''

    // Get all organization schemas to search for invoices
    const organizations = await prisma.organization.findMany({
      select: { id: true, slug: true, name: true }
    })

    for (const org of organizations) {
      try {
        if (!org.slug) continue
        
        const schemaName = `org_${org.slug.replace(/-/g, '_')}`
        console.log(`🔍 Searching for invoice in schema: ${schemaName}`)
        
        const { querySchema } = await import('@/lib/db/schema-db')
        const schemaDb = querySchema(schemaName)
        
        // Check if invoice exists in this schema
        const invoice = await schemaDb.invoice.findUnique({
          where: { id: invoiceId }
        })
        
        if (invoice) {
          console.log(`✅ Found invoice ${invoice.invoiceNumber} in schema: ${schemaName}`)
          
          // Check if invoice can be deleted (business rules)
          if (invoice.status === 'paid') {
            console.log('❌ Cannot delete paid invoice')
            return NextResponse.json(
              { error: 'Cannot delete paid invoices' },
              { status: 400 }
            )
          }
          
          if (invoice.status === 'sent') {
            console.log('❌ Cannot delete sent invoice')
            return NextResponse.json(
              { error: 'Cannot delete sent invoices. Cancel them first.' },
              { status: 400 }
            )
          }
          
          // Delete the invoice
          await schemaDb.invoice.delete({
            where: { id: invoiceId }
          })
          
          deletedFromSchema = schemaName
          organizationName = org.name
          deletedInvoice = invoice
          console.log(`✅ Invoice ${invoice.invoiceNumber} deleted from schema: ${schemaName}`)
          break
        }
      } catch (schemaError) {
        // Continue to next schema if this one fails
        console.log(`⚠️ Could not query schema ${org.slug}:`, schemaError)
      }
    }

    if (deletedFromSchema && deletedInvoice) {
      console.log('✅ Invoice deletion completed')
      
      return NextResponse.json({
        success: true,
        message: `Invoice ${deletedInvoice.invoiceNumber} deleted successfully`,
        deletedId: invoiceId,
        organizationName,
        schema: deletedFromSchema,
        action: 'invoice_deleted'
      })
    }

    // If we get here, no invoice was found in any schema
    console.log('❌ No invoice found with ID:', invoiceId)
    return NextResponse.json(
      { error: 'Invoice not found' },
      { status: 404 }
    )

  } catch (error) {
    console.error('❌ Master invoice DELETE error:', error)
    
    return NextResponse.json(
      { error: 'Failed to delete invoice' },
      { status: 500 }
    )
  }
}
