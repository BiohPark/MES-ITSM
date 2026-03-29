'use client'

import { Placeholder } from '@/components/common/Placeholder'
import { useI18n, tabTranslationPath } from '@/lib/i18n'
import type { HomeTabContentProps } from '../home-tab-content.types'

export function TabFallbackHomePanel({ p }: { p: HomeTabContentProps }) {
  const { t } = useI18n()
  return <Placeholder label={t(tabTranslationPath(p.activeTab))} />
}
