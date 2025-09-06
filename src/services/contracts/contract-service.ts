import prisma from '@/lib/db/prisma'
import { safeQuerySchema } from '@/lib/db/schema-db'
import { v4 as uuidv4 } from 'uuid'
// We'll use existing notification system
const createNotification = async (data: any) => {
  // This is a placeholder - integrate with existing notification system
  console.log('Notification:', data)
}

interface GenerateContractOptions {
  orderId: string
  schemaName: string
  templateId: string
  userId: string
}

interface SendContractOptions {
  contractId: string
  schemaName: string
  recipientEmails: string[]
}

export async function generateContract(options: GenerateContractOptions): Promise<string> {
  const { orderId, schemaName, templateId, userId } = options
  const contractId = uuidv4()

  try {
    // Get order details
    const { data: orders } = await safeQuerySchema(schemaName, async (schema) => {
      return await prisma.$queryRawUnsafe(`
        SELECT 
          o.*,
          c."name" as "campaignName",
          a."name" as "advertiserName",
          a."email" as "advertiserEmail",
          a."billingContact",
          ag."name" as "agencyName",
          ag."email" as "agencyEmail"
        FROM "${schema}"."Order" o
        JOIN "${schema}"."Campaign" c ON o."campaignId" = c.id
        LEFT JOIN "${schema}"."Advertiser" a ON o."advertiserId" = a.id
        LEFT JOIN "${schema}"."Agency" ag ON o."agencyId" = ag.id
        WHERE o.id = $1
      `, orderId)
    })

    if (!orders || orders.length === 0) {
      throw new Error('Order not found')
    }

    const order = orders[0]

    // Get contract template
    const { data: templates } = await safeQuerySchema(schemaName, async (schema) => {
      return await prisma.$queryRawUnsafe(`
        SELECT * FROM "${schema}"."ContractTemplate"
        WHERE id = $1 OR "isDefault" = true
        ORDER BY id = $1 DESC
        LIMIT 1
      `, templateId)
    })

    const template = templates?.[0] || {
      name: 'Standard Contract',
      content: getDefaultContractTemplate(),
    }

    // Get order line items
    const { data: lineItems } = await safeQuerySchema(schemaName, async (schema) => {
      return await prisma.$queryRawUnsafe(`
        SELECT 
          ss."showId",
          s."name" as "showName",
          COUNT(*) as "spotCount",
          AVG(ss.rate) as "avgRate",
          SUM(ss.rate) as "totalAmount"
        FROM "${schema}"."ScheduledSpot" ss
        JOIN "${schema}"."Show" s ON ss."showId" = s.id
        WHERE ss."campaignId" = (SELECT "campaignId" FROM "${schema}"."Order" WHERE id = $1)
        GROUP BY ss."showId", s."name"
      `, orderId)
    })

    // Generate contract content from template
    const contractContent = generateContractContent(template.content, {
      order,
      lineItems: lineItems || [],
      contractDate: new Date(),
    })

    // Create contract record
    await safeQuerySchema(schemaName, async (schema) => {
      return await prisma.$executeRawUnsafe(`
        INSERT INTO "${schema}"."Contract" (
          id, "orderId", "templateId", "version",
          content, status, metadata,
          "createdAt", "updatedAt", "createdBy"
        ) VALUES (
          $1, $2, $3, 1,
          $4, 'draft', $5,
          NOW(), NOW(), $6
        )
      `, contractId, orderId, template.id || templateId, 
         contractContent,
         JSON.stringify({
           advertiserName: order.advertiserName,
           agencyName: order.agencyName,
           campaignName: order.campaignName,
           totalAmount: order.totalAmount,
           lineItemCount: lineItems?.length || 0,
         }),
         userId
      )
    })

    console.log(`Generated contract ${contractId} for order ${orderId}`)
    return contractId

  } catch (error) {
    console.error('Error generating contract:', error)
    throw error
  }
}

export async function sendContract(options: SendContractOptions): Promise<boolean> {
  const { contractId, schemaName, recipientEmails } = options

  try {
    // Get contract details
    const { data: contracts } = await safeQuerySchema(schemaName, async (schema) => {
      return await prisma.$queryRawUnsafe(`
        SELECT 
          c.*,
          o."organizationId"
        FROM "${schema}"."Contract" c
        JOIN "${schema}"."Order" o ON c."orderId" = o.id
        WHERE c.id = $1
      `, contractId)
    })

    if (!contracts || contracts.length === 0) {
      throw new Error('Contract not found')
    }

    const contract = contracts[0]
    const metadata = contract.metadata as any

    // Update contract status to sent
    await safeQuerySchema(schemaName, async (schema) => {
      return await prisma.$executeRawUnsafe(`
        UPDATE "${schema}"."Contract"
        SET 
          status = 'sent',
          "sentAt" = NOW(),
          "recipientEmails" = $1,
          "updatedAt" = NOW()
        WHERE id = $2
      `, JSON.stringify(recipientEmails), contractId)
    })

    // Send notifications
    for (const email of recipientEmails) {
      await createNotification({
        type: 'contract_sent',
        title: 'Contract Ready for Signature',
        message: `Contract for ${metadata.campaignName} has been sent for your review and signature`,
        recipientEmail: email,
        organizationId: contract.organizationId,
        data: {
          contractId,
          orderId: contract.orderId,
        },
      })
    }

    console.log(`Contract ${contractId} sent to ${recipientEmails.join(', ')}`)
    return true

  } catch (error) {
    console.error('Error sending contract:', error)
    return false
  }
}

