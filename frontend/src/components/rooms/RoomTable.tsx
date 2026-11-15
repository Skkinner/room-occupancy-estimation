import { ChevronRight, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/form'
import { useI18n } from '@/i18n'
import { formatReplayTime } from '@/lib/format'
import { INSPECTION_STATUSES, PRIORITY_RANK, needsManualVerification, type Priority } from '@/lib/safety'
import type { InspectionStatus } from '@/lib/types'
import { useDemo, type RoomView } from '@/state/DemoStore'
import { EstimateCell, FreshnessBadge, IndicatorChips, InspectionBadge, PriorityBadge, SourceBadge } from './StatusBadges'

const PRIORITIES = Object.keys(PRIORITY_RANK) as Priority[]

function ReadingCell({ view }: { view: RoomView }) {
  const { t, lang } = useI18n()
  return (
    <div className="flex flex-col gap-1">
      <FreshnessBadge freshness={view.freshness} ageSeconds={view.ageSeconds} />
      {view.latestReading && (
        <span className="text-xs text-muted-foreground tabular">
          <span dir="ltr">{formatReplayTime(view.latestReading.timestamp, lang)}</span>{' '}
          ({view.series.source === 'historical_replay' ? t('common.datasetClock') : t('common.simClock')})
        </span>
      )}
      <SourceBadge source={view.series.source} />
    </div>
  )
}

export function RoomTable({ rooms }: { rooms: RoomView[] }) {
  const { t } = useI18n()
  const { retryPrediction } = useDemo()
  const [query, setQuery] = useState('')
  const [priority, setPriority] = useState<Priority | 'all'>('all')
  const [inspection, setInspection] = useState<InspectionStatus | 'all'>('all')
  const [onlyNeeds, setOnlyNeeds] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rooms
      .filter((r) => {
        if (q && !`${r.room.id} ${t(`rooms.${r.room.key}`)}`.toLowerCase().includes(q)) return false
        if (priority !== 'all' && r.priority !== priority) return false
        if (inspection !== 'all' && r.inspection !== inspection) return false
        if (onlyNeeds && !needsManualVerification(r.inspection)) return false
        return true
      })
      .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.room.id.localeCompare(b.room.id))
  }, [rooms, query, priority, inspection, onlyNeeds, t])

  const hasFilters = query || priority !== 'all' || inspection !== 'all' || onlyNeeds
  const clear = () => {
    setQuery('')
    setPriority('all')
    setInspection('all')
    setOnlyNeeds(false)
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_auto] lg:items-end">
        <label className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">{t('table.search')}</span>
          <span className="relative block">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('table.searchPlaceholder')} className="ps-9" />
          </span>
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">{t('table.filterPriority')}</span>
          <Select value={priority} onChange={(e) => setPriority(e.target.value as Priority | 'all')}>
            <option value="all">{t('common.all')}</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {t(`priorityShort.${p}`)}
              </option>
            ))}
          </Select>
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">{t('table.filterInspection')}</span>
          <Select value={inspection} onChange={(e) => setInspection(e.target.value as InspectionStatus | 'all')}>
            <option value="all">{t('common.all')}</option>
            {INSPECTION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`inspectionShort.${s}`)}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex h-10 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={onlyNeeds}
            onChange={(e) => setOnlyNeeds(e.target.checked)}
            className="size-4 accent-[hsl(var(--primary))]"
          />
          {t('table.onlyNeeds')}
        </label>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span aria-live="polite">{t('table.count', { n: filtered.length, total: rooms.length })}</span>
        {hasFilters && (
          <Button variant="link" size="sm" onClick={clear} className="h-auto p-0 text-xs">
            {t('table.clearFilters')}
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground">{t('table.empty')}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={clear}>
            {t('table.clearFilters')}
          </Button>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-lg border lg:block">
            <table className="w-full text-sm">
              <caption className="sr-only">{t('overview.roomList')}</caption>
              <thead className="bg-secondary/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2.5 text-start font-medium">{t('table.colRoom')}</th>
                  <th scope="col" className="px-3 py-2.5 text-start font-medium">{t('table.colPriority')}</th>
                  <th scope="col" className="px-3 py-2.5 text-start font-medium">{t('table.colEstimate')}</th>
                  <th scope="col" className="px-3 py-2.5 text-start font-medium">{t('table.colIndicators')}</th>
                  <th scope="col" className="px-3 py-2.5 text-start font-medium">{t('table.colInspection')}</th>
                  <th scope="col" className="px-3 py-2.5 text-start font-medium">{t('table.colReading')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((r) => (
                  <tr key={r.room.id} className="align-top hover:bg-accent/30">
                    <th scope="row" className="px-3 py-3 text-start font-normal">
                      <Link
                        to={`/rooms/${r.room.id}`}
                        className="group inline-flex flex-col rounded-sm"
                        aria-label={t('table.open', { room: `${r.room.id} ${t(`rooms.${r.room.key}`)}` })}
                      >
                        <span className="font-mono text-base font-semibold text-teal-300 group-hover:underline">{r.room.id}</span>
                        <span className="text-xs text-muted-foreground">{t(`rooms.${r.room.key}`)}</span>
                      </Link>
                    </th>
                    <td className="px-3 py-3">
                      <PriorityBadge priority={r.priority} short />
                    </td>
                    <td className="px-3 py-3">
                      <EstimateCell view={r} onRetry={() => retryPrediction(r.room.id)} />
                    </td>
                    <td className="px-3 py-3">
                      <IndicatorChips indicators={r.indicators} freshness={r.freshness} />
                    </td>
                    <td className="min-w-[200px] max-w-[240px] px-3 py-3">
                      <InspectionBadge status={r.inspection} />
                    </td>
                    <td className="px-3 py-3">
                      <ReadingCell view={r} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile / tablet cards */}
          <ul className="grid gap-3 sm:grid-cols-2 lg:hidden">
            {filtered.map((r) => (
              <li key={r.room.id} className="rounded-lg border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <Link to={`/rooms/${r.room.id}`} className="group">
                    <span className="font-mono text-lg font-semibold text-teal-300 group-hover:underline">{r.room.id}</span>
                    <span className="block text-xs text-muted-foreground">{t(`rooms.${r.room.key}`)}</span>
                  </Link>
                  <PriorityBadge priority={r.priority} short />
                </div>
                <dl className="mt-3 grid gap-3 text-sm">
                  <div>
                    <dt className="mb-1 text-xs text-muted-foreground">{t('table.colEstimate')}</dt>
                    <dd><EstimateCell view={r} onRetry={() => retryPrediction(r.room.id)} /></dd>
                  </div>
                  <div>
                    <dt className="mb-1 text-xs text-muted-foreground">{t('table.colInspection')}</dt>
                    <dd><InspectionBadge status={r.inspection} /></dd>
                  </div>
                  <div>
                    <dt className="mb-1 text-xs text-muted-foreground">{t('table.colIndicators')}</dt>
                    <dd><IndicatorChips indicators={r.indicators} freshness={r.freshness} /></dd>
                  </div>
                  <div>
                    <dt className="mb-1 text-xs text-muted-foreground">{t('table.colReading')}</dt>
                    <dd><ReadingCell view={r} /></dd>
                  </div>
                </dl>
                <Link
                  to={`/rooms/${r.room.id}`}
                  className="mt-3 inline-flex items-center gap-1 text-sm text-teal-300 hover:underline"
                  aria-label={t('table.open', { room: r.room.id })}
                >
                  {t('floorPlan.openRoom')}
                  <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
