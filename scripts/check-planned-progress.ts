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
  
  console.log(`  계산 상세: 시작일=${start}, 마감일=${due}, 오늘=${today.toISOString().slice(0, 10)}`)
  console.log(`  전체 일수: ${totalDays}, 경과 일수: ${elapsedDays}`)
  
  if (totalDays <= 0) {
    console.log(`  ⚠️  전체 일수가 0 이하: ${totalDays}`)
    // 시작일과 마감일이 같은 경우, 오늘이 그 날짜와 같거나 이후면 100%
    if (elapsedDays >= 0) {
      console.log(`  ✅ 시작일=마감일이고 오늘이 해당 날짜 이후이므로 100%로 처리`)
      return 100
    }
    return 0
  }
  if (elapsedDays < 0) {
    console.log(`  ⚠️  경과 일수가 음수 (시작일이 미래): ${elapsedDays}`)
    return 0
  }
  if (elapsedDays > totalDays) {
    console.log(`  ⚠️  경과 일수가 전체 일수보다 큼: ${elapsedDays} > ${totalDays}`)
    return 100
  }
  
  const progress = Math.round((elapsedDays / totalDays) * 100)
  console.log(`  ✅ 계산된 진척도: ${progress}%`)
  return progress
}

async function checkPlannedProgress() {
  const pool = getPool()
  const connection = await pool.getConnection()

  try {
    console.log('📋 일감(project_children) 계획 진척도 확인 중...\n')
    const [tasks] = await connection.query<any[]>(
      'SELECT id, title, start, due, progress, status FROM project_children WHERE start IS NOT NULL AND due IS NOT NULL AND start != "" AND due != ""'
    )

    console.log(`총 ${tasks.length}개의 일감이 시작일과 마감일을 가지고 있습니다.\n`)

    let zeroProgressCount = 0
    for (const task of tasks) {
      const start = task.start ? (typeof task.start === 'string' ? task.start : new Date(task.start).toISOString().slice(0, 10)) : null
      const due = task.due ? (typeof task.due === 'string' ? task.due : new Date(task.due).toISOString().slice(0, 10)) : null
      
      console.log(`\n📌 일감: "${task.title}" (ID: ${task.id})`)
      console.log(`  시작일: ${start}, 마감일: ${due}, 실적 진척도: ${task.progress || 0}%`)
      
      const plannedProgress = calculatePlannedProgress(start, due)
      
      if (plannedProgress === 0) {
        zeroProgressCount++
        console.log(`  ⚠️  계획 진척도가 0%입니다!`)
      } else {
        console.log(`  ✅ 계획 진척도: ${plannedProgress}%`)
      }
    }

    console.log(`\n\n📋 GMP Record 계획 진척도 확인 중...\n`)
    const [gmpRecords] = await connection.query<any[]>(
      'SELECT id, title, start, due, progress, status FROM gmp_records WHERE start IS NOT NULL AND due IS NOT NULL AND start != "" AND due != ""'
    )

    console.log(`총 ${gmpRecords.length}개의 GMP Record가 시작일과 마감일을 가지고 있습니다.\n`)

    let gmpZeroProgressCount = 0
    for (const record of gmpRecords) {
      const start = record.start ? (typeof record.start === 'string' ? record.start : new Date(record.start).toISOString().slice(0, 10)) : null
      const due = record.due ? (typeof record.due === 'string' ? record.due : new Date(record.due).toISOString().slice(0, 10)) : null
      
      console.log(`\n📌 GMP Record: "${record.title}" (ID: ${record.id})`)
      console.log(`  시작일: ${start}, 마감일: ${due}, 실적 진척도: ${record.progress || 0}%`)
      
      const plannedProgress = calculatePlannedProgress(start, due)
      
      if (plannedProgress === 0) {
        gmpZeroProgressCount++
        console.log(`  ⚠️  계획 진척도가 0%입니다!`)
      } else {
        console.log(`  ✅ 계획 진척도: ${plannedProgress}%`)
      }
    }

    console.log(`\n\n📊 요약:`)
    console.log(`  일감: ${zeroProgressCount}개 항목의 계획 진척도가 0%`)
    console.log(`  GMP Record: ${gmpZeroProgressCount}개 항목의 계획 진척도가 0%`)
    console.log(`  총 ${zeroProgressCount + gmpZeroProgressCount}개 항목 확인 필요`)

  } catch (error) {
    console.error('❌ 확인 실패:', error)
    throw error
  } finally {
    connection.release()
  }
}

async function main() {
  try {
    await checkPlannedProgress()
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

main()

