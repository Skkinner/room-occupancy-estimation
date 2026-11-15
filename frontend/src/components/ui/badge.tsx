import { cva, type VariantProps } from 'class-variance-authority'
import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium leading-5 whitespace-nowrap [&_svg]:size-3.5 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        neutral: 'border-border bg-secondary text-secondary-foreground',
        teal: 'border-primary/40 bg-primary/10 text-teal-200',
        warning: 'border-warning/50 bg-warning/15 text-amber-200',
        warningSolid: 'border-warning bg-warning text-warning-foreground',
        stale: 'hatch border-warning/60 text-amber-200',
        muted: 'border-dashed border-muted-foreground/40 bg-transparent text-muted-foreground',
        drill: 'border-drill bg-drill text-drill-foreground',
        info: 'border-sky-400/40 bg-sky-400/10 text-sky-200',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
)

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
