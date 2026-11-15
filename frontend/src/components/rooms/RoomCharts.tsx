import { useMemo } from 'react'
import { CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useI18n } from '@/i18n'
import { formatNumber, formatPercent } from '@/lib/format'
import type { Estimate, RoomSeries } from '@/lib/types'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { cn } from '@/lib/utils'

const findKey = (sensors: Record<string, number>, re: RegExp, not?: RegExp) =>
  Object.keys(sensors).find((k) => re.test(k) && !(not && not.test(k)))

export function Co2Chart({ series, step }: { series: RoomSeries; step: number }) {
  const { t, lang } = useI18n()
  const reduced = useReducedMotion()
  const data = useMemo(() => {
    const out: { step: number; co2: number | null; slope: number | null }[] = []
    for (let i = 0; i <= step; i++) {
      const r = series.readings[i]
      if (!r) {
        out.push({ step: i + 1, co2: null, slope: null })
        continue
      }
      const co2Key = findKey(r.sensors, /co2/i, /slope/i)
      const slopeKey = findKey(r.sensors, /slope/i)
      out.push({
        step: i + 1,
        co2: co2Key ? r.sensors[co2Key] : null,
        slope: slopeKey ? r.sensors[slopeKey] : null,
      })
    }
    return out
  }, [series, step])

  const hasAny = data.some((d) => d.co2 !== null)
  if (!hasAny) {
    return <p className="hatch rounded-md border border-warning/40 p-8 text-center text-sm text-muted-foreground">{t('room.noData')}</p>
  }

  return (
    <div dir="ltr" className="h-64 w-full" role="img" aria-label={t('room.co2Desc')}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -8 }}>
          <CartesianGrid stroke="hsl(217 30% 18%)" strokeDasharray="3 3" />
          <XAxis dataKey="step" stroke="hsl(215 22% 60%)" fontSize={11} tickLine={false} />
          <YAxis yAxisId="co2" stroke="hsl(173 70% 55%)" fontSize={11} tickLine={false} domain={['auto', 'auto']} width={48} />
          <YAxis yAxisId="slope" orientation="right" stroke="hsl(38 92% 60%)" fontSize={11} tickLine={false} width={36} />
          <Tooltip
            contentStyle={{ background: 'hsl(222 42% 10%)', border: '1px solid hsl(217 30% 24%)', borderRadius: 8, fontSize: 12 }}
            labelFormatter={(l) => `${t('room.replayStep')} ${l}`}
            formatter={(v: number | string) => (typeof v === 'number' ? formatNumber(v, lang) : v)}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            yAxisId="co2"
            type="monotone"
            dataKey="co2"
            name={t('room.co2Axis')}
            stroke="hsl(173 70% 50%)"
            strokeWidth={2}
            dot={false}
            connectNulls={false}
            isAnimationActive={!reduced}
          />
          <Line
            yAxisId="slope"
            type="monotone"
            dataKey="slope"
            name={t('room.slopeAxis')}
            stroke="hsl(38 92% 55%)"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={false}
            connectNulls={false}
            isAnimationActive={!reduced}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Per-class scores rendered as plain bars, explicitly labeled UNCALIBRATED. */
export function ScoreBars({ estimate, dimmed }: { estimate: Estimate; dimmed: boolean }) {
  const { t, lang } = useI18n()
  const entries = Object.entries(estimate.scores).sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true }))
  return (
    <ul className={cn('space-y-2', dimmed && 'opacity-60')}>
      {entries.map(([cls, v]) => {
        const pct = Math.max(0, Math.min(1, v))
        const isTop = String(estimate.estimatedOccupancy) === cls
        return (
          <li key={cls} className="grid grid-cols-[72px_1fr_44px] items-center gap-3 text-sm">
            <span className={cn('text-muted-foreground', isTop && 'font-semibold text-foreground')}>
              {t('room.classLabel', { n: cls })}
            </span>
            <span className="h-2.5 overflow-hidden rounded-full bg-secondary" aria-hidden>
              <span
                className={cn('block h-full rounded-full', isTop ? 'bg-primary' : 'bg-muted-foreground/50')}
                style={{ width: `${pct * 100}%` }}
              />
            </span>
            <span className="text-end text-xs text-muted-foreground tabular" dir="ltr">
              {formatPercent(pct, lang)}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
