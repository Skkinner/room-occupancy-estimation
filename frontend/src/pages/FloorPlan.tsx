import { ChevronRight, MousePointerClick } from 'lucide-react'
import { useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { ReplayTimeline } from '@/components/rooms/DrillControls'
import { PageHeader } from '@/components/rooms/MetricCard'
import {
  EstimateCell,
  FreshnessBadge,
  IndicatorChips,
  InspectionBadge,
  PriorityBadge,
  SourceBadge,
} from '@/components/rooms/StatusBadges'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useI18n } from '@/i18n'
import type { Priority } from '@/lib/safety'
import { useDemo, type RoomView } from '@/state/DemoStore'

const AMBER = 'hsl(38 92% 52%)'
const SLATE = 'hsl(215 20% 62%)'
const TEAL = 'hsl(173 70% 48%)'

const STYLE: Record<Priority, { fill: string; stroke: string; dash?: string; width: number }> = {
  responders: { fill: 'hsl(38 92% 52% / 0.30)', stroke: AMBER, width: 4 },
  check_first: { fill: 'hsl(38 92% 52% / 0.14)', stroke: AMBER, width: 3 },
  no_data: { fill: 'url(#hatch)', stroke: AMBER, dash: '10 6', width: 2.5 },
  unconfirmed: { fill: 'hsl(217 33% 14%)', stroke: SLATE, dash: '6 5', width: 2 },
  check_recorded: { fill: 'hsl(217 33% 18%)', stroke: SLATE, width: 2 },
}

/** Distinct marker SHAPES so priority never depends on color alone. */
function Marker({ priority, x, y }: { priority: Priority; x: number; y: number }) {
  const s = 14
  switch (priority) {
    case 'responders': {
      const pts = Array.from({ length: 8 }, (_, i) => {
        const a = (Math.PI / 4) * i + Math.PI / 8
        return `${x + s * Math.cos(a)},${y + s * Math.sin(a)}`
      }).join(' ')
      return <polygon points={pts} fill={AMBER} />
    }
    case 'check_first':
      return <polygon points={`${x},${y - s} ${x + s},${y + s * 0.8} ${x - s},${y + s * 0.8}`} fill={AMBER} />
    case 'no_data':
      return (
        <g stroke={AMBER} strokeWidth={3} fill="none">
          <circle cx={x} cy={y} r={s - 2} />
          <line x1={x - 8} y1={y + 8} x2={x + 8} y2={y - 8} />
        </g>
      )
    case 'unconfirmed':
      return (
        <g>
          <circle cx={x} cy={y} r={s - 2} fill="none" stroke={SLATE} strokeWidth={2.5} strokeDasharray="4 3" />
          <text x={x} y={y + 5} textAnchor="middle" fontSize={15} fontWeight={700} fill={SLATE}>
            ?
          </text>
        </g>
      )
    case 'check_recorded':
      return (
        <g>
          <rect x={x - s + 2} y={y - s + 2} width={2 * s - 4} height={2 * s - 4} rx={3} fill="none" stroke={SLATE} strokeWidth={2.5} />
          <path d={`M${x - 6},${y} l4,4 l8,-8`} stroke={SLATE} strokeWidth={2.5} fill="none" />
        </g>
      )
  }
}

function RoomShape({
  view,
  selected,
  onSelect,
  onHover,
}: {
  view: RoomView
  selected: boolean
  onSelect: () => void
  onHover: (v: boolean) => void
}) {
  const { t } = useI18n()
  const { x, y, w, h } = view.room.plan
  const st = STYLE[view.priority]
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect()
    }
  }
  const est = view.estimate
  return (
    <g
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={t('floorPlan.roomButton', {
        room: view.room.id,
        type: t(`rooms.${view.room.key}`),
        priority: t(`priority.${view.priority}`),
      })}
      onClick={onSelect}
      onKeyDown={onKey}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onFocus={() => onHover(true)}
      onBlur={() => onHover(false)}
      className="cursor-pointer outline-none [&:focus-visible>rect:first-child]:stroke-[hsl(173_70%_60%)]"
    >
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={8}
        fill={st.fill}
        stroke={selected ? TEAL : st.stroke}
        strokeWidth={selected ? 4 : st.width}
        strokeDasharray={selected ? undefined : st.dash}
      />
      {/* door gap toward corridor */}
      <rect x={x + w / 2 - 22} y={y < 250 ? y + h - 3 : y - 3} width={44} height={6} fill="hsl(222 47% 6%)" />
      <Marker priority={view.priority} x={x + w - 26} y={y + 26} />
      <text x={x + 18} y={y + 36} fontSize={26} fontWeight={700} fill="hsl(210 40% 96%)" fontFamily="JetBrains Mono, monospace">
        {view.room.id}
      </text>
      <text x={x + 18} y={y + 62} fontSize={15} fill="hsl(215 22% 70%)">
        {t(`rooms.${view.room.key}`)}
      </text>
      <text x={x + 18} y={y + h - 54} fontSize={15} fontWeight={600} fill={view.priority === 'unconfirmed' || view.priority === 'check_recorded' ? SLATE : AMBER}>
        {t(`priorityShort.${view.priority}`)}
      </text>
      <text x={x + 18} y={y + h - 28} fontSize={14} fill="hsl(215 22% 75%)">
        {view.freshness !== 'current'
          ? t(`freshness.${view.freshness}`)
          : est
            ? `${t('estimate.value', { n: est.estimatedOccupancy })}${est.origin === 'offline_simulator' ? ' (sim)' : ''}`
            : t('estimate.none')}
      </text>
    </g>
  )
}

