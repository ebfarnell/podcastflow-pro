import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug, querySchema, SchemaModels } from '@/lib/db/schema-db'
import { v4 as uuidv4 } from 'uuid'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get session and verify authentication
    const authToken = request.cookies.get('auth-token')?.value
    if (!authToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin, sales, and master can approve campaigns
    if (!['master', 'admin', 'sales'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const body = await request.json()
    const { notes } = body

    // Get campaign details
    const campaign = await SchemaModels.campaign.findById(orgSlug, params.id)
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Check if campaign is at 100% probability (ready for approval)
    if (campaign.probability !== 100) {
      return NextResponse.json({ 
        error: 'Campaign must be at 100% probability (Signed Contract) before approval' 
      }, { status: 400 })
    }

    // Check if campaign is already approved
    if (campaign.status === 'approved' || campaign.status === 'active') {
      return NextResponse.json({ 
        error: 'Campaign is already approved or active' 
      }, { status: 400 })
    }

    // Begin transaction-like operations
    const timestamp = new Date().toISOString()
    const results = {
      campaign: null as any,
      order: null as any,
      contract: null as any,
      invoices: [] as any[],
      adApprovals: [] as any[]
    }

    // 1. Determine campaign status based on flight dates
    const now = new Date()
    const startDate = new Date(campaign.startDate)
    const endDate = new Date(campaign.endDate)
    
    let newStatus = 'booked' // Default to booked
    if (now >= startDate && now <= endDate) {
      newStatus = 'active' // Campaign is in flight
    } else if (now > endDate) {
      return NextResponse.json({ 
        error: 'Cannot approve a campaign that has already ended' 
      }, { status: 400 })
    }
    
    // Update campaign status
    const updateCampaignQuery = `
      UPDATE "Campaign" 
      SET 
        status = $2,
        "updatedAt" = $3,
        "updatedBy" = $4,
        "approvedBy" = $4,
        "approvedAt" = $3
      WHERE id = $1
      RETURNING *
    `
    const updatedCampaigns = await querySchema(orgSlug, updateCampaignQuery, [
      params.id, 
      newStatus,
      timestamp,
      user.id
    ])
    results.campaign = updatedCampaigns[0]

    // 2. Create Order from Campaign
    const orderId = `order_${Date.now()}_${uuidv4().substring(0, 8)}`
    const orderNumber = `ORD-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`
    
    const createOrderQuery = `
      INSERT INTO "Order" (
        id,
        "orderNumber",
        "campaignId",
        "advertiserId",
        "agencyId",
        "organizationId",
        "orderDate",
        "startDate",
        "endDate",
        "grossAmount",
        "discountPercentage",
        "discountAmount",
        "netAmount",
        "commissionPercentage",
        "commissionAmount",
        "totalAmount",
        status,
        notes,
        "createdBy",
        "createdAt",
        "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
      ) RETURNING *
    `
    
    const grossAmount = campaign.budget || 0
    const discountPercentage = 0 // Can be configured
    const discountAmount = grossAmount * (discountPercentage / 100)
    const netAmount = grossAmount - discountAmount
    const commissionPercentage = 15 // Standard commission
    const commissionAmount = netAmount * (commissionPercentage / 100)
    const totalAmount = netAmount + commissionAmount

    const orders = await querySchema(orgSlug, createOrderQuery, [
      orderId,
      orderNumber,
      campaign.id,
      campaign.advertiserId,
      campaign.agencyId,
      campaign.organizationId,
      timestamp,
      campaign.startDate,
      campaign.endDate,
      grossAmount,
      discountPercentage,
      discountAmount,
      netAmount,
      commissionPercentage,
      commissionAmount,
      totalAmount,
      newStatus === 'active' ? 'active' : 'confirmed', // Order status matches campaign status
      notes || `Order created from approved campaign: ${campaign.name}`,
      user.id,
      timestamp,
      timestamp
    ])
    results.order = orders[0]

    // 3. Create Order Items from AdApprovals
    const adApprovalsQuery = `
      SELECT aa.*, s.name as "showName"
      FROM "AdApproval" aa
      JOIN "Show" s ON aa."showId" = s.id
      WHERE aa."campaignId" = $1 AND aa.status = 'approved'
    `
    const adApprovals = await querySchema(orgSlug, adApprovalsQuery, [campaign.id])

    if (adApprovals.length > 0) {
      // Create order items for each approved ad
      for (const adApproval of adApprovals) {
        const orderItemId = `orderitem_${Date.now()}_${uuidv4().substring(0, 8)}`
        const createOrderItemQuery = `
          INSERT INTO "OrderItem" (
            id,
            "orderId",
            "showId",
            "episodeId",
            "placementType",
            length,
            rate,
            quantity,
            "totalAmount",
            "airDate",
            status,
            "createdAt",
            "updatedAt"
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
          )
        `
        
        const rate = 1000 // Default rate, should be from show placement rates
        const quantity = 1
        const totalAmount = rate * quantity

        await querySchema(orgSlug, createOrderItemQuery, [
          orderItemId,
          orderId,
          adApproval.showId,
          null, // episodeId - to be assigned later
          adApproval.type,
          adApproval.duration,
          rate,
          quantity,
          totalAmount,
          campaign.startDate, // Initial air date
          'pending',
          timestamp,
          timestamp
        ])
      }
    }

    // 4. Create Contract
    const contractId = `contract_${Date.now()}_${uuidv4().substring(0, 8)}`
    const contractNumber = `CNT-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`
    
    const createContractQuery = `
      INSERT INTO "Contract" (
        id,
        "contractNumber",
        "campaignId",
        "advertiserId",
        "agencyId",
        "organizationId",
        "contractDate",
        "startDate",
        "endDate",
        "totalValue",
        status,
        "paymentTerms",
        "billingSchedule",
        "specialTerms",
        "signedBy",
        "signedAt",
        "createdBy",
        "createdAt",
        "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
      ) RETURNING *
    `
    
    const contracts = await querySchema(orgSlug, createContractQuery, [
      contractId,
      contractNumber,
      campaign.id,
      campaign.advertiserId,
      campaign.agencyId,
      campaign.organizationId,
      timestamp,
      campaign.startDate,
      campaign.endDate,
      totalAmount,
      'active',
      'Net 30', // Standard payment terms
      'monthly', // Billing schedule
      notes || `Contract for campaign: ${campaign.name}`,
      user.id,
      timestamp,
      user.id,
      timestamp,
      timestamp
    ])
    results.contract = contracts[0]

    // 5. Create initial Invoice (if billing schedule is upfront or monthly)
    const invoiceId = `invoice_${Date.now()}_${uuidv4().substring(0, 8)}`
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`
    
    const createInvoiceQuery = `
      INSERT INTO "Invoice" (
        id,
        "invoiceNumber",
        "contractId",
        "campaignId",
        "advertiserId",
        "organizationId",
        "invoiceDate",
        "dueDate",
        "billingPeriodStart",
        "billingPeriodEnd",
        "subtotal",
        "taxRate",
        "taxAmount",
        "totalAmount",
        status,
        "createdBy",
        "createdAt",
        "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
      ) RETURNING *
    `
    
    const dueDate = new Date(timestamp)
    dueDate.setDate(dueDate.getDate() + 30) // Net 30
    
    const subtotal = totalAmount
    const taxRate = 0 // Tax rate can be configured
    const taxAmount = subtotal * (taxRate / 100)
    const invoiceTotal = subtotal + taxAmount

    const invoices = await querySchema(orgSlug, createInvoiceQuery, [
      invoiceId,
      invoiceNumber,
      contractId,
      campaign.id,
      campaign.advertiserId,
      campaign.organizationId,
      timestamp,
      dueDate.toISOString(),
      campaign.startDate,
      campaign.endDate,
      subtotal,
      taxRate,
      taxAmount,
      invoiceTotal,
      'draft', // Invoice starts as draft
      user.id,
      timestamp,
      timestamp
    ])
    results.invoices.push(invoices[0])

    // 6. Update AdApproval workflow status
    const updateAdApprovalsQuery = `
      UPDATE "AdApproval"
      SET 
        "workflowStage" = 'production_ready',
        "updatedAt" = $2
      WHERE "campaignId" = $1 AND status = 'approved'
    `
    await querySchema(orgSlug, updateAdApprovalsQuery, [campaign.id, timestamp])

    // 7. Remove campaign from pipeline (it's now in Orders)
    // The campaign remains in the Campaign table but with 'approved' status
    // Pipeline queries should filter out 'approved' status campaigns

    return NextResponse.json({
      success: true,
      message: 'Campaign approved and moved to Orders system',
      results: {
        campaign: {
          id: results.campaign.id,
          name: results.campaign.name,
          status: results.campaign.status
        },
        order: {
          id: results.order.id,
          orderNumber: results.order.orderNumber,
          totalAmount: results.order.totalAmount
        },
        contract: {
          id: results.contract.id,
          contractNumber: results.contract.contractNumber,
          status: results.contract.status
        },
        invoices: results.invoices.map(inv => ({
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          totalAmount: inv.totalAmount,
          status: inv.status
        })),
        adApprovalsUpdated: adApprovals.length
      }
    })

  } catch (error) {
    console.error('Error approving campaign:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
