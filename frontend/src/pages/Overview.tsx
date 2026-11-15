import { Building, ClipboardList, Eye, Info, Users, WifiOff } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DrillToggle, ReplayTimeline, ResetSimulationButton } from '@/components/rooms/DrillControls'
import { EventLog } from '@/components/rooms/EventLog'
import { MetricCard, PageHeader } from '@/components/rooms/MetricCard'
import { RoomTable } from '@/components/rooms/RoomTable'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FLOORS } from '@/data/rooms'
import { useI18n } from '@/i18n'
import { STALE_AFTER_SECONDS, needsManualVerification } from '@/lib/safety'
import { cn } from '@/lib/utils'
import { useDemo } from '@/state/DemoStore'

export default function Overview() {
  const { t } = useI18n()
  const { rooms, state } = useDemo()
  const [floor, setFloor] = useState<number>(1)
  const floorRooms = rooms.filter((r) => r.room.floor === floor)

  const needs = floorRooms.filter((r) => needsManualVerification(r.inspection)).length
  const suggesting = floorRooms.filter(
    (r) => r.estimate && r.estimateFreshness === 'current' && r.estimate.estimatedOccupancy >= 1,
  ).length
  const stale = floorRooms.filter((r) => r.freshness !== 'current').length

  return (
    <>
      <PageHeader title={t('overview.title')} subtitle={t('overview.subtitle')} actions={<ResetSimulationButton />} />

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label={t('metrics.rooms')} value={floorRooms.length} hint={t('metrics.roomsHint')} Icon={Building} />
          <MetricCard
            label={t('metrics.needsVerification')}
            value={needs}
            hint={t('metrics.needsVerificationHint')}
            Icon={ClipboardList}
            tone={needs > 0 ? 'warning' : 'neutral'}
          />
          <MetricCard
            label={t('metrics.suggesting')}
            value={suggesting}
            hint={t('metrics.suggestingHint')}
            Icon={Users}
            tone={suggesting > 0 ? 'warning' : 'neutral'}
          />
          <MetricCard
            label={t('metrics.stale')}
            value={stale}
            hint={t('metrics.staleHint', { seconds: STALE_AFTER_SECONDS })}
            Icon={WifiOff}
            tone={stale > 0 ? 'stale' : 'neutral'}
          />
        </div>

        <Card className={cn(state.drill.active && 'border-drill/60')}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle>{t('drillPage.controlsTitle')}</CardTitle>
              {state.drill.active ? <Badge variant="drill">{t('drill.activeBadge')}</Badge> : <Badge>{t('drill.inactive')}</Badge>}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <DrillToggle className="w-full" />
            <p className="text-xs text-muted-foreground">{t('drill.noAlarm')}</p>
          </CardContent>
        </Card>
      </div>

      <aside
        aria-labelledby="story-title"
        className="mt-4 flex gap-3 rounded-lg border border-warning/30 bg-warning/5 p-4"
      >
        <Eye className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
        <div>
          <h2 id="story-title" className="text-sm font-semibold text-amber-200">
            {t('overview.storyTitle')}
          </h2>
          <p className="mt-1 text-sm font-medium">{t('overview.story')}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('overview.storyBody')}{' '}
            <Link to="/about" className="text-teal-300 underline-offset-2 hover:underline">
              {t('common.learnWhy')}
            </Link>
          </p>
        </div>
      </aside>

      <ReplayTimeline className="mt-4" />

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
            <CardTitle>{t('overview.roomList')}</CardTitle>
            <div role="radiogroup" aria-label={t('overview.floor')} className="flex rounded-md border p-0.5">
              {FLOORS.map((f) => (
                <button
                  key={f}
                  role="radio"
                  aria-checked={floor === f}
                  onClick={() => setFloor(f)}
                  className={cn(
                    'rounded px-3 py-1.5 text-sm font-medium transition-colors',
                    floor === f ? 'bg-primary/15 text-teal-200' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t('overview.floorN', { n: f })}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {floorRooms.length === 0 ? (
              <div className="rounded-lg border border-dashed p-10 text-center">
                <Info className="mx-auto mb-2 size-6 text-muted-foreground" aria-hidden />
                <p className="text-sm font-medium">{t('overview.floorEmpty', { n: floor })}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t('overview.floorEmptyHint')}</p>
                <button onClick={() => setFloor(1)} className="mt-3 text-sm text-teal-300 hover:underline">
                  {t('overview.floorN', { n: 1 })}
                </button>
              </div>
            ) : (
              <RoomTable rooms={floorRooms} />
            )}
          </CardContent>
        </Card>
        <EventLog />
      </div>
    </>
  )
}
