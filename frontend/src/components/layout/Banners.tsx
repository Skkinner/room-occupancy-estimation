import { FlaskConical, Loader2, RefreshCw, ShieldAlert, Siren } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useI18n } from '@/i18n'
import { API_URL } from '@/lib/api'
import { formatWallTime } from '@/lib/format'
import { useDemo } from '@/state/DemoStore'

/** Persistent, always-bilingual safety banner. Never dismissible. */
export function SafetyBanner() {
  const { t } = useI18n()
  return (
    <div role="region" aria-label="Research demo safety notice" className="border-b border-warning/40 bg-[hsl(38_60%_12%)] text-amber-100">
      <div className="container flex flex-col gap-1 py-2 text-center sm:flex-row sm:items-center sm:justify-center sm:gap-3">
        <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 text-[13px] font-semibold tracking-wide">
          <ShieldAlert className="size-4 shrink-0 text-warning" aria-hidden />
          <span lang="en" dir="ltr">RESEARCH DEMO — NOT FOR LIFE-SAFETY DECISIONS</span>
          <span aria-hidden className="hidden text-amber-300/60 sm:inline">/</span>
          <span lang="ar" dir="rtl" className="font-arabic">نموذج تجريبي — لا يُستخدم لاتخاذ قرارات سلامة الأرواح</span>
        </p>
        <p className="text-xs text-amber-100/80">{t('banner.subline')}</p>
      </div>
    </div>
  )
}

/** Shown whenever estimates do NOT come from the API model. */
export function ConnectionBanner() {
  const { t } = useI18n()
  const { state, mode, checkConnection, setForceSimulation } = useDemo()
  const { status, error } = state.connection

  if (status === 'checking') {
    return (
      <div role="status" className="border-b bg-secondary/60">
        <div className="container flex items-center gap-2 py-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
          {t('connection.checking', { url: API_URL })}
        </div>
      </div>
    )
  }
  if (mode === 'api') return null

  const forced = status === 'online' && state.forceSimulation
  return (
    <div role="alert" className="border-b border-warning/50 bg-warning/10">
      <div className="container flex flex-col gap-3 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <FlaskConical className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
          <div className="space-y-0.5">
            <p className="text-sm font-bold tracking-wide text-amber-200">
              {forced ? t('connection.forcedTitle') : t('connection.offlineTitle')}
            </p>
            <p className="text-sm text-amber-100/90">
              {forced ? t('connection.forcedBody') : t('connection.offlineBody', { url: API_URL })}
            </p>
            {!forced && error && (
              <p className="break-all font-mono text-xs text-amber-100/60" dir="ltr">
                {t('connection.errorDetail', { error })}
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {forced ? (
            <Button size="sm" variant="outline" onClick={() => setForceSimulation(false)}>
              <RefreshCw aria-hidden />
              {t('events.msg.forceSimOff')}
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => void checkConnection()}>
              <RefreshCw aria-hidden />
              {t('connection.retry')}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

/** The ONLY place red is used: an explicit simulated-drill notice. */
export function DrillBanner() {
  const { t, lang } = useI18n()
  const { state } = useDemo()
  if (!state.drill.active) return null
  return (
    <div role="status" aria-live="polite" className="border-b border-drill/60 bg-drill/15">
      <div className="container flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:gap-3">
        <p className="flex items-center gap-2 text-sm font-bold tracking-wide text-red-200">
          <Siren className="size-4 text-drill" aria-hidden />
          {t('drill.activeTitle')}
        </p>
        <p className="text-sm text-red-100/90">{t('drill.activeBody')}</p>
        {state.drill.startedAt && (
          <p className="text-xs text-red-100/70 sm:ms-auto">
            {t('drill.startedAt', { time: formatWallTime(state.drill.startedAt, lang), step: (state.drill.startedStep ?? 0) + 1 })}
          </p>
        )}
      </div>
    </div>
  )
}

export function SimulatorToggle() {
  const { t } = useI18n()
  const { state, setForceSimulation } = useDemo()
  const disabled = state.connection.status !== 'online'
  return (
    <div className="flex items-center gap-3">
      <Switch
        id="force-sim"
        checked={state.forceSimulation || disabled}
        disabled={disabled}
        onCheckedChange={(v) => setForceSimulation(v)}
        aria-describedby="force-sim-hint"
      />
      <div>
        <label htmlFor="force-sim" className="text-sm font-medium">
          {t('connection.useSimulator')}
        </label>
        <p id="force-sim-hint" className="text-xs text-muted-foreground">
          {t('connection.useSimulatorHint')}
        </p>
      </div>
    </div>
  )
}
