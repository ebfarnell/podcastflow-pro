import { useCallback, useState } from 'react'
import { Alert, Snackbar } from '@mui/material'

type VariantType = 'success' | 'error' | 'warning' | 'info'

// Simple snackbar implementation without external dependencies
let globalShowSnackbar: ((message: string, variant: VariantType) => void) | null = null

export function SnackbarProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [variant, setVariant] = useState<VariantType>('info')

  globalShowSnackbar = useCallback((msg: string, v: VariantType = 'info') => {
    setMessage(msg)
    setVariant(v)
    setOpen(true)
  }, [])

  return (
    <>
      {children}
      <Snackbar
        open={open}
        autoHideDuration={6000}
        onClose={() => setOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setOpen(false)} severity={variant} sx={{ width: '100%' }}>
          {message}
        </Alert>
      </Snackbar>
    </>
  )
}

export function useSnackbar() {
  const showSnackbar = useCallback(
    (message: string, variant: VariantType = 'info') => {
      if (globalShowSnackbar) {
        globalShowSnackbar(message, variant)
      } else {
        // Fallback to console if provider not mounted
        console.log(`[${variant.toUpperCase()}]`, message)
      }
    },
    []
  )

  return { showSnackbar }
}