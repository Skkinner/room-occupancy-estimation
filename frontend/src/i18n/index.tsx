import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ar } from './ar'
import { en, type Dictionary } from './en'

export type Lang = 'en' | 'ar'

type Join<K extends string, P extends string> = `${K}.${P}`
type Paths<T> = {
  [K in keyof T & string]: T[K] extends string ? K : Join<K, Paths<T[K]>>
}[keyof T & string]

export type TKey = Paths<Dictionary>
export type TParams = Record<string, string | number>

const dictionaries: Record<Lang, Dictionary> = { en, ar }

export function translate(dict: Dictionary, key: TKey, params?: TParams): string {
  let node: unknown = dict
  for (const part of key.split('.')) {
    node = (node as Record<string, unknown> | undefined)?.[part]
  }
  let str = typeof node === 'string' ? node : key
  if (params) {
    for (const [k, v] of Object.entries(params)) str = str.split(`{${k}}`).join(String(v))
  }
  return str
}

interface I18nValue {
  lang: Lang
  dir: 'ltr' | 'rtl'
  setLang: (l: Lang) => void
  toggleLang: () => void
  t: (key: TKey, params?: TParams) => string
}

const I18nContext = createContext<I18nValue | null>(null)
const STORAGE_KEY = 'iat.lang'

function readStoredLang(): Lang {
  // `?lang=ar` / `?lang=en` in the URL wins (handy for demos and screenshots).
  const fromUrl = new URLSearchParams(window.location.search).get('lang')
  if (fromUrl === 'ar' || fromUrl === 'en') return fromUrl
  try {
    const v = window.localStorage.getItem(STORAGE_KEY)
    return v === 'ar' ? 'ar' : 'en'
  } catch {
    return 'en'
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readStoredLang)
  const dir = lang === 'ar' ? 'rtl' : 'ltr'

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = dir
    try {
      window.localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      /* storage unavailable — language simply won't persist */
    }
  }, [lang, dir])

  const setLang = useCallback((l: Lang) => setLangState(l), [])
  const toggleLang = useCallback(() => setLangState((l) => (l === 'en' ? 'ar' : 'en')), [])
  const t = useCallback((key: TKey, params?: TParams) => translate(dictionaries[lang], key, params), [lang])

  const value = useMemo(() => ({ lang, dir, setLang, toggleLang, t }) as I18nValue, [lang, dir, setLang, toggleLang, t])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}

export { dictionaries }
