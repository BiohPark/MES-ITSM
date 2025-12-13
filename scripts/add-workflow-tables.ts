import { getPool } from '../lib/db'

async function addWorkflowTables() {
  const pool = getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    console.log('워크플로우 관리 테이블 생성 중...\n')

    // 1. workflows 테이블 생성
    console.log('📊 workflows 테이블 생성...')
    await connection.query(`
      CREATE TABLE IF NOT EXISTS workflows (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_name (name),
        INDEX idx_is_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
    console.log('   ✅ workflows 테이블 생성 완료')

    // 2. workflow_statuses 테이블 생성
    console.log('\n📊 workflow_statuses 테이블 생성...')
    await connection.query(`
      CREATE TABLE IF NOT EXISTS workflow_statuses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(50) NOT NULL,
        category VARCHAR(20) DEFAULT 'todo',
        workflow_id INT NOT NULL,
        description TEXT,
        is_initial BOOLEAN DEFAULT FALSE,
        is_final BOOLEAN DEFAULT FALSE,
        display_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
        UNIQUE KEY unique_workflow_status (workflow_id, name),
        INDEX idx_workflow_id (workflow_id),
        INDEX idx_category (category)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
    console.log('   ✅ workflow_statuses 테이블 생성 완료')

    // 3. workflow_transitions 테이블 생성
    console.log('\n📊 workflow_transitions 테이블 생성...')
    await connection.query(`
      CREATE TABLE IF NOT EXISTS workflow_transitions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        workflow_id INT NOT NULL,
        from_status_id INT NOT NULL,
        to_status_id INT NOT NULL,
        \`condition\` JSON,
        description TEXT,
        display_order INT DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
        FOREIGN KEY (from_status_id) REFERENCES workflow_statuses(id) ON DELETE CASCADE,
        FOREIGN KEY (to_status_id) REFERENCES workflow_statuses(id) ON DELETE CASCADE,
        INDEX idx_workflow_id (workflow_id),
        INDEX idx_from_status_id (from_status_id),
        INDEX idx_to_status_id (to_status_id),
        INDEX idx_is_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
    console.log('   ✅ workflow_transitions 테이블 생성 완료')

    // 4. workflow_schemes 테이블 생성
    console.log('\n📊 workflow_schemes 테이블 생성...')
    await connection.query(`
      CREATE TABLE IF NOT EXISTS workflow_schemes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        workflow_id INT NOT NULL,
        is_default BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
        INDEX idx_workflow_id (workflow_id),
        INDEX idx_is_default (is_default)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
    console.log('   ✅ workflow_schemes 테이블 생성 완료')

    // 5. project_children 테이블에 워크플로우 관련 컬럼 추가 (이미 존재하면 무시)
    console.log('\n📊 project_children 테이블에 워크플로우 컬럼 추가...')
    try {
      await connection.query(`
        ALTER TABLE project_children
        ADD COLUMN current_status_id INT NULL,
        ADD COLUMN workflow_scheme_id INT NULL,
        ADD FOREIGN KEY (current_status_id) REFERENCES workflow_statuses(id) ON DELETE SET NULL,
        ADD FOREIGN KEY (workflow_scheme_id) REFERENCES workflow_schemes(id) ON DELETE SET NULL,
        ADD INDEX idx_current_status_id (current_status_id),
        ADD INDEX idx_workflow_scheme_id (workflow_scheme_id)
      `)
      console.log('   ✅ project_children 테이블에 워크플로우 컬럼 추가 완료')
    } catch (error: any) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('   ℹ️  워크플로우 컬럼이 이미 존재합니다.')
      } else {
        throw error
      }
    }

    // 6. 기본 워크플로우 데이터 생성 (예시)
    console.log('\n📝 기본 워크플로우 데이터 생성...')
    
    // Task Workflow 생성
    const [workflowResult] = await connection.query<any[]>(
      `INSERT IGNORE INTO workflows (name, description, is_active) 
       VALUES ('Task Workflow', 'Task 이슈용 기본 워크플로우', TRUE)`
    )
    
    const [workflows] = await connection.query<any[]>(
      "SELECT id FROM workflows WHERE name = 'Task Workflow'"
    )
    
    if (workflows.length > 0) {
      const workflowId = workflows[0].id
      
      // 상태 생성
      const statuses = [
        { name: 'Planning', category: 'todo', is_initial: true, display_order: 1 },
        { name: 'In Progress', category: 'in_progress', display_order: 2 },
        { name: 'Review', category: 'in_progress', display_order: 3 },
        { name: 'Completed', category: 'done', is_final: true, display_order: 4 },
        { name: 'Cancelled', category: 'done', is_final: true, display_order: 5 },
      ]
      
      const statusIds: { [key: string]: number } = {}
      
      for (const status of statuses) {
        const [statusResult] = await connection.query<any[]>(
          `INSERT IGNORE INTO workflow_statuses 
           (name, category, workflow_id, is_initial, is_final, display_order) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [status.name, status.category, workflowId, status.is_initial || false, status.is_final || false, status.display_order]
        )
        
        const [insertedStatus] = await connection.query<any[]>(
          'SELECT id FROM workflow_statuses WHERE workflow_id = ? AND name = ?',
          [workflowId, status.name]
        )
        
        if (insertedStatus.length > 0) {
          statusIds[status.name] = insertedStatus[0].id
        }
      }
      
      // 전환 생성
      const transitions = [
        { name: 'Start Work', from: 'Planning', to: 'In Progress', order: 1 },
        { name: 'Submit for Review', from: 'In Progress', to: 'Review', order: 2 },
        { name: 'Back to Work', from: 'Review', to: 'In Progress', order: 3 },
        { name: 'Complete', from: 'Review', to: 'Completed', order: 4 },
        { name: 'Cancel', from: 'Planning', to: 'Cancelled', order: 5 },
        { name: 'Cancel', from: 'In Progress', to: 'Cancelled', order: 6 },
      ]
      
      for (const trans of transitions) {
        const fromId = statusIds[trans.from]
        const toId = statusIds[trans.to]
        
        if (fromId && toId) {
          await connection.query(
            `INSERT IGNORE INTO workflow_transitions 
             (name, workflow_id, from_status_id, to_status_id, display_order, is_active) 
             VALUES (?, ?, ?, ?, ?, TRUE)`,
            [trans.name, workflowId, fromId, toId, trans.order]
          )
        }
      }
      
      // 기본 스킴 생성
      await connection.query(
        `INSERT IGNORE INTO workflow_schemes (name, workflow_id, is_default) 
         VALUES ('Default Task Scheme', ?, TRUE)`,
        [workflowId]
      )
      
      console.log('   ✅ 기본 워크플로우 데이터 생성 완료')
    }

    await connection.commit()
    console.log('\n🎉 워크플로우 관리 테이블 생성 완료!')
  } catch (error) {
    await connection.rollback()
    console.error('❌ 워크플로우 테이블 생성 실패:', error)
    throw error
  } finally {
    connection.release()
  }
}

async function main() {
  try {
    await addWorkflowTables()
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

main()

