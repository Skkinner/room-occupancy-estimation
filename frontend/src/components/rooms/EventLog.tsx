import { Activity, ClipboardCheck, Cpu, Database, Plug, Siren } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select } from '@/components/ui/form'
import { useI18n, type TParams } from '@/i18n'
import { formatWallTime } from '@/lib/format'
import type { EventType, InspectionStatus, LogEvent } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useDemo } from '@/state/DemoStore'

const ICONS: Record<EventType, typeof Activity> = {
  connection: Plug,
  drill: Siren,
  replay: Database,
  sensor: Activity,
  model: Cpu,
  inspection: ClipboardCheck,
}

const TYPES: EventType[] = ['connection', 'drill', 'replay', 'sensor', 'model', 'inspection']

export function EventLog({ roomId, limit = 40, className }: { roomId?: string; limit?: number; className?: string }) {
  const { t, lang } = useI18n()
  const { state } = useDemo()
  const [filter, setFilter] = useState<EventType | 'all'>('all')

  const events = useMemo(
    () =>
      state.events
        .filter((e) => (roomId ? e.roomId === roomId : true))
        .filter((e) => filter === 'all' || e.type === filter)
        .slice(0, limit),
    [state.events, roomId, filter, limit],
  )

  const message = (e: LogEvent) => {
    let params: TParams | undefined = e.params
    if (e.key === 'inspection' && e.params) {
      params = {
        ...e.params,
        status: t(`inspectionShort.${e.params.status as InspectionStatus}`),
        previous: t(`inspectionShort.${e.params.previous as InspectionStatus}`),
      }
    }
    return t(`events.msg.${e.key}`, params)
  }

  return (
    <Card className={className}>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle>{t('events.title')}</CardTitle>
          <CardDescription>{t('events.subtitle')}</CardDescription>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          {t('events.filter')}
          <Select value={filter} onChange={(e) => setFilter(e.target.value as EventType | 'all')} className="h-8 w-auto text-xs">
            <option value="all">{t('common.all')}</option>
            {TYPES.map((ty) => (
              <option key={ty} value={ty}>
                {t(`events.types.${ty}`)}
              </option>
            ))}
          </Select>
        </label>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">{t('events.empty')}</p>
        ) : (
          <ol className="max-h-[420px] space-y-1 overflow-y-auto pe-1" aria-live="polite" aria-relevant="additions">
            {events.map((e) => {
              const Icon = ICONS[e.type]
              return (
                <li key={e.id} className="flex gap-3 rounded-md px-2 py-2 hover:bg-accent/40">
                  <span
                    className={cn(
                      'mt-0.5 grid size-7 shrink-0 place-items-center rounded-md border',
                      e.type === 'drill' && 'border-drill/50 text-red-300',
                      e.type === 'sensor' && 'border-warning/50 text-amber-300',
                      e.type === 'inspection' && 'border-primary/50 text-teal-300',
                      (e.type === 'connection' || e.type === 'model' || e.type === 'replay') && 'text-muted-foreground',
                    )}
                  >
                    <Icon className="size-3.5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      {e.roomId && !roomId && (
                        <Link to={`/rooms/${e.roomId}`} className="me-1.5 font-mono font-semibold text-teal-300 hover:underline">
                          {e.roomId}
                        </Link>
                      )}
                      {message(e)}
                    </p>
                    <p className="text-xs text-muted-foreground tabular">
                      <span className="sr-only">{t(`events.types.${e.type}`)} · </span>
                      <span dir="ltr">{formatWallTime(e.at, lang)}</span> ({t('common.deviceClock')})
                      {e.replayStep !== null && <> · {t('events.replayAt', { step: e.replayStep + 1 })}</>}
                    </p>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}
