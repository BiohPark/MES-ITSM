import { coreEn } from './en-core'
import { ganttEn } from './en-gantt'
import { modalsEn } from './en-modals'

export const compEn: Record<string, unknown> = {
  ...coreEn,
  gantt: ganttEn,
  ...modalsEn,
}
