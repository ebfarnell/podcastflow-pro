import { useCallback } from 'react'

/**
 * Custom hook that returns a focus handler to select all text in an input
 * Useful for Material-UI TextField components
 */
export function useSelectOnFocus() {
  const handleFocus = useCallback((event: React.FocusEvent<HTMLInputElement>) => {
    // Small timeout to ensure cursor is properly placed
    setTimeout(() => {
      event.target.select()
    }, 0)
  }, [])

  return handleFocus
}

/**
 * Props that can be spread onto a TextField or input element
 */
export function getSelectOnFocusProps() {
  return {
    onFocus: (event: React.FocusEvent<HTMLInputElement>) => {
      setTimeout(() => {
        event.target.select()
      }, 0)
    }
  }
}