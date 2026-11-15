import { Ban, CheckSquare, Clock, Database, ListChecks, Plug, RefreshCw, ShieldAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { SimulatorToggle } from '@/components/layout/Banners'
import { PageHeader } from '@/components/rooms/MetricCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useI18n, type TKey } from '@/i18n'
import { API_URL } from '@/lib/api'
import { formatWallTime } from '@/lib/format'
import { STALE_AFTER_SECONDS } from '@/lib/safety'
import { useDemo } from '@/state/DemoStore'

function Section({ title, Icon, children }: { title: string; Icon: typeof Ban; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="size-4 text-teal-300" aria-hidden />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function Bullets({ keys, params }: { keys: TKey[]; params?: Record<string, string | number> }) {
  const { t } = useI18n()
  return (
    <ul className="space-y-2 text-sm">
      {keys.map((k) => (
        <li key={k} className="flex gap-2">
          <span className="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground" aria-hidden />
          <span>{t(k, params)}</span>
        </li>
      ))}
    </ul>
  )
}

export default function About() {
  const { t, lang } = useI18n()
  const { state, mode, schema, checkConnection } = useDemo()

  return (
    <>
      <PageHeader title={t('about.title')} subtitle={t('about.subtitle')} />

      <div className="mb-4 grid gap-4 lg:grid-cols-[360px_1fr]">
        <div className="rounded-lg border-2 border-warning/60 bg-warning/10 p-6">
          <p className="text-5xl font-bold tabular text-amber-200" dir="ltr">
            {t('about.missRate')}
          </p>
          <p className="mt-2 text-sm text-amber-50/90">{t('about.missLabel')}</p>
        </div>
        <div className="rounded-lg border border-warning/40 bg-card p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <ShieldAlert className="size-5 text-warning" aria-hidden />
            {t('about.sweepTitle')}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">{t('about.sweepBody')}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title={t('about.whatTitle')} Icon={CheckSquare}>
          <p className="text-sm">{t('about.whatBody')}</p>
        </Section>
        <Section title={t('about.notTitle')} Icon={Ban}>
          <Bullets keys={['about.not1', 'about.not2', 'about.not3', 'about.not4', 'about.not5']} />
        </Section>
        <Section title={t('about.dataTitle')} Icon={Database}>
          <Bullets keys={['about.data1', 'about.data2', 'about.data3', 'about.data4', 'about.data5', 'about.data6', 'about.data7']} />
        </Section>
        <Section title={t('about.designTitle')} Icon={ListChecks}>
          <Bullets
            keys={['about.design1', 'about.design2', 'about.design3', 'about.design4', 'about.design5']}
            params={{ seconds: STALE_AFTER_SECONDS }}
          />
        </Section>

        <Section title={t('about.apiTitle')} Icon={Plug}>
          <dl className="space-y-2 text-sm">
            <div className="flex flex-wrap justify-between gap-2">
              <dt className="text-muted-foreground">{t('about.apiUrl')}</dt>
              <dd className="font-mono" dir="ltr">{API_URL}</dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <dt className="text-muted-foreground">{t('about.apiStatus')}</dt>
              <dd>
                {state.connection.status === 'checking' ? (
                  <Badge>{t('connection.checkingBadge')}</Badge>
                ) : mode === 'api' ? (
                  <Badge variant="teal">{t('connection.onlineBadge')}</Badge>
                ) : (
                  <Badge variant="warning">{t('connection.offlineBadge')}</Badge>
                )}
              </dd>
            </div>
            {state.connection.checkedAt && (
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-muted-foreground">{t('about.apiChecked')}</dt>
                <dd className="tabular">
                  <span dir="ltr">{formatWallTime(state.connection.checkedAt, lang)}</span> ({t('common.deviceClock')})
                </dd>
              </div>
            )}
          </dl>
          {state.connection.error && (
            <p className="mt-3 break-all rounded-md bg-secondary/60 p-2 font-mono text-xs text-muted-foreground" dir="ltr">
              {state.connection.error}
            </p>
          )}
          <div className="mt-4 flex flex-col gap-4">
            <Button variant="outline" size="sm" className="self-start" onClick={() => void checkConnection()}>
              <RefreshCw aria-hidden />
              {t('connection.retry')}
            </Button>
            <SimulatorToggle />
          </div>
          <div className="mt-4 border-t pt-4">
            <p className="mb-2 text-sm font-medium">
              {t('about.featuresTitle', { n: schema.features.length })}{' '}
              <span className="text-xs font-normal text-muted-foreground">
                ·{' '}
                {schema.origin === 'api'
                  ? t('connection.schemaApi', { count: schema.features.length })
                  : t('connection.schemaFallback')}
              </span>
            </p>
            <ol className="flex flex-wrap gap-1.5" dir="ltr">
              {schema.features.map((f, i) => (
                <li key={f.name}>
                  <Badge variant="neutral" className="font-mono">
                    {i + 1}. {f.name}
                  </Badge>
                </li>
              ))}
            </ol>
            {schema.warnings.map((w) => (
              <p key={w} className="mt-2 text-xs text-amber-300">
                {t('connection.schemaWarning', { warning: w })}
              </p>
            ))}
          </div>
        </Section>

        <Section title={t('about.demoTitle')} Icon={Clock}>
          <ol className="space-y-2.5 text-sm">
            {(['about.demo1', 'about.demo2', 'about.demo3', 'about.demo4', 'about.demo5', 'about.demo6', 'about.demo7'] as TKey[]).map(
              (k) => {
                const [time, ...rest] = t(k).split(' — ')
                return (
                  <li key={k} className="flex gap-3">
                    <span className="w-10 shrink-0 font-mono text-xs text-teal-300" dir="ltr">
                      {time}
                    </span>
                    <span>{rest.join(' — ')}</span>
                  </li>
                )
              },
            )}
          </ol>
        </Section>
      </div>
    </>
  )
}
