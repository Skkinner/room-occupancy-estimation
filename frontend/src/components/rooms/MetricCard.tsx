import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export function MetricCard({
  label,
  value,
  hint,
  Icon,
  tone = 'neutral',
}: {
  label: string
  value: number | string
  hint: string
  Icon: LucideIcon
  tone?: 'neutral' | 'warning' | 'stale'
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg border bg-card p-4',
        tone === 'warning' && 'border-warning/40',
        tone === 'stale' && 'hatch border-warning/40',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <span
          className={cn(
            'grid size-8 place-items-center rounded-md border',
            tone === 'neutral' ? 'border-primary/30 text-teal-300' : 'border-warning/50 text-amber-300',
          )}
        >
          <Icon className="size-4" aria-hidden />
        </span>
      </div>
      <p className="mt-2 text-3xl font-bold tabular">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 max-w-3xl text-sm text-muted-foreground sm:text-base">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
