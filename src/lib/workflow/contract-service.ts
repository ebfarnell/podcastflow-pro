import { safeQuerySchema } from '@/lib/db/schema-db'
import { generateContractNumber } from '@/lib/utils/contract-utils'
import puppeteer from 'puppeteer'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { format } from 'date-fns'

export interface ContractGenerationData {
  orderId: string
  templateId?: string
  variables?: Record<string, any>
  autogenerate?: boolean
}

export interface ContractVariables {
  contractNumber: string
  contractDate: string
  advertiserName: string
  agencyName?: string
  campaignName: string
  startDate: string
  endDate: string
  totalSpots: number
  totalAmount: string
  showsPlacements: string
  paymentTerms: string
  cancellationTerms: string
  [key: string]: any
}

export class ContractService {
  private uploadDir = '/home/ec2-user/podcastflow-pro/uploads/contracts'

  constructor() {
    // Ensure upload directory exists
    this.ensureUploadDir()
  }

  private async ensureUploadDir() {
    try {
      await mkdir(this.uploadDir, { recursive: true })
    } catch (error) {
      console.error('Failed to create upload directory:', error)
    }
  }

  async generateContract(
    orgSlug: string,
    data: ContractGenerationData
  ): Promise<{ success: boolean; contractId?: string; documentUrl?: string; error?: string }> {
    try {
      // Get order details
      const { data: order, error: orderError } = await safeQuerySchema(orgSlug, async (db) => {
        return db.order.findUnique({
          where: { id: data.orderId },
          include: {
            campaign: true,
            advertiser: true,
            agency: true,
            lineItems: {
              include: {
                episode: {
                  include: {
                    show: true
                  }
                }
              }
            }
          }
        })
      })

      if (orderError || !order) {
        return { success: false, error: 'Order not found' }
      }

      // Get contract template
      let templateId = data.templateId
      if (!templateId) {
        const { data: defaultTemplate } = await safeQuerySchema(orgSlug, async (db) => {
          return db.contractTemplate.findFirst({
            where: {
              organizationId: order.organizationId,
              isDefault: true,
              isActive: true
            }
          })
        })
        if (defaultTemplate) {
          templateId = defaultTemplate.id
        }
      }

      if (!templateId) {
        return { success: false, error: 'No contract template found' }
      }

      // Prepare contract variables
      const contractNumber = await generateContractNumber(orgSlug)
      const contractVariables: ContractVariables = {
        contractNumber,
        contractDate: format(new Date(), 'MMMM d, yyyy'),
        advertiserName: order.advertiser.name,
        agencyName: order.agency?.name || 'N/A',
        campaignName: order.campaign?.name || order.name,
        startDate: format(new Date(order.startDate), 'MMMM d, yyyy'),
        endDate: format(new Date(order.endDate), 'MMMM d, yyyy'),
        totalSpots: order.lineItems.length,
        totalAmount: order.netAmount.toFixed(2),
        showsPlacements: this.formatShowsPlacements(order.lineItems),
        paymentTerms: order.paymentTerms || 'Net 30',
        cancellationTerms: '30 days written notice required',
        ...data.variables
      }

      // Generate HTML from template
      const { data: generatedHtml } = await safeQuerySchema(orgSlug, 
        `SELECT generate_contract_from_template($1, $2, $3, $4) as result`,
        [orgSlug, templateId, data.orderId, JSON.stringify(contractVariables)]
      )

      if (!generatedHtml || !generatedHtml[0]?.result) {
        return { success: false, error: 'Failed to generate contract HTML' }
      }

      const contractHtml = generatedHtml[0].result.html

      // Generate PDF
      const pdfPath = await this.generatePDF(contractHtml, contractNumber)
      const documentUrl = `/api/contracts/download/${contractNumber}.pdf`

      // Create contract record
      const { data: contract, error: contractError } = await safeQuerySchema(orgSlug, async (db) => {
        return db.contract.create({
          data: {
            contractNumber,
            organizationId: order.organizationId,
            orderId: order.id,
            campaignId: order.campaignId,
            advertiserId: order.advertiserId,
            agencyId: order.agencyId,
            title: `${order.advertiser.name} - ${order.campaign?.name || order.name}`,
            totalAmount: order.totalAmount,
            discountAmount: order.discountAmount || 0,
            netAmount: order.netAmount,
            startDate: order.startDate,
            endDate: order.endDate,
            paymentTerms: order.paymentTerms || 'Net 30',
            status: 'draft',
            templateId,
            generatedDocument: generatedHtml[0].result,
            documentUrl
          }
        })
      })

      if (contractError || !contract) {
        return { success: false, error: 'Failed to create contract record' }
      }

      // Update order with contract ID
      await safeQuerySchema(orgSlug, async (db) => {
        await db.order.update({
          where: { id: order.id },
          data: { contractId: contract.id }
        })
      })

      return {
        success: true,
        contractId: contract.id,
        documentUrl
      }
    } catch (error) {
      console.error('Contract generation error:', error)
      return { success: false, error: error.message || 'Contract generation failed' }
    }
  }

