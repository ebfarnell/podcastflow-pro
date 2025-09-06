'use client'

// Client-side DatePicker component to prevent SSR issues with location references
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { forwardRef } from 'react'

export interface ClientDatePickerProps {
  label?: string
  value?: any
  onChange?: (date: any) => void
  slotProps?: any
  [key: string]: any
}

// Forward ref for proper component behavior
export const ClientDatePicker = forwardRef<any, ClientDatePickerProps>((props, ref) => {
  return <DatePicker {...props} ref={ref} />
})

ClientDatePicker.displayName = 'ClientDatePicker'