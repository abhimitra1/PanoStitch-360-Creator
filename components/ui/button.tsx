import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils/cn'

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap',
    'text-sm font-medium font-sans transition-colors',
    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent',
    'disabled:pointer-events-none disabled:opacity-40',
    'cursor-pointer select-none',
  ],
  {
    variants: {
      variant: {
        default:
          'bg-accent text-background hover:bg-accent/90 rounded-[2px]',
        ghost:
          'text-ink-dim hover:text-ink hover:bg-surface-hover rounded-[2px]',
        outline:
          'border border-line text-ink-dim hover:text-ink hover:border-ink-faint rounded-[2px]',
        destructive:
          'text-error hover:bg-error/10 rounded-[2px]',
        link:
          'text-ink-dim hover:text-ink underline-offset-4 hover:underline p-0 h-auto',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-7 px-3 py-1 text-xs',
        lg: 'h-11 px-6',
        icon: 'h-9 w-9 p-0',
        'icon-sm': 'h-7 w-7 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
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
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
