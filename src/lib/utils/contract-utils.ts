import { safeQuerySchema } from '@/lib/db/schema-db'

export async function generateContractNumber(orgSlug: string): Promise<string> {
  const year = new Date().getFullYear()
  const month = String(new Date().getMonth() + 1).padStart(2, '0')
  
  // Get the last contract number for this month
  const { data } = await safeQuerySchema(orgSlug, async (db) => {
    return db.contract.findFirst({
      where: {
        contractNumber: {
          startsWith: `IO-${year}${month}`
        }
      },
      orderBy: {
        contractNumber: 'desc'
      },
      select: {
        contractNumber: true
      }
    })
  })

  let sequenceNumber = 1
  if (data?.contractNumber) {
    const lastSequence = parseInt(data.contractNumber.split('-').pop() || '0')
    sequenceNumber = lastSequence + 1
  }

  return `IO-${year}${month}-${String(sequenceNumber).padStart(4, '0')}`
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount)
}

export function calculateDueDate(issueDate: Date, paymentTerms: string): Date {
  const dueDate = new Date(issueDate)
  
  // Parse payment terms (e.g., "Net 30", "Net 15", etc.)
  const match = paymentTerms.match(/Net (\d+)/i)
  const days = match ? parseInt(match[1]) : 30
  
  dueDate.setDate(dueDate.getDate() + days)
  return dueDate
}