import mysql from 'mysql2/promise'

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'project_management',
}

async function addPredecessorsTable() {
  const connection = await mysql.createConnection(dbConfig)

  try {
    console.log('Creating predecessors table...')

    // predecessors 테이블 생성
    await connection.query(`
      CREATE TABLE IF NOT EXISTS predecessors (
        predecessor_id INT AUTO_INCREMENT PRIMARY KEY,
        task_id VARCHAR(50) NOT NULL,
        predecessor_task_id VARCHAR(50) NOT NULL,
        dependency_type ENUM('FS', 'SS', 'FF', 'SF') NOT NULL DEFAULT 'FS',
        lag_days INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (task_id) REFERENCES project_children(id) ON DELETE CASCADE,
        FOREIGN KEY (predecessor_task_id) REFERENCES project_children(id) ON DELETE CASCADE,
        INDEX idx_task_id (task_id),
        INDEX idx_predecessor_task_id (predecessor_task_id),
        UNIQUE KEY unique_dependency (task_id, predecessor_task_id, dependency_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    console.log('Predecessors table created successfully!')

    // project_children 테이블에 task_index 컬럼 추가 (없는 경우)
    await connection.query(`
      ALTER TABLE project_children 
      ADD COLUMN IF NOT EXISTS task_index INT NULL,
      ADD INDEX IF NOT EXISTS idx_project_task_index (project_id, task_index)
    `).catch((error: any) => {
      // MySQL 8.0 이하에서는 IF NOT EXISTS를 지원하지 않으므로 에러 무시
      if (error.code !== 'ER_DUP_FIELDNAME') {
        console.warn('Note: task_index column may already exist or MySQL version does not support IF NOT EXISTS')
      }
    })

    // task_index가 없는 경우에만 추가 시도
    try {
      await connection.query(`
        ALTER TABLE project_children 
        ADD COLUMN task_index INT NULL
      `)
      console.log('task_index column added successfully!')
    } catch (error: any) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('task_index column already exists')
      } else {
        throw error
      }
    }

    // 인덱스 추가 시도
    try {
      await connection.query(`
        ALTER TABLE project_children 
        ADD INDEX idx_project_task_index (project_id, task_index)
      `)
      console.log('Index added successfully!')
    } catch (error: any) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log('Index already exists')
      } else {
        throw error
      }
    }

    console.log('Database schema update completed!')
  } catch (error) {
    console.error('Error creating predecessors table:', error)
    throw error
  } finally {
    await connection.end()
  }
}

// 스크립트 직접 실행 시
if (require.main === module) {
  addPredecessorsTable()
    .then(() => {
      console.log('Migration completed successfully')
      process.exit(0)
    })
    .catch((error) => {
      console.error('Migration failed:', error)
      process.exit(1)
    })
}

export default addPredecessorsTable


