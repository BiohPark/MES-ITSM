'use client'

import { useI18n } from '@/lib/i18n'

export function Placeholder({ label }: { label: string }) {
  const { t } = useI18n()
  return (
    <div className="placeholder">
      <p>{t('comp.placeholder.comingSoon', { label })}</p>
    </div>
  )
}
