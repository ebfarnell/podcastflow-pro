import { toast } from '@/lib/toast'

export function useSnackbar() {
  const showSnackbar = (message: string, severity: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    toast[severity](message)
  }

  return { showSnackbar }
}