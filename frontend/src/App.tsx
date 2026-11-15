import { useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { useI18n } from '@/i18n'
import About from '@/pages/About'
import Drill from '@/pages/Drill'
import FloorPlan from '@/pages/FloorPlan'
import NotFound from '@/pages/NotFound'
import Overview from '@/pages/Overview'
import RoomDetail from '@/pages/RoomDetail'

function TitleAndFocus() {
  const { t } = useI18n()
  const { pathname } = useLocation()
  useEffect(() => {
    document.title = `${t('app.name')} — ${t('app.tagline')} (Research demo)`
    // Move focus to main content on route change for screen-reader / keyboard users.
    document.getElementById('main')?.focus({ preventScroll: true })
    window.scrollTo({ top: 0 })
  }, [pathname, t])
  return null
}

export default function App() {
  return (
    <>
      <TitleAndFocus />
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Overview />} />
          <Route path="floor-plan" element={<FloorPlan />} />
          <Route path="rooms/:roomId" element={<RoomDetail />} />
          <Route path="drill" element={<Drill />} />
          <Route path="about" element={<About />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </>
  )
}
