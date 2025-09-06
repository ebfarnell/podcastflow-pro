import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import html2canvas from 'html2canvas'
import { format } from 'date-fns'

export interface PDFExportOptions {
  title: string
  subtitle?: string
  author?: string
  orientation?: 'portrait' | 'landscape'
  includeTimestamp?: boolean
  includePageNumbers?: boolean
}

export class PDFExporter {
  private pdf: jsPDF
  private options: PDFExportOptions
  private pageNumber: number = 1
  private readonly margins = { top: 40, right: 20, bottom: 30, left: 20 }
  
  constructor(options: PDFExportOptions) {
    this.options = {
      orientation: 'portrait',
      includeTimestamp: true,
      includePageNumbers: true,
      ...options
    }
    
    this.pdf = new jsPDF({
      orientation: this.options.orientation,
      unit: 'mm',
      format: 'a4'
    })
    
    this.addHeader()
  }
  
  private addHeader() {
    // Add title
    this.pdf.setFontSize(20)
    this.pdf.setFont('helvetica', 'bold')
    this.pdf.text(this.options.title, this.margins.left, this.margins.top - 20)
    
    // Add subtitle
    if (this.options.subtitle) {
      this.pdf.setFontSize(12)
      this.pdf.setFont('helvetica', 'normal')
      this.pdf.text(this.options.subtitle, this.margins.left, this.margins.top - 10)
    }
    
    // Add timestamp
    if (this.options.includeTimestamp) {
      this.pdf.setFontSize(10)
      this.pdf.setTextColor(100, 100, 100)
      const timestamp = format(new Date(), 'MMM dd, yyyy HH:mm')
      const pageWidth = this.pdf.internal.pageSize.getWidth()
      this.pdf.text(timestamp, pageWidth - this.margins.right - 50, this.margins.top - 20)
    }
    
    // Reset text color
    this.pdf.setTextColor(0, 0, 0)
  }
  
  private addPageNumber() {
    if (!this.options.includePageNumbers) return
    
    const pageHeight = this.pdf.internal.pageSize.getHeight()
    const pageWidth = this.pdf.internal.pageSize.getWidth()
    
    this.pdf.setFontSize(10)
    this.pdf.setTextColor(100, 100, 100)
    this.pdf.text(
      `Page ${this.pageNumber}`,
      pageWidth / 2,
      pageHeight - this.margins.bottom + 10,
      { align: 'center' }
    )
    this.pdf.setTextColor(0, 0, 0)
  }
  
  addSection(title: string) {
    this.pdf.setFontSize(16)
    this.pdf.setFont('helvetica', 'bold')
    const currentY = this.pdf.lastAutoTable?.finalY || this.margins.top
    this.pdf.text(title, this.margins.left, currentY + 10)
    this.pdf.setFont('helvetica', 'normal')
  }
  
  addParagraph(text: string) {
    this.pdf.setFontSize(12)
    const currentY = this.pdf.lastAutoTable?.finalY || this.margins.top
    const pageWidth = this.pdf.internal.pageSize.getWidth()
    const maxWidth = pageWidth - this.margins.left - this.margins.right
    
    const lines = this.pdf.splitTextToSize(text, maxWidth)
    this.pdf.text(lines, this.margins.left, currentY + 10)
  }
  
  addTable(headers: string[], data: any[][], options?: any) {
    const currentY = this.pdf.lastAutoTable?.finalY || this.margins.top
    
    autoTable(this.pdf, {
      head: [headers],
      body: data,
      startY: currentY + 15,
      margin: { left: this.margins.left, right: this.margins.right },
      theme: 'striped',
      headStyles: {
        fillColor: [33, 150, 243],
        textColor: 255,
        fontSize: 11,
        fontStyle: 'bold'
      },
      bodyStyles: {
        fontSize: 10
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      },
      ...options
    })
  }
  
