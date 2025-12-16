/**
 * MS Project 스타일 일정 계산 유틸리티
 * Forward Pass와 Backward Pass를 통한 CPM (Critical Path Method) 계산
 */

export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF'

export interface TaskSchedule {
  taskId: string
  taskIndex: number
  taskName: string
  durationDays: number
  startDate: string | null
  // Early Start, Early Finish
  es: number // Early Start (프로젝트 시작일 기준 일수)
  ef: number // Early Finish
  // Late Start, Late Finish
  ls: number // Late Start
  lf: number // Late Finish
  // Float (여유 시간)
  totalFloat: number
  freeFloat: number
  // Critical Path 여부
  isCritical: boolean
}

export interface Predecessor {
  taskId: string
  predecessorTaskId: string
  dependencyType: DependencyType
  lagDays: number
}

export interface Task {
  taskId: string
  taskIndex: number
  taskName: string
  durationDays: number
  startDate: string | null
  projectStartDate: string | null
}

/**
 * Forward Pass: Early Start와 Early Finish 계산
 */
function calculateForwardPass(
  tasks: Task[],
  predecessors: Predecessor[],
  projectStartDate: string | null
): Map<string, { es: number; ef: number }> {
  const results = new Map<string, { es: number; ef: number }>()
  const taskMap = new Map(tasks.map(t => [t.taskId, t]))
  const predecessorsByTask = new Map<string, Predecessor[]>()
  
  // 각 작업의 선행 작업 목록 구성
  predecessors.forEach(pred => {
    if (!predecessorsByTask.has(pred.taskId)) {
      predecessorsByTask.set(pred.taskId, [])
    }
    predecessorsByTask.get(pred.taskId)!.push(pred)
  })

  // 프로젝트 시작일을 기준으로 일수 계산
  const baseDate = projectStartDate ? new Date(projectStartDate) : new Date()
  const baseTimestamp = baseDate.getTime()

  // 위상 정렬을 위한 방문 체크
  const visited = new Set<string>()
  const visiting = new Set<string>()

  function visit(taskId: string): { es: number; ef: number } {
    if (visiting.has(taskId)) {
      // 순환 참조 감지
      console.warn(`Circular dependency detected involving task ${taskId}`)
      return { es: 0, ef: 0 }
    }

    if (visited.has(taskId)) {
      return results.get(taskId) || { es: 0, ef: 0 }
    }

    visiting.add(taskId)
    const task = taskMap.get(taskId)
    if (!task) {
      visiting.delete(taskId)
      return { es: 0, ef: 0 }
    }

    const preds = predecessorsByTask.get(taskId) || []
    let maxEF = 0

    for (const pred of preds) {
      const predResult = visit(pred.predecessorTaskId)
      const predTask = taskMap.get(pred.predecessorTaskId)
      if (!predTask) continue

      let dependencyEF = 0

      switch (pred.dependencyType) {
        case 'FS': // Finish-to-Start
          dependencyEF = predResult.ef + pred.lagDays
          break
        case 'SS': // Start-to-Start
          dependencyEF = predResult.es + pred.lagDays
          break
        case 'FF': // Finish-to-Finish
          dependencyEF = predResult.ef + pred.lagDays
          break
        case 'SF': // Start-to-Finish
          dependencyEF = predResult.es + pred.lagDays
          break
      }

      maxEF = Math.max(maxEF, dependencyEF)
    }

    // Early Start는 모든 선행 작업의 종속성 조건을 만족하는 최소 일수
    let es = maxEF

    // 작업에 고정 시작일이 있는 경우
    if (task.startDate) {
      const taskStartDate = new Date(task.startDate)
      const daysFromBase = Math.floor((taskStartDate.getTime() - baseTimestamp) / (1000 * 60 * 60 * 24))
      es = Math.max(es, daysFromBase)
    }

    const ef = es + task.durationDays

    const result = { es, ef }
    results.set(taskId, result)
    visiting.delete(taskId)
    visited.add(taskId)

    return result
  }

  // 모든 작업에 대해 Forward Pass 수행
  tasks.forEach(task => {
    if (!visited.has(task.taskId)) {
      visit(task.taskId)
    }
  })

  return results
}

/**
 * Backward Pass: Late Start와 Late Finish 계산
 */