  private formatShowsPlacements(lineItems: any[]): string {
    const groupedByShow: Record<string, any[]> = {}
    
    lineItems.forEach(item => {
      const showName = item.episode?.show?.name || 'Unknown Show'
      if (!groupedByShow[showName]) {
        groupedByShow[showName] = []
      }
      groupedByShow[showName].push(item)
    })

    let html = '<table style="width: 100%; border-collapse: collapse;">'
    html += '<tr><th style="text-align: left; border-bottom: 1px solid #ddd; padding: 8px;">Show</th>'
    html += '<th style="text-align: left; border-bottom: 1px solid #ddd; padding: 8px;">Dates</th>'
    html += '<th style="text-align: left; border-bottom: 1px solid #ddd; padding: 8px;">Placement</th>'
    html += '<th style="text-align: right; border-bottom: 1px solid #ddd; padding: 8px;">Rate</th>'
    html += '<th style="text-align: right; border-bottom: 1px solid #ddd; padding: 8px;">Spots</th></tr>'

    Object.entries(groupedByShow).forEach(([showName, items]) => {
      items.forEach(item => {
        html += '<tr>'
        html += `<td style="padding: 8px;">${showName}</td>`
        html += `<td style="padding: 8px;">${format(new Date(item.airDate), 'MM/dd/yyyy')}</td>`
        html += `<td style="padding: 8px;">${item.placementType}</td>`
        html += `<td style="padding: 8px; text-align: right;">$${item.rate.toFixed(2)}</td>`
        html += `<td style="padding: 8px; text-align: right;">1</td>`
        html += '</tr>'
      })
    })

    html += '</table>'
    return html
  }

  private async generatePDF(html: string, contractNumber: string): Promise<string> {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })

    try {
      const page = await browser.newPage()
      await page.setContent(html, { waitUntil: 'networkidle0' })
      
      const pdfBuffer = await page.pdf({
        format: 'Letter',
        printBackground: true,
        margin: {
          top: '1in',
          right: '1in',
          bottom: '1in',
          left: '1in'
        }
      })

      const pdfPath = join(this.uploadDir, `${contractNumber}.pdf`)
      await writeFile(pdfPath, pdfBuffer)

      return pdfPath
    } finally {
      await browser.close()
    }
  }

  async sendContractForSignature(
    orgSlug: string,
    contractId: string,
    recipientEmail: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Update contract status
      const { error } = await safeQuerySchema(orgSlug, async (db) => {
        await db.contract.update({
          where: { id: contractId },
          data: { 
            status: 'sent',
            sentAt: new Date()
          }
        })
      })

      if (error) {
        return { success: false, error: 'Failed to update contract status' }
      }

      // TODO: Integrate with DocuSign or similar service
      // For now, we'll just mark it as sent

      return { success: true }
    } catch (error) {
      console.error('Send contract error:', error)
      return { success: false, error: error.message || 'Failed to send contract' }
    }
  }

  async markContractExecuted(
    orgSlug: string,
    contractId: string,
    executedById: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await safeQuerySchema(orgSlug, async (db) => {
        await db.contract.update({
          where: { id: contractId },
          data: {
            status: 'executed',
            isExecuted: true,
            executedAt: new Date(),
            executedById
          }
        })
      })

      if (error) {
        return { success: false, error: 'Failed to mark contract as executed' }
      }

      return { success: true }
    } catch (error) {
      console.error('Execute contract error:', error)
      return { success: false, error: error.message || 'Failed to execute contract' }
    }
  }
}