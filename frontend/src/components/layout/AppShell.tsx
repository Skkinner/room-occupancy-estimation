import { Building2, ClipboardList, Cpu, FlaskConical, Languages, LayoutDashboard, Loader2, Map, Menu, PlayCircle, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Toaster } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useI18n, type TKey } from '@/i18n'
import { cn } from '@/lib/utils'
import { useDemo } from '@/state/DemoStore'
import { ConnectionBanner, DrillBanner, SafetyBanner } from './Banners'

const NAV: { to: string; key: TKey; Icon: typeof Map }[] = [
  { to: '/', key: 'nav.overview', Icon: LayoutDashboard },
  { to: '/floor-plan', key: 'nav.floorPlan', Icon: Map },
  { to: '/drill', key: 'nav.drill', Icon: PlayCircle },
  { to: '/about', key: 'nav.about', Icon: ClipboardList },
]

function ModeBadge() {
  const { t } = useI18n()
  const { state, mode } = useDemo()
  if (state.connection.status === 'checking')
    return (
      <Badge variant="neutral">
        <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />
        {t('connection.checkingBadge')}
      </Badge>
    )
  return mode === 'api' ? (
    <Badge variant="teal">
      <Cpu aria-hidden />
      {t('connection.onlineBadge')}
    </Badge>
  ) : (
    <Badge variant="warning">
      <FlaskConical aria-hidden />
      {t('connection.offlineBadge')}
    </Badge>
  )
}

export function AppShell() {
  const { t, toggleLang, dir } = useI18n()
  const { state } = useDemo()
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  useEffect(() => setMenuOpen(false), [location.pathname])

  const navLinks = (
    <ul className="flex flex-col gap-1 lg:flex-row lg:items-center">
      {NAV.map(({ to, key, Icon }) => (
        <li key={to}>
          <NavLink
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
                isActive && 'bg-primary/10 text-teal-200 ring-1 ring-inset ring-primary/30',
              )
            }
          >
            <Icon className="size-4" aria-hidden />
            {t(key)}
          </NavLink>
        </li>
      ))}
    </ul>
  )

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only z-[60] rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:start-4 focus:top-4"
      >
        {t('app.skip')}
      </a>
      <div className="sticky top-0 z-40">
        <SafetyBanner />
        <header className="border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
          <div className="container flex h-16 items-center gap-3">
            <NavLink to="/" className="flex min-w-0 items-center gap-2.5" aria-label={`${t('app.name')} — ${t('app.tagline')}`}>
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/15 ring-1 ring-primary/40">
                <Building2 className="size-5 text-teal-300" aria-hidden />
              </span>
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-sm font-bold sm:text-base">{t('app.name')}</span>
                <span className="block truncate text-xs text-muted-foreground">{t('app.tagline')}</span>
              </span>
            </NavLink>
            <nav aria-label={t('nav.label')} className="ms-6 hidden lg:block">
              {navLinks}
            </nav>
            <div className="ms-auto flex items-center gap-2">
              <div className="hidden items-center gap-2 sm:flex">
                <ModeBadge />
                {state.drill.active && (
                  <Badge variant="drill">{t('drill.activeBadge')}</Badge>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={toggleLang} aria-label={t('lang.label')}>
                <Languages aria-hidden />
                <span lang={dir === 'rtl' ? 'en' : 'ar'}>{t('lang.switchTo')}</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                aria-expanded={menuOpen}
                aria-controls="mobile-nav"
                aria-label={t('app.menu')}
                onClick={() => setMenuOpen((o) => !o)}
              >
                {menuOpen ? <X aria-hidden /> : <Menu aria-hidden />}
              </Button>
            </div>
          </div>
          {menuOpen && (
            <nav id="mobile-nav" aria-label={t('nav.label')} className="container border-t pb-3 pt-2 lg:hidden">
              <div className="mb-2 flex flex-wrap gap-2 sm:hidden">
                <ModeBadge />
                {state.drill.active && <Badge variant="drill">{t('drill.activeBadge')}</Badge>}
              </div>
              {navLinks}
            </nav>
          )}
        </header>
      </div>
      <ConnectionBanner />
      <DrillBanner />
      <main id="main" tabIndex={-1} className="container flex-1 py-6 focus:outline-none">
        <Outlet />
      </main>
      <footer className="border-t py-4">
        <p className="container text-xs text-muted-foreground">{t('app.footer')}</p>
      </footer>
      <Toaster theme="dark" position={dir === 'rtl' ? 'bottom-left' : 'bottom-right'} dir={dir} richColors={false} closeButton />
    </div>
  )
}