function LegendItem({ priority }: { priority: Priority }) {
  const st = STYLE[priority]
  return (
    <li className="flex items-center gap-3">
      <svg width="44" height="30" viewBox="0 0 44 30" aria-hidden>
        <rect x="2" y="2" width="40" height="26" rx="4" fill={st.fill} stroke={st.stroke} strokeWidth={2} strokeDasharray={st.dash} />
        <g transform="translate(-8 -0) scale(0.7)">
          <Marker priority={priority} x={44} y={21} />
        </g>
      </svg>
      <PriorityBadge priority={priority} />
    </li>
  )
}

export default function FloorPlan() {
  const { t } = useI18n()
  const { rooms, retryPrediction } = useDemo()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const detailId = hoverId ?? selectedId
  const detail = rooms.find((r) => r.room.id === detailId) ?? null

  return (
    <>
      <PageHeader title={t('floorPlan.title')} subtitle={t('floorPlan.subtitle')} />
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
            <CardTitle>{t('overview.floorN', { n: 1 })}</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Badge variant="warning">{t('floorPlan.watermark')}</Badge>
              <Badge variant="neutral">{t('provenance.fictional')}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-lg border bg-[hsl(222_47%_5%)]" dir="ltr">
              <svg viewBox="0 0 1000 600" role="group" aria-label={t('floorPlan.mapLabel')} className="h-auto w-full">
                <defs>
                  <pattern id="hatch" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <rect width="12" height="12" fill="hsl(222 42% 9%)" />
                    <rect width="5" height="12" fill="hsl(38 92% 52% / 0.18)" />
                  </pattern>
                  <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                    <path d="M20 0H0V20" fill="none" stroke="hsl(217 30% 14%)" strokeWidth="1" />
                  </pattern>
                </defs>
                <rect width="1000" height="600" fill="url(#grid)" />
                {/* building outline */}
                <rect x="20" y="20" width="960" height="520" rx="10" fill="none" stroke="hsl(217 30% 30%)" strokeWidth="3" />
                {/* corridor */}
                <rect x="40" y="250" width="920" height="60" fill="hsl(217 33% 10%)" stroke="hsl(217 30% 22%)" />
                <text x="500" y="286" textAnchor="middle" fontSize="14" letterSpacing="4" fill="hsl(215 22% 55%)">
                  {t('floorPlan.corridor').toUpperCase()}
                </text>
                {/* exits (fictional) */}
                <g fill="hsl(173 70% 48%)" fontSize="13">
                  <rect x="14" y="262" width="12" height="36" />
                  <text x="52" y="285">← {t('floorPlan.exit')}</text>
                  <rect x="974" y="262" width="12" height="36" />
                  <text x="948" y="285" textAnchor="end">{t('floorPlan.exit')} →</text>
                </g>
                {rooms.map((r) => (
                  <RoomShape
                    key={r.room.id}
                    view={r}
                    selected={selectedId === r.room.id}
                    onSelect={() => setSelectedId(r.room.id)}
                    onHover={(v) => setHoverId(v ? r.room.id : null)}
                  />
                ))}
                <text x="500" y="575" textAnchor="middle" fontSize="16" fontWeight="700" letterSpacing="3" fill="hsl(38 92% 52% / 0.75)">
                  {t('floorPlan.watermark')}
                </text>
              </svg>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card aria-live="polite">
            <CardHeader>
              <CardTitle>{detail ? `${detail.room.id} · ${t(`rooms.${detail.room.key}`)}` : t('floorPlan.title')}</CardTitle>
              {detail && <CardDescription>{t(`roomStories.${detail.room.key}`)}</CardDescription>}
            </CardHeader>
            <CardContent>
              {!detail ? (
                <p className="flex items-center gap-2 rounded-md border border-dashed p-6 text-sm text-muted-foreground">
                  <MousePointerClick className="size-5 shrink-0" aria-hidden />
                  {t('floorPlan.selectHint')}
                </p>
              ) : (
                <dl className="space-y-3 text-sm">
                  <div>
                    <dt className="mb-1 text-xs text-muted-foreground">{t('table.colPriority')}</dt>
                    <dd><PriorityBadge priority={detail.priority} /></dd>
                  </div>
                  <div>
                    <dt className="mb-1 text-xs text-muted-foreground">{t('table.colEstimate')}</dt>
                    <dd><EstimateCell view={detail} onRetry={() => retryPrediction(detail.room.id)} /></dd>
                  </div>
                  <div>
                    <dt className="mb-1 text-xs text-muted-foreground">{t('table.colInspection')}</dt>
                    <dd><InspectionBadge status={detail.inspection} /></dd>
                  </div>
                  <div>
                    <dt className="mb-1 text-xs text-muted-foreground">{t('table.colIndicators')}</dt>
                    <dd><IndicatorChips indicators={detail.indicators} freshness={detail.freshness} /></dd>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <FreshnessBadge freshness={detail.freshness} ageSeconds={detail.ageSeconds} />
                    <SourceBadge source={detail.series.source} />
                  </div>
                  <Link
                    to={`/rooms/${detail.room.id}`}
                    className="inline-flex items-center gap-1 pt-1 text-sm font-medium text-teal-300 hover:underline"
                  >
                    {t('floorPlan.openRoom')}
                    <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />
                  </Link>
                </dl>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('floorPlan.legendTitle')}</CardTitle>
              <CardDescription>{t('floorPlan.legendNote')}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {(['responders', 'check_first', 'no_data', 'unconfirmed', 'check_recorded'] as Priority[]).map((p) => (
                  <LegendItem key={p} priority={p} />
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
      <ReplayTimeline className="mt-4" />
    </>
  )
}
