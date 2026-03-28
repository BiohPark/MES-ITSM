import type { TabKey } from '@/utils/constants'

/** Maps TabKey to nested message key segment (hyphens → underscores for JSON paths). */
export function tabKeyToMessageSegment(key: TabKey): string {
  return key.replace(/-/g, '_')
}

export function tabTranslationPath(key: TabKey): string {
  return `tabs.${tabKeyToMessageSegment(key)}`
}
