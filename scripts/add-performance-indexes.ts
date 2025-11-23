import { getPool } from '../lib/db'

// 성능 최적화를 위한 인덱스 추가 스크립트
async function addIndexes() {
  const pool = getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    console.log('🔧 성능 최적화 인덱스 추가 시작...\n')

    // 1. projects 테이블 인덱스
    console.log('📊 projects 테이블 인덱스 추가...')
    try {
      await connection.query(`
        CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at DESC)
      `)
      console.log('   ✅ idx_projects_created_at 인덱스 추가 완료')
    } catch (error: any) {
      if (error.code !== 'ER_DUP_KEYNAME') {
        console.log('   ⚠️  idx_projects_created_at 인덱스 추가 실패:', error.message)
      } else {
        console.log('   ℹ️  idx_projects_created_at 인덱스 이미 존재')
      }
    }

    try {
      await connection.query(`
        CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner)
      `)
      console.log('   ✅ idx_projects_owner 인덱스 추가 완료')
    } catch (error: any) {
      if (error.code !== 'ER_DUP_KEYNAME') {
        console.log('   ⚠️  idx_projects_owner 인덱스 추가 실패:', error.message)
      } else {
        console.log('   ℹ️  idx_projects_owner 인덱스 이미 존재')
      }
    }

    // 2. project_children 테이블 인덱스
    console.log('\n📊 project_children 테이블 인덱스 추가...')
    try {
      await connection.query(`
        CREATE INDEX IF NOT EXISTS idx_project_children_created_at ON project_children(created_at ASC)
      `)
      console.log('   ✅ idx_project_children_created_at 인덱스 추가 완료')
    } catch (error: any) {
      if (error.code !== 'ER_DUP_KEYNAME') {
        console.log('   ⚠️  idx_project_children_created_at 인덱스 추가 실패:', error.message)
      } else {
        console.log('   ℹ️  idx_project_children_created_at 인덱스 이미 존재')
      }
    }

    try {
      await connection.query(`
        CREATE INDEX IF NOT EXISTS idx_project_children_owner ON project_children(owner)
      `)
      console.log('   ✅ idx_project_children_owner 인덱스 추가 완료')
    } catch (error: any) {
      if (error.code !== 'ER_DUP_KEYNAME') {
        console.log('   ⚠️  idx_project_children_owner 인덱스 추가 실패:', error.message)
      } else {
        console.log('   ℹ️  idx_project_children_owner 인덱스 이미 존재')
      }
    }

    // 3. gmp_records 테이블 인덱스
    console.log('\n📊 gmp_records 테이블 인덱스 추가...')
    try {
      await connection.query(`
        CREATE INDEX IF NOT EXISTS idx_gmp_records_created_at ON gmp_records(created_at ASC)
      `)
      console.log('   ✅ idx_gmp_records_created_at 인덱스 추가 완료')
    } catch (error: any) {
      if (error.code !== 'ER_DUP_KEYNAME') {
        console.log('   ⚠️  idx_gmp_records_created_at 인덱스 추가 실패:', error.message)
      } else {
        console.log('   ℹ️  idx_gmp_records_created_at 인덱스 이미 존재')
      }
    }

    try {
      await connection.query(`
        CREATE INDEX IF NOT EXISTS idx_gmp_records_owner ON gmp_records(owner)
      `)
      console.log('   ✅ idx_gmp_records_owner 인덱스 추가 완료')
    } catch (error: any) {
      if (error.code !== 'ER_DUP_KEYNAME') {
        console.log('   ⚠️  idx_gmp_records_owner 인덱스 추가 실패:', error.message)
      } else {
        console.log('   ℹ️  idx_gmp_records_owner 인덱스 이미 존재')
      }
    }

    try {
      await connection.query(`
        CREATE INDEX IF NOT EXISTS idx_gmp_records_kind ON gmp_records(kind)
      `)
      console.log('   ✅ idx_gmp_records_kind 인덱스 추가 완료')
    } catch (error: any) {
      if (error.code !== 'ER_DUP_KEYNAME') {
        console.log('   ⚠️  idx_gmp_records_kind 인덱스 추가 실패:', error.message)
      } else {
        console.log('   ℹ️  idx_gmp_records_kind 인덱스 이미 존재')
      }
    }

    await connection.commit()
    console.log('\n🎉 인덱스 추가 완료!')
  } catch (error) {
    await connection.rollback()
    console.error('❌ 인덱스 추가 실패:', error)
    throw error
  } finally {
    connection.release()
  }
}

async function main() {
  try {
    await addIndexes()
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

main()

