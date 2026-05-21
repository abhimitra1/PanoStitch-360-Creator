import * as React from 'react'
import { cn } from '@/lib/utils/cn'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'accent' | 'success' | 'error'
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center font-mono text-xs tracking-widest uppercase',
        variant === 'default' && 'text-ink-faint',
        variant === 'accent' && 'text-accent',
        variant === 'success' && 'text-success',
        variant === 'error' && 'text-error',
        className
      )}
      {...props}
    />
  )
}
