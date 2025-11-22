import mysql from 'mysql2/promise'
import type { Project, ProjectChild } from '@/types/project'
import type { Issue } from '@/types/issue'
import type { Comment, CommentEntityType } from '@/types/comment'

// 데이터베이스 연결 설정
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'project_management',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
}

// 연결 풀 생성
let pool: mysql.Pool | null = null

export function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool(dbConfig)
  }
  return pool
}

// 데이터베이스 초기화 (테이블 생성)
export async function initializeDatabase(): Promise<void> {
  const connection = await mysql.createConnection({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
  })

  try {
    // 데이터베이스 생성 (없으면)
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\``)
    await connection.query(`USE \`${dbConfig.database}\``)

    // projects 테이블 생성
    await connection.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        owner VARCHAR(100) NOT NULL,
        members INT NOT NULL DEFAULT 1,
        status VARCHAR(50) NOT NULL DEFAULT 'Planning',
        progress INT NOT NULL DEFAULT 0,
        start DATE,
        due DATE NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    // project_children 테이블 생성
    await connection.query(`
      CREATE TABLE IF NOT EXISTS project_children (
        id VARCHAR(50) PRIMARY KEY,
        project_id VARCHAR(50) NULL,
        title VARCHAR(255) NOT NULL,
        owner VARCHAR(100) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'Planning',
        progress INT NOT NULL DEFAULT 0,
        start DATE,
        due DATE,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
        INDEX idx_project_id (project_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    // users 테이블 생성
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    // gmp_records 테이블 생성 (일감과 분리된 별도 테이블)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS gmp_records (
        id VARCHAR(50) PRIMARY KEY,
        project_id VARCHAR(50) NULL,
        title VARCHAR(255) NOT NULL,
        kind VARCHAR(10) DEFAULT 'CC',
        number INT DEFAULT 0,
        kind_number VARCHAR(20) DEFAULT 'CC-00000',
        owner VARCHAR(100) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'Planning',
        progress INT NOT NULL DEFAULT 0,
        start DATE,
        due DATE,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
        INDEX idx_project_id (project_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
  } finally {
    await connection.end()
  }
}

// 프로젝트 조회
export async function getProjects(): Promise<Project[]> {
  try {
    const pool = getPool()
    const [projects] = await pool.query<any[]>(
      'SELECT * FROM projects ORDER BY created_at DESC'
    )

    const projectsWithChildren: Project[] = []

    const today = new Date().toISOString().slice(0, 10)
    for (const project of projects) {
      // 일반 일감 조회
      const [children] = await pool.query<any[]>(
        'SELECT * FROM project_children WHERE project_id = ? ORDER BY created_at ASC',
        [project.id]
      )

      // GMP Record 조회
      const [gmpRecords] = await pool.query<any[]>(
        'SELECT * FROM gmp_records WHERE project_id = ? ORDER BY created_at ASC',
        [project.id]
      )

      // 일반 일감 매핑
      const childrenList: any[] = children.map((child) => ({
        id: child.id,
        title: child.title,
        owner: child.owner,
        status: child.status,
        progress: child.progress || 0,
        start: child.start ? (typeof child.start === 'string' ? child.start : new Date(child.start).toISOString().slice(0, 10)) : today,
        due: child.due ? (typeof child.due === 'string' ? child.due : new Date(child.due).toISOString().slice(0, 10)) : '',
        description: child.description || '',
      }))

      // GMP Record 매핑 (kind_number 포함)
      const gmpRecordsList: any[] = gmpRecords.map((record) => {
        const kind = record.kind || 'CC'
        const number = record.number || 0
        const kindNumber = record.kind_number || `${kind}-${String(number).padStart(5, '0')}`
        
        return {
          id: record.id,
          title: record.title,
          owner: record.owner,
          status: record.status,
          progress: record.progress || 0,
          start: record.start ? (typeof record.start === 'string' ? record.start : new Date(record.start).toISOString().slice(0, 10)) : today,
          due: record.due ? (typeof record.due === 'string' ? record.due : new Date(record.due).toISOString().slice(0, 10)) : '',
          description: record.description || '',
          kind: kind,
          number: number,
          kind_number: kindNumber,
          isGmpRecord: true, // GMP Record 구분용 플래그
        }
      })

      // 일반 일감과 GMP Record를 합쳐서 정렬
      const allChildren = [...childrenList, ...gmpRecordsList].sort((a, b) => {
        // GMP Record를 먼저 표시하거나, 생성일 기준으로 정렬
        if (a.isGmpRecord && !b.isGmpRecord) return -1
        if (!a.isGmpRecord && b.isGmpRecord) return 1
        return 0
      })

      projectsWithChildren.push({
        id: project.id,
        name: project.name,
        owner: project.owner,
        members: project.members,
        status: project.status,
        progress: project.progress,
        start: project.start ? (typeof project.start === 'string' ? project.start : new Date(project.start).toISOString().slice(0, 10)) : today,
        due: project.due ? (typeof project.due === 'string' ? project.due : new Date(project.due).toISOString().slice(0, 10)) : '',
        description: project.description || '',
        srb_ver: project.srb_ver || '',
        children: allChildren,
      })
    }

    return projectsWithChildren
  } catch (error) {
    console.error('Error in getProjects:', error)
    throw new Error(`데이터베이스 조회 실패: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// 프로젝트가 없는 일감 조회 (N/A 일감)
export async function getOrphanTasks(): Promise<ProjectChild[]> {
  const pool = getPool()
  const [tasks] = await pool.query<any[]>(
    'SELECT * FROM project_children WHERE project_id IS NULL ORDER BY created_at ASC'
  )

  const today = new Date().toISOString().slice(0, 10)
  return tasks.map((task) => ({
    id: task.id,
    title: task.title,
    owner: task.owner,
    status: task.status,
    progress: task.progress || 0,
    start: task.start ? (typeof task.start === 'string' ? task.start : new Date(task.start).toISOString().slice(0, 10)) : today,
    due: task.due ? (typeof task.due === 'string' ? task.due : new Date(task.due).toISOString().slice(0, 10)) : '',
    description: task.description || '',
  }))
}

// 프로젝트 추가
export async function createProject(project: Project): Promise<void> {
  const pool = getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    // 프로젝트 추가
    await connection.query(
      `INSERT INTO projects (id, name, owner, members, status, progress, start, due, description, srb_ver)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        project.id,
        project.name,
        project.owner,
        project.members,
        project.status,
        project.progress,
        project.start || null,
        project.due,
        project.description || null,
        (project as any).srb_ver || null,
      ]
    )

    // 하위 아이템 추가
    if (project.children && project.children.length > 0) {
      for (const child of project.children) {
        await connection.query(
          `INSERT INTO project_children (id, project_id, title, owner, status, progress, due, description)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [child.id, project.id, child.title, child.owner, child.status, child.progress || 0, child.due || null, child.description || null]
        )
      }
    }

    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

// 프로젝트 업데이트
export async function updateProject(project: Project): Promise<void> {
  const pool = getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    // 실적 진척도가 100%이면 상태를 "Completed"로 자동 변경
    let finalStatus = project.status
    if (project.progress >= 100) {
      finalStatus = 'Completed'
    }

    // 프로젝트 업데이트
    await connection.query(
      `UPDATE projects 
       SET name = ?, owner = ?, members = ?, status = ?, progress = ?, start = ?, due = ?, description = ?, srb_ver = ?
       WHERE id = ?`,
      [
        project.name,
        project.owner,
        project.members,
        finalStatus,
        project.progress,
        project.start || null,
        project.due,
        project.description || null,
        (project as any).srb_ver || null,
        project.id,
      ]
    )

    // 기존 하위 아이템 삭제
    await connection.query('DELETE FROM project_children WHERE project_id = ?', [
      project.id,
    ])

    // 새로운 하위 아이템 추가 (GMP Record는 제외)
    if (project.children && project.children.length > 0) {
      for (const child of project.children) {
        // GMP Record는 별도 테이블에 있으므로 건너뛰기
        const isGmpRecord = !!(child as any).kind_number || !!(child as any).isGmpRecord
        if (isGmpRecord) {
          continue
        }
        
        await connection.query(
          `INSERT INTO project_children (id, project_id, title, owner, status, progress, start, due, description)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [child.id, project.id, child.title, child.owner, child.status, child.progress || 0, (child as any).start || null, child.due || null, child.description || null]
        )
      }
    }

    await connection.commit()
    
    // 하위 아이템이 있으면 마감일 자동 업데이트
    await updateProjectDueDate(project.id)
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

// 프로젝트 삭제
export async function deleteProject(projectId: string): Promise<void> {
  const pool = getPool()
  await pool.query('DELETE FROM projects WHERE id = ?', [projectId])
  // CASCADE로 자동 삭제되지만 명시적으로 삭제
  await pool.query('DELETE FROM project_children WHERE project_id = ?', [projectId])
}

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
  
  // 시작일과 마감일이 같은 경우 (totalDays = 0)
  if (totalDays <= 0) {
    // 오늘이 시작일/마감일과 같거나 이후면 100%, 이전이면 0%
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

// 하위 아이템 추가 (projectId가 null일 수 있음)
// 프로젝트의 마감일을 하위 아이템의 가장 늦은 마감일로 자동 업데이트
async function updateProjectDueDate(projectId: string): Promise<void> {
  const pool = getPool()
  
  // 일반 일감 조회
  const [children] = await pool.query<any[]>(
    'SELECT due FROM project_children WHERE project_id = ? AND due IS NOT NULL AND due != ""',
    [projectId]
  )
  
  // GMP Record 조회
  const [gmpRecords] = await pool.query<any[]>(
    'SELECT due FROM gmp_records WHERE project_id = ? AND due IS NOT NULL AND due != ""',
    [projectId]
  )
  
  // 모든 하위 아이템의 마감일 수집
  const allDueDates: string[] = []
  children.forEach((child) => {
    if (child.due) {
      allDueDates.push(child.due)
    }
  })
  gmpRecords.forEach((record) => {
    if (record.due) {
      allDueDates.push(record.due)
    }
  })
  
  // 가장 늦은 마감일 찾기
  if (allDueDates.length > 0) {
    const latestDueDate = allDueDates.sort((a, b) => {
      const dateA = new Date(a)
      const dateB = new Date(b)
      return dateB.getTime() - dateA.getTime() // 내림차순 정렬
    })[0]
    
    // 프로젝트 마감일 업데이트
    await pool.query(
      'UPDATE projects SET due = ? WHERE id = ?',
      [latestDueDate, projectId]
    )
  }
}

export async function addChildToProject(
  projectId: string | null,
  child: ProjectChild
): Promise<void> {
  const pool = getPool()
  await pool.query(
    `INSERT INTO project_children (id, project_id, title, owner, status, progress, start, due, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [child.id, projectId, child.title, child.owner, child.status, child.progress || 0, child.start || null, child.due || null, child.description || null]
  )
  
  // 프로젝트가 있는 경우 마감일 자동 업데이트
  if (projectId) {
    await updateProjectDueDate(projectId)
  }
}

// 하위 아이템 업데이트 (projectId가 null일 수 있음)
export async function updateChild(
  projectId: string | null,
  child: ProjectChild
): Promise<void> {
  const pool = getPool()
  
  // 기존 프로젝트 ID 조회 (프로젝트가 변경될 수 있으므로)
  const [existingRows] = await pool.query<any[]>(
    'SELECT project_id FROM project_children WHERE id = ?',
    [child.id]
  )
  const oldProjectId = existingRows.length > 0 ? existingRows[0].project_id : null
  
  // 상태 자동 관리: 실적 진척도가 100%이면 "Completed", 그 외 Risk 체크
  let finalStatus = child.status
  if ((child.progress || 0) >= 100) {
    finalStatus = 'Completed'
  } else if (checkRiskStatus(child.start, child.due, child.progress || 0)) {
    finalStatus = 'Issued'
  }
  
  await pool.query(
    `UPDATE project_children 
     SET project_id = ?, title = ?, owner = ?, status = ?, progress = ?, start = ?, due = ?, description = ?
     WHERE id = ?`,
    [projectId, child.title, child.owner, finalStatus, child.progress || 0, child.start || null, child.due || null, child.description || null, child.id]
  )
  
  // 프로젝트가 변경되었거나 업데이트된 경우 마감일 자동 업데이트
  if (oldProjectId && oldProjectId !== projectId) {
    // 이전 프로젝트의 마감일 업데이트
    await updateProjectDueDate(oldProjectId)
  }
  if (projectId) {
    // 새 프로젝트의 마감일 업데이트
    await updateProjectDueDate(projectId)
  }
}

// 하위 아이템 삭제
export async function deleteChild(
  projectId: string | null,
  childId: string
): Promise<void> {
  const pool = getPool()
  try {
    // 삭제 전에 프로젝트 ID 확인 (projectId가 null일 수 있으므로)
    const [existingRows] = await pool.query<any[]>(
      'SELECT project_id FROM project_children WHERE id = ?',
      [childId]
    )
    const actualProjectId = existingRows.length > 0 ? existingRows[0].project_id : null
    
    if (projectId) {
      const [result] = await pool.query<any[]>(
        'DELETE FROM project_children WHERE id = ? AND project_id = ?',
        [childId, projectId]
      )
      // 삭제된 행이 없으면 에러 발생
      if (Array.isArray(result) && (result as any).affectedRows === 0) {
        throw new Error(`일감 ${childId}를 프로젝트 ${projectId}에서 찾을 수 없습니다.`)
      }
    } else {
      const [result] = await pool.query<any[]>(
        'DELETE FROM project_children WHERE id = ? AND project_id IS NULL',
        [childId]
      )
      // 삭제된 행이 없으면 에러 발생
      if (Array.isArray(result) && (result as any).affectedRows === 0) {
        throw new Error(`일감 ${childId}를 찾을 수 없습니다.`)
      }
    }
    
    // 프로젝트가 있는 경우 마감일 자동 업데이트
    if (actualProjectId) {
      await updateProjectDueDate(actualProjectId)
    }
  } catch (error) {
    console.error('Error in deleteChild:', error)
    throw error
  }
}

// 다음 프로젝트 ID 생성 (5자리 숫자)
export async function getNextProjectId(): Promise<string> {
  const pool = getPool()
  const [rows] = await pool.query<any[]>(
    `SELECT id FROM projects WHERE id LIKE 'PJT-%' ORDER BY id DESC LIMIT 1`
  )

  if (rows.length === 0) {
    return 'PJT-00001'
  }

  const lastId = rows[0].id
  const match = lastId.match(/PJT-(\d+)/)
  if (match) {
    const nextNum = parseInt(match[1], 10) + 1
    return `PJT-${String(nextNum).padStart(5, '0')}`
  }

  return 'PJT-00001'
}

// 다음 일감 ID 생성 (5자리 숫자)
export async function getNextTaskId(): Promise<string> {
  const pool = getPool()
  const [rows] = await pool.query<any[]>(
    `SELECT id FROM project_children WHERE id LIKE 'TASK-%' ORDER BY id DESC LIMIT 1`
  )

  if (rows.length === 0) {
    return 'TASK-00001'
  }

  const lastId = rows[0].id
  const match = lastId.match(/TASK-(\d+)/)
  if (match) {
    const nextNum = parseInt(match[1], 10) + 1
    return `TASK-${String(nextNum).padStart(5, '0')}`
  }

  return 'TASK-00001'
}

// GMP Record 관련 함수들

// 모든 GMP Record 조회 (프로젝트 포함 및 프로젝트 없는 것 포함)
export async function getAllGmpRecords(): Promise<Array<ProjectChild & { projectId?: string | null; projectName?: string; kind_number?: string }>> {
  const pool = getPool()
  const [records] = await pool.query<any[]>(
    `SELECT g.*, p.name as project_name 
     FROM gmp_records g 
     LEFT JOIN projects p ON g.project_id = p.id 
     ORDER BY g.created_at DESC`
  )

  const today = new Date().toISOString().slice(0, 10)
  return records.map((record) => {
    const kind = record.kind || 'CC'
    const number = record.number || 0
    const kindNumber = `${kind}-${String(number).padStart(5, '0')}`
    
    return {
      id: record.id,
      title: record.title,
      owner: record.owner,
      status: record.status,
      progress: record.progress || 0,
      start: record.start ? (typeof record.start === 'string' ? record.start : new Date(record.start).toISOString().slice(0, 10)) : today,
      due: record.due ? (typeof record.due === 'string' ? record.due : new Date(record.due).toISOString().slice(0, 10)) : '',
      description: record.description || '',
      kind: kind,
      number: number,
      kind_number: record.kind_number || kindNumber,
      projectId: record.project_id || null,
      projectName: record.project_name || 'N/A',
    }
  })
}

// 프로젝트가 없는 GMP Record 조회 (N/A GMP Record)
export async function getOrphanGmpRecords(): Promise<Array<ProjectChild & { projectId?: string | null; projectName?: string; kind_number?: string }>> {
  const pool = getPool()
  const [records] = await pool.query<any[]>(
    `SELECT g.*, p.name as project_name 
     FROM gmp_records g 
     LEFT JOIN projects p ON g.project_id = p.id 
     WHERE g.project_id IS NULL 
     ORDER BY g.created_at ASC`
  )

  const today = new Date().toISOString().slice(0, 10)
  return records.map((record) => {
    const kind = record.kind || 'CC'
    const number = record.number || 0
    const kindNumber = `${kind}-${String(number).padStart(5, '0')}`
    
    return {
      id: record.id,
      title: record.title,
      owner: record.owner,
      status: record.status,
      progress: record.progress || 0,
      start: record.start ? (typeof record.start === 'string' ? record.start : new Date(record.start).toISOString().slice(0, 10)) : today,
      due: record.due ? (typeof record.due === 'string' ? record.due : new Date(record.due).toISOString().slice(0, 10)) : '',
      description: record.description || '',
      kind: kind,
      number: number,
      kind_number: record.kind_number || kindNumber,
      projectId: record.project_id || null,
      projectName: record.project_name || 'N/A',
    }
  })
}

// GMP Record 추가 (projectId가 null일 수 있음)
export async function addGmpRecord(
  projectId: string | null,
  record: ProjectChild
): Promise<void> {
  const pool = getPool()
  const recordAny = record as any
  const kind = recordAny.kind || 'CC'
  const number = recordAny.number || 0
  const kindNumber = `${kind}-${String(number).padStart(5, '0')}`
  
  await pool.query(
    `INSERT INTO gmp_records (id, project_id, title, kind, number, kind_number, owner, status, progress, start, due, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.id, 
      projectId, 
      record.title, 
      kind,
      number,
      kindNumber,
      record.owner, 
      record.status, 
      record.progress || 0, 
      record.start || null, 
      record.due || null, 
      record.description || null
    ]
  )
  
  // 프로젝트가 있는 경우 마감일 자동 업데이트
  if (projectId) {
    await updateProjectDueDate(projectId)
  }
}

// GMP Record 업데이트 (projectId가 null일 수 있음)
export async function updateGmpRecord(
  projectId: string | null,
  record: ProjectChild
): Promise<void> {
  const pool = getPool()
  
  // 기존 프로젝트 ID 조회 (프로젝트가 변경될 수 있으므로)
  const [existingRows] = await pool.query<any[]>(
    'SELECT project_id FROM gmp_records WHERE id = ?',
    [record.id]
  )
  const oldProjectId = existingRows.length > 0 ? existingRows[0].project_id : null
  
  const recordAny = record as any
  const kind = recordAny.kind || 'CC'
  const number = recordAny.number || 0
  const kindNumber = `${kind}-${String(number).padStart(5, '0')}`
  
  // 상태 자동 관리: 실적 진척도가 100%이면 "Completed", 그 외 Risk 체크
  let finalStatus = record.status
  if ((record.progress || 0) >= 100) {
    finalStatus = 'Completed'
  } else if (checkRiskStatus(record.start, record.due, record.progress || 0)) {
    finalStatus = 'Issued'
  }
  
  await pool.query(
    `UPDATE gmp_records 
     SET project_id = ?, title = ?, kind = ?, number = ?, kind_number = ?, owner = ?, status = ?, progress = ?, start = ?, due = ?, description = ?
     WHERE id = ?`,
    [
      projectId, 
      record.title, 
      kind,
      number,
      kindNumber,
      record.owner, 
      finalStatus, 
      record.progress || 0, 
      record.start || null, 
      record.due || null, 
      record.description || null, 
      record.id
    ]
  )
  
  // 프로젝트가 변경되었거나 업데이트된 경우 마감일 자동 업데이트
  if (oldProjectId && oldProjectId !== projectId) {
    // 이전 프로젝트의 마감일 업데이트
    await updateProjectDueDate(oldProjectId)
  }
  if (projectId) {
    // 새 프로젝트의 마감일 업데이트
    await updateProjectDueDate(projectId)
  }
}

// GMP Record 삭제
export async function deleteGmpRecord(
  projectId: string | null,
  recordId: string
): Promise<void> {
  const pool = getPool()
  try {
    // 삭제 전에 프로젝트 ID 확인 (projectId가 null일 수 있으므로)
    const [existingRows] = await pool.query<any[]>(
      'SELECT project_id FROM gmp_records WHERE id = ?',
      [recordId]
    )
    const actualProjectId = existingRows.length > 0 ? existingRows[0].project_id : null
    
    if (projectId) {
      const [result] = await pool.query<any[]>(
        'DELETE FROM gmp_records WHERE id = ? AND project_id = ?',
        [recordId, projectId]
      )
      // 삭제된 행이 없으면 에러 발생
      if (Array.isArray(result) && (result as any).affectedRows === 0) {
        throw new Error(`GMP Record ${recordId}를 프로젝트 ${projectId}에서 찾을 수 없습니다.`)
      }
    } else {
      const [result] = await pool.query<any[]>(
        'DELETE FROM gmp_records WHERE id = ? AND project_id IS NULL',
        [recordId]
      )
      // 삭제된 행이 없으면 에러 발생
      if (Array.isArray(result) && (result as any).affectedRows === 0) {
        throw new Error(`GMP Record ${recordId}를 찾을 수 없습니다.`)
      }
    }
    
    // 프로젝트가 있는 경우 마감일 자동 업데이트
    if (actualProjectId) {
      await updateProjectDueDate(actualProjectId)
    }
  } catch (error) {
    console.error('Error in deleteGmpRecord:', error)
    throw error
  }
}

// 다음 GMP Record ID 생성 (5자리 숫자)
export async function getNextGmpRecordId(): Promise<string> {
  const pool = getPool()
  const [rows] = await pool.query<any[]>(
    `SELECT id FROM gmp_records WHERE id LIKE 'GMP-%' ORDER BY id DESC LIMIT 1`
  )

  if (rows.length === 0) {
    return 'GMP-00001'
  }

  const lastId = rows[0].id
  const match = lastId.match(/GMP-(\d+)/)
  if (match) {
    const nextNum = parseInt(match[1], 10) + 1
    return `GMP-${String(nextNum).padStart(5, '0')}`
  }

  return 'GMP-00001'
}

// 특정 종류(kind)의 다음 번호 생성
export async function getNextGmpRecordNumberForKind(kind: string): Promise<number> {
  const pool = getPool()
  const [rows] = await pool.query<any[]>(
    `SELECT number FROM gmp_records WHERE kind = ? ORDER BY number DESC LIMIT 1`,
    [kind]
  )

  if (rows.length === 0) {
    return 0
  }

  const lastNumber = rows[0].number || 0
  return lastNumber + 1
}

// 이슈 관리 관련 함수들

// 모든 이슈 조회
export async function getAllIssues(): Promise<Issue[]> {
  const pool = getPool()
  const [issues] = await pool.query<any[]>(
    'SELECT * FROM issues ORDER BY occurred_date DESC, created_at DESC'
  )

  return issues.map((issue) => ({
    id: issue.id,
    title: issue.title,
    description: issue.description || '',
    status: issue.status,
    owner: issue.owner,
    occurred_date: issue.occurred_date ? (typeof issue.occurred_date === 'string' ? issue.occurred_date : new Date(issue.occurred_date).toISOString().slice(0, 10)) : '',
    due_date: issue.due_date ? (typeof issue.due_date === 'string' ? issue.due_date : new Date(issue.due_date).toISOString().slice(0, 10)) : '',
    resolved_date: issue.resolved_date ? (typeof issue.resolved_date === 'string' ? issue.resolved_date : new Date(issue.resolved_date).toISOString().slice(0, 10)) : '',
    sw_version: issue.sw_version || '',
    resolved_sw_version: issue.resolved_sw_version || '',
    cause: issue.cause || '',
    cause_category: issue.cause_category || '',
    module: issue.module || '',
    is_deviation: issue.is_deviation ? true : false,
    related_issue_id: issue.related_issue_id || '',
    created_at: issue.created_at ? (typeof issue.created_at === 'string' ? issue.created_at : new Date(issue.created_at).toISOString()) : '',
    updated_at: issue.updated_at ? (typeof issue.updated_at === 'string' ? issue.updated_at : new Date(issue.updated_at).toISOString()) : '',
  }))
}

// 이슈 추가
export async function addIssue(issue: Issue): Promise<void> {
  const pool = getPool()
  await pool.query(
    `INSERT INTO issues (id, title, description, status, owner, occurred_date, due_date, resolved_date, sw_version, resolved_sw_version, cause, cause_category, module, is_deviation, related_issue_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      issue.id,
      issue.title,
      issue.description || null,
      issue.status,
      issue.owner,
      issue.occurred_date || null,
      issue.due_date || null,
      issue.resolved_date || null,
      issue.sw_version || null,
      issue.resolved_sw_version || null,
      issue.cause || null,
      issue.cause_category || null,
      issue.module || null,
      issue.is_deviation ? 1 : 0,
      issue.related_issue_id || null,
    ]
  )
}

// 이슈 업데이트
export async function updateIssue(issue: Issue): Promise<void> {
  const pool = getPool()
  await pool.query(
    `UPDATE issues 
     SET title = ?, description = ?, status = ?, owner = ?, occurred_date = ?, due_date = ?, resolved_date = ?, sw_version = ?, resolved_sw_version = ?, cause = ?, cause_category = ?, module = ?, is_deviation = ?, related_issue_id = ?
     WHERE id = ?`,
    [
      issue.title,
      issue.description || null,
      issue.status,
      issue.owner,
      issue.occurred_date || null,
      issue.due_date || null,
      issue.resolved_date || null,
      issue.sw_version || null,
      issue.resolved_sw_version || null,
      issue.cause || null,
      issue.cause_category || null,
      issue.module || null,
      issue.is_deviation ? 1 : 0,
      issue.related_issue_id || null,
      issue.id,
    ]
  )
}

// 이슈 삭제
export async function deleteIssue(issueId: string): Promise<void> {
  const pool = getPool()
  await pool.query('DELETE FROM issues WHERE id = ?', [issueId])
}

// 다음 이슈 ID 생성
export async function getNextIssueId(): Promise<string> {
  const pool = getPool()
  const [rows] = await pool.query<any[]>(
    `SELECT id FROM issues WHERE id LIKE 'ISSUE-%' ORDER BY id DESC LIMIT 1`
  )

  if (rows.length === 0) {
    return 'ISSUE-00001'
  }

  const lastId = rows[0].id
  const match = lastId.match(/ISSUE-(\d+)/)
  if (match) {
    const nextNum = parseInt(match[1], 10) + 1
    return `ISSUE-${String(nextNum).padStart(5, '0')}`
  }

  return 'ISSUE-00001'
}

// 관련 이슈 조회 (재발 이슈 추적용)
export async function getRelatedIssues(issueId: string): Promise<Issue[]> {
  const pool = getPool()
  const [issues] = await pool.query<any[]>(
    'SELECT * FROM issues WHERE related_issue_id = ? ORDER BY occurred_date DESC',
    [issueId]
  )

  return issues.map((issue) => ({
    id: issue.id,
    title: issue.title,
    description: issue.description || '',
    status: issue.status,
    owner: issue.owner,
    occurred_date: issue.occurred_date ? (typeof issue.occurred_date === 'string' ? issue.occurred_date : new Date(issue.occurred_date).toISOString().slice(0, 10)) : '',
    due_date: issue.due_date ? (typeof issue.due_date === 'string' ? issue.due_date : new Date(issue.due_date).toISOString().slice(0, 10)) : '',
    resolved_date: issue.resolved_date ? (typeof issue.resolved_date === 'string' ? issue.resolved_date : new Date(issue.resolved_date).toISOString().slice(0, 10)) : '',
    sw_version: issue.sw_version || '',
    resolved_sw_version: issue.resolved_sw_version || '',
    cause: issue.cause || '',
    cause_category: issue.cause_category || '',
    module: issue.module || '',
    is_deviation: issue.is_deviation ? true : false,
    related_issue_id: issue.related_issue_id || '',
    created_at: issue.created_at ? (typeof issue.created_at === 'string' ? issue.created_at : new Date(issue.created_at).toISOString()) : '',
    updated_at: issue.updated_at ? (typeof issue.updated_at === 'string' ? issue.updated_at : new Date(issue.updated_at).toISOString()) : '',
  }))
}

// 전체 데이터베이스 검색
export interface SearchResult {
  projects: Array<Project & { type: 'project' }>
  tasks: Array<ProjectChild & { type: 'task'; projectId: string | null; projectName: string }>
  gmpRecords: Array<ProjectChild & { type: 'gmp-record'; projectId: string | null; projectName: string; kind_number?: string }>
}

export async function searchAll(keyword: string): Promise<SearchResult> {
  const pool = getPool()
  const searchPattern = `%${keyword}%`
  
  try {
    // 프로젝트 검색
    const [projects] = await pool.query<any[]>(
      `SELECT * FROM projects 
       WHERE name LIKE ? 
          OR id LIKE ? 
          OR owner LIKE ? 
          OR description LIKE ?
          OR srb_ver LIKE ?
       ORDER BY created_at DESC`,
      [searchPattern, searchPattern, searchPattern, searchPattern, searchPattern]
    )

    const projectsWithType: Array<Project & { type: 'project' }> = projects.map((project) => ({
      id: project.id,
      name: project.name,
      owner: project.owner,
      members: project.members,
      status: project.status,
      progress: project.progress,
      start: project.start ? (typeof project.start === 'string' ? project.start : new Date(project.start).toISOString().slice(0, 10)) : '',
      due: project.due ? (typeof project.due === 'string' ? project.due : new Date(project.due).toISOString().slice(0, 10)) : '',
      description: project.description || '',
      srb_ver: project.srb_ver || '',
      children: [],
      type: 'project' as const,
    }))

    // 일감 검색
    const [tasks] = await pool.query<any[]>(
      `SELECT pc.*, p.name as project_name, p.id as project_id
       FROM project_children pc
       LEFT JOIN projects p ON pc.project_id = p.id
       WHERE pc.title LIKE ? 
          OR pc.id LIKE ? 
          OR pc.owner LIKE ? 
          OR pc.description LIKE ?
       ORDER BY pc.created_at DESC`,
      [searchPattern, searchPattern, searchPattern, searchPattern]
    )

    const tasksWithType: Array<ProjectChild & { type: 'task'; projectId: string | null; projectName: string }> = tasks.map((task) => ({
      id: task.id,
      title: task.title,
      owner: task.owner,
      status: task.status,
      progress: task.progress || 0,
      start: task.start ? (typeof task.start === 'string' ? task.start : new Date(task.start).toISOString().slice(0, 10)) : '',
      due: task.due ? (typeof task.due === 'string' ? task.due : new Date(task.due).toISOString().slice(0, 10)) : '',
      description: task.description || '',
      type: 'task' as const,
      projectId: task.project_id || null,
      projectName: task.project_name || 'N/A',
    }))

    // GMP Record 검색
    const [gmpRecords] = await pool.query<any[]>(
      `SELECT g.*, p.name as project_name, p.id as project_id
       FROM gmp_records g
       LEFT JOIN projects p ON g.project_id = p.id
       WHERE g.title LIKE ? 
          OR g.id LIKE ? 
          OR g.owner LIKE ? 
          OR g.description LIKE ?
          OR g.kind_number LIKE ?
       ORDER BY g.created_at DESC`,
      [searchPattern, searchPattern, searchPattern, searchPattern, searchPattern]
    )

    const gmpRecordsWithType: Array<ProjectChild & { type: 'gmp-record'; projectId: string | null; projectName: string; kind_number?: string }> = gmpRecords.map((record) => {
      const kind = record.kind || 'CC'
      const number = record.number || 0
      const kindNumber = record.kind_number || `${kind}-${String(number).padStart(5, '0')}`
      
      return {
        id: record.id,
        title: record.title,
        owner: record.owner,
        status: record.status,
        progress: record.progress || 0,
        start: record.start ? (typeof record.start === 'string' ? record.start : new Date(record.start).toISOString().slice(0, 10)) : '',
        due: record.due ? (typeof record.due === 'string' ? record.due : new Date(record.due).toISOString().slice(0, 10)) : '',
        description: record.description || '',
        kind: kind,
        number: number,
        kind_number: kindNumber,
        type: 'gmp-record' as const,
        projectId: record.project_id || null,
        projectName: record.project_name || 'N/A',
      }
    })

    return {
      projects: projectsWithType,
      tasks: tasksWithType,
      gmpRecords: gmpRecordsWithType,
    }
  } catch (error) {
    console.error('Error in searchAll:', error)
    throw new Error(`검색 실패: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// 댓글 관리 관련 함수들

// 댓글 조회
export async function getComments(entityType: CommentEntityType, entityId: string): Promise<Comment[]> {
  const pool = getPool()
  const [comments] = await pool.query<any[]>(
    'SELECT * FROM comments WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC',
    [entityType, entityId]
  )

  return comments.map((comment) => ({
    id: comment.id,
    entity_type: comment.entity_type as CommentEntityType,
    entity_id: comment.entity_id,
    author: comment.author,
    content: comment.content,
    created_at: comment.created_at ? (typeof comment.created_at === 'string' ? comment.created_at : new Date(comment.created_at).toISOString()) : '',
    updated_at: comment.updated_at ? (typeof comment.updated_at === 'string' ? comment.updated_at : new Date(comment.updated_at).toISOString()) : '',
  }))
}

// 댓글 추가
export async function addComment(comment: Comment): Promise<void> {
  const pool = getPool()
  await pool.query(
    `INSERT INTO comments (id, entity_type, entity_id, author, content)
     VALUES (?, ?, ?, ?, ?)`,
    [comment.id, comment.entity_type, comment.entity_id, comment.author, comment.content]
  )
}

// 댓글 업데이트
export async function updateComment(commentId: string, content: string): Promise<void> {
  const pool = getPool()
  await pool.query(
    'UPDATE comments SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [content, commentId]
  )
}

// 댓글 삭제
export async function deleteComment(commentId: string): Promise<void> {
  const pool = getPool()
  await pool.query('DELETE FROM comments WHERE id = ?', [commentId])
}

// 다음 댓글 ID 생성
export async function getNextCommentId(): Promise<string> {
  const pool = getPool()
  const [rows] = await pool.query<any[]>(
    `SELECT id FROM comments WHERE id LIKE 'CMT-%' ORDER BY id DESC LIMIT 1`
  )

  if (rows.length === 0) {
    return 'CMT-00001'
  }

  const lastId = rows[0].id
  const match = lastId.match(/CMT-(\d+)/)
  if (match) {
    const nextNum = parseInt(match[1], 10) + 1
    return `CMT-${String(nextNum).padStart(5, '0')}`
  }

  return 'CMT-00001'
}

