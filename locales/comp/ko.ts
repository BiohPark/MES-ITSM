import { coreKo } from './ko-core'
import { ganttKo } from './ko-gantt'
import { modalsKo } from './ko-modals'

export const compKo: Record<string, unknown> = {
  ...coreKo,
  gantt: ganttKo,
  ...modalsKo,
}
