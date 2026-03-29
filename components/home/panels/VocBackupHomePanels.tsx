'use client'

import { VocView } from '@/components/voc/VocView'
import { BackupView } from '@/components/backup/BackupView'
import { Placeholder } from '@/components/common/Placeholder'
import { useI18n } from '@/lib/i18n'
import type { HomeTabContentProps } from '../home-tab-content.types'

export function VocHomePanel({ p }: { p: HomeTabContentProps }) {
  const { user } = p
  return <VocView currentUser={user ? { name: user.name, username: user.username, role: user.role } : undefined} />
}

export function BackupHomePanel({ p }: { p: HomeTabContentProps }) {
  const { t } = useI18n()
  const { user } = p
  if (user && (user.role === 'admin' || user.isAdmin)) {
    return <BackupView />
  }
  return <Placeholder label={t('page.noAccess')} />
}
