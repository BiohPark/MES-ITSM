import type { TabKey } from '@/utils/constants'
import type { Locale, TabGuide } from './types'
import { guidesKo } from '@/locales/guides/ko'
import { guidesEn } from '@/locales/guides/en'

const byLocale = { ko: guidesKo, en: guidesEn }

export function getGuideForTab(tab: TabKey, locale: Locale): TabGuide {
  const g = byLocale[locale]
  return g.tabs[tab] ?? g.default
}
