'use client'

import { useEffect } from 'react'
import { useI18n } from '@/lib/i18n'

export function DocumentTitle() {
  const { t, locale } = useI18n()
  useEffect(() => {
    document.title = t('app.title')
  }, [t, locale])
  return null
}
