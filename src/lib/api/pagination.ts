/**
 * Pagination utilities for API endpoints
 * Supports both offset-based and cursor-based pagination
 */

import { NextRequest } from 'next/server'

export interface PaginationParams {
  page?: number
  limit?: number
  cursor?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
  cursor?: {
    next?: string
    prev?: string
  }
}

export interface CursorPaginatedResponse<T> {
  data: T[]
  cursor: {
    next?: string
    prev?: string
    hasNext: boolean
    hasPrev: boolean
  }
}

/**
 * Extract pagination parameters from request
 */
export function getPaginationParams(request: NextRequest): PaginationParams {
  const searchParams = request.nextUrl.searchParams
  
  return {
    page: Math.max(1, parseInt(searchParams.get('page') || '1', 10)),
    limit: Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10))),
    cursor: searchParams.get('cursor') || undefined,
    sortBy: searchParams.get('sortBy') || undefined,
    sortOrder: (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc'
  }
}

/**
 * Create offset-based pagination response
 */
export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  params: PaginationParams
): PaginatedResponse<T> {
  const page = params.page || 1
  const limit = params.limit || 20
  const totalPages = Math.ceil(total / limit)
  
  return {
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  }
}

/**
 * Create cursor-based pagination response
 */
export function createCursorPaginatedResponse<T>(
  data: T[],
  params: PaginationParams,
  getIdFn: (item: T) => string
): CursorPaginatedResponse<T> {
  const limit = params.limit || 20
  const hasNext = data.length > limit
  
  // Remove extra item used for hasNext check
  if (hasNext) {
    data = data.slice(0, limit)
  }
  
  return {
    data,
    cursor: {
      next: hasNext && data.length > 0 ? getIdFn(data[data.length - 1]) : undefined,
      prev: params.cursor ? getIdFn(data[0]) : undefined,
      hasNext,
      hasPrev: !!params.cursor
    }
  }
}

/**
 * Build Prisma pagination options
 */
export function buildPrismaOffsetPagination(params: PaginationParams) {
  const page = params.page || 1
  const limit = params.limit || 20
  
  return {
    skip: (page - 1) * limit,
    take: limit
  }
}

/**
 * Build Prisma cursor pagination options
 */
export function buildPrismaCursorPagination(params: PaginationParams) {
  const limit = params.limit || 20
  
  const options: any = {
    take: limit + 1 // Take one extra to check if there's a next page
  }
  
  if (params.cursor) {
    options.cursor = { id: params.cursor }
    options.skip = 1 // Skip the cursor itself
  }
  
  return options
}

/**
 * Build Prisma orderBy clause
 */
export function buildPrismaOrderBy(params: PaginationParams) {
  if (!params.sortBy) {
    return { createdAt: 'desc' } // Default sort
  }
  
  // Handle nested fields (e.g., "organization.name")
  if (params.sortBy.includes('.')) {
    const [relation, field] = params.sortBy.split('.')
    return {
      [relation]: {
        [field]: params.sortOrder || 'desc'
      }
    }
  }
  
  return {
    [params.sortBy]: params.sortOrder || 'desc'
  }
}

/**
 * Pagination middleware for API routes
 */
export async function withPagination<T>(
  request: NextRequest,
  handler: (params: PaginationParams) => Promise<{ data: T[], total: number }>
): Promise<PaginatedResponse<T>> {
  const params = getPaginationParams(request)
  const result = await handler(params)
  
  return createPaginatedResponse(result.data, result.total, params)
}

/**
 * SQL query builder for pagination
 */
export function buildSQLPagination(params: PaginationParams): string {
  const limit = params.limit || 20
  const offset = ((params.page || 1) - 1) * limit
  
  return `LIMIT ${limit} OFFSET ${offset}`
}

/**
 * SQL query builder for sorting
 */
export function buildSQLOrderBy(params: PaginationParams, allowedFields: string[]): string {
  const sortBy = params.sortBy || 'created_at'
  const sortOrder = params.sortOrder || 'desc'
  
  // Validate sort field to prevent SQL injection
  if (!allowedFields.includes(sortBy)) {
    return 'ORDER BY created_at DESC'
  }
  
  return `ORDER BY ${sortBy} ${sortOrder.toUpperCase()}`
}