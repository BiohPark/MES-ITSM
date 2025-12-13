import mysql from 'mysql2/promise'

async function checkTaskStatus() {
  // 환경 변수는 .env 파일에서 자동으로 로드됨 (Next.js 환경)
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'project_management',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  })

  try {
    // "생산 요구사항"이 포함된 모든 일감 조회
    const [tasks] = await pool.query<any[]>(
      `SELECT id, title, status, progress, project_id, phases 
       FROM project_children 
       WHERE title LIKE '%생산 요구사항%' 
       ORDER BY created_at DESC`
    )

    console.log('\n=== "생산 요구사항" 일감 조회 결과 ===')
    console.log(`총 ${tasks.length}개 일감 발견\n`)

    tasks.forEach((task, index) => {
      console.log(`${index + 1}. ${task.title}`)
      console.log(`   ID: ${task.id}`)
      console.log(`   Status: ${task.status}`)
      console.log(`   Progress: ${task.progress}%`)
      console.log(`   Project ID: ${task.project_id || 'NULL (orphan task)'}`)
      
      if (task.phases) {
        try {
          const phases = typeof task.phases === 'string' ? JSON.parse(task.phases) : task.phases
          console.log(`   PI Phase: ${phases?.pi?.status || 'N/A'} (${phases?.pi?.progress || 0}%)`)
          console.log(`   PM Phase: ${phases?.pm?.status || 'N/A'} (${phases?.pm?.progress || 0}%)`)
          console.log(`   Development Phase: ${phases?.development?.status || 'N/A'} (${phases?.development?.progress || 0}%)`)
        } catch (e) {
          console.log(`   Phases: 파싱 오류`)
        }
      }
      console.log('')
    })

    // 모든 Completed 일감 조회
    const [completedTasks] = await pool.query<any[]>(
      `SELECT id, title, status, progress, project_id 
       FROM project_children 
       WHERE status = 'Completed' 
       ORDER BY created_at DESC`
    )

    console.log(`\n=== 전체 Completed 일감 목록 ===`)
    console.log(`총 ${completedTasks.length}개 Completed 일감\n`)

    completedTasks.forEach((task, index) => {
      console.log(`${index + 1}. ${task.title}`)
      console.log(`   ID: ${task.id}`)
      console.log(`   Status: ${task.status}`)
      console.log(`   Progress: ${task.progress}%`)
      console.log(`   Project ID: ${task.project_id || 'NULL (orphan task)'}`)
      console.log('')
    })

    // 상태별 일감 수 통계
    const [statusStats] = await pool.query<any[]>(
      `SELECT status, COUNT(*) as count 
       FROM project_children 
       GROUP BY status 
       ORDER BY count DESC`
    )

    console.log(`\n=== 상태별 일감 통계 ===`)
    statusStats.forEach((stat) => {
      console.log(`${stat.status}: ${stat.count}개`)
    })

  } catch (error) {
    console.error('오류 발생:', error)
  } finally {
    await pool.end()
  }
}

checkTaskStatus()

