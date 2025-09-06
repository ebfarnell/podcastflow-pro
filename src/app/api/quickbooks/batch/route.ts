import { NextRequest, NextResponse } from 'next/server'
import { withApiProtection } from '@/lib/auth/api-protection'
import { comprehensiveQuickBooksService } from '@/lib/quickbooks/comprehensive-service'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


// POST /api/quickbooks/batch - Execute batch operations
export const POST = await withApiProtection(async (
  request: NextRequest,
  context: any,
  { user, organization }
) => {
  try {
    // Check if user has appropriate permissions
    if (!user || !['master', 'admin'].includes(user.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const body = await request.json()
    
    // Validate batch request structure
    if (!body.BatchItemRequest || !Array.isArray(body.BatchItemRequest)) {
      return NextResponse.json(
        { error: 'BatchItemRequest array is required' },
        { status: 400 }
      )
    }

    // Validate batch size limit (QuickBooks allows max 10 operations per batch)
    if (body.BatchItemRequest.length > 10) {
      return NextResponse.json(
        { error: 'Maximum 10 batch operations allowed per request' },
        { status: 400 }
      )
    }

    // Validate each batch item
    for (let i = 0; i < body.BatchItemRequest.length; i++) {
      const item = body.BatchItemRequest[i]
      
      if (!item.bId) {
        return NextResponse.json(
          { error: `Batch item ${i + 1} missing required bId` },
          { status: 400 }
        )
      }

      if (!item.operation || !['create', 'update', 'delete', 'query'].includes(item.operation)) {
        return NextResponse.json(
          { error: `Batch item ${i + 1} has invalid operation. Must be create, update, delete, or query` },
          { status: 400 }
        )
      }

      // Validate operation-specific requirements
      if (['create', 'update'].includes(item.operation) && !item.entity) {
        return NextResponse.json(
          { error: `Batch item ${i + 1} with operation '${item.operation}' requires entity data` },
          { status: 400 }
        )
      }

      if (item.operation === 'query' && !item.query) {
        return NextResponse.json(
          { error: `Batch item ${i + 1} with operation 'query' requires query string` },
          { status: 400 }
        )
      }

      if (item.operation === 'update' && (!item.entity?.Id || !item.entity?.SyncToken)) {
        return NextResponse.json(
          { error: `Batch item ${i + 1} with operation 'update' requires entity Id and SyncToken` },
          { status: 400 }
        )
      }

      if (item.operation === 'delete' && (!item.entity?.Id || !item.entity?.SyncToken)) {
        return NextResponse.json(
          { error: `Batch item ${i + 1} with operation 'delete' requires entity Id and SyncToken` },
          { status: 400 }
        )
      }
    }

    // Execute the batch request
    const batchResponse = await comprehensiveQuickBooksService.executeBatch(organization.id, body)
    
    // Process the response to provide better error information
    const processedResponse = {
      success: true,
      batchResults: batchResponse.BatchItemResponse || [],
      summary: {
        totalOperations: body.BatchItemRequest.length,
        successful: 0,
        failed: 0,
        errors: [] as any[]
      }
    }

    // Analyze results
    for (const result of processedResponse.batchResults) {
      if (result.Fault) {
        processedResponse.summary.failed++
        processedResponse.summary.errors.push({
          bId: result.bId,
          fault: result.Fault
        })
      } else {
        processedResponse.summary.successful++
      }
    }

    return NextResponse.json(processedResponse)

  } catch (error) {
    console.error('QuickBooks batch error:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('not found') || error.message.includes('not connected')) {
        return NextResponse.json(
          { error: 'QuickBooks integration not found or not connected' },
          { status: 404 }
        )
      }
      
      if (error.message.includes('token') || error.message.includes('unauthorized')) {
        return NextResponse.json(
          { error: 'QuickBooks authentication failed. Please reconnect.' },
          { status: 401 }
        )
      }
      
      if (error.message.includes('rate limit') || error.message.includes('throttle')) {
        return NextResponse.json(
          { error: 'Rate limit exceeded. Please try again later.' },
          { status: 429 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Failed to execute batch operations in QuickBooks' },
      { status: 500 }
    )
  }
}, ['QUICKBOOKS_WRITE'])
