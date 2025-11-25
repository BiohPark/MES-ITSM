import { getPool } from '../lib/db'

async function addPerformanceIndexes() {
  const pool = getPool()
  const connection = await pool.getConnection()

  try {
    console.log('='.repeat(80))
    console.log('성능 최적화 인덱스 추가')
    console.log('='.repeat(80))
    console.log()

    // 1. project_children 테이블 인덱스
    console.log('📊 project_children 테이블 인덱스 추가...')
    const projectChildrenIndexes = [
      { name: 'idx_owner', sql: 'CREATE INDEX IF NOT EXISTS idx_owner ON project_children(owner)' },
      { name: 'idx_status', sql: 'CREATE INDEX IF NOT EXISTS idx_status ON project_children(status)' },
      { name: 'idx_created_at', sql: 'CREATE INDEX IF NOT EXISTS idx_created_at ON project_children(created_at)' },
      { name: 'idx_linked_gmp_record_id', sql: 'CREATE INDEX IF NOT EXISTS idx_linked_gmp_record_id ON project_children(linked_gmp_record_id)' },
    ]

    for (const idx of projectChildrenIndexes) {
      try {
        await connection.query(idx.sql)
        console.log(`   ✅ ${idx.name} 인덱스 추가 완료`)
      } catch (error: any) {
        if (error.code === 'ER_DUP_KEYNAME') {
          console.log(`   ℹ️  ${idx.name} 인덱스가 이미 존재합니다.`)
        } else {
          console.error(`   ❌ ${idx.name} 인덱스 추가 실패:`, error.message)
        }
      }
    }
    console.log()

    // 2. gmp_records 테이블 인덱스
    console.log('📊 gmp_records 테이블 인덱스 추가...')
    const gmpRecordsIndexes = [
      { name: 'idx_owner', sql: 'CREATE INDEX IF NOT EXISTS idx_owner ON gmp_records(owner)' },
      { name: 'idx_status', sql: 'CREATE INDEX IF NOT EXISTS idx_status ON gmp_records(status)' },
      { name: 'idx_kind', sql: 'CREATE INDEX IF NOT EXISTS idx_kind ON gmp_records(kind)' },
      { name: 'idx_created_at', sql: 'CREATE INDEX IF NOT EXISTS idx_created_at ON gmp_records(created_at)' },
      { name: 'idx_linked_task_id', sql: 'CREATE INDEX IF NOT EXISTS idx_linked_task_id ON gmp_records(linked_task_id)' },
    ]

    for (const idx of gmpRecordsIndexes) {
      try {
        await connection.query(idx.sql)
        console.log(`   ✅ ${idx.name} 인덱스 추가 완료`)
      } catch (error: any) {
        if (error.code === 'ER_DUP_KEYNAME') {
          console.log(`   ℹ️  ${idx.name} 인덱스가 이미 존재합니다.`)
        } else {
          console.error(`   ❌ ${idx.name} 인덱스 추가 실패:`, error.message)
        }
      }
    }
    console.log()

    // 3. projects 테이블 인덱스
    console.log('📊 projects 테이블 인덱스 추가...')
    const projectsIndexes = [
      { name: 'idx_owner', sql: 'CREATE INDEX IF NOT EXISTS idx_owner ON projects(owner)' },
      { name: 'idx_status', sql: 'CREATE INDEX IF NOT EXISTS idx_status ON projects(status)' },
      { name: 'idx_created_at', sql: 'CREATE INDEX IF NOT EXISTS idx_created_at ON projects(created_at)' },
    ]

    for (const idx of projectsIndexes) {
      try {
        await connection.query(idx.sql)
        console.log(`   ✅ ${idx.name} 인덱스 추가 완료`)
      } catch (error: any) {
        if (error.code === 'ER_DUP_KEYNAME') {
          console.log(`   ℹ️  ${idx.name} 인덱스가 이미 존재합니다.`)
        } else {
          console.error(`   ❌ ${idx.name} 인덱스 추가 실패:`, error.message)
        }
      }
    }
    console.log()

    // 4. 복합 인덱스 (자주 함께 조회되는 컬럼들)
    console.log('📊 복합 인덱스 추가...')
    const compositeIndexes = [
      { 
        name: 'idx_project_children_project_status', 
        sql: 'CREATE INDEX IF NOT EXISTS idx_project_children_project_status ON project_children(project_id, status)' 
      },
      { 
        name: 'idx_gmp_records_project_kind', 
        sql: 'CREATE INDEX IF NOT EXISTS idx_gmp_records_project_kind ON gmp_records(project_id, kind)' 
      },
    ]

    for (const idx of compositeIndexes) {
      try {
        await connection.query(idx.sql)
        console.log(`   ✅ ${idx.name} 복합 인덱스 추가 완료`)
      } catch (error: any) {
        if (error.code === 'ER_DUP_KEYNAME') {
          console.log(`   ℹ️  ${idx.name} 인덱스가 이미 존재합니다.`)
        } else {
          console.error(`   ❌ ${idx.name} 인덱스 추가 실패:`, error.message)
        }
      }
    }
    console.log()

    console.log('='.repeat(80))
    console.log('✅ 성능 최적화 인덱스 추가 완료!')
    console.log('='.repeat(80))

  } catch (error) {
    console.error('❌ 인덱스 추가 실패:', error)
    throw error
  } finally {
    connection.release()
  }
}

async function main() {
  try {
    await addPerformanceIndexes()
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

main()
