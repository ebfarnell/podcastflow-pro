import { NextRequest, NextResponse } from 'next/server'
import { createLocalDate, formatDateKey, parseDate } from '@/lib/utils/date-utils'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const dateStr = url.searchParams.get('date') || '2025-08-15'
  
  try {
    // Test different date parsing methods
    const tests = {
      inputDate: dateStr,
      serverTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      serverTime: new Date().toString(),
      
      // Test our safe date utilities
      createLocalDate: {
        date: createLocalDate(dateStr),
        toString: createLocalDate(dateStr).toString(),
        toISOString: createLocalDate(dateStr).toISOString(),
        formatted: formatDateKey(createLocalDate(dateStr))
      },
      
      // Test problematic methods
      newDate: {
        date: new Date(dateStr),
        toString: new Date(dateStr).toString(),
        toISOString: new Date(dateStr).toISOString(),
        timezoneOffset: new Date(dateStr).getTimezoneOffset()
      },
      
      // Test parseDate utility
      parseDate: {
        date: parseDate(dateStr),
        toString: parseDate(dateStr).toString(),
        toISOString: parseDate(dateStr).toISOString(),
        formatted: formatDateKey(parseDate(dateStr))
      },
      
      // Edge cases
      edgeCases: {
        endOfMonth: {
          input: '2025-08-31',
          createLocal: formatDateKey(createLocalDate('2025-08-31')),
          newDate: formatDateKey(new Date('2025-08-31'))
        },
        dstSpring: {
          input: '2025-03-09',
          createLocal: formatDateKey(createLocalDate('2025-03-09')),
          newDate: formatDateKey(new Date('2025-03-09'))
        },
        dstFall: {
          input: '2025-11-02',
          createLocal: formatDateKey(createLocalDate('2025-11-02')),
          newDate: formatDateKey(new Date('2025-11-02'))
        }
      },
      
      // Verify consistency
      consistency: {
        roundTrip: formatDateKey(createLocalDate(dateStr)) === dateStr,
        parseRoundTrip: formatDateKey(parseDate(dateStr)) === dateStr
      }
    }
    
    return NextResponse.json(tests, { status: 200 })
  } catch (error) {
    return NextResponse.json({ 
      error: 'Failed to test timezone handling',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}