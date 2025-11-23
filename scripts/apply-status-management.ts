import { getPool } from '../lib/db'

// 계획 진척도 계산 (시작일과 마감일 기반)
function calculatePlannedProgress(start: string | null | undefined, due: string | null | undefined): number {
  if (!start || !due) return 0
  
  const startDate = new Date(start)
  const dueDate = new Date(due)
  const today = new Date()
  
  // 날짜를 자정으로 설정하여 일 단위 계산
  startDate.setHours(0, 0, 0, 0)
  dueDate.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)
  
  const totalDays = Math.ceil((dueDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  const elapsedDays = Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  
  // 시작일과 마감일이 같은 경우 (totalDays = 0)
  if (totalDays <= 0) {
    // 오늘이 시작일/마감일과 같거나 이후면 100%, 이전이면 0%
    if (elapsedDays >= 0) return 100
    return 0
  }
  
  if (elapsedDays < 0) return 0
  if (elapsedDays > totalDays) return 100
  
  return Math.round((elapsedDays / totalDays) * 100)
}

// Risk 체크: 계획 진척도가 실적 진척도보다 10% 이상 높은지 확인 (계획이 실적보다 뒤처진 경우만)
function checkRiskStatus(start: string | null | undefined, due: string | null | undefined, actualProgress: number): boolean {
  const plannedProgress = calculatePlannedProgress(start, due)
  const difference = plannedProgress - actualProgress
  return difference >= 10 // 계획이 실적보다 10% 이상 높은 경우만 true
}

// 상태 결정 로직: progress >= 100 → "Completed", Risk 체크 → "Issued", progress > 0 → "In progress"
function determineStatus(start: string | null | undefined, due: string | null | undefined, progress: number, currentStatus: string): string {
  if (progress >= 100) {
    return 'Completed'
  } else if (checkRiskStatus(start, due, progress)) {
    return 'Issued'
  } else if (progress > 0) {
    return 'In progress'
  }
  return currentStatus // 그 외는 원래 상태 유지
}

async function applyStatusManagement() {
  const pool = getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    console.log('상태 자동 관리 로직 적용 중...')

    // 1. 모든 프로젝트 조회 및 업데이트
    console.log('\n📋 프로젝트 상태 업데이트 중...')
    const [projects] = await connection.query<any[]>(
      'SELECT id, name, start, due, progress, status FROM projects'
    )

    let projectUpdatedCount = 0
    for (const project of projects) {
      const start = project.start ? (typeof project.start === 'string' ? project.start : new Date(project.start).toISOString().slice(0, 10)) : null
      const due = project.due ? (typeof project.due === 'string' ? project.due : new Date(project.due).toISOString().slice(0, 10)) : null
      const actualProgress = project.progress || 0
      const newStatus = determineStatus(start, due, actualProgress, project.status)
      
      if (newStatus !== project.status) {
        await connection.query(
          'UPDATE projects SET status = ? WHERE id = ?',
          [newStatus, project.id]
        )
        console.log(`  ✅ 프로젝트 "${project.name}" (ID: ${project.id}) 상태를 "${project.status}" → "${newStatus}"로 변경 (진척률: ${actualProgress}%)`)
        projectUpdatedCount++
      } else {
        console.log(`  ℹ️  프로젝트 "${project.name}" (ID: ${project.id}) 상태 유지: "${project.status}" (진척률: ${actualProgress}%)`)
      }
    }
    console.log(`\n✅ 프로젝트 업데이트 완료: ${projectUpdatedCount}개 항목이 업데이트됨`)

    // 2. 모든 일감(project_children) 조회 및 업데이트
    console.log('\n📋 일감(project_children) 상태 업데이트 중...')
    const [tasks] = await connection.query<any[]>(
      'SELECT id, title, start, due, progress, status FROM project_children'
    )

    let taskUpdatedCount = 0
    for (const task of tasks) {
      const start = task.start ? (typeof task.start === 'string' ? task.start : new Date(task.start).toISOString().slice(0, 10)) : null
      const due = task.due ? (typeof task.due === 'string' ? task.due : new Date(task.due).toISOString().slice(0, 10)) : null
      const actualProgress = task.progress || 0
      const newStatus = determineStatus(start, due, actualProgress, task.status)
      
      if (newStatus !== task.status) {
        await connection.query(
          'UPDATE project_children SET status = ? WHERE id = ?',
          [newStatus, task.id]
        )
        console.log(`  ✅ 일감 "${task.title}" (ID: ${task.id}) 상태를 "${task.status}" → "${newStatus}"로 변경 (진척률: ${actualProgress}%)`)
        taskUpdatedCount++
      } else {
        console.log(`  ℹ️  일감 "${task.title}" (ID: ${task.id}) 상태 유지: "${task.status}" (진척률: ${actualProgress}%)`)
      }
    }
    console.log(`\n✅ 일감 업데이트 완료: ${taskUpdatedCount}개 항목이 업데이트됨`)

    // 3. 모든 GMP Record 조회 및 업데이트
    console.log('\n📋 GMP Record 상태 업데이트 중...')
    const [gmpRecords] = await connection.query<any[]>(
      'SELECT id, title, start, due, progress, status FROM gmp_records'
    )

    let gmpUpdatedCount = 0
    for (const record of gmpRecords) {
      const start = record.start ? (typeof record.start === 'string' ? record.start : new Date(record.start).toISOString().slice(0, 10)) : null
      const due = record.due ? (typeof record.due === 'string' ? record.due : new Date(record.due).toISOString().slice(0, 10)) : null
      const actualProgress = record.progress || 0
      const newStatus = determineStatus(start, due, actualProgress, record.status)
      
      if (newStatus !== record.status) {
        await connection.query(
          'UPDATE gmp_records SET status = ? WHERE id = ?',
          [newStatus, record.id]
        )
        console.log(`  ✅ GMP Record "${record.title}" (ID: ${record.id}) 상태를 "${record.status}" → "${newStatus}"로 변경 (진척률: ${actualProgress}%)`)
        gmpUpdatedCount++
      } else {
        console.log(`  ℹ️  GMP Record "${record.title}" (ID: ${record.id}) 상태 유지: "${record.status}" (진척률: ${actualProgress}%)`)
      }
    }
    console.log(`\n✅ GMP Record 업데이트 완료: ${gmpUpdatedCount}개 항목이 업데이트됨`)

    await connection.commit()
    console.log(`\n🎉 상태 자동 관리 로직 적용 완료! 총 ${projectUpdatedCount + taskUpdatedCount + gmpUpdatedCount}개 항목이 업데이트되었습니다.`)
  } catch (error) {
    await connection.rollback()
    console.error('❌ 상태 자동 관리 로직 적용 실패:', error)
    throw error
  } finally {
    connection.release()
  }
}

async function main() {
  try {
    await applyStatusManagement()
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

main()

