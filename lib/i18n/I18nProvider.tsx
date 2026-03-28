'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Locale } from './types'
import { getNested, interpolate } from './utils'
import { deepMerge } from './deepMerge'
import koBase from '@/locales/ko.json'
import enBase from '@/locales/en.json'
import { compKo } from '@/locales/comp/ko'
import { compEn } from '@/locales/comp/en'

const STORAGE_KEY = 'itsm-locale'

const dictionaries = {
  ko: deepMerge(koBase as Record<string, unknown>, { comp: compKo } as Record<string, unknown>) as typeof koBase,
  en: deepMerge(enBase as Record<string, unknown>, { comp: compEn } as Record<string, unknown>) as typeof enBase,
} satisfies Record<Locale, typeof koBase>

export interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('ko')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Locale | null
      if (stored === 'ko' || stored === 'en') {
        setLocaleState(stored)
      }
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    if (!mounted) return
    document.documentElement.lang = locale === 'ko' ? 'ko' : 'en'
    try {
      localStorage.setItem(STORAGE_KEY, locale)
    } catch {
      /* ignore */
    }
  }, [locale, mounted])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
  }, [])

  const dict = dictionaries[locale]

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const raw = getNested(dict as unknown as Record<string, unknown>, key)
      const str = typeof raw === 'string' ? raw : key
      return interpolate(str, vars)
    },
    [dict]
  )

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) {
    throw new Error('useI18n must be used within I18nProvider')
  }
  return ctx
}
