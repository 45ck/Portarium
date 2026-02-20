import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-[var(--radius)] border-2 border-[rgb(var(--border))] bg-white px-3 py-2 text-sm font-bold shadow-[var(--shadow-card)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ring))] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-white text-[rgb(var(--foreground))] hover:bg-gray-50',
        primary:
          'bg-[rgb(var(--primary))] border-[rgb(var(--primary))] text-white hover:bg-[rgb(var(--primary)/0.9)]',
        destructive:
          'bg-[rgb(var(--destructive))] border-[rgb(var(--destructive))] text-white hover:bg-[rgb(var(--destructive)/0.9)]',
        ghost:
          'border-transparent shadow-none hover:bg-gray-100',
        link:
          'border-transparent shadow-none underline-offset-4 hover:underline text-[rgb(var(--primary))]',
      },
      size: {
        default: 'px-3 py-2 text-sm',
        sm: 'px-2.5 py-1.5 text-xs',
        lg: 'px-4 py-2.5 text-base',
        icon: 'h-9 w-9 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
