import { getPool } from '../lib/db'
import { getProjects, getAllGmpRecords, getAllIssues } from '../lib/db'

async function performanceTest() {
  const pool = getPool()
  
  try {
    console.log('='.repeat(80))
    console.log('성능 테스트 시작')
    console.log('='.repeat(80))
    console.log()

    // 1. 프로젝트 조회 성능 테스트
    console.log('📊 프로젝트 조회 성능 테스트...')
    const startProjects = performance.now()
    const projects = await getProjects()
    const endProjects = performance.now()
    const projectsTime = endProjects - startProjects
    console.log(`  ✅ 프로젝트 ${projects.length}개 조회 완료: ${projectsTime.toFixed(2)}ms`)
    console.log(`  평균 조회 시간: ${(projectsTime / Math.max(projects.length, 1)).toFixed(2)}ms/프로젝트`)
    console.log()

    // 2. GMP Record 조회 성능 테스트
    console.log('📊 GMP Record 조회 성능 테스트...')
    const startGmp = performance.now()
    const gmpRecords = await getAllGmpRecords()
    const endGmp = performance.now()
    const gmpTime = endGmp - startGmp
    console.log(`  ✅ GMP Record ${gmpRecords.length}개 조회 완료: ${gmpTime.toFixed(2)}ms`)
    console.log(`  평균 조회 시간: ${(gmpTime / Math.max(gmpRecords.length, 1)).toFixed(2)}ms/레코드`)
    console.log()

    // 3. 이슈 조회 성능 테스트
    console.log('📊 이슈 조회 성능 테스트...')
    const startIssues = performance.now()
    const issues = await getAllIssues()
    const endIssues = performance.now()
    const issuesTime = endIssues - startIssues
    console.log(`  ✅ 이슈 ${issues.length}개 조회 완료: ${issuesTime.toFixed(2)}ms`)
    console.log(`  평균 조회 시간: ${(issuesTime / Math.max(issues.length, 1)).toFixed(2)}ms/이슈`)
    console.log()

    // 4. 데이터베이스 연결 풀 상태 확인
    console.log('📊 데이터베이스 연결 풀 상태...')
    const poolInfo = pool as any
    console.log(`  연결 풀 설정:`)
    console.log(`    - 최대 연결 수: ${poolInfo.config?.connectionLimit || 'N/A'}`)
    console.log(`    - 대기 큐 제한: ${poolInfo.config?.queueLimit || 'N/A'}`)
    console.log()

    // 5. 인덱스 확인
    console.log('📊 인덱스 확인...')
    const connection = await pool.getConnection()
    try {
      const [indexes] = await connection.query<any[]>(`
        SELECT 
          TABLE_NAME,
          INDEX_NAME,
          COLUMN_NAME,
          SEQ_IN_INDEX
        FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME IN ('projects', 'project_children', 'gmp_records', 'issues', 'users', 'comments')
        ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX
      `)
      
      const indexMap = new Map<string, Set<string>>()
      indexes.forEach((idx: any) => {
        const key = `${idx.TABLE_NAME}.${idx.INDEX_NAME}`
        if (!indexMap.has(key)) {
          indexMap.set(key, new Set())
        }
        indexMap.get(key)!.add(idx.COLUMN_NAME)
      })
      
      console.log(`  ✅ 총 ${indexMap.size}개의 인덱스 발견:`)
      indexMap.forEach((columns, key) => {
        console.log(`    - ${key}: ${Array.from(columns).join(', ')}`)
      })
    } finally {
      connection.release()
    }
    console.log()

    // 6. 느린 쿼리 확인 (MySQL slow query log가 활성화된 경우)
    console.log('📊 느린 쿼리 확인...')
    try {
      const [slowQueries] = await connection.query<any[]>(`
        SELECT 
          sql_text,
          exec_count,
          avg_timer_wait/1000000000000 as avg_time_sec,
          sum_timer_wait/1000000000000 as total_time_sec
        FROM performance_schema.events_statements_summary_by_digest
        WHERE schema_name = DATABASE()
        AND avg_timer_wait > 1000000000
        ORDER BY avg_timer_wait DESC
        LIMIT 10
      `)
      
      if (slowQueries.length > 0) {
        console.log(`  ⚠️  느린 쿼리 ${slowQueries.length}개 발견:`)
        slowQueries.forEach((query: any, idx: number) => {
          console.log(`    ${idx + 1}. 평균 실행 시간: ${query.avg_time_sec.toFixed(4)}초`)
          console.log(`       실행 횟수: ${query.exec_count}`)
          console.log(`       총 실행 시간: ${query.total_time_sec.toFixed(4)}초`)
        })
      } else {
        console.log('  ✅ 느린 쿼리 없음')
      }
    } catch (error: any) {
      if (error.code === 'ER_TABLEACCESS_DENIED_ERROR') {
        console.log('  ℹ️  performance_schema 접근 권한이 없습니다.')
      } else {
        console.log(`  ℹ️  느린 쿼리 확인 불가: ${error.message}`)
      }
    }
    console.log()

    // 7. 테이블 크기 확인
    console.log('📊 테이블 크기 확인...')
    try {
      const [tableSizes] = await connection.query<any[]>(`
        SELECT 
          TABLE_NAME,
          ROUND(((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024), 2) AS SIZE_MB,
          TABLE_ROWS
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
        ORDER BY (DATA_LENGTH + INDEX_LENGTH) DESC
      `)
      
      console.log(`  테이블 크기:`)
      tableSizes.forEach((table: any) => {
        console.log(`    - ${table.TABLE_NAME}: ${table.SIZE_MB}MB (${table.TABLE_ROWS}행)`)
      })
    } finally {
      connection.release()
    }
    console.log()

    console.log('='.repeat(80))
    console.log('✅ 성능 테스트 완료!')
    console.log('='.repeat(80))

  } catch (error) {
    console.error('❌ 성능 테스트 실패:', error)
    throw error
  } finally {
    await pool.end()
  }
}

async function main() {
  try {
    await performanceTest()
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

main()

