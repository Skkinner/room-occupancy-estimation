import { Activity, ArrowLeft, Droplets, Lightbulb, RefreshCw, Thermometer, TriangleAlert, Volume2, Wind } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ReplayTimeline } from '@/components/rooms/DrillControls'
import { EventLog } from '@/components/rooms/EventLog'
import { ManualCheckForm } from '@/components/rooms/ManualCheckForm'
import { Co2Chart, ScoreBars } from '@/components/rooms/RoomCharts'
import { FreshnessBadge, InspectionBadge, OriginBadge, PriorityBadge, SourceBadge } from '@/components/rooms/StatusBadges'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getRoom } from '@/data/rooms'
import { useI18n, type TKey } from '@/i18n'
import { formatNumber, formatReplayTime, formatWallTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useDemo } from '@/state/DemoStore'

const GROUPS: { key: TKey; re: RegExp; Icon: typeof Thermometer }[] = [
  { key: 'room.temp', re: /temp/i, Icon: Thermometer },
  { key: 'room.light', re: /light/i, Icon: Lightbulb },
  { key: 'room.sound', re: /sound/i, Icon: Volume2 },
  { key: 'room.co2', re: /co2(?!.*slope)/i, Icon: Wind },
  { key: 'room.co2Slope', re: /slope/i, Icon: Droplets },
  { key: 'room.pir', re: /pir/i, Icon: Activity },
]

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
      <dt className="text-xs text-muted-foreground sm:pt-0.5">{label}</dt>
      <dd className="text-sm sm:text-end">{children}</dd>
    </div>
  )
}

