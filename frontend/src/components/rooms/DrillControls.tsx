import { Pause, Play, RotateCcw, Siren, SkipBack, SkipForward, Square } from 'lucide-react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'
import { formatReplayTime } from '@/lib/format'
import { TOTAL_STEPS, simTimestamp } from '@/lib/simulation'
import { cn } from '@/lib/utils'
import { useDemo } from '@/state/DemoStore'

export function DrillToggle({ className }: { className?: string }) {
  const { t } = useI18n()
  const { state, startDrill, endDrill } = useDemo()
  if (state.drill.active) {
    return (
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" className={className}>
            <Square aria-hidden />
            {t('drill.end')}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('drill.endTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('drill.endBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={endDrill}>{t('drill.endAction')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )
  }
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="drill" className={className}>
          <Siren aria-hidden />
          {t('drill.start')}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('drill.confirmTitle')}</AlertDialogTitle>
          <AlertDialogDescription>{t('drill.confirmBody')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction variant="drill" onClick={startDrill}>
            {t('drill.confirmAction')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function ResetSimulationButton() {
  const { t } = useI18n()
  const { reset } = useDemo()
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <RotateCcw aria-hidden />
          {t('overview.resetSim')}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('drillPage.resetConfirmTitle')}</AlertDialogTitle>
          <AlertDialogDescription>{t('drillPage.resetConfirmBody')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            variant="warning"
            onClick={() => {
              reset()
              toast(t('drillPage.resetToast'))
            }}
          >
            {t('drillPage.resetConfirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/** Replay transport. Always labeled "not real-time"; the clock is the simulated/replay clock. */
export function ReplayTimeline({ className }: { className?: string }) {
  const { t, lang, dir } = useI18n()
  const { state, setStep, stepBy, setPlaying, setSpeed } = useDemo()
  const { step, playing, speed } = state.replay
  const hasHistorical = !!state.csv
  const BackIcon = dir === 'rtl' ? SkipForward : SkipBack
  const FwdIcon = dir === 'rtl' ? SkipBack : SkipForward

  return (
    <section aria-labelledby="replay-title" className={cn('rounded-lg border bg-card p-4', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="replay-title" className="text-sm font-semibold">
            {t('replay.title')}
          </h2>
          <Badge variant="warning">{t('replay.notRealtime')}</Badge>
          <Badge variant={hasHistorical ? 'info' : 'teal'}>
            {hasHistorical ? t('replay.sourceMixed') : t('provenance.simulated')}
          </Badge>
        </div>
        <p className="text-sm tabular" aria-live="polite" aria-atomic="true">
          <span className="text-muted-foreground">{t('replay.clock')}: </span>
          <span className="font-mono font-medium" dir="ltr">
            {formatReplayTime(simTimestamp(step), lang)}
          </span>
          <span className="text-muted-foreground"> ({t('common.simClock')}) · </span>
          {t('replay.stepOf', { step: step + 1, total: TOTAL_STEPS })}
        </p>
      </div>

      <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setStep(0)} aria-label={t('replay.toStart')}>
            <RotateCcw aria-hidden />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => stepBy(-1)} disabled={step === 0} aria-label={t('replay.back')}>
            <BackIcon aria-hidden />
          </Button>
          <Button
            size="icon"
            onClick={() => setPlaying(!playing)}
            disabled={!playing && step >= TOTAL_STEPS - 1}
            aria-label={playing ? t('replay.pause') : t('replay.play')}
            aria-pressed={playing}
          >
            {playing ? <Pause aria-hidden /> : <Play aria-hidden className="rtl:-scale-x-100" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => stepBy(1)}
            disabled={step >= TOTAL_STEPS - 1}
            aria-label={t('replay.forward')}
          >
            <FwdIcon aria-hidden />
          </Button>
        </div>
        <label className="flex flex-1 items-center gap-3">
          <span className="sr-only">{t('replay.scrub')}</span>
          <input
            type="range"
            min={0}
            max={TOTAL_STEPS - 1}
            value={step}
            onChange={(e) => setStep(Number(e.target.value))}
            aria-valuetext={t('replay.stepOf', { step: step + 1, total: TOTAL_STEPS })}
            className="h-2 w-full cursor-pointer accent-[hsl(var(--primary))]"
          />
        </label>
        <div role="group" aria-label={t('replay.speed')} className="flex items-center gap-1">
          {([1, 2, 4] as const).map((s) => (
            <Button key={s} size="sm" variant={speed === s ? 'secondary' : 'ghost'} aria-pressed={speed === s} onClick={() => setSpeed(s)}>
              <span dir="ltr">{s}×</span>
            </Button>
          ))}
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{t('replay.hint')}</p>
    </section>
  )
}
