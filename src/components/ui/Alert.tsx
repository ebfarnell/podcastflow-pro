import { ReactNode } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/utils/cn'

const alertVariants = cva(
  'relative w-full rounded-lg border p-4',
  {
    variants: {
      variant: {
        default: 'bg-white text-gray-950 dark:bg-gray-950 dark:text-gray-50',
        destructive:
          'border-red-600/50 text-red-600 dark:border-red-600 [&>svg]:text-red-600',
        success:
          'border-green-600/50 text-green-600 dark:border-green-600 [&>svg]:text-green-600',
        warning:
          'border-yellow-600/50 text-yellow-600 dark:border-yellow-600 [&>svg]:text-yellow-600',
        info:
          'border-blue-600/50 text-blue-600 dark:border-blue-600 [&>svg]:text-blue-600',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

interface AlertProps extends VariantProps<typeof alertVariants> {
  children: ReactNode
  className?: string
}

export function Alert({ children, variant, className }: AlertProps) {
  return (
    <div className={cn(alertVariants({ variant }), className)} role="alert">
      {children}
    </div>
  )
}