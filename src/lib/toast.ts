// Simple toast notification utility
// In a production app, you'd use a library like react-hot-toast or react-toastify

export const toast = {
  success: (message: string) => {
    // For now, just log to console
    // In production, integrate with a proper toast library
    console.log('✅ Success:', message)
    if (typeof window !== 'undefined') {
      // You could dispatch a custom event here that a toast component listens to
      window.dispatchEvent(new CustomEvent('toast', { 
        detail: { type: 'success', message } 
      }))
    }
  },
  
  error: (message: string) => {
    console.error('❌ Error:', message)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('toast', { 
        detail: { type: 'error', message } 
      }))
    }
  },
  
  info: (message: string) => {
    console.log('ℹ️ Info:', message)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('toast', { 
        detail: { type: 'info', message } 
      }))
    }
  },
  
  warning: (message: string) => {
    console.warn('⚠️ Warning:', message)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('toast', { 
        detail: { type: 'warning', message } 
      }))
    }
  }
}