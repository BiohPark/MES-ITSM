import mysql from 'mysql2/promise'
import { getPool } from '../lib/db'

async function addAttachmentsTable() {
  const pool = getPool()
  const connection = await pool.getConnection()

  try {
    console.log('Creating attachments table...')

    await connection.query(`
      CREATE TABLE IF NOT EXISTS attachments (
        id VARCHAR(50) PRIMARY KEY,
        record_id VARCHAR(50) NOT NULL,
        record_type VARCHAR(50) NOT NULL DEFAULT 'task',
        file_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        file_size BIGINT NOT NULL,
        mime_type VARCHAR(100),
        uploaded_by VARCHAR(50) NOT NULL,
        upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_record (record_id, record_type),
        INDEX idx_uploaded_by (uploaded_by)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    console.log('✓ Attachments table created successfully')
  } catch (error) {
    console.error('Error creating attachments table:', error)
    throw error
  } finally {
    connection.release()
  }
}

addAttachmentsTable()
  .then(() => {
    console.log('Attachments table setup completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Attachments table setup failed:', error)
    process.exit(1)
  })

