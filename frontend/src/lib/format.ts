import type { Lang } from '@/i18n'

const locale = (lang: Lang) => (lang === 'ar' ? 'ar-u-nu-latn' : 'en-GB')

/** Replay / dataset timestamps are displayed as recorded (UTC digits), never converted to "now". */
export function formatReplayTime(iso: string, lang: Lang, withDate = false): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat(locale(lang), {
    timeZone: 'UTC',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    ...(withDate ? { year: 'numeric', month: 'short', day: '2-digit' } : {}),
  }).format(d)
}

/** Device wall-clock times (when someone clicked something in this browser). */
export function formatWallTime(iso: string, lang: Lang): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat(locale(lang), {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(d)
}

export function formatNumber(v: number, lang: Lang, digits = 2): string {
  return new Intl.NumberFormat(locale(lang), { maximumFractionDigits: digits }).format(v)
}

export function formatPercent(v: number, lang: Lang): string {
  return new Intl.NumberFormat(locale(lang), { style: 'percent', maximumFractionDigits: 0 }).format(v)
}
