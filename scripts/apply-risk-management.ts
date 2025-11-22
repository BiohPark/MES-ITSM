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
  
  if (totalDays <= 0) {
    // 시작일과 마감일이 같은 경우, 오늘이 그 날짜와 같거나 이후면 100%
    if (elapsedDays >= 0) return 100
    return 0
  }
  if (elapsedDays < 0) return 0
  if (elapsedDays > totalDays) return 100
  
  return Math.round((elapsedDays / totalDays) * 100)
}

// Risk 체크: 계획 진척도와 실적 진척도의 차이가 10% 이상인지 확인
function checkRiskStatus(start: string | null | undefined, due: string | null | undefined, actualProgress: number): boolean {
  const plannedProgress = calculatePlannedProgress(start, due)
  const difference = Math.abs(plannedProgress - actualProgress)
  return difference >= 10
}

async function applyRiskManagement() {
  const pool = getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    console.log('Risk 관리 로직 적용 중...')

    // 1. 모든 일감(project_children) 조회 및 업데이트
    console.log('\n📋 일감(project_children) Risk 체크 중...')
    const [tasks] = await connection.query<any[]>(
      'SELECT id, title, start, due, progress, status FROM project_children'
    )

    let taskUpdatedCount = 0
    for (const task of tasks) {
      const start = task.start ? (typeof task.start === 'string' ? task.start : new Date(task.start).toISOString().slice(0, 10)) : null
      const due = task.due ? (typeof task.due === 'string' ? task.due : new Date(task.due).toISOString().slice(0, 10)) : null
      const actualProgress = task.progress || 0
      
      if (checkRiskStatus(start, due, actualProgress)) {
        const plannedProgress = calculatePlannedProgress(start, due)
        const difference = Math.abs(plannedProgress - actualProgress)
        
        // 상태가 이미 "Issued"가 아니면 업데이트
        if (task.status !== 'Issued') {
          await connection.query(
            'UPDATE project_children SET status = ? WHERE id = ?',
            ['Issued', task.id]
          )
          console.log(`  ✅ 일감 "${task.title}" (ID: ${task.id}) 상태를 "Issued"로 변경 (계획: ${plannedProgress}%, 실적: ${actualProgress}%, 차이: ${difference}%)`)
          taskUpdatedCount++
        } else {
          console.log(`  ℹ️  일감 "${task.title}" (ID: ${task.id}) 이미 "Issued" 상태 (계획: ${plannedProgress}%, 실적: ${actualProgress}%, 차이: ${difference}%)`)
        }
      }
    }
    console.log(`\n✅ 일감 업데이트 완료: ${taskUpdatedCount}개 항목이 "Issued" 상태로 변경됨`)

    // 2. 모든 GMP Record 조회 및 업데이트
    console.log('\n📋 GMP Record Risk 체크 중...')
    const [gmpRecords] = await connection.query<any[]>(
      'SELECT id, title, start, due, progress, status FROM gmp_records'
    )

    let gmpUpdatedCount = 0
    for (const record of gmpRecords) {
      const start = record.start ? (typeof record.start === 'string' ? record.start : new Date(record.start).toISOString().slice(0, 10)) : null
      const due = record.due ? (typeof record.due === 'string' ? record.due : new Date(record.due).toISOString().slice(0, 10)) : null
      const actualProgress = record.progress || 0
      
      if (checkRiskStatus(start, due, actualProgress)) {
        const plannedProgress = calculatePlannedProgress(start, due)
        const difference = Math.abs(plannedProgress - actualProgress)
        
        // 상태가 이미 "Issued"가 아니면 업데이트
        if (record.status !== 'Issued') {
          await connection.query(
            'UPDATE gmp_records SET status = ? WHERE id = ?',
            ['Issued', record.id]
          )
          console.log(`  ✅ GMP Record "${record.title}" (ID: ${record.id}) 상태를 "Issued"로 변경 (계획: ${plannedProgress}%, 실적: ${actualProgress}%, 차이: ${difference}%)`)
          gmpUpdatedCount++
        } else {
          console.log(`  ℹ️  GMP Record "${record.title}" (ID: ${record.id}) 이미 "Issued" 상태 (계획: ${plannedProgress}%, 실적: ${actualProgress}%, 차이: ${difference}%)`)
        }
      }
    }
    console.log(`\n✅ GMP Record 업데이트 완료: ${gmpUpdatedCount}개 항목이 "Issued" 상태로 변경됨`)

    await connection.commit()
    console.log(`\n🎉 Risk 관리 로직 적용 완료! 총 ${taskUpdatedCount + gmpUpdatedCount}개 항목이 업데이트되었습니다.`)
  } catch (error) {
    await connection.rollback()
    console.error('❌ Risk 관리 로직 적용 실패:', error)
    throw error
  } finally {
    connection.release()
  }
}

async function main() {
  try {
    await applyRiskManagement()
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

main()

