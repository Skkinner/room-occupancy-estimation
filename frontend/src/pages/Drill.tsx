import { Database, Eye, FileUp, FlaskConical, HelpCircle, Pause, Trash2 } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { toast } from 'sonner'
import { DrillToggle, ReplayTimeline, ResetSimulationButton } from '@/components/rooms/DrillControls'
import { EventLog } from '@/components/rooms/EventLog'
import { PageHeader } from '@/components/rooms/MetricCard'
import { FreshnessBadge, IndicatorChips, OriginBadge, SourceBadge } from '@/components/rooms/StatusBadges'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input, Label, Select } from '@/components/ui/form'
import { ROOMS } from '@/data/rooms'
import { useI18n } from '@/i18n'
import { formatNumber } from '@/lib/format'
import { SimulatorToggle } from '@/components/layout/Banners'
import type { OccupancyClass } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useDemo } from '@/state/DemoStore'

function CsvLoader() {
  const { t } = useI18n()
  const { state, loadCsv, clearCsv } = useDemo()
  const ids = { file: useId(), room: useId(), start: useId() }
  const fileRef = useRef<HTMLInputElement>(null)
  const [roomId, setRoomId] = useState('A101')
  const [startRow, setStartRow] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const onLoad = async () => {
    const file = fileRef.current?.files?.[0]
    if (!file) {
      setError(t('drillPage.csvNoFile'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await loadCsv(file, roomId, Math.max(0, Math.floor(startRow)))
      toast(t('drillPage.csvSuccess'), {
        description: t('drillPage.csvLoaded', { file: file.name, rows: res.rowsUsed, room: roomId }),
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Database className="size-4 text-sky-300" aria-hidden />
          {t('drillPage.csvTitle')}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">{t('drillPage.csvBody')}</p>
      </div>
      {state.csv ? (
        <div className="space-y-2 rounded-md bg-sky-400/5 p-3 text-sm">
          <p>
            {t('drillPage.csvLoaded', { file: state.csv.fileName, rows: state.csv.rowsUsed, room: state.csv.roomId })}
          </p>
          <p className="text-xs text-muted-foreground">
            {state.csv.labelColumn ? t('drillPage.csvLabelCol', { col: state.csv.labelColumn }) : t('drillPage.csvNoLabel')}
          </p>
          <Button size="sm" variant="outline" onClick={clearCsv}>
            <Trash2 aria-hidden />
            {t('drillPage.csvClear')}
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-[1fr_140px_120px_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor={ids.file}>{t('drillPage.csvFile')}</Label>
            <Input id={ids.file} ref={fileRef} type="file" accept=".csv,text/csv" className="pt-1.5 file:me-3 file:rounded file:border-0 file:bg-secondary file:px-2 file:py-1 file:text-xs file:text-foreground" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={ids.room}>{t('drillPage.csvRoom')}</Label>
            <Select id={ids.room} value={roomId} onChange={(e) => setRoomId(e.target.value)}>
              {ROOMS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.id}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={ids.start}>{t('drillPage.csvStart')}</Label>
            <Input id={ids.start} type="number" min={0} value={startRow} onChange={(e) => setStartRow(Number(e.target.value) || 0)} />
          </div>
          <Button onClick={() => void onLoad()} disabled={busy} variant="secondary">
            <FileUp aria-hidden />
            {t('drillPage.csvLoad')}
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="rounded-md border border-warning/50 bg-warning/10 p-2 text-sm text-amber-200">
          <span className="font-semibold">{t('drillPage.csvError')}: </span>
          <span dir="auto">{error}</span>
        </p>
      )}
    </div>
  )
}

function GuessGame() {
  const { t, lang } = useI18n()
  const { rooms, state, setPlaying, stepBy } = useDemo()
  const [roomId, setRoomId] = useState('A101')
  const [guess, setGuess] = useState<OccupancyClass | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [score, setScore] = useState({ n: 0, you: 0, model: 0 })
  const ids = { room: useId() }
  const view = rooms.find((r) => r.room.id === roomId)!
  const step = state.replay.step
  const paused = !state.replay.playing

  useEffect(() => {
    setGuess(null)
    setRevealed(false)
  }, [step, roomId])

  const reading = view.freshness === 'current' ? view.latestReading : null
  const estimate = view.estimate && view.estimateFreshness === 'current' && view.estimate.readingStep === reading?.step ? view.estimate : null
  const label = reading?.label ?? null
  const labelKind = reading?.labelKind ?? null

  const onReveal = () => {
    if (guess === null || !estimate) return
    setRevealed(true)
    if (label !== null) {
      setScore((s) => ({
        n: s.n + 1,
        you: s.you + (guess === label ? 1 : 0),
        model: s.model + (estimate.estimatedOccupancy === label ? 1 : 0),
      }))
    }
  }

  const phase = !paused ? 0 : revealed ? 2 : 1
  const STEPS = [t('drillPage.stepPause'), t('drillPage.stepGuess'), t('drillPage.stepReveal')]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HelpCircle className="size-4 text-teal-300" aria-hidden />
          {t('drillPage.gameTitle')}
        </CardTitle>
        <CardDescription>{t('drillPage.gameBody')}</CardDescription>
        <ol className="mt-2 flex flex-wrap items-center gap-2 text-xs" aria-label={t('drillPage.gameTitle')}>
          {STEPS.map((s, i) => (
            <li
              key={s}
              aria-current={phase === i ? 'step' : undefined}
              className={cn(
                'rounded-full border px-3 py-1',
                phase === i ? 'border-primary bg-primary/15 text-teal-200' : phase > i ? 'text-muted-foreground' : 'text-muted-foreground/60',
              )}
            >
              {i + 1}. {s}
            </li>
          ))}
        </ol>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor={ids.room}>{t('drillPage.pickRoom')}</Label>
            <Select id={ids.room} value={roomId} onChange={(e) => setRoomId(e.target.value)} className="w-48">
              {rooms.map((r) => (
                <option key={r.room.id} value={r.room.id}>
                  {r.room.id} · {t(`rooms.${r.room.key}`)}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-wrap gap-1.5 pb-2">
            <SourceBadge source={view.series.source} />
            <FreshnessBadge freshness={view.freshness} ageSeconds={view.ageSeconds} />
          </div>
        </div>

        {!paused ? (
          <div className="flex flex-wrap items-center gap-3 rounded-md border border-dashed p-4">
            <p className="text-sm text-muted-foreground">{t('drillPage.pauseFirst')}</p>
            <Button size="sm" onClick={() => setPlaying(false)}>
              <Pause aria-hidden />
              {t('drillPage.pauseNow')}
            </Button>
          </div>
        ) : !reading ? (
          <p className="hatch rounded-md border border-warning/40 p-4 text-sm text-amber-100">{t('drillPage.noReading')}</p>
        ) : (
          <>
            <div className="rounded-md border bg-background/40 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('drillPage.snapshot')}</p>
              <IndicatorChips indicators={view.indicators} freshness={view.freshness} />
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4" dir="ltr">
                {Object.entries(reading.sensors)
                  .filter(([k]) => /light|sound|co2/i.test(k))
                  .map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-2 text-xs">
                      <dt className="font-mono text-muted-foreground">{k}</dt>
                      <dd className="tabular">{formatNumber(v, lang)}</dd>
                    </div>
                  ))}
              </dl>
            </div>

            <fieldset disabled={revealed}>
              <legend className="mb-2 text-sm font-medium">{t('drillPage.yourGuess')}</legend>
              <div className="flex flex-wrap gap-2" role="radiogroup">
                {([0, 1, 2, 3] as OccupancyClass[]).map((g) => (
                  <label
                    key={g}
                    className={cn(
                      'grid size-12 cursor-pointer place-items-center rounded-md border text-lg font-semibold tabular transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
                      guess === g ? 'border-primary bg-primary/15 text-teal-200' : 'hover:bg-accent',
                    )}
                  >
                    <input type="radio" name="guess" value={g} checked={guess === g} onChange={() => setGuess(g)} className="sr-only" />
                    {g}
                  </label>
                ))}
              </div>
            </fieldset>

            {!revealed ? (
              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={onReveal} disabled={guess === null || !estimate}>
                  <Eye aria-hidden />
                  {t('drillPage.reveal')}
                </Button>
                {!estimate && <span className="text-sm text-muted-foreground" role="status">{t('drillPage.waiting')}</span>}
              </div>
            ) : (
              estimate && (
                <div className="grid gap-3 sm:grid-cols-3" aria-live="polite">
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">{t('drillPage.youGuessed', { g: guess ?? '' })}</p>
                    <p className="mt-1 text-3xl font-bold tabular">{guess}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">{t('drillPage.estimator')}</p>
                    <p className="mt-1 text-3xl font-bold tabular">{estimate.estimatedOccupancy}</p>
                    <div className="mt-1">
                      <OriginBadge origin={estimate.origin} />
                    </div>
                  </div>
                  <div className={cn('rounded-md border p-3', labelKind === 'scenario_simulated' && 'border-dashed')}>
                    <p className="text-xs text-muted-foreground">{t('drillPage.expected')}</p>
                    {label === null ? (
                      <p className="mt-1 text-sm text-muted-foreground">{t('drillPage.noLabel')}</p>
                    ) : (
                      <>
                        <p className="mt-1 text-3xl font-bold tabular">{label}</p>
                        <Badge variant={labelKind === 'dataset_recorded' ? 'info' : 'muted'} className="mt-1 whitespace-normal">
                          {labelKind === 'dataset_recorded' ? <Database aria-hidden /> : <FlaskConical aria-hidden />}
                          {labelKind === 'dataset_recorded' ? t('drillPage.expectedDataset') : t('drillPage.expectedScenario')}
                        </Badge>
                      </>
                    )}
                  </div>
                  {label !== null && label > 0 && estimate.estimatedOccupancy === 0 && (
                    <p className="rounded-md border border-warning/50 bg-warning/10 p-3 text-sm text-amber-100 sm:col-span-3">
                      {t('drillPage.missNote')}
                    </p>
                  )}
                  <div className="sm:col-span-3">
                    <Button variant="secondary" onClick={() => stepBy(1)}>
                      {t('drillPage.nextRound')}
                    </Button>
                  </div>
                </div>
              )
            )}
          </>
        )}
        <p className="border-t pt-3 text-sm text-muted-foreground tabular" aria-live="polite">
          {t('drillPage.score', { n: score.n, you: score.you, model: score.model })}
        </p>
      </CardContent>
    </Card>
  )
}

export default function Drill() {
  const { t } = useI18n()
  const { state } = useDemo()
  return (
    <>
      <PageHeader
        title={t('drillPage.title')}
        subtitle={t('drillPage.subtitle')}
        actions={
          <>
            <ResetSimulationButton />
            <DrillToggle />
          </>
        }
      />
      <ReplayTimeline />
      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_400px]">
        <div className="space-y-4">
          <GuessGame />
          <Card>
            <CardHeader>
              <CardTitle>{t('drillPage.sourceTitle')}</CardTitle>
              <CardDescription className="flex items-center gap-2">
                <FlaskConical className="size-4 shrink-0" aria-hidden />
                {t('drillPage.sourceSimBody')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <SimulatorToggle />
              <CsvLoader />
            </CardContent>
          </Card>
        </div>
        <div className="space-y-4">
          <Card className={cn(state.drill.active && 'border-drill/60')}>
            <CardHeader>
              <CardTitle>{t('drillPage.controlsTitle')}</CardTitle>
              <CardDescription>{t('drill.noAlarm')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {state.drill.active ? <Badge variant="drill">{t('drill.activeBadge')}</Badge> : <Badge>{t('drill.inactive')}</Badge>}
              <p className="text-sm text-muted-foreground">{t('drillPage.resetBody')}</p>
            </CardContent>
          </Card>
          <EventLog />
        </div>
      </div>
    </>
  )
}
