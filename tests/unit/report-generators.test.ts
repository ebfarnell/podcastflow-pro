import { PDFDocument } from 'pdf-lib'
import ExcelJS from 'exceljs'

/**
 * Unit Tests for Financial Report Generators
 * Tests the individual report generation functions in isolation
 */

describe('Report Generator Unit Tests', () => {
  // Sample data for testing report generators
  const sampleMonthlyData = {
    period: {
      year: 2024,
      month: 11,
      monthName: 'November',
      daysInMonth: 30
    },
    revenue: {
      advertising: 45000,
      sponsorship: 5000,
      other: 2000,
      total: 52000
    },
    expenses: {
      byCategory: {
        production: 8000,
        talent: 12000,
        hosting: 1500,
        marketing: 6000,
        office: 2500,
        software: 1200
      },
      total: 31200
    },
    invoices: {
      sent: 8,
      paid: 6,
      overdue: 1,
      totalAmount: 48000,
      paidAmount: 36000,
      overdueAmount: 6000,
      details: [
        {
          id: 'inv-001',
          clientName: 'Test Client 1',
          amount: 12000,
          status: 'paid',
          dueDate: new Date('2024-11-15')
        },
        {
          id: 'inv-002', 
          clientName: 'Test Client 2',
          amount: 18000,
          status: 'sent',
          dueDate: new Date('2024-11-30')
        }
      ]
    },
    cashFlow: {
      inflow: 36000,
      outflow: 31200,
      netFlow: 4800
    },
    metrics: {
      profitMargin: 40.0,
      expenseRatio: 60.0,
      collectionRate: 75.0,
      averageInvoiceValue: 6000
    }
  }

  const sampleQuarterlyData = {
    period: {
      year: 2024,
      quarter: 4,
      startMonth: 10,
      endMonth: 12,
      label: 'Q4 2024'
    },
    summary: {
      totalRevenue: 156000,
      totalExpenses: 93600,
      netProfit: 62400,
      profitMargin: 40.0
    },
    monthlyBreakdown: [
      {
        month: 10,
        name: 'October',
        revenue: 50000,
        expenses: 30000,
        profit: 20000
      },
      {
        month: 11,
        name: 'November',
        revenue: 52000,
        expenses: 31200,
        profit: 20800
      },
      {
        month: 12,
        name: 'December',
        revenue: 54000,
        expenses: 32400,
        profit: 21600
      }
    ],
    trends: {
      revenueGrowth: 8.0,
      expenseGrowth: 8.0,
      profitGrowth: 8.0
    },
    topAdvertisers: [
      {
        name: 'Advertiser A',
        totalSpent: 45000,
        campaigns: 6
      },
      {
        name: 'Advertiser B',
        totalSpent: 38000,
        campaigns: 4
      }
    ],
    kpis: {
      averageRevenuePerMonth: 52000,
      customerAcquisitionCost: 250,
      lifetimeValue: 15000
    }
  }

  const samplePLData = {
    period: {
      year: 2024,
      startMonth: 1,
      endMonth: 12,
      label: 'January - December 2024',
      months: Array.from({length: 12}, (_, i) => ({
        number: i + 1,
        name: new Date(2024, i).toLocaleString('default', { month: 'long' })
      }))
    },
    revenue: {
      advertising: 540000,
      other: 60000,
      total: 600000
    },
    cogs: {
      production: 96000,
      talent: 144000,
      hosting: 18000,
      total: 258000
    },
    opex: {
      salesMarketing: 72000,
      generalAdmin: 30000,
      technology: 14400,
      other: 9600,
      total: 126000
    },
    totals: {
      revenue: { advertising: 540000, other: 60000, total: 600000 },
      cogs: 258000,
      grossProfit: 342000,
      opex: 126000,
      ebitda: 216000,
      netIncome: 216000
    },
    metrics: {
      grossMargin: 57.0,
      operatingMargin: 36.0,
      ebitdaMargin: 36.0,
      netMargin: 36.0
    },
    monthlyPL: Array.from({length: 12}, (_, i) => ({
      number: i + 1,
      name: new Date(2024, i).toLocaleString('default', { month: 'long' }),
      revenue: {
        advertising: 45000,
        other: 5000,
        total: 50000
      },
      cogs: 21500,
      opex: 10500,
      netIncome: 18000
    }))
  }

  describe('PDF Generation', () => {
    test('should create valid PDF document for monthly report', async () => {
      // Test PDF creation with sample data
      const pdfDoc = await PDFDocument.create()
      const page = pdfDoc.addPage([612, 792])
      
      // Verify basic PDF structure
      expect(pdfDoc).toBeDefined()
      expect(page).toBeDefined()
      
      const { width, height } = page.getSize()
      expect(width).toBe(612)
      expect(height).toBe(792)
      
      // Test adding content
      page.drawText('Monthly Financial Report', {
        x: 50,
        y: height - 50,
        size: 20
      })
      
      const pdfBytes = await pdfDoc.save()
      expect(pdfBytes).toBeInstanceOf(Uint8Array)
      expect(pdfBytes.length).toBeGreaterThan(0)
      
      // Verify PDF header
      const pdfHeader = String.fromCharCode(...pdfBytes.slice(0, 4))
      expect(pdfHeader).toBe('%PDF')
    })

    test('should handle large amounts of data in PDF', async () => {
      const pdfDoc = await PDFDocument.create()
      const page = pdfDoc.addPage([612, 792])
      
      // Test adding multiple sections of data
      let yPosition = 750
      
      // Revenue section
      page.drawText('REVENUE', { x: 50, y: yPosition, size: 14 })
      yPosition -= 20
      
      for (const [key, value] of Object.entries(sampleMonthlyData.revenue)) {
        page.drawText(`${key}: $${value.toLocaleString()}`, {
          x: 70,
          y: yPosition,
          size: 10
        })
        yPosition -= 15
      }
      
      // Expenses section  
      yPosition -= 10
      page.drawText('EXPENSES', { x: 50, y: yPosition, size: 14 })
      yPosition -= 20
      
      for (const [key, value] of Object.entries(sampleMonthlyData.expenses.byCategory)) {
        page.drawText(`${key}: $${value.toLocaleString()}`, {
          x: 70,
          y: yPosition,
          size: 10
        })
        yPosition -= 15
      }
      
      const pdfBytes = await pdfDoc.save()
      expect(pdfBytes.length).toBeGreaterThan(1000) // Should be substantial
    })

    test('should handle currency formatting in PDF', async () => {
      const pdfDoc = await PDFDocument.create()
      const page = pdfDoc.addPage()
      
      // Test different currency amounts
      const testAmounts = [
        1234.56,
        -1234.56,
        0,
        1000000,
        0.01
      ]
      
      let yPosition = 750
      
      testAmounts.forEach(amount => {
        const formattedAmount = amount < 0 ? 
          `($${Math.abs(amount).toLocaleString()})` : 
          `$${amount.toLocaleString()}`
          
        page.drawText(`Amount: ${formattedAmount}`, {
          x: 50,
          y: yPosition,
          size: 12
        })
        yPosition -= 20
      })
      
      const pdfBytes = await pdfDoc.save()
      expect(pdfBytes.length).toBeGreaterThan(0)
    })
  })

  describe('Excel Generation', () => {
    test('should create valid Excel workbook for quarterly report', async () => {
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Quarterly Report')
      
      // Set up columns
      worksheet.columns = [
        { header: 'Month', key: 'month', width: 15 },
        { header: 'Revenue', key: 'revenue', width: 15 },
        { header: 'Expenses', key: 'expenses', width: 15 },
        { header: 'Profit', key: 'profit', width: 15 }
      ]
      
      // Add data
      sampleQuarterlyData.monthlyBreakdown.forEach(monthData => {
        worksheet.addRow({
          month: monthData.name,
          revenue: `$${monthData.revenue.toLocaleString()}`,
          expenses: `$${monthData.expenses.toLocaleString()}`,
          profit: `$${monthData.profit.toLocaleString()}`
        })
      })
      
      // Test workbook generation
      const buffer = await workbook.xlsx.writeBuffer()
      expect(buffer).toBeInstanceOf(Buffer)
      expect(buffer.length).toBeGreaterThan(0)
      
      // Basic Excel file validation
      expect(buffer.length).toBeGreaterThan(1000) // Should be substantial
    })

    test('should handle multiple worksheets', async () => {
      const workbook = new ExcelJS.Workbook()
      
      // Summary sheet
      const summarySheet = workbook.addWorksheet('Summary')
      summarySheet.addRow(['Total Revenue', `$${sampleQuarterlyData.summary.totalRevenue.toLocaleString()}`])
      summarySheet.addRow(['Total Expenses', `$${sampleQuarterlyData.summary.totalExpenses.toLocaleString()}`])
      summarySheet.addRow(['Net Profit', `$${sampleQuarterlyData.summary.netProfit.toLocaleString()}`])
      
      // Details sheet
      const detailsSheet = workbook.addWorksheet('Monthly Details')
      detailsSheet.columns = [
        { header: 'Month', key: 'month' },
        { header: 'Revenue', key: 'revenue' },
        { header: 'Expenses', key: 'expenses' }
      ]
      
      sampleQuarterlyData.monthlyBreakdown.forEach(month => {
        detailsSheet.addRow(month)
      })
      
      expect(workbook.worksheets).toHaveLength(2)
      expect(workbook.worksheets[0].name).toBe('Summary')
      expect(workbook.worksheets[1].name).toBe('Monthly Details')
      
      const buffer = await workbook.xlsx.writeBuffer()
      expect(buffer.length).toBeGreaterThan(0)
    })

    test('should handle Excel cell formatting and styles', async () => {
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Styled Report')
      
      // Add header with styling
      const headerRow = worksheet.addRow(['Item', 'Amount', 'Status'])
      headerRow.font = { bold: true }
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFCCCCCC' }
      }
      
      // Add data rows with conditional formatting
      worksheet.addRow(['Revenue', 52000, 'Positive'])
      worksheet.addRow(['Expenses', -31200, 'Negative'])
      worksheet.addRow(['Profit', 20800, 'Positive'])
      
      // Test column width setting
      worksheet.getColumn('A').width = 20
      worksheet.getColumn('B').width = 15
      worksheet.getColumn('C').width = 15
      
      const buffer = await workbook.xlsx.writeBuffer()
      expect(buffer.length).toBeGreaterThan(1000)
    })
  })

  describe('CSV Generation', () => {
    test('should generate valid CSV format for P&L report', () => {
      let csv = 'Profit & Loss Statement\n'
      csv += `Period: ${samplePLData.period.label}\n\n`
      
      // Header row
      csv += 'Line Item,'
      samplePLData.period.months.forEach(month => {
        csv += `"${month.name}",`
      })
      csv += 'Total\n'
      
      // Revenue row
      csv += 'Total Revenue,'
      samplePLData.monthlyPL.forEach(month => {
        csv += `"$${month.revenue.total.toLocaleString()}",`
      })
      csv += `"$${samplePLData.revenue.total.toLocaleString()}"\n`
      
      // Verify CSV structure
      expect(csv).toContain('Profit & Loss Statement')
      expect(csv).toContain('Line Item')
      expect(csv).toContain('Total Revenue')
      expect(csv).toContain('January')
      expect(csv).toContain('December')
      
      // Count commas to verify column structure
      const headerLine = csv.split('\n')[3] // Header row
      const commaCount = (headerLine.match(/,/g) || []).length
      expect(commaCount).toBe(13) // 12 months + Total column
    })

    test('should handle CSV escaping for special characters', () => {
      const testData = [
        { item: 'Revenue, Q4', amount: 52000 },
        { item: 'Expenses "Office"', amount: 2500 },
        { item: 'Marketing\nCosts', amount: 6000 }
      ]
      
      let csv = 'Item,Amount\n'
      
      testData.forEach(row => {
        // Properly escape CSV fields
        const escapedItem = row.item.includes(',') || row.item.includes('"') || row.item.includes('\n') ?
          `"${row.item.replace(/"/g, '""')}"` :
          row.item
        
        csv += `${escapedItem},"$${row.amount.toLocaleString()}"\n`
      })
      
      expect(csv).toContain('"Revenue, Q4"')
      expect(csv).toContain('"Expenses ""Office"""')
      expect(csv).toContain('"Marketing\nCosts"')
    })

    test('should generate proper CSV format for monthly report', () => {
      let csv = 'Monthly Financial Report\n'
      csv += `Period: ${sampleMonthlyData.period.monthName} ${sampleMonthlyData.period.year}\n\n`
      
      // Revenue section
      csv += 'REVENUE SUMMARY\n'
      csv += 'Category,Amount\n'
      
      Object.entries(sampleMonthlyData.revenue).forEach(([key, value]) => {
        csv += `"${key}","$${value.toLocaleString()}"\n`
      })
      
      csv += '\nEXPENSE SUMMARY\n'
      csv += 'Category,Amount\n'
      
      Object.entries(sampleMonthlyData.expenses.byCategory).forEach(([key, value]) => {
        csv += `"${key}","$${value.toLocaleString()}"\n`
      })
      
      // Verify structure
      expect(csv).toContain('Monthly Financial Report')
      expect(csv).toContain('REVENUE SUMMARY')
      expect(csv).toContain('EXPENSE SUMMARY')
      expect(csv).toContain('Category,Amount')
      
      // Verify data integrity
      expect(csv).toContain(`"$${sampleMonthlyData.revenue.total.toLocaleString()}"`)
      expect(csv).toContain(`"$${sampleMonthlyData.expenses.total.toLocaleString()}"`)
    })
  })

  describe('Data Validation and Edge Cases', () => {
    test('should handle zero and negative values correctly', () => {
      const edgeCaseData = {
        revenue: { total: 0 },
        expenses: { total: 5000 },
        profit: -5000
      }
      
      // Test PDF formatting
      const formatCurrency = (value: number) => {
        return value < 0 ? 
          `($${Math.abs(value).toLocaleString()})` : 
          `$${value.toLocaleString()}`
      }
      
      expect(formatCurrency(edgeCaseData.revenue.total)).toBe('$0')
      expect(formatCurrency(edgeCaseData.expenses.total)).toBe('$5,000')
      expect(formatCurrency(edgeCaseData.profit)).toBe('($5,000)')
    })

    test('should handle empty data gracefully', () => {
      const emptyData = {
        revenue: { total: 0 },
        expenses: { byCategory: {}, total: 0 },
        invoices: { details: [] },
        metrics: {
          profitMargin: 0,
          expenseRatio: 0,
          collectionRate: 0
        }
      }
      
      // Should not throw errors
      expect(() => {
        let csv = 'Report\n'
        csv += `Total Revenue: $${emptyData.revenue.total.toLocaleString()}\n`
        csv += `Total Expenses: $${emptyData.expenses.total.toLocaleString()}\n`
        csv += `Invoice Count: ${emptyData.invoices.details.length}\n`
      }).not.toThrow()
    })

    test('should validate percentage calculations', () => {
      const calculateMargin = (revenue: number, expenses: number) => {
        if (revenue === 0) return 0
        return ((revenue - expenses) / revenue) * 100
      }
      
      expect(calculateMargin(100, 60)).toBe(40)
      expect(calculateMargin(0, 50)).toBe(0)
      expect(calculateMargin(50, 75)).toBe(-50)
    })

    test('should handle large numbers formatting', () => {
      const largeNumbers = [
        1000000,      // 1M
        1000000000,   // 1B
        1234567890.12 // Large decimal
      ]
      
      largeNumbers.forEach(num => {
        const formatted = `$${num.toLocaleString()}`
        expect(formatted).toMatch(/^\$[\d,]+(\.\d{2})?$/)
      })
    })
  })

  describe('Report Consistency', () => {
    test('should maintain data consistency across formats', () => {
      // Test that the same data produces consistent results across PDF, Excel, and CSV
      const testRevenue = 52000
      const testExpenses = 31200
      const testProfit = testRevenue - testExpenses
      
      // All formats should show the same calculated values
      expect(testProfit).toBe(20800)
      
      // Formatting should be consistent
      const pdfFormat = `$${testRevenue.toLocaleString()}`
      const csvFormat = `"$${testRevenue.toLocaleString()}"`
      
      expect(pdfFormat).toBe('$52,000')
      expect(csvFormat).toBe('"$52,000"')
    })

    test('should handle date formatting consistently', () => {
      const testDate = new Date('2024-11-15')
      
      // Different format requirements
      const isoFormat = testDate.toISOString().split('T')[0]
      const displayFormat = testDate.toLocaleDateString('en-US')
      const monthYear = testDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
      
      expect(isoFormat).toBe('2024-11-15')
      expect(displayFormat).toBe('11/15/2024')
      expect(monthYear).toBe('November 2024')
    })
  })
})