function calculateBackwardPass(
  tasks: Task[],
  predecessors: Predecessor[],
  forwardResults: Map<string, { es: number; ef: number }>,
  projectEndDate: string | null
): Map<string, { ls: number; lf: number }> {
  const results = new Map<string, { ls: number; lf: number }>()
  const taskMap = new Map(tasks.map(t => [t.taskId, t]))
  const successorsByTask = new Map<string, Predecessor[]>()
  
  // 각 작업의 후행 작업(Successor) 목록 구성
  predecessors.forEach(pred => {
    if (!successorsByTask.has(pred.predecessorTaskId)) {
      successorsByTask.set(pred.predecessorTaskId, [])
    }
    successorsByTask.get(pred.predecessorTaskId)!.push(pred)
  })

  // 프로젝트 종료일 계산
  let projectEF = 0
  if (projectEndDate) {
    const baseDate = tasks[0]?.projectStartDate ? new Date(tasks[0].projectStartDate) : new Date()
    const baseTimestamp = baseDate.getTime()
    const endDate = new Date(projectEndDate)
    projectEF = Math.floor((endDate.getTime() - baseTimestamp) / (1000 * 60 * 60 * 24))
  } else {
    // 프로젝트 종료일이 없으면 가장 큰 EF를 사용
    forwardResults.forEach(({ ef }) => {
      projectEF = Math.max(projectEF, ef)
    })
  }

  // 역순으로 처리하기 위해 작업을 역순으로 정렬
  const sortedTasks = [...tasks].reverse()

  sortedTasks.forEach(task => {
    const forward = forwardResults.get(task.taskId)
    if (!forward) {
      results.set(task.taskId, { ls: 0, lf: 0 })
      return
    }

    const successors = successorsByTask.get(task.taskId) || []
    let minLS = projectEF

    if (successors.length === 0) {
      // 후행 작업이 없는 경우 (프로젝트 종료 작업)
      minLS = projectEF - task.durationDays
    } else {
      // 각 후행 작업의 종속성 조건을 고려하여 최소 LS 계산
      for (const succ of successors) {
        const succTask = taskMap.get(succ.taskId)
        if (!succTask) continue

        const succResult = results.get(succ.taskId)
        if (!succResult) {
          // 아직 계산되지 않은 경우, 일단 건너뛰고 나중에 다시 계산
          // (역순 처리이므로 후행 작업이 먼저 계산되어야 함)
          continue
        } else {
          let dependencyLS = 0
          switch (succ.dependencyType) {
            case 'FS': // Finish-to-Start
              dependencyLS = succResult.ls - task.durationDays - succ.lagDays
              break
            case 'SS': // Start-to-Start
              dependencyLS = succResult.ls - succ.lagDays
              break
            case 'FF': // Finish-to-Finish
              dependencyLS = succResult.lf - task.durationDays - succ.lagDays
              break
            case 'SF': // Start-to-Finish
              dependencyLS = succResult.lf - succ.lagDays
              break
          }
          minLS = Math.min(minLS, dependencyLS)
        }
      }
    }

    const lf = minLS + task.durationDays
    results.set(task.taskId, { ls: minLS, lf })
  })

  return results
}

/**
 * Float (여유 시간) 계산
 */
function calculateFloat(
  tasks: Task[],
  forwardResults: Map<string, { es: number; ef: number }>,
  backwardResults: Map<string, { ls: number; lf: number }>,
  predecessors: Predecessor[]
): Map<string, { totalFloat: number; freeFloat: number; isCritical: boolean }> {
  const results = new Map<string, { totalFloat: number; freeFloat: number; isCritical: boolean }>()
  const successorsByTask = new Map<string, Predecessor[]>()
  
  predecessors.forEach(pred => {
    if (!successorsByTask.has(pred.predecessorTaskId)) {
      successorsByTask.set(pred.predecessorTaskId, [])
    }
    successorsByTask.get(pred.predecessorTaskId)!.push(pred)
  })

  tasks.forEach(task => {
    const forward = forwardResults.get(task.taskId)
    const backward = backwardResults.get(task.taskId)
    
    if (!forward || !backward) {
      results.set(task.taskId, { totalFloat: 0, freeFloat: 0, isCritical: false })
      return
    }

    // Total Float = LS - ES = LF - EF
    const totalFloat = backward.ls - forward.es

    // Free Float 계산: 후행 작업의 최소 ES - 현재 작업의 EF
    const successors = successorsByTask.get(task.taskId) || []
    let minSuccessorES = Infinity
    
    if (successors.length === 0) {
      minSuccessorES = Infinity
    } else {
      successors.forEach(succ => {
        const succForward = forwardResults.get(succ.taskId)
        if (succForward) {
          minSuccessorES = Math.min(minSuccessorES, succForward.es)
        }
      })
    }

    const freeFloat = minSuccessorES === Infinity ? totalFloat : minSuccessorES - forward.ef
    const isCritical = totalFloat === 0

    results.set(task.taskId, { totalFloat, freeFloat, isCritical })
  })

  return results
}

/**
 * 전체 일정 계산 (Forward Pass + Backward Pass + Float)
 */
export function calculateSchedule(
  tasks: Task[],
  predecessors: Predecessor[],
  projectStartDate: string | null,
  projectEndDate: string | null
): TaskSchedule[] {
  // Forward Pass
  const forwardResults = calculateForwardPass(tasks, predecessors, projectStartDate)

  // Backward Pass
  const backwardResults = calculateBackwardPass(tasks, predecessors, forwardResults, projectEndDate)

  // Float 계산
  const floatResults = calculateFloat(tasks, forwardResults, backwardResults, predecessors)

  // 결과 통합
  const schedules: TaskSchedule[] = tasks.map(task => {
    const forward = forwardResults.get(task.taskId) || { es: 0, ef: 0 }
    const backward = backwardResults.get(task.taskId) || { ls: 0, lf: 0 }
    const float = floatResults.get(task.taskId) || { totalFloat: 0, freeFloat: 0, isCritical: false }

    // 실제 날짜 계산
    const baseDate = projectStartDate ? new Date(projectStartDate) : new Date()
    const startDate = new Date(baseDate)
    startDate.setDate(startDate.getDate() + forward.es)

    return {
      taskId: task.taskId,
      taskIndex: task.taskIndex,
      taskName: task.taskName,
      durationDays: task.durationDays,
      startDate: startDate.toISOString().split('T')[0],
      es: forward.es,
      ef: forward.ef,
      ls: backward.ls,
      lf: backward.lf,
      totalFloat: float.totalFloat,
      freeFloat: float.freeFloat,
      isCritical: float.isCritical,
    }
  })

  return schedules
}