export default function RoomDetail() {
  const { roomId } = useParams()
  const { t, lang } = useI18n()
  const { rooms, state, mode, schema, retryPrediction } = useDemo()
  const info = getRoom(roomId)
  const view = rooms.find((r) => r.room.id === info?.id)

  if (!info || !view) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-2xl font-bold">{t('room.notFound')}</h1>
        <p className="mt-2 text-muted-foreground">{t('room.notFoundBody', { id: roomId ?? '' })}</p>
        <Button asChild className="mt-6">
          <Link to="/">{t('room.back')}</Link>
        </Button>
      </div>
    )
  }

  const roomLabel = `${info.id} ${t(`rooms.${info.key}`)}`
  const { estimate, latestReading, freshness } = view
  const estStale = view.estimateFreshness !== 'current'
  const clockLabel = view.series.source === 'historical_replay' ? t('common.datasetClock') : t('common.simClock')
  const records = state.audit.filter((a) => a.roomId === info.id)

  const sensors = latestReading?.sensors ?? {}
  const sensorNames = schema.features.map((f) => f.name)
  const used = new Set<string>()
  const groups = GROUPS.map((g) => {
    const names = sensorNames.filter((n) => g.re.test(n) && !used.has(n))
    names.forEach((n) => used.add(n))
    return { ...g, names }
  }).filter((g) => g.names.length)
  const others = sensorNames.filter((n) => !used.has(n))

  return (
    <>
      <Link to="/" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
        {t('room.back')}
      </Link>

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="flex flex-wrap items-baseline gap-x-3 text-2xl font-bold tracking-tight sm:text-3xl">
            <span className="font-mono text-teal-300">{info.id}</span>
            <span>{t(`rooms.${info.key}`)}</span>
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t(`roomStories.${info.key}`)}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="neutral">{t('provenance.fictional')}</Badge>
          <Badge variant="neutral">{t('room.capacity', { n: info.capacity })}</Badge>
          <SourceBadge source={view.series.source} />
          <FreshnessBadge freshness={freshness} ageSeconds={view.ageSeconds} />
          <PriorityBadge priority={view.priority} />
        </div>
      </div>

      {/* Primary safety note — always shown, regardless of the estimate or a recorded check. */}
      <section
        aria-labelledby="primary-note"
        className="mb-4 flex gap-3 rounded-lg border-2 border-warning/60 bg-warning/10 p-4"
      >
        <TriangleAlert className="mt-0.5 size-6 shrink-0 text-warning" aria-hidden />
        <div>
          <h2 id="primary-note" className="text-lg font-bold text-amber-200">
            {t('room.primaryNote')}
          </h2>
          <p className="mt-1 text-sm text-amber-50/90">{t('room.primaryBody')}</p>
        </div>
      </section>

      <ReplayTimeline className="mb-4" />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ML estimate */}
        <Card>
          <CardHeader>
            <CardTitle>{t('room.estimateTitle')}</CardTitle>
            {estimate && <CardDescription>{t('room.estimateFrom', { step: estimate.readingStep + 1 })}</CardDescription>}
          </CardHeader>
          <CardContent className="space-y-4">
            {view.validationIssues?.length ? (
              <div className="rounded-md border border-warning/50 bg-warning/10 p-3 text-sm">
                <p className="font-semibold text-amber-200">{t('room.validationTitle')}</p>
                <p className="mt-1 text-amber-100/90">{t('room.validationBody')}</p>
                <ul className="mt-2 flex flex-wrap gap-1.5" dir="ltr">
                  {view.validationIssues.map((i) => (
                    <li key={i.feature}>
                      <Badge variant="warning">
                        {i.feature}: {t(`room.reason.${i.reason}`)}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {estimate ? (
              <>
                <div className="flex flex-wrap items-end gap-4">
                  <p
                    className={cn(
                      'rounded-lg border px-4 py-2 text-5xl font-bold tabular',
                      estStale ? 'hatch border-warning/60 text-muted-foreground' : 'border-border bg-secondary',
                    )}
                  >
                    {estimate.estimatedOccupancy}
                    <span className="ms-2 text-base font-medium text-muted-foreground">/ 3</span>
                  </p>
                  <div className="flex flex-col gap-1.5">
                    <OriginBadge origin={estimate.origin} />
                    {estStale && <FreshnessBadge freshness={view.estimateFreshness} ageSeconds={view.estimateAgeSeconds} />}
                  </div>
                </div>
                {estimate.estimatedOccupancy === 0 && (
                  <p className="text-sm text-amber-200">{t('estimate.zeroNote')}</p>
                )}
                {estimate.note && (
                  <p className="rounded-md bg-secondary/60 p-2 text-xs text-muted-foreground" dir="auto">
                    {t('room.apiNote')}: {estimate.note}
                  </p>
                )}
              </>
            ) : view.estimatePending ? (
              <p role="status" className="text-sm text-muted-foreground">{t('estimate.pending')}</p>
            ) : (
              <p className="hatch rounded-md border border-warning/40 p-4 text-sm text-muted-foreground">
                {freshness === 'unavailable' ? t('freshness.unavailableBody') : t('estimate.none')}
              </p>
            )}
            {view.estimateError && (
              <div role="alert" className="flex flex-wrap items-center gap-2 rounded-md border border-warning/50 p-3 text-sm">
                <span className="text-amber-200">{t('estimate.error')}</span>
                <code className="break-all text-xs text-muted-foreground" dir="ltr">{view.estimateError}</code>
                <Button size="sm" variant="outline" onClick={() => retryPrediction(info.id)}>
                  <RefreshCw aria-hidden />
                  {t('common.retry')}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Manual inspection — a separate field from the estimate */}
        <Card>
          <CardHeader>
            <CardTitle>{t('room.inspectionTitle')}</CardTitle>
            <CardDescription>{t('room.inspectionSeparate')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <InspectionBadge status={view.inspection} />
            {view.lastRecord && (
              <p className="text-xs text-muted-foreground">
                {t('room.auditBy', { actor: view.lastRecord.actor })} ·{' '}
                <span dir="ltr">{formatWallTime(view.lastRecord.recordedAt, lang)}</span> ({t('common.deviceClock')})
              </p>
            )}
            <dl className="space-y-2.5 border-t pt-4">
              <Field label={t('room.readingTime')}>
                {latestReading ? (
                  <>
                    <span dir="ltr" className="font-mono">
                      {formatReplayTime(latestReading.timestamp, lang, view.series.source === 'historical_replay')}
                    </span>{' '}
                    <span className="text-muted-foreground">({clockLabel})</span>
                  </>
                ) : (
                  t('common.none')
                )}
              </Field>
              <Field label={t('room.replayStep')}>
                {latestReading ? `${latestReading.step + 1}` : t('common.none')}
              </Field>
              <Field label={t('room.freshness')}>
                <FreshnessBadge freshness={freshness} ageSeconds={view.ageSeconds} />
              </Field>
              <Field label={t('room.source')}>
                <SourceBadge source={view.series.source} />
              </Field>
              <Field label={t('room.estimator')}>
                <OriginBadge origin={mode === 'api' ? 'api_model' : 'offline_simulator'} />
              </Field>
              <Field label={t('room.schema')}>
                <span className="text-xs text-muted-foreground">
                  {schema.origin === 'api'
                    ? t('connection.schemaApi', { count: schema.features.length })
                    : t('connection.schemaFallback')}
                </span>
              </Field>
            </dl>
          </CardContent>
        </Card>

        {/* Scores */}
        <Card>
          <CardHeader>
            <CardTitle>{estimate?.origin === 'offline_simulator' ? t('room.scoresSimTitle') : t('room.scoresTitle')}</CardTitle>
            <CardDescription>{t('room.scoresNote')}</CardDescription>
          </CardHeader>
          <CardContent>
            {estimate ? (
              <ScoreBars estimate={estimate} dimmed={estStale} />
            ) : (
              <p className="text-sm text-muted-foreground">{t('estimate.none')}</p>
            )}
          </CardContent>
        </Card>

        {/* CO2 */}
        <Card>
          <CardHeader>
            <CardTitle>{t('room.co2Title')}</CardTitle>
            <CardDescription>{t('room.co2Desc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Co2Chart series={view.series} step={state.replay.step} />
          </CardContent>
        </Card>
      </div>

      {/* Sensor panels */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>{t('room.sensorsTitle')}</CardTitle>
          <CardDescription>
            {latestReading ? t('room.sensorsDesc', { step: latestReading.step + 1 }) : t('room.noData')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!latestReading ? (
            <p className="hatch rounded-md border border-warning/40 p-6 text-center text-sm text-muted-foreground">
              {t('freshness.unavailableBody')}
            </p>
          ) : (
            <div className={cn('grid gap-3 sm:grid-cols-2 xl:grid-cols-3', freshness === 'stale' && 'hatch rounded-lg p-2')}>
              {[...groups, ...(others.length ? [{ key: 'room.other' as TKey, Icon: Activity, names: others, re: /.*/ }] : [])].map(
                (g) => (
                  <div key={g.key} className="rounded-lg border bg-background/40 p-3">
                    <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <g.Icon className="size-3.5" aria-hidden />
                      {t(g.key)}
                    </p>
                    <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                      {g.names.map((n) => {
                        const v = sensors[n]
                        const isPir = /pir/i.test(n)
                        return (
                          <div key={n} className="flex items-baseline justify-between gap-2">
                            <dt className="font-mono text-[11px] text-muted-foreground" dir="ltr">{n}</dt>
                            <dd className={cn('text-sm font-medium tabular', isPir && v > 0 && 'text-amber-300')}>
                              {v === undefined
                                ? t('common.none')
                                : isPir
                                  ? v > 0
                                    ? t('room.detected')
                                    : t('room.notDetected')
                                  : formatNumber(v, lang)}
                            </dd>
                          </div>
                        )
                      })}
                    </dl>
                  </div>
                ),
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ManualCheckForm roomId={info.id} roomLabel={roomLabel} />
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('room.auditTitle')}</CardTitle>
            </CardHeader>
            <CardContent>
              {records.length === 0 ? (
                <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">{t('room.auditEmpty')}</p>
              ) : (
                <ol className="space-y-3">
                  {records.map((r) => (
                    <li key={r.id} className="rounded-md border p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <InspectionBadge status={r.status} short />
                        {r.drillActive && <Badge variant="drill">{t('room.auditDuringDrill')}</Badge>}
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {t('room.auditBy', { actor: r.actor })} · <span dir="ltr">{formatWallTime(r.recordedAt, lang)}</span> (
                        {t('common.deviceClock')}) · {t('events.replayAt', { step: r.replayStep + 1 })} ·{' '}
                        {t(`inspectionShort.${r.previousStatus}`)} → {t(`inspectionShort.${r.status}`)}
                      </p>
                      {r.comment && <p className="mt-1.5 text-sm" dir="auto">“{r.comment}”</p>}
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
          <EventLog roomId={info.id} limit={15} />
        </div>
      </div>
    </>
  )
}
