import {
  Activity,
  ClipboardCheck,
  Cpu,
  Database,
  FlaskConical,
  HelpCircle,
  History,
  Loader2,
  Megaphone,
  RefreshCw,
  TrendingUp,
  TriangleAlert,
  WifiOff,
} from 'lucide-react'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'
import type { Freshness, Indicators, Priority } from '@/lib/safety'
import type { DataSource, EstimateOrigin, InspectionStatus } from '@/lib/types'
import { cn } from '@/lib/utils'
import type { RoomView } from '@/state/DemoStore'

export const PRIORITY_STYLE: Record<Priority, { variant: BadgeProps['variant']; Icon: typeof HelpCircle }> = {
  responders: { variant: 'warningSolid', Icon: Megaphone },
  check_first: { variant: 'warning', Icon: TriangleAlert },
  no_data: { variant: 'stale', Icon: WifiOff },
  unconfirmed: { variant: 'muted', Icon: HelpCircle },
  check_recorded: { variant: 'neutral', Icon: ClipboardCheck },
}

export function PriorityBadge({ priority, short = false, className }: { priority: Priority; short?: boolean; className?: string }) {
  const { t } = useI18n()
  const { variant, Icon } = PRIORITY_STYLE[priority]
  return (
    <Badge variant={variant} className={className} title={t(`priority.${priority}`)}>
      <Icon aria-hidden />
      {short ? t(`priorityShort.${priority}`) : t(`priority.${priority}`)}
    </Badge>
  )
}

const INSPECTION_VARIANT: Record<InspectionStatus, BadgeProps['variant']> = {
  unknown: 'muted',
  in_progress: 'info',
  person_found: 'warningSolid',
  inaccessible: 'warningSolid',
  no_one_found: 'neutral',
}

export function InspectionBadge({ status, short = false }: { status: InspectionStatus; short?: boolean }) {
  const { t } = useI18n()
  return (
    <Badge variant={INSPECTION_VARIANT[status]} title={t(`inspection.${status}`)} className="whitespace-normal text-start">
      {status === 'unknown' ? <HelpCircle aria-hidden /> : <ClipboardCheck aria-hidden />}
      {short ? t(`inspectionShort.${status}`) : t(`inspection.${status}`)}
    </Badge>
  )
}

export function FreshnessBadge({ freshness, ageSeconds }: { freshness: Freshness; ageSeconds: number | null }) {
  const { t } = useI18n()
  if (freshness === 'unavailable')
    return (
      <Badge variant="stale" title={t('freshness.unavailableBody')}>
        <WifiOff aria-hidden />
        {t('freshness.unavailable')}
      </Badge>
    )
  if (freshness === 'stale')
    return (
      <Badge variant="stale" title={t('freshness.staleBody', { n: ageSeconds ?? 0 })}>
        <TriangleAlert aria-hidden />
        {t('freshness.stale')} · {t('common.seconds', { n: ageSeconds ?? 0 })}
      </Badge>
    )
  return (
    <Badge variant="neutral" title={t('freshness.age', { n: ageSeconds ?? 0 })}>
      <History aria-hidden />
      {t('freshness.age', { n: ageSeconds ?? 0 })}
    </Badge>
  )
}

export function SourceBadge({ source }: { source: DataSource }) {
  const { t } = useI18n()
  return (
    <Badge variant={source === 'historical_replay' ? 'info' : 'teal'}>
      {source === 'historical_replay' ? <Database aria-hidden /> : <FlaskConical aria-hidden />}
      {t(`provenance.${source}`)}
    </Badge>
  )
}

export function OriginBadge({ origin }: { origin: EstimateOrigin }) {
  const { t } = useI18n()
  return (
    <Badge variant={origin === 'api_model' ? 'teal' : 'warning'}>
      {origin === 'api_model' ? <Cpu aria-hidden /> : <FlaskConical aria-hidden />}
      {t(`provenance.${origin}`)}
    </Badge>
  )
}

/** Compact estimate display that never hides staleness, origin, or the "0 ≠ empty" caveat. */
export function EstimateCell({ view, onRetry, compact = false }: { view: RoomView; onRetry?: () => void; compact?: boolean }) {
  const { t } = useI18n()
  const { estimate, estimateFreshness, estimateAgeSeconds, estimatePending, estimateError, validationIssues } = view

  if (validationIssues?.length) {
    return (
      <Badge variant="warning">
        <TriangleAlert aria-hidden />
        {t('estimate.invalid')}
      </Badge>
    )
  }
  if (!estimate) {
    if (estimateError)
      return (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="warning">
            <TriangleAlert aria-hidden />
            {t('estimate.error')}
          </Badge>
          {onRetry && (
            <Button size="sm" variant="outline" onClick={onRetry}>
              <RefreshCw aria-hidden />
              {t('common.retry')}
            </Button>
          )}
        </div>
      )
    if (estimatePending)
      return (
        <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
          {t('estimate.pending')}
        </span>
      )
    return <span className="text-sm text-muted-foreground">{t('estimate.none')}</span>
  }

  const stale = estimateFreshness !== 'current'
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className={cn(
            'inline-flex items-center rounded-md border px-2 py-0.5 text-sm font-semibold tabular',
            stale ? 'hatch border-warning/60 text-muted-foreground line-through decoration-warning/70' : 'border-border bg-secondary',
          )}
        >
          {stale && <span className="sr-only">{t('estimate.last')}: </span>}
          {t('estimate.value', { n: estimate.estimatedOccupancy })}
        </span>
        {stale && <FreshnessBadge freshness={estimateFreshness} ageSeconds={estimateAgeSeconds} />}
        {estimatePending && <Loader2 className="size-3.5 animate-spin text-muted-foreground motion-reduce:animate-none" aria-label={t('estimate.pending')} />}
      </div>
      {!compact && (
        <div className="flex flex-wrap items-center gap-1.5">
          <OriginBadge origin={estimate.origin} />
        </div>
      )}
      {estimate.estimatedOccupancy === 0 && !stale && (
        <span className="text-xs text-amber-200/90">{t('estimate.zeroNote')}</span>
      )}
      {estimateError && onRetry && (
        <button type="button" onClick={onRetry} className="text-start text-xs text-amber-200 underline underline-offset-2">
          {t('estimate.error')} — {t('common.retry')}
        </button>
      )}
    </div>
  )
}

export function IndicatorChips({ indicators, freshness }: { indicators: Indicators; freshness: Freshness }) {
  const { t, lang } = useI18n()
  if (freshness !== 'current') return <span className="text-xs text-muted-foreground">{t('indicators.noData')}</span>
  return (
    <div className="flex flex-wrap gap-1.5">
      <Badge variant={indicators.pirActive ? 'warning' : 'neutral'}>
        <Activity aria-hidden />
        {indicators.pirActive ? t('indicators.pirActive') : t('indicators.pirNone')}
      </Badge>
      {indicators.co2Slope !== null && (
        <Badge variant={indicators.co2Rising ? 'warning' : 'neutral'} title={t('indicators.slope', { v: indicators.co2Slope })}>
          <TrendingUp aria-hidden className={cn(!indicators.co2Rising && 'opacity-50')} />
          {indicators.co2Rising ? t('indicators.co2Rising') : t('indicators.co2Flat')}
          <span className="tabular opacity-80" dir="ltr">
            ({indicators.co2Slope.toLocaleString(lang === 'ar' ? 'ar-u-nu-latn' : 'en', { maximumFractionDigits: 2, signDisplay: 'always' })})
          </span>
        </Badge>
      )}
    </div>
  )
}
