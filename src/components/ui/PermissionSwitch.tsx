import * as React from 'react'
import * as SwitchPrimitives from '@radix-ui/react-switch'
import { cn } from '@/lib/utils'

interface PermissionSwitchProps extends React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> {
  checked?: boolean
}

const PermissionSwitch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  PermissionSwitchProps
>(({ className, checked, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      'peer inline-flex h-7 w-14 shrink-0 cursor-pointer items-center rounded-full border-2 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
      checked 
        ? 'bg-green-600 border-green-600 hover:bg-green-700 hover:border-green-700' 
        : 'bg-gray-300 border-gray-300 hover:bg-gray-400 hover:border-gray-400',
      className
    )}
    checked={checked}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        'pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200',
        checked ? 'translate-x-7' : 'translate-x-1'
      )}
    />
  </SwitchPrimitives.Root>
))
PermissionSwitch.displayName = 'PermissionSwitch'

export { PermissionSwitch }