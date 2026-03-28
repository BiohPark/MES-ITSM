'use client'

import { useI18n, type Locale } from '@/lib/i18n'

const LOCALES: Locale[] = ['ko', 'en']

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n()
  return (
    <div className="servicenow-header__lang" role="group" aria-label={t('language.label')}>
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          className={`servicenow-header__lang-btn${locale === l ? ' servicenow-header__lang-btn--active' : ''}`}
          onClick={() => setLocale(l)}
          aria-pressed={locale === l}
        >
          {t(`language.${l}`)}
        </button>
      ))}
    </div>
  )
}
