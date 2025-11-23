import { getPool, getNextProjectId, getNextTaskId, getNextGmpRecordId, getNextGmpRecordNumberForKind } from '../lib/db'

// 성능 테스트를 위한 대량 데이터 생성 스크립트
async function generateTestData() {
  const pool = getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    console.log('🚀 성능 테스트 데이터 생성 시작...\n')

    const totalProjects = 1000
    const tasksPerProject = 10
    const gmpRecordsPerProject = 5
    const totalTasks = totalProjects * tasksPerProject
    const totalGmpRecords = totalProjects * gmpRecordsPerProject

    console.log(`📊 생성 계획:`)
    console.log(`   - 프로젝트: ${totalProjects}개`)
    console.log(`   - 일감: ${totalTasks}개`)
    console.log(`   - GMP Record: ${totalGmpRecords}개`)
    console.log(`   - 총 데이터: ${totalProjects + totalTasks + totalGmpRecords}개\n`)

    // 사용자 목록 (테스트용)
    const testUsers = [
      '김개발', '이기획', '박디자인', '최QA', '정PM',
      '강개발', '윤기획', '임디자인', '한QA', '조PM',
      '성개발', '유기획', '노디자인', '신QA', '오PM'
    ]

    const statuses = ['Planning', 'In Progress', 'Issued', 'Completed']
    const kinds = ['CC', 'Deviation', 'CAPA', 'Change Control']

    // 날짜 생성 헬퍼
    const getRandomDate = (start: Date, end: Date): string => {
      const date = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
      return date.toISOString().slice(0, 10)
    }

    const today = new Date()
    const startDate = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000) // 1년 전
    const endDate = new Date(today.getTime() + 365 * 24 * 60 * 60 * 1000) // 1년 후

    // 기존 최대 ID 확인
    const [existingProjects] = await connection.query<any[]>(
      "SELECT id FROM projects WHERE id LIKE 'PJT-%' ORDER BY id DESC LIMIT 1"
    )
    let lastProjectNum = 0
    if (existingProjects.length > 0) {
      const match = existingProjects[0].id.match(/PJT-(\d+)/)
      if (match) {
        lastProjectNum = parseInt(match[1], 10)
      }
    }

    const [existingTasks] = await connection.query<any[]>(
      "SELECT id FROM project_children WHERE id LIKE 'TASK-%' ORDER BY id DESC LIMIT 1"
    )
    let lastTaskNum = 0
    if (existingTasks.length > 0) {
      const match = existingTasks[0].id.match(/TASK-(\d+)/)
      if (match) {
        lastTaskNum = parseInt(match[1], 10)
      }
    }

    const [existingGmp] = await connection.query<any[]>(
      "SELECT id FROM gmp_records WHERE id LIKE 'GMP-%' ORDER BY id DESC LIMIT 1"
    )
    let lastGmpNum = 0
    if (existingGmp.length > 0) {
      const match = existingGmp[0].id.match(/GMP-(\d+)/)
      if (match) {
        lastGmpNum = parseInt(match[1], 10)
      }
    }

    // 프로젝트 생성
    console.log('📦 프로젝트 생성 중...')
    const projectIds: string[] = []
    
    for (let i = 0; i < totalProjects; i++) {
      const projectNum = lastProjectNum + i + 1
      const projectId = `PJT-${String(projectNum).padStart(5, '0')}`
      projectIds.push(projectId)
      
      const name = `테스트 프로젝트 ${String(i + 1).padStart(4, '0')}`
      const owner = testUsers[Math.floor(Math.random() * testUsers.length)]
      const members = Math.floor(Math.random() * 10) + 1
      const status = statuses[Math.floor(Math.random() * statuses.length)]
      const progress = Math.floor(Math.random() * 101)
      const start = getRandomDate(startDate, endDate)
      const due = getRandomDate(new Date(start), endDate)
      const description = `이것은 성능 테스트를 위한 프로젝트입니다. 프로젝트 번호: ${i + 1}`
      const srb_ver = `v${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 10)}`

      await connection.query(
        `INSERT INTO projects (id, name, owner, members, status, progress, start, due, description, srb_ver)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [projectId, name, owner, members, status, progress, start, due, description, srb_ver]
      )

      if ((i + 1) % 100 === 0) {
        console.log(`   ✅ ${i + 1}/${totalProjects} 프로젝트 생성 완료`)
      }
    }
    console.log(`✅ 프로젝트 생성 완료: ${totalProjects}개\n`)

    // 일감 생성
    console.log('📋 일감 생성 중...')
    let taskCount = 0
    
    for (let i = 0; i < totalProjects; i++) {
      const projectId = projectIds[i]
      
      for (let j = 0; j < tasksPerProject; j++) {
        const taskNum = lastTaskNum + taskCount + 1
        const taskId = `TASK-${String(taskNum).padStart(5, '0')}`
        const title = `테스트 일감 ${String(taskCount + 1).padStart(5, '0')}`
        const owner = testUsers[Math.floor(Math.random() * testUsers.length)]
        const status = statuses[Math.floor(Math.random() * statuses.length)]
        const progress = Math.floor(Math.random() * 101)
        const start = getRandomDate(startDate, endDate)
        const due = getRandomDate(new Date(start), endDate)
        const description = `이것은 성능 테스트를 위한 일감입니다. 일감 번호: ${taskCount + 1}`

        await connection.query(
          `INSERT INTO project_children (id, project_id, title, owner, status, progress, start, due, description)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [taskId, projectId, title, owner, status, progress, start, due, description]
        )

        taskCount++
        if (taskCount % 500 === 0) {
          console.log(`   ✅ ${taskCount}/${totalTasks} 일감 생성 완료`)
        }
      }
    }
    console.log(`✅ 일감 생성 완료: ${totalTasks}개\n`)

    // GMP Record 생성
    console.log('📝 GMP Record 생성 중...')
    let gmpCount = 0
    
    for (let i = 0; i < totalProjects; i++) {
      const projectId = projectIds[i]
      
      for (let j = 0; j < gmpRecordsPerProject; j++) {
        const recordNum = lastGmpNum + gmpCount + 1
        const recordId = `GMP-${String(recordNum).padStart(5, '0')}`
        const kind = kinds[Math.floor(Math.random() * kinds.length)]
        
        // kind별 번호 계산 (간단한 방법)
        const [kindRecords] = await connection.query<any[]>(
          'SELECT number FROM gmp_records WHERE kind = ? ORDER BY number DESC LIMIT 1',
          [kind]
        )
        let kindNumber = 0
        if (kindRecords.length > 0) {
          kindNumber = (kindRecords[0].number || 0) + 1
        } else {
          kindNumber = 1
        }
        const kindNumberStr = `${kind}-${String(kindNumber).padStart(5, '0')}`
        const title = `테스트 GMP Record ${String(gmpCount + 1).padStart(5, '0')}`
        const owner = testUsers[Math.floor(Math.random() * testUsers.length)]
        const status = statuses[Math.floor(Math.random() * statuses.length)]
        const progress = Math.floor(Math.random() * 101)
        const start = getRandomDate(startDate, endDate)
        const due = getRandomDate(new Date(start), endDate)
        const description = `이것은 성능 테스트를 위한 GMP Record입니다. Record 번호: ${gmpCount + 1}`

        await connection.query(
          `INSERT INTO gmp_records (id, project_id, title, kind, number, kind_number, owner, status, progress, start, due, description)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [recordId, projectId, title, kind, kindNumber, kindNumberStr, owner, status, progress, start, due, description]
        )

        gmpCount++
        if (gmpCount % 500 === 0) {
          console.log(`   ✅ ${gmpCount}/${totalGmpRecords} GMP Record 생성 완료`)
        }
      }
    }
    console.log(`✅ GMP Record 생성 완료: ${totalGmpRecords}개\n`)

    await connection.commit()
    
    console.log('🎉 성능 테스트 데이터 생성 완료!')
    console.log(`\n📊 생성된 데이터 요약:`)
    console.log(`   - 프로젝트: ${totalProjects}개`)
    console.log(`   - 일감: ${totalTasks}개`)
    console.log(`   - GMP Record: ${totalGmpRecords}개`)
    console.log(`   - 총 데이터: ${totalProjects + totalTasks + totalGmpRecords}개`)
  } catch (error) {
    await connection.rollback()
    console.error('❌ 데이터 생성 실패:', error)
    throw error
  } finally {
    connection.release()
  }
}

async function main() {
  try {
    await generateTestData()
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

main()

