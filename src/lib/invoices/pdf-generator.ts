import { jsPDF } from 'jspdf'

export interface InvoiceData {
  id: string
  invoiceNumber: string
  issueDate: string
  dueDate: string
  clientName: string
  clientAddress?: string
  clientEmail?: string
  organizationName: string
  organizationAddress?: string
  organizationEmail?: string
  organizationPhone?: string
  totalAmount: number
  taxAmount?: number
  subtotal?: number
  status: string
  items: InvoiceItem[]
  notes?: string
  paymentTerms?: string
}

export interface InvoiceItem {
  description: string
  quantity: number
  unitPrice: number
  amount: number
}

export function generateInvoicePDF(invoice: InvoiceData): Buffer {
  // Create new PDF document
  const doc = new jsPDF()
  
  // Set font
  doc.setFont('helvetica')
  
  // Company Header
  doc.setFontSize(24)
  doc.setTextColor(44, 62, 80) // Dark blue-gray
  doc.text(invoice.organizationName, 20, 30)
  
  doc.setFontSize(10)
  doc.setTextColor(100, 100, 100)
  if (invoice.organizationAddress) {
    doc.text(invoice.organizationAddress, 20, 40)
  }
  if (invoice.organizationEmail) {
    doc.text(`Email: ${invoice.organizationEmail}`, 20, 45)
  }
  if (invoice.organizationPhone) {
    doc.text(`Phone: ${invoice.organizationPhone}`, 20, 50)
  }
  
  // Invoice Title
  doc.setFontSize(28)
  doc.setTextColor(44, 62, 80)
  doc.text('INVOICE', 150, 30)
  
  // Invoice Number and Date
  doc.setFontSize(12)
  doc.setTextColor(0, 0, 0)
  doc.text(`Invoice #: ${invoice.invoiceNumber}`, 150, 45)
  doc.text(`Issue Date: ${new Date(invoice.issueDate).toLocaleDateString()}`, 150, 52)
  doc.text(`Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}`, 150, 59)
  
  // Status Badge
  const statusColor = getStatusColor(invoice.status)
  doc.setFillColor(statusColor.r, statusColor.g, statusColor.b)
  doc.rect(150, 65, 40, 8, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(10)
  doc.text(invoice.status.toUpperCase(), 152, 71)
  
  // Bill To Section
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(14)
  doc.text('Bill To:', 20, 80)
  
  doc.setFontSize(12)
  doc.text(invoice.clientName, 20, 90)
  if (invoice.clientAddress) {
    doc.text(invoice.clientAddress, 20, 97)
  }
  if (invoice.clientEmail) {
    doc.text(invoice.clientEmail, 20, 104)
  }
  
  // Line separator
  doc.setDrawColor(200, 200, 200)
  doc.line(20, 115, 190, 115)
  
  // Table Header
  const tableTop = 125
  doc.setFillColor(248, 249, 250)
  doc.rect(20, tableTop, 170, 12, 'F')
  
  doc.setTextColor(44, 62, 80)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Description', 22, tableTop + 8)
  doc.text('Qty', 110, tableTop + 8)
  doc.text('Unit Price', 130, tableTop + 8)
  doc.text('Amount', 165, tableTop + 8)
  
  // Table Border
  doc.setDrawColor(200, 200, 200)
  doc.rect(20, tableTop, 170, 12)
  
  // Invoice Items
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(0, 0, 0)
  let currentY = tableTop + 20
  
  invoice.items.forEach((item, index) => {
    // Add new page if needed
    if (currentY > 250) {
      doc.addPage()
      currentY = 30
    }
    
    // Alternate row colors
    if (index % 2 === 1) {
      doc.setFillColor(248, 249, 250)
      doc.rect(20, currentY - 6, 170, 12, 'F')
    }
    
    doc.text(item.description, 22, currentY)
    doc.text(item.quantity.toString(), 115, currentY)
    doc.text(`$${item.unitPrice.toFixed(2)}`, 135, currentY)
    doc.text(`$${item.amount.toFixed(2)}`, 167, currentY)
    
    currentY += 12
  })
  
  // Table border
  doc.setDrawColor(200, 200, 200)
  doc.rect(20, tableTop + 12, 170, currentY - tableTop - 12)
  
  // Totals Section
  const totalsY = currentY + 10
  doc.setDrawColor(200, 200, 200)
  doc.line(110, totalsY, 190, totalsY)
  
  doc.setFont('helvetica', 'normal')
  if (invoice.subtotal && invoice.taxAmount) {
    doc.text('Subtotal:', 130, totalsY + 10)
    doc.text(`$${invoice.subtotal.toFixed(2)}`, 167, totalsY + 10)
    
    doc.text('Tax:', 130, totalsY + 20)
    doc.text(`$${invoice.taxAmount.toFixed(2)}`, 167, totalsY + 20)
    
    doc.setFont('helvetica', 'bold')
    doc.text('Total:', 130, totalsY + 35)
    doc.text(`$${invoice.totalAmount.toFixed(2)}`, 167, totalsY + 35)
  } else {
    doc.setFont('helvetica', 'bold')
    doc.text('Total:', 130, totalsY + 10)
    doc.text(`$${invoice.totalAmount.toFixed(2)}`, 167, totalsY + 10)
  }
  
  // Payment Terms
  if (invoice.paymentTerms) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text('Payment Terms:', 20, totalsY + 20)
    doc.text(invoice.paymentTerms, 20, totalsY + 27)
  }
  
  // Notes
  if (invoice.notes) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text('Notes:', 20, totalsY + 40)
    const splitNotes = doc.splitTextToSize(invoice.notes, 170)
    doc.text(splitNotes, 20, totalsY + 47)
  }
  
  // Footer
  doc.setFontSize(8)
  doc.setTextColor(100, 100, 100)
  doc.text('Thank you for your business!', 20, 280)
  doc.text(`Generated on ${new Date().toLocaleDateString()}`, 150, 280)
  
  // Convert to Buffer
  const pdfOutput = doc.output('arraybuffer')
  return Buffer.from(pdfOutput)
}

function getStatusColor(status: string): { r: number; g: number; b: number } {
  switch (status.toLowerCase()) {
    case 'paid':
      return { r: 34, g: 197, b: 94 } // Green
    case 'pending':
      return { r: 251, g: 191, b: 36 } // Yellow
    case 'overdue':
      return { r: 239, g: 68, b: 68 } // Red
    case 'draft':
      return { r: 107, g: 114, b: 128 } // Gray
    default:
      return { r: 107, g: 114, b: 128 } // Gray
  }
}