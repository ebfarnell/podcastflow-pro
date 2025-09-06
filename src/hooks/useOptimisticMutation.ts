import { useMutation, useQueryClient, UseMutationOptions } from '@tanstack/react-query'

interface OptimisticMutationOptions<TData, TError, TVariables, TContext> extends UseMutationOptions<TData, TError, TVariables, TContext> {
  queryKey: readonly unknown[]
  updateCache?: (oldData: any, variables: TVariables) => any
  successMessage?: string
  errorMessage?: string
}

export function useOptimisticMutation<TData = unknown, TError = unknown, TVariables = void, TContext = unknown>({
  queryKey,
  updateCache,
  successMessage,
  errorMessage,
  ...options
}: OptimisticMutationOptions<TData, TError, TVariables, TContext>) {
  const queryClient = useQueryClient()

  return useMutation<TData, TError, TVariables, TContext>({
    ...options,
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey })

      // Snapshot the previous value
      const previousData = queryClient.getQueryData(queryKey)

      // Optimistically update the cache if updateCache is provided
      if (updateCache && previousData) {
        queryClient.setQueryData(queryKey, (old: any) => updateCache(old, variables))
      }

      // Return context with previous data
      const context = { previousData, ...(options.onMutate ? await options.onMutate(variables) : {}) }
      return context as TContext
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context && 'previousData' in context) {
        queryClient.setQueryData(queryKey, (context as any).previousData)
      }
      
      // Show error message
      if (errorMessage) {
        console.error('Mutation error:', errorMessage)
      }

      // Call original onError if provided
      options.onError?.(error, variables, context)
    },
    onSuccess: (data, variables, context) => {
      // Show success message
      if (successMessage) {
        console.log('Mutation success:', successMessage)
      }

      // Call original onSuccess if provided
      options.onSuccess?.(data, variables, context)
    },
    onSettled: async (data, error, variables, context) => {
      // Always invalidate the query to ensure consistency
      await queryClient.invalidateQueries({ queryKey })

      // Call original onSettled if provided
      return options.onSettled?.(data, error, variables, context)
    },
  })
}

// Example usage for agencies
export function useOptimisticAgencyDelete() {
  return useOptimisticMutation({
    queryKey: ['agencies'] as const,
    mutationFn: async (agencyId: string) => {
      // Your delete API call here
      const response = await fetch(`/api/agencies/${agencyId}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to delete')
      return response.json()
    },
    updateCache: (oldData: any[], agencyId: string) => {
      // Remove the agency from the list optimistically
      return oldData.filter(agency => agency.id !== agencyId)
    },
    successMessage: 'Agency deleted successfully',
    errorMessage: 'Failed to delete agency',
  })
}