export async function executeContract(
  contractId: string,
  schemaName: string,
  signedBy: string,
  signature: string
): Promise<boolean> {
  try {
    // Update contract status
    await safeQuerySchema(schemaName, async (schema) => {
      return await prisma.$executeRawUnsafe(`
        UPDATE "${schema}"."Contract"
        SET 
          status = 'executed',
          "executedAt" = NOW(),
          signatures = jsonb_build_array(
            jsonb_build_object(
              'signedBy', $1,
              'signature', $2,
              'signedAt', NOW()
            )
          ) || COALESCE(signatures, '[]'::jsonb),
          "updatedAt" = NOW()
        WHERE id = $3
      `, signedBy, signature, contractId)
    })

    // Get contract details for notification
    const { data: contracts } = await safeQuerySchema(schemaName, async (schema) => {
      return await prisma.$queryRawUnsafe(`
        SELECT 
          c.*,
          o."organizationId",
          o."campaignId"
        FROM "${schema}"."Contract" c
        JOIN "${schema}"."Order" o ON c."orderId" = o.id
        WHERE c.id = $1
      `, contractId)
    })

    if (contracts && contracts.length > 0) {
      const contract = contracts[0]
      
      // Send notification
      await createNotification({
        type: 'contract_executed',
        title: 'Contract Executed',
        message: `Contract has been fully executed and is now in effect`,
        organizationId: contract.organizationId,
        data: {
          contractId,
          orderId: contract.orderId,
          campaignId: contract.campaignId,
        },
      })

      // Update order status
      await safeQuerySchema(schemaName, async (schema) => {
        return await prisma.$executeRawUnsafe(`
          UPDATE "${schema}"."Order"
          SET 
            status = 'contract_executed',
            "updatedAt" = NOW()
          WHERE id = $1
        `, contract.orderId)
      })
    }

    console.log(`Contract ${contractId} executed by ${signedBy}`)
    return true

  } catch (error) {
    console.error('Error executing contract:', error)
    return false
  }
}

function generateContractContent(template: string, data: any): string {
  // Replace template variables
  let content = template
  
  // Order details
  content = content.replace(/\{\{advertiserName\}\}/g, data.order.advertiserName || 'N/A')
  content = content.replace(/\{\{agencyName\}\}/g, data.order.agencyName || 'N/A')
  content = content.replace(/\{\{campaignName\}\}/g, data.order.campaignName || 'N/A')
  content = content.replace(/\{\{totalAmount\}\}/g, formatCurrency(data.order.totalAmount))
  content = content.replace(/\{\{contractDate\}\}/g, formatDate(data.contractDate))
  
  // Line items
  let lineItemsHtml = '<table><thead><tr><th>Show</th><th>Spots</th><th>Rate</th><th>Total</th></tr></thead><tbody>'
  for (const item of data.lineItems) {
    lineItemsHtml += `<tr>
      <td>${item.showName}</td>
      <td>${item.spotCount}</td>
      <td>${formatCurrency(item.avgRate)}</td>
      <td>${formatCurrency(item.totalAmount)}</td>
    </tr>`
  }
  lineItemsHtml += '</tbody></table>'
  
  content = content.replace(/\{\{lineItems\}\}/g, lineItemsHtml)
  
  return content
}

function getDefaultContractTemplate(): string {
  return `
    <h1>ADVERTISING INSERTION ORDER</h1>
    
    <p>Date: {{contractDate}}</p>
    
    <h2>PARTIES</h2>
    <p>Advertiser: {{advertiserName}}</p>
    <p>Agency: {{agencyName}}</p>
    
    <h2>CAMPAIGN DETAILS</h2>
    <p>Campaign: {{campaignName}}</p>
    <p>Total Amount: {{totalAmount}}</p>
    
    <h2>SCHEDULE</h2>
    {{lineItems}}
    
    <h2>TERMS AND CONDITIONS</h2>
    <p>Standard terms and conditions apply.</p>
    
    <h2>SIGNATURES</h2>
    <p>Advertiser: ___________________________ Date: ___________</p>
    <p>Publisher: ___________________________ Date: ___________</p>
  `
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount)
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date)
}