  async addChart(chartElement: HTMLElement | null, title?: string) {
    if (!chartElement) return
    
    try {
      const canvas = await html2canvas(chartElement, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false
      })
      
      const imgData = canvas.toDataURL('image/png')
      const currentY = this.pdf.lastAutoTable?.finalY || this.margins.top
      const pageWidth = this.pdf.internal.pageSize.getWidth()
      const maxWidth = pageWidth - this.margins.left - this.margins.right
      
      // Calculate image dimensions
      const imgWidth = maxWidth
      const imgHeight = (canvas.height / canvas.width) * imgWidth
      
      // Add title if provided
      if (title) {
        this.pdf.setFontSize(14)
        this.pdf.setFont('helvetica', 'bold')
        this.pdf.text(title, this.margins.left, currentY + 10)
        this.pdf.setFont('helvetica', 'normal')
      }
      
      // Add image
      this.pdf.addImage(
        imgData,
        'PNG',
        this.margins.left,
        currentY + (title ? 20 : 10),
        imgWidth,
        imgHeight
      )
    } catch (error) {
      console.error('Error adding chart to PDF:', error)
    }
  }
  
  addNewPage() {
    this.addPageNumber()
    this.pdf.addPage()
    this.pageNumber++
    this.addHeader()
  }
  
  addMetrics(metrics: { label: string; value: string | number; change?: string }[]) {
    const currentY = this.pdf.lastAutoTable?.finalY || this.margins.top
    let xOffset = this.margins.left
    const metricWidth = 60
    
    metrics.forEach((metric, index) => {
      if (index > 0 && index % 3 === 0) {
        xOffset = this.margins.left
      }
      
      // Metric label
      this.pdf.setFontSize(10)
      this.pdf.setTextColor(100, 100, 100)
      this.pdf.text(metric.label, xOffset, currentY + 15)
      
      // Metric value
      this.pdf.setFontSize(16)
      this.pdf.setFont('helvetica', 'bold')
      this.pdf.setTextColor(0, 0, 0)
      this.pdf.text(String(metric.value), xOffset, currentY + 22)
      
      // Change percentage if provided
      if (metric.change) {
        this.pdf.setFontSize(10)
        this.pdf.setFont('helvetica', 'normal')
        const isPositive = metric.change.startsWith('+')
        this.pdf.setTextColor(isPositive ? 76 : 244, isPositive ? 175 : 67, isPositive ? 80 : 54)
        this.pdf.text(metric.change, xOffset, currentY + 28)
      }
      
      xOffset += metricWidth
    })
    
    this.pdf.setTextColor(0, 0, 0)
    this.pdf.setFont('helvetica', 'normal')
  }
  
  save(filename: string) {
    this.addPageNumber()
    this.pdf.save(filename)
  }
  
  getBlob(): Blob {
    this.addPageNumber()
    return this.pdf.output('blob')
  }
  
  getDataUri(): string {
    this.addPageNumber()
    return this.pdf.output('datauristring')
  }
}

// Helper function to create a chart canvas from chart data
export async function createChartCanvas(
  chartData: any,
  chartType: 'line' | 'bar' | 'pie',
  options: {
    width?: number
    height?: number
    title?: string
  } = {}
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas')
  canvas.width = options.width || 800
  canvas.height = options.height || 400
  
  // This is a placeholder - in a real implementation, you would use a charting library
  // like Chart.js to render the chart on the canvas
  const ctx = canvas.getContext('2d')
  if (ctx) {
    // Draw a placeholder chart
    ctx.fillStyle = '#f0f0f0'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    
    ctx.fillStyle = '#333'
    ctx.font = '20px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(
      `${chartType.charAt(0).toUpperCase() + chartType.slice(1)} Chart`,
      canvas.width / 2,
      canvas.height / 2
    )
  }
  
  return canvas
}

// Quick export functions
export function exportReportAsPDF(
  title: string,
  content: {
    sections?: { title: string; content: string }[]
    tables?: { title: string; headers: string[]; data: any[][] }[]
    metrics?: { label: string; value: string | number; change?: string }[]
  },
  options?: Partial<PDFExportOptions>
) {
  const exporter = new PDFExporter({ title, ...options })
  
  // Add metrics
  if (content.metrics && content.metrics.length > 0) {
    exporter.addMetrics(content.metrics)
  }
  
  // Add sections
  content.sections?.forEach(section => {
    exporter.addSection(section.title)
    exporter.addParagraph(section.content)
  })
  
  // Add tables
  content.tables?.forEach(table => {
    if (table.title) {
      exporter.addSection(table.title)
    }
    exporter.addTable(table.headers, table.data)
  })
  
  const filename = `${title.toLowerCase().replace(/\s+/g, '-')}-${format(new Date(), 'yyyy-MM-dd')}.pdf`
  exporter.save(filename)
}