import mysql from 'mysql2/promise'
import type { Project, ProjectChild } from '@/types/project'
import type { Issue } from '@/types/issue'
import type { Comment, CommentEntityType } from '@/types/comment'
import type { MeetingNote, ActionItem } from '@/types/meeting'
import { getUsers, createUser, getNextUserId } from '@/lib/users'

// MariaDB 연결 설정 (mysql2는 MariaDB와 호환됨)
const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'project_management',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  connectTimeout: 10000, // 10초 타임아웃
  // MariaDB/mysql2 호환을 위해 일부 옵션 제거
}

type GlobalDbState = typeof globalThis & {
  __itsmDbPool?: mysql.Pool | null
  __itsmDbPoolProxy?: mysql.Pool | null
}

const globalDbState = globalThis as GlobalDbState

// 연결 풀 생성
let pool: mysql.Pool | null = globalDbState.__itsmDbPool ?? null
let lastSuccessfulConnectionCheckAt = 0
const CONNECTION_CHECK_TTL_MS = 30_000

function wrapDbError(message: string, error: unknown): Error & { code?: string } {
  const wrapped = new Error(message) as Error & { code?: string }
  if (error && typeof error === 'object' && 'code' in error) {
    wrapped.code = String((error as { code?: unknown }).code || '')
  }
  return wrapped
}

// 연결 풀 재생성 함수
function recreatePool(): mysql.Pool {
  if (pool) {
    try {
      pool.end()
    } catch (error) {
      console.warn('Error closing old pool:', error)
    }
  }
  pool = mysql.createPool(dbConfig)
  globalDbState.__itsmDbPool = pool
  globalDbState.__itsmDbPoolProxy = null
  
  // 연결 오류 핸들러 (타입 단언 사용)
  ;(pool as any).on('error', (err: any) => {
    console.error('Database pool error:', err)
    if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ECONNRESET') {
      console.log('Attempting to recreate pool...')
      pool = null
      globalDbState.__itsmDbPool = null
      globalDbState.__itsmDbPoolProxy = null
    }
  })
  
  return pool
}

/** "Pool is closed" 발생 시 풀 재생성 후 한 번 재시도하도록 래핑 */
function wrapPoolWithAutoRecreate(p: mysql.Pool): mysql.Pool {
  const isPoolClosed = (err: unknown) =>
    err && typeof (err as Error).message === 'string' && String((err as Error).message).includes('Pool is closed')

  return new Proxy(p, {
    get(target, prop: string) {
      const v = (target as any)[prop]
      if (prop === 'query' && typeof v === 'function') {
        return function (...args: unknown[]) {
          return (v as any).apply(target, args as any[]).catch((err: unknown) => {
            if (isPoolClosed(err)) {
              console.warn('[DB] Pool is closed, recreating pool...')
              pool = null
              const newPool = recreatePool()
              return (newPool as any).query(...(args as any[]))
            }
            throw err
          })
        }
      }
      if (prop === 'getConnection' && typeof v === 'function') {
        return function (...args: unknown[]) {
          return (v as any).apply(target, args as any[]).catch((err: unknown) => {
            if (isPoolClosed(err)) {
              console.warn('[DB] Pool is closed, recreating pool...')
              pool = null
              const newPool = recreatePool()
              return (newPool as any).getConnection(...(args as any[]))
            }
            throw err
          })
        }
      }
      return typeof v === 'function' ? v.bind(target) : v
    },
  }) as mysql.Pool
}

export function getPool(): mysql.Pool {
  if (!pool) {
    pool = recreatePool()
  }
  if (!globalDbState.__itsmDbPoolProxy) {
    globalDbState.__itsmDbPoolProxy = wrapPoolWithAutoRecreate(pool)
  }
  return globalDbState.__itsmDbPoolProxy
}

// 연결 테스트 함수
export async function testConnection(maxRetries: number = 1): Promise<boolean> {
  const now = Date.now()
  if (now - lastSuccessfulConnectionCheckAt < CONNECTION_CHECK_TTL_MS) {
    return true
  }
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const currentPool = pool || getPool()
      const connection = await currentPool.getConnection()
      await connection.ping()
      connection.release()
      lastSuccessfulConnectionCheckAt = Date.now()
      return true
    } catch (error: any) {
      if (attempt < maxRetries) {
        // 연결 풀 재생성 시도
        pool = null
        await new Promise(resolve => setTimeout(resolve, 500)) // 500ms 대기
        continue
      }
      return false
    }
  }
  return false
}

// MariaDB 데이터베이스 초기화 (기본 테이블 생성)
// 참고: 모든 테이블은 npm run setup-db를 통해 생성됩니다
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

    // val_packages 테이블 생성 (프로젝트와 동일한 구조)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS val_packages (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        owner VARCHAR(100) NOT NULL,
        members INT NOT NULL DEFAULT 1,
        status VARCHAR(50) NOT NULL DEFAULT 'Planning',
        progress INT NOT NULL DEFAULT 0,
        start DATE,
        due DATE NOT NULL,
        description TEXT,
        srb_ver VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    // val_package_task_links 테이블 생성 (VAL Pkg와 일감 간 다대다 관계)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS val_package_task_links (
        id INT AUTO_INCREMENT PRIMARY KEY,
        val_package_id VARCHAR(50) NOT NULL,
        task_id VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_link (val_package_id, task_id),
        FOREIGN KEY (val_package_id) REFERENCES val_packages(id) ON DELETE CASCADE,
        FOREIGN KEY (task_id) REFERENCES project_children(id) ON DELETE CASCADE,
        INDEX idx_val_package_id (val_package_id),
        INDEX idx_task_id (task_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
  } finally {
    await connection.end()
  }
}

type ProjectPayloadDetail = 'full' | 'lite'

function toIsoDateValue(value: any, fallback: string): string {
  if (!value) return fallback
  return typeof value === 'string' ? value : new Date(value).toISOString().slice(0, 10)
}

function parseTaskPhases(raw: any) {
  if (!raw) return null
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw
  } catch {
    return null
  }
}

function mapProjectChildRow(
  child: any,
  today: string,
  detail: ProjectPayloadDetail,
  valPackageLinks?: Map<string, any[]>
): ProjectChild {
  const baseChild: ProjectChild = {
    id: child.id,
    title: child.title,
    owner: child.owner,
    status: child.status,
    progress: child.progress || 0,
    start: toIsoDateValue(child.start, today),
    due: toIsoDateValue(child.due, ''),
  }

  if (detail === 'lite') {
    return baseChild
  }

  return {
    ...baseChild,
    description: child.description || '',
    issue_reason: child.issue_reason || null,
    phases: parseTaskPhases(child.phases),
    linked_gmp_record_id: child.linked_gmp_record_id || null,
    linked_issue_id: child.linked_issue_id || null,
    linked_val_packages: valPackageLinks?.get(child.id) || [],
  } as ProjectChild
}

function mapGmpRecordRow(record: any, today: string, detail: ProjectPayloadDetail): ProjectChild {
  const kind = record.kind || 'CC'
  const number = record.number || 0
  const kindNumber = record.kind_number || `${kind}-${String(number).padStart(5, '0')}`
  const baseRecord: ProjectChild = {
    id: record.id,
    title: record.title,
    owner: record.owner,
    status: record.status,
    progress: record.progress || 0,
    start: toIsoDateValue(record.start, today),
    due: toIsoDateValue(record.due, ''),
    kind,
    number,
    kind_number: kindNumber,
    isGmpRecord: true,
  }

  if (detail === 'lite') {
    return baseRecord
  }

  return {
    ...baseRecord,
    description: record.description || '',
    linked_task_id: record.linked_task_id || null,
    linked_issue_id: record.linked_issue_id || null,
  }
}

// 프로젝트 조회 (최적화: N+1 문제 해결)
export async function getProjects(detail: ProjectPayloadDetail = 'full'): Promise<Project[]> {
  let retries = 2
  while (retries > 0) {
    try {
      const pool = getPool()
      const [projects] = await pool.query<any[]>(
        'SELECT * FROM projects ORDER BY created_at DESC'
      )

    if (projects.length === 0) {
      return []
    }

    const projectIds = projects.map(p => p.id)
    const placeholders = projectIds.map(() => '?').join(',')

    // 모든 일감을 한 번에 조회 (배치 쿼리)
    const [allChildren] = await pool.query<any[]>(
      `SELECT * FROM project_children WHERE project_id IN (${placeholders}) AND id NOT LIKE "GMP-%" ORDER BY project_id, created_at ASC`,
      projectIds
    )

    // 모든 GMP Record를 한 번에 조회 (배치 쿼리)
    const [allGmpRecords] = await pool.query<any[]>(
      `SELECT * FROM gmp_records WHERE project_id IN (${placeholders}) ORDER BY project_id, created_at ASC`,
      projectIds
    )

      // 모든 일감의 VAL Pkg 링크 조회
    const allChildIds = allChildren.map(c => c.id)
    let valPackageLinks = new Map<string, any[]>()
      if (detail === 'full' && allChildIds.length > 0) {
      const childPlaceholders = allChildIds.map(() => '?').join(',')
      const [links] = await pool.query<any[]>(
        `SELECT vptl.task_id, vp.id as val_package_id, vp.name as val_package_name
         FROM val_package_task_links vptl
         INNER JOIN val_packages vp ON vptl.val_package_id = vp.id
         WHERE vptl.task_id IN (${childPlaceholders})`,
        allChildIds
      )
      links.forEach((link) => {
        if (!valPackageLinks.has(link.task_id)) {
          valPackageLinks.set(link.task_id, [])
        }
        valPackageLinks.get(link.task_id)!.push({
          id: link.val_package_id,
          name: link.val_package_name,
        })
      })
    }

    // 프로젝트별로 일감과 GMP Record를 그룹화
    const childrenByProject = new Map<string, any[]>()
    const gmpRecordsByProject = new Map<string, any[]>()

    allChildren.forEach((child) => {
      if (!childrenByProject.has(child.project_id)) {
        childrenByProject.set(child.project_id, [])
      }
      childrenByProject.get(child.project_id)!.push(child)
    })

    allGmpRecords.forEach((record) => {
      if (!gmpRecordsByProject.has(record.project_id)) {
        gmpRecordsByProject.set(record.project_id, [])
      }
      gmpRecordsByProject.get(record.project_id)!.push(record)
    })

    const projectsWithChildren: Project[] = []
    const today = new Date().toISOString().slice(0, 10)

    for (const project of projects) {
      // 프로젝트별 일감 가져오기
      const children = childrenByProject.get(project.id) || []
      const gmpRecords = gmpRecordsByProject.get(project.id) || []

      const childrenList: ProjectChild[] = children.map((child) =>
        mapProjectChildRow(child, today, detail, valPackageLinks)
      )

      const gmpRecordsList: ProjectChild[] = gmpRecords.map((record) =>
        mapGmpRecordRow(record, today, detail)
      )

      // 일반 일감과 GMP Record를 합쳐서 정렬
      // ID 기준으로 중복 제거 (GMP Record가 우선)
      const childrenMap = new Map<string, any>()
      
      // 먼저 일반 일감 추가
      childrenList.forEach((child) => {
        childrenMap.set(child.id, child)
      })
      
      // GMP Record 추가 (같은 ID가 있으면 덮어씀)
      gmpRecordsList.forEach((record) => {
        childrenMap.set(record.id, record)
      })
      
      const allChildren = Array.from(childrenMap.values()).sort((a, b) => {
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
        has_cc: project.has_cc || false,
        cc_number: project.cc_number || null,
        children: allChildren,
      })
    }

      return projectsWithChildren
    } catch (error: any) {
      retries--
      
      if (retries === 0) {
        // 마지막 시도 실패 시 연결 풀 재생성
        pool = null
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        const errorCode = error.code || 'UNKNOWN_ERROR'
        throw wrapDbError(`데이터베이스 조회 실패 [${errorCode}]: ${errorMessage}`, error)
      }
      
      // 재시도 전 잠시 대기
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }
  
  // 이 코드는 실행되지 않아야 하지만 타입 체크를 위해 필요
  throw new Error('Unexpected error in getProjects')
}

// 프로젝트가 없는 일감 조회 (N/A 일감, Dropped 포함 - 일감 목록에서 표시하기 위해)
export async function getOrphanTasks(detail: ProjectPayloadDetail = 'full'): Promise<ProjectChild[]> {
  let retries = 2
  while (retries > 0) {
    try {
      const pool = getPool()
      const [tasks] = await pool.query<any[]>(
        "SELECT * FROM project_children WHERE project_id IS NULL ORDER BY created_at ASC"
      )

      // VAL Pkg 링크 조회
      const taskIds = tasks.map(t => t.id)
      let valPackageLinks = new Map<string, any[]>()
      if (detail === 'full' && taskIds.length > 0) {
        const placeholders = taskIds.map(() => '?').join(',')
        const [links] = await pool.query<any[]>(
          `SELECT vptl.task_id, vp.id as val_package_id, vp.name as val_package_name
           FROM val_package_task_links vptl
           INNER JOIN val_packages vp ON vptl.val_package_id = vp.id
           WHERE vptl.task_id IN (${placeholders})`,
          taskIds
        )
        links.forEach((link) => {
          if (!valPackageLinks.has(link.task_id)) {
            valPackageLinks.set(link.task_id, [])
          }
          valPackageLinks.get(link.task_id)!.push({
            id: link.val_package_id,
            name: link.val_package_name,
          })
        })
      }

      const today = new Date().toISOString().slice(0, 10)
      return tasks.map((task) => mapProjectChildRow(task, today, detail, valPackageLinks))
    } catch (error: any) {
      retries--
      if (retries === 0) {
        pool = null
        if (process.env.NODE_ENV === 'development') {
          console.error('Error in getOrphanTasks (final attempt):', error)
        }
        throw wrapDbError(
          `Orphan Task 조회 실패: ${error instanceof Error ? error.message : 'Unknown error'}`,
          error
        )
      }
      
      await new Promise(resolve => setTimeout(resolve, 500))
      if (process.env.NODE_ENV === 'development') {
        console.warn(`Retrying getOrphanTasks... (${retries} attempts remaining)`)
      }
    }
  }
  
  throw new Error('Unexpected error in getOrphanTasks')
}

// 프로젝트 추가
export async function createProject(project: Project): Promise<void> {
  const pool = getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    // 프로젝트 추가
    await connection.query(
      `INSERT INTO projects (id, name, owner, members, status, progress, start, due, description, srb_ver, has_cc, cc_number)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        (project as any).has_cc || false,
        (project as any).cc_number || null,
      ]
    )

    // 하위 아이템 추가
    if (project.children && project.children.length > 0) {
      for (const child of project.children) {
        const phasesJson = (child as any).phases ? JSON.stringify((child as any).phases) : null
        await connection.query(
          `INSERT INTO project_children (id, project_id, title, owner, status, progress, due, description, phases)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [child.id, project.id, child.title, child.owner, child.status, child.progress || 0, child.due || null, child.description || null, phasesJson]
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

    // 상태 자동 관리: 실적 진척도가 100%이면 "Completed", 그 외 Risk 체크, 0%보다 크면 "In Progress"
    let finalStatus = project.status
    if (project.progress >= 100) {
      finalStatus = 'Completed'
    } else if (checkRiskStatus(project.start, project.due, project.progress || 0)) {
      finalStatus = 'Issued'
    } else if (project.progress > 0) {
      finalStatus = 'In Progress'
    }

    // 프로젝트 업데이트
    await connection.query(
      `UPDATE projects 
       SET name = ?, owner = ?, members = ?, status = ?, progress = ?, start = ?, due = ?, description = ?, srb_ver = ?, has_cc = ?, cc_number = ?
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
        (project as any).has_cc || false,
        (project as any).cc_number || null,
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
        
        const phasesJson = (child as any).phases ? JSON.stringify((child as any).phases) : null
        await connection.query(
          `INSERT INTO project_children (id, project_id, title, owner, status, progress, start, due, description, phases)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [child.id, project.id, child.title, child.owner, child.status, child.progress || 0, (child as any).start || null, child.due || null, child.description || null, phasesJson]
        )
      }
    }

    // 하위 아이템이 있으면 마감일 자동 업데이트 (트랜잭션 내에서)
    await updateProjectDueDateWithConnection(connection, project.id)
    
    await connection.commit()
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

// Risk 체크: 계획 진척도가 실적 진척도보다 10% 이상 높은지 확인 (계획이 실적보다 뒤처진 경우만)
function checkRiskStatus(start: string | null | undefined, due: string | null | undefined, actualProgress: number): boolean {
  const plannedProgress = calculatePlannedProgress(start, due)
  const difference = plannedProgress - actualProgress
  return difference >= 10 // 계획이 실적보다 10% 이상 높은 경우만 true
}

// 하위 아이템 추가 (projectId가 null일 수 있음)
// 프로젝트의 마감일을 하위 아이템의 가장 늦은 마감일로 자동 업데이트
async function updateProjectDueDate(projectId: string): Promise<void> {
  const pool = getPool()
  await updateProjectDueDateWithConnection(pool, projectId)
}

// connection을 받아서 마감일 업데이트 (트랜잭션 내부에서 사용)
async function updateProjectDueDateWithConnection(
  connection: mysql.PoolConnection | mysql.Pool,
  projectId: string
): Promise<void> {
  // 일반 일감 조회
  const [children] = await connection.query<any[]>(
    'SELECT due FROM project_children WHERE project_id = ? AND due IS NOT NULL AND due != ""',
    [projectId]
  )
  
  // GMP Record 조회
  const [gmpRecords] = await connection.query<any[]>(
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
    await connection.query(
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
  const phasesJson = (child as any).phases ? JSON.stringify((child as any).phases) : null
  const linkedGmpRecordId = (child as any).linked_gmp_record_id || null
  const linkedIssueId = (child as any).linked_issue_id || null
  const issueReason = (child as any).issue_reason || null
  await pool.query(
    `INSERT INTO project_children (id, project_id, title, owner, status, progress, start, due, description, phases, linked_gmp_record_id, linked_issue_id, issue_reason)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [child.id, projectId, child.title, child.owner, child.status, child.progress || 0, child.start || null, child.due || null, child.description || null, phasesJson, linkedGmpRecordId, linkedIssueId, issueReason]
  )
  
  // 프로젝트가 있는 경우 마감일 자동 업데이트
  if (projectId) {
    await updateProjectDueDate(projectId)
  }

  try {
    const { syncProjectChildRowToGantt } = await import('@/lib/gantt-project-child-sync')
    await syncProjectChildRowToGantt(projectId, child)
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[addChildToProject] gantt sync skipped:', e)
    }
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
  
  // Issue 상태 체크 함수
  const checkIssueStatus = async (taskId: string, projectId: string | null, due: string | null): Promise<{ isIssue: boolean; reason: string | null }> => {
    if (!due) {
      return { isIssue: false, reason: null }
    }

    // 마감일 2개월 전인지 체크
    const dueDate = new Date(due)
    const twoMonthsBefore = new Date(dueDate)
    twoMonthsBefore.setMonth(twoMonthsBefore.getMonth() - 2)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    twoMonthsBefore.setHours(0, 0, 0, 0)

    if (today < twoMonthsBefore) {
      return { isIssue: false, reason: null }
    }

    // Val Pkg 연결 확인
    const [valPackageLinks] = await pool.query<any[]>(
      'SELECT COUNT(*) as count FROM val_package_task_links WHERE task_id = ?',
      [taskId]
    )
    const hasValPackage = valPackageLinks[0]?.count > 0

    // 프로젝트에 CC가 있는지 확인
    let hasProjectCc = false
    if (projectId) {
      // 프로젝트의 CC 확인
      const [projectRows] = await pool.query<any[]>(
        'SELECT has_cc, cc_number FROM projects WHERE id = ?',
        [projectId]
      )
      if (projectRows.length > 0) {
        const project = projectRows[0]
        if (project.has_cc && project.cc_number) {
          hasProjectCc = true
        }
      }

      // 프로젝트에 연결된 GMP Record CC 확인
      if (!hasProjectCc) {
        const [ccRecords] = await pool.query<any[]>(
          'SELECT COUNT(*) as count FROM gmp_records WHERE project_id = ? AND kind = "CC"',
          [projectId]
        )
        hasProjectCc = ccRecords[0]?.count > 0
      }
    }

    // Issue 조건: 마감일 2개월 전이고, Val Pkg 연결이 없고, 프로젝트에 CC가 없는 경우
    if (!hasValPackage && !hasProjectCc) {
      const reasons: string[] = []
      if (!hasValPackage) {
        reasons.push('VAL Pkg가 연결되지 않았습니다')
      }
      if (!hasProjectCc) {
        reasons.push('프로젝트에 CC가 연결되지 않았습니다')
      }
      return {
        isIssue: true,
        reason: `마감일 2개월 전까지 다음 조건을 만족해야 합니다:\n- ${reasons.join('\n- ')}\n\n해결 방법:\n- 일감에 VAL Pkg를 연결하거나\n- 프로젝트에 현업 CC를 연결하세요`
      }
    }

    return { isIssue: false, reason: null }
  }

  // 상태 자동 관리: Dropped 상태는 유지, 그 외 실적 진척도가 100%이면 "Completed", 그 외 Issue 체크, Risk 체크, 0%보다 크면 "In Progress"
  let finalStatus = child.status
  let issueReason: string | null = (child as any).issue_reason || null

  // Dropped 상태는 진행률이 100%여도 Completed로 변경하지 않음
  if (child.status === 'Dropped') {
    finalStatus = 'Dropped'
    issueReason = null
  } else if ((child.progress || 0) >= 100) {
    finalStatus = 'Completed'
    issueReason = null // 완료되면 Issue 해결
  } else {
    // Issue 상태 체크 (일감만, GMP Record는 제외)
    const isGmpRecord = !!(child as any).kind_number || !!(child as any).isGmpRecord
    if (!isGmpRecord) {
      const issueCheck = await checkIssueStatus(child.id, projectId, child.due || null)
      if (issueCheck.isIssue) {
        finalStatus = 'Issue'
        issueReason = issueCheck.reason
      } else {
        // Issue가 아니면 issue_reason 삭제
        issueReason = null
        // 기존 로직
        if (checkRiskStatus(child.start, child.due, child.progress || 0)) {
          finalStatus = 'Issued'
        } else if ((child.progress || 0) > 0) {
          finalStatus = 'In Progress'
        } else {
          finalStatus = 'Planning'
        }
      }
    } else {
      // GMP Record는 기존 로직
      issueReason = null
      if (checkRiskStatus(child.start, child.due, child.progress || 0)) {
        finalStatus = 'Issued'
      } else if ((child.progress || 0) > 0) {
        finalStatus = 'In Progress'
      }
    }
  }
  
  const phasesJson = (child as any).phases ? JSON.stringify((child as any).phases) : null
  const linkedGmpRecordId = (child as any).linked_gmp_record_id || null
  const linkedIssueId = (child as any).linked_issue_id || null
  await pool.query(
    `UPDATE project_children 
     SET project_id = ?, title = ?, owner = ?, status = ?, progress = ?, start = ?, due = ?, description = ?, phases = ?, linked_gmp_record_id = ?, linked_issue_id = ?, issue_reason = ?
     WHERE id = ?`,
    [projectId, child.title, child.owner, finalStatus, child.progress || 0, child.start || null, child.due || null, child.description || null, phasesJson, linkedGmpRecordId, linkedIssueId, issueReason, child.id]
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

  try {
    const { syncProjectChildRowToGantt } = await import('@/lib/gantt-project-child-sync')
    await syncProjectChildRowToGantt(projectId, {
      ...child,
      status: finalStatus,
    })
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[updateChild] gantt sync skipped:', e)
    }
  }
}

/** 일감(project_children)의 연결 이슈 ID만 설정 (이슈 ↔ 일감 링크) */
export async function setTaskLinkedIssueId(taskId: string, issueId: string | null): Promise<void> {
  const pool = getPool()
  await pool.query(
    'UPDATE project_children SET linked_issue_id = ? WHERE id = ?',
    [issueId, taskId]
  )
}

/** 해당 이슈에 연결된 모든 일감의 linked_issue_id 해제 */
export async function clearTaskLinksByIssueId(issueId: string): Promise<void> {
  const pool = getPool()
  await pool.query(
    'UPDATE project_children SET linked_issue_id = NULL WHERE linked_issue_id = ?',
    [issueId]
  )
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

    try {
      const { deleteGanttTaskByProjectChildId } = await import('@/lib/gantt-project-child-sync')
      await deleteGanttTaskByProjectChildId(childId)
    } catch (e) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[deleteChild] gantt row delete skipped:', e)
      }
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Error in deleteChild:', error)
    }
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
  let retries = 2
  while (retries > 0) {
    try {
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
        let phases = null
        if (record.phases) {
          try {
            phases = typeof record.phases === 'string' ? JSON.parse(record.phases) : record.phases
          } catch (e) {
            phases = null
          }
        }
        
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
          phases: phases,
          linked_task_id: record.linked_task_id || null,
          linked_issue_id: record.linked_issue_id || null,
        }
      })
    } catch (error: any) {
      retries--
      if (retries === 0) {
        pool = null
        if (process.env.NODE_ENV === 'development') {
          console.error('Error in getAllGmpRecords (final attempt):', error)
        }
        throw wrapDbError(
          `GMP Record 조회 실패: ${error instanceof Error ? error.message : 'Unknown error'}`,
          error
        )
      }
      
      await new Promise(resolve => setTimeout(resolve, 500))
      if (process.env.NODE_ENV === 'development') {
        console.warn(`Retrying getAllGmpRecords... (${retries} attempts remaining)`)
      }
    }
  }
  
  throw new Error('Unexpected error in getAllGmpRecords')
}

// GMP Record 추가 (projectId가 null일 수 있음)
export async function addGmpRecord(
  projectId: string | null,
  record: ProjectChild
): Promise<string | null> {
  const pool = getPool()
  const recordAny = record as any
  const kind = recordAny.kind || 'CC'
  const number = recordAny.number || 0
  const kindNumber = `${kind}-${String(number).padStart(5, '0')}`
  
  const phasesJson = (record as any).phases ? JSON.stringify((record as any).phases) : null
  const linkedTaskId = recordAny.linked_task_id || null
  const linkedIssueId = recordAny.linked_issue_id || null

  await pool.query(
    `INSERT INTO gmp_records (id, project_id, title, kind, number, kind_number, owner, status, progress, start, due, description, phases, linked_task_id, linked_issue_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      record.description || null,
      phasesJson,
      linkedTaskId,
      linkedIssueId,
    ]
  )
  
  // CPA 종류인 경우 일감 자동 생성
  let createdTaskId: string | null = null
  if (kind === 'CPA') {
    try {
      const taskId = await getNextTaskId()
      const phases = (record as any).phases || {}
      
      // 그룹 매니저 확인/생성 (일감·PI 담당은 그룹 매니저에서 시작)
      const users = await getUsers()
      let groupManager = users.find(u => u.role === '그룹 매니저')
      
      if (!groupManager) {
        const userId = await getNextUserId()
        await createUser({
          id: userId,
          name: '그룹 매니저',
          email: undefined,
          role: '그룹 매니저',
        })
        groupManager = { id: userId, name: '그룹 매니저', role: '그룹 매니저' }
      }
      
      // 일감 phases 설정 (PI·개발 모두 그룹 매니저에서 시작, 이후 파트 매니저→파트원으로 재할당 가능)
      const taskPhases = {
        pi: {
          owner: groupManager!.name,
          status: phases.pi?.status || 'Planning',
          progress: phases.pi?.progress || 0,
          start: phases.pi?.start || phases.start || new Date().toISOString().slice(0, 10),
          due: phases.pi?.due || phases.due || '',
        },
        development: {
          owner: groupManager!.name,
          status: phases.development?.status || 'Planning',
          progress: phases.development?.progress || 0,
          start: phases.development?.start || phases.start || new Date().toISOString().slice(0, 10),
          due: phases.development?.due || phases.due || '',
        },
      }
      
      // 일감 생성
      const linkedTask: ProjectChild = {
        id: taskId,
        title: record.title,
        owner: groupManager!.name, // 대표 담당자: 그룹 매니저에서 시작
        status: record.status,
        progress: record.progress || 0,
        start: record.start,
        due: record.due,
        description: record.description,
        phases: taskPhases,
        linked_gmp_record_id: record.id,
      } as any
      
      await addChildToProject(projectId, linkedTask)
      createdTaskId = taskId
      
      // GMP Record에 linked_task_id 업데이트
      await pool.query(
        'UPDATE gmp_records SET linked_task_id = ? WHERE id = ?',
        [taskId, record.id]
      )
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('CPA 일감 자동 생성 실패:', error)
      }
      // 일감 생성 실패해도 GMP Record 저장은 성공한 것으로 처리
    }
  }
  
  // 프로젝트가 있는 경우 마감일 자동 업데이트
  if (projectId) {
    await updateProjectDueDate(projectId)
  }
  
  return createdTaskId
}

// GMP Record 업데이트 (projectId가 null일 수 있음)
export async function updateGmpRecord(
  projectId: string | null,
  record: ProjectChild
): Promise<void> {
  const pool = getPool()
  
  // 기존 프로젝트 ID 및 linked_task_id 조회
  const [existingRows] = await pool.query<any[]>(
    'SELECT project_id, linked_task_id, kind FROM gmp_records WHERE id = ?',
    [record.id]
  )
  const oldProjectId = existingRows.length > 0 ? existingRows[0].project_id : null
  const existingLinkedTaskId = existingRows.length > 0 ? existingRows[0].linked_task_id : null
  const existingKind = existingRows.length > 0 ? existingRows[0].kind : 'CC'
  
  const recordAny = record as any
  const kind = recordAny.kind || 'CC'
  const number = recordAny.number || 0
  const kindNumber = `${kind}-${String(number).padStart(5, '0')}`
  
  // CPA 종류이고 linked_task_id가 없으면 일감 생성
  let linkedTaskId = recordAny.linked_task_id || existingLinkedTaskId
  if (kind === 'CPA' && !linkedTaskId) {
    try {
      const taskId = await getNextTaskId()
      const phases = (record as any).phases || {}
      
      // 그룹 매니저 확인/생성 (일감·PI 담당은 그룹 매니저에서 시작)
      const users = await getUsers()
      let groupManager = users.find(u => u.role === '그룹 매니저')
      
      if (!groupManager) {
        const userId = await getNextUserId()
        await createUser({
          id: userId,
          name: '그룹 매니저',
          email: undefined,
          role: '그룹 매니저',
        })
        groupManager = { id: userId, name: '그룹 매니저', role: '그룹 매니저' }
      }
      
      // 일감 phases 설정 (PI·개발 모두 그룹 매니저에서 시작)
      const taskPhases = {
        pi: {
          owner: groupManager!.name,
          status: phases.pi?.status || 'Planning',
          progress: phases.pi?.progress || 0,
          start: phases.pi?.start || phases.start || new Date().toISOString().slice(0, 10),
          due: phases.pi?.due || phases.due || '',
        },
        development: {
          owner: groupManager!.name,
          status: phases.development?.status || 'Planning',
          progress: phases.development?.progress || 0,
          start: phases.development?.start || phases.start || new Date().toISOString().slice(0, 10),
          due: phases.development?.due || phases.due || '',
        },
      }
      
      // 일감 생성
      const linkedTask: ProjectChild = {
        id: taskId,
        title: record.title,
        owner: groupManager!.name,
        status: record.status,
        progress: record.progress || 0,
        start: record.start,
        due: record.due,
        description: record.description,
        phases: taskPhases,
        linked_gmp_record_id: record.id,
      } as any
      
      await addChildToProject(projectId, linkedTask)
      linkedTaskId = taskId
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('CPA 일감 자동 생성 실패:', error)
      }
    }
  }
  
  // CPA 종류인 경우 Link된 일감이 Completed되지 않았으면 Completed 상태로 전환 불가
  if (kind === 'CPA' && linkedTaskId) {
    const [linkedTask] = await pool.query<any[]>(
      'SELECT status FROM project_children WHERE id = ?',
      [linkedTaskId]
    )
    if (linkedTask.length > 0 && linkedTask[0].status !== 'Completed' && record.status === 'Completed') {
      throw new Error('Link된 일감이 Completed 상태가 아니면 GMP Record를 Completed로 변경할 수 없습니다.')
    }
  }
  
  // 상태 자동 관리: 실적 진척도가 100%이면 "Completed", 그 외 Risk 체크, 0%보다 크면 "In Progress"
  let finalStatus = record.status
  if ((record.progress || 0) >= 100) {
    finalStatus = 'Completed'
  } else if (checkRiskStatus(record.start, record.due, record.progress || 0)) {
    finalStatus = 'Issued'
  } else if ((record.progress || 0) > 0) {
    finalStatus = 'In Progress'
  }
  
  // CPA 종류이고 Link된 일감이 Completed되지 않았으면 Completed 상태로 전환 불가
  if (kind === 'CPA' && linkedTaskId && finalStatus === 'Completed') {
    const [linkedTask] = await pool.query<any[]>(
      'SELECT status FROM project_children WHERE id = ?',
      [linkedTaskId]
    )
    if (linkedTask.length > 0 && linkedTask[0].status !== 'Completed') {
      finalStatus = record.status // 원래 상태 유지
    }
  }
  
  const phasesJson = (record as any).phases ? JSON.stringify((record as any).phases) : null
  const linkedIssueId = (record as any).linked_issue_id || null
  await pool.query(
    `UPDATE gmp_records 
     SET project_id = ?, title = ?, kind = ?, number = ?, kind_number = ?, owner = ?, status = ?, progress = ?, start = ?, due = ?, description = ?, phases = ?, linked_task_id = ?, linked_issue_id = ?
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
      phasesJson,
      linkedTaskId,
      linkedIssueId,
      record.id,
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
    if (process.env.NODE_ENV === 'development') {
      console.error('Error in deleteGmpRecord:', error)
    }
    throw error
  }
}

// 프로젝트 없는 GMP Record 조회
export async function getOrphanGmpRecords(): Promise<Array<ProjectChild & { kind_number?: string }>> {
  let retries = 2
  while (retries > 0) {
    try {
      // 연결 테스트
      const isConnected = await testConnection()
      if (!isConnected) {
        throw new Error('Database connection failed')
      }
      
      const pool = getPool()
      const [records] = await pool.query<any[]>(
        "SELECT * FROM gmp_records WHERE project_id IS NULL ORDER BY created_at ASC"
      )

      const today = new Date().toISOString().slice(0, 10)
      return records.map((record) => {
        const kind = record.kind || 'CC'
        const number = record.number || 0
        const kindNumber = `${kind}-${String(number).padStart(5, '0')}`
        let phases = null
        if (record.phases) {
          try {
            phases = typeof record.phases === 'string' ? JSON.parse(record.phases) : record.phases
          } catch (e) {
            phases = null
          }
        }
        
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
          phases: phases,
          linked_task_id: record.linked_task_id || null,
          linked_issue_id: record.linked_issue_id || null,
        }
      })
    } catch (error: any) {
      retries--
      if (retries === 0) {
        pool = null
        if (process.env.NODE_ENV === 'development') {
          console.error('Error in getOrphanGmpRecords (final attempt):', error)
        }
        throw new Error(`Orphan GMP Record 조회 실패: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
      
      await new Promise(resolve => setTimeout(resolve, 500))
      if (process.env.NODE_ENV === 'development') {
        console.warn(`Retrying getOrphanGmpRecords... (${retries} attempts remaining)`)
      }
    }
  }
  
  throw new Error('Unexpected error in getOrphanGmpRecords')
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
  let retries = 2
  while (retries > 0) {
    try {
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
        linked_gmp_record_id: issue.linked_gmp_record_id || '',
        linked_task_id: issue.linked_task_id || '',
        created_at: issue.created_at ? (typeof issue.created_at === 'string' ? issue.created_at : new Date(issue.created_at).toISOString()) : '',
        updated_at: issue.updated_at ? (typeof issue.updated_at === 'string' ? issue.updated_at : new Date(issue.updated_at).toISOString()) : '',
      }))
    } catch (error: any) {
      retries--
      if (retries === 0) {
        pool = null
        if (process.env.NODE_ENV === 'development') {
          console.error('Error in getAllIssues (final attempt):', error)
        }
        throw wrapDbError(
          `이슈 조회 실패: ${error instanceof Error ? error.message : 'Unknown error'}`,
          error
        )
      }
      
      await new Promise(resolve => setTimeout(resolve, 500))
      if (process.env.NODE_ENV === 'development') {
        console.warn(`Retrying getAllIssues... (${retries} attempts remaining)`)
      }
    }
  }
  
  throw new Error('Unexpected error in getAllIssues')
}

// 이슈 추가
export async function addIssue(issue: Issue): Promise<void> {
  const pool = getPool()
  await pool.query(
    `INSERT INTO issues (id, title, description, status, owner, occurred_date, due_date, resolved_date, sw_version, resolved_sw_version, cause, cause_category, module, is_deviation, related_issue_id, linked_gmp_record_id, linked_task_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      issue.linked_gmp_record_id || null,
      issue.linked_task_id || null,
    ]
  )
}

// 이슈 업데이트
export async function updateIssue(issue: Issue): Promise<void> {
  const pool = getPool()
  await pool.query(
    `UPDATE issues 
     SET title = ?, description = ?, status = ?, owner = ?, occurred_date = ?, due_date = ?, resolved_date = ?, sw_version = ?, resolved_sw_version = ?, cause = ?, cause_category = ?, module = ?, is_deviation = ?, related_issue_id = ?, linked_gmp_record_id = ?, linked_task_id = ?
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
      issue.linked_gmp_record_id || null,
      issue.linked_task_id || null,
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
export interface GanttTaskSearchHit {
  type: 'gantt-task'
  id: number
  projectId: number
  projectName: string
  name: string
  wbsCode: string | null
  assignee: string | null
  startDate: string | null
  finishDate: string | null
}

export interface SearchResult {
  projects: Array<Project & { type: 'project' }>
  tasks: Array<ProjectChild & { type: 'task'; projectId: string | null; projectName: string }>
  gmpRecords: Array<ProjectChild & { type: 'gmp-record'; projectId: string | null; projectName: string; kind_number?: string }>
  ganttTasks: GanttTaskSearchHit[]
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

    // 간트 차트 작업 검색 (작업명, 담당자, WBS 코드)
    let ganttTasks: GanttTaskSearchHit[] = []
    try {
      const [ganttRows] = await pool.query<any[]>(
        `SELECT t.id, t.project_id, t.name, t.wbs_code, t.assignee, t.start_date, t.finish_date, p.name as project_name
         FROM gantt_tasks t
         INNER JOIN gantt_projects p ON t.project_id = p.id
         WHERE t.name LIKE ? OR t.assignee LIKE ? OR (t.wbs_code IS NOT NULL AND t.wbs_code LIKE ?)
         ORDER BY p.name, t.sort_order`,
        [searchPattern, searchPattern, searchPattern]
      )
      ganttTasks = ganttRows.map((row) => ({
        type: 'gantt-task' as const,
        id: row.id,
        projectId: row.project_id,
        projectName: row.project_name || 'N/A',
        name: row.name || '',
        wbsCode: row.wbs_code || null,
        assignee: row.assignee || null,
        startDate: row.start_date ? (typeof row.start_date === 'string' ? row.start_date : new Date(row.start_date).toISOString().slice(0, 10)) : null,
        finishDate: row.finish_date ? (typeof row.finish_date === 'string' ? row.finish_date : new Date(row.finish_date).toISOString().slice(0, 10)) : null,
      }))
    } catch (e) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Gantt search skipped (table may not exist):', e)
      }
    }

    return {
      projects: projectsWithType,
      tasks: tasksWithType,
      gmpRecords: gmpRecordsWithType,
      ganttTasks,
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Error in searchAll:', error)
    }
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

// VAL Pkg 관련 함수들

// 모든 VAL Pkg 조회 (링크된 일감 포함)
export async function getValPackages(): Promise<Project[]> {
  let retries = 2
  while (retries > 0) {
    try {
      // 연결 테스트
      const isConnected = await testConnection()
      if (!isConnected) {
        throw new Error('Database connection failed')
      }
      
      const pool = getPool()
      const [packages] = await pool.query<any[]>(
        'SELECT * FROM val_packages ORDER BY created_at DESC'
      )

    if (packages.length === 0) {
      return []
    }

    const packageIds = packages.map(p => p.id)
    const placeholders = packageIds.map(() => '?').join(',')

    // 모든 링크된 일감을 한 번에 조회
    const [linkedTasks] = await pool.query<any[]>(
      `SELECT pc.*, vptl.val_package_id
       FROM project_children pc
       INNER JOIN val_package_task_links vptl ON pc.id = vptl.task_id
       WHERE vptl.val_package_id IN (${placeholders})
       ORDER BY vptl.val_package_id, pc.created_at ASC`,
      packageIds
    )

    // VAL Pkg별로 일감 그룹화
    const tasksByPackage = new Map<string, any[]>()
    linkedTasks.forEach((task) => {
      if (!tasksByPackage.has(task.val_package_id)) {
        tasksByPackage.set(task.val_package_id, [])
      }
      tasksByPackage.get(task.val_package_id)!.push(task)
    })

    const today = new Date().toISOString().slice(0, 10)
    return packages.map((pkg) => {
      const linkedTasksList = tasksByPackage.get(pkg.id) || []
      const childrenList = linkedTasksList.map((task) => {
        let phases = null
        if (task.phases) {
          try {
            phases = typeof task.phases === 'string' ? JSON.parse(task.phases) : task.phases
          } catch (e) {
            phases = null
          }
        }
        return {
          id: task.id,
          title: task.title,
          owner: task.owner,
          status: task.status,
          progress: task.progress || 0,
          start: task.start ? (typeof task.start === 'string' ? task.start : new Date(task.start).toISOString().slice(0, 10)) : today,
          due: task.due ? (typeof task.due === 'string' ? task.due : new Date(task.due).toISOString().slice(0, 10)) : '',
          description: task.description || '',
          phases: phases,
          linked_gmp_record_id: task.linked_gmp_record_id || null,
        }
      })

      return {
        id: pkg.id,
        name: pkg.name,
        owner: pkg.owner,
        members: pkg.members,
        status: pkg.status,
        progress: pkg.progress,
        start: pkg.start ? (typeof pkg.start === 'string' ? pkg.start : new Date(pkg.start).toISOString().slice(0, 10)) : today,
        due: pkg.due ? (typeof pkg.due === 'string' ? pkg.due : new Date(pkg.due).toISOString().slice(0, 10)) : '',
        description: pkg.description || '',
        srb_ver: pkg.srb_ver || '',
        children: childrenList, // 링크된 일감
      }
    })
    } catch (error: any) {
      retries--
      if (retries === 0) {
        pool = null
        if (process.env.NODE_ENV === 'development') {
          console.error('Error in getValPackages (final attempt):', error)
        }
        throw new Error(`VAL Pkg 조회 실패: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
      
      await new Promise(resolve => setTimeout(resolve, 500))
      if (process.env.NODE_ENV === 'development') {
        console.warn(`Retrying getValPackages... (${retries} attempts remaining)`)
      }
    }
  }
  
  throw new Error('Unexpected error in getValPackages')
}

// VAL Pkg 추가
export async function createValPackage(valPackage: Project): Promise<void> {
  const pool = getPool()
  await pool.query(
    `INSERT INTO val_packages (id, name, owner, members, status, progress, start, due, description, srb_ver)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      valPackage.id,
      valPackage.name,
      valPackage.owner,
      valPackage.members,
      valPackage.status,
      valPackage.progress,
      valPackage.start || null,
      valPackage.due,
      valPackage.description || null,
      (valPackage as any).srb_ver || null,
    ]
  )
}

// VAL Pkg 업데이트
export async function updateValPackage(valPackage: Project): Promise<void> {
  const pool = getPool()

  // 상태 자동 관리: 실적 진척도가 100%이면 "Completed", 그 외 Risk 체크, 0%보다 크면 "In Progress"
  let finalStatus = valPackage.status
  if (valPackage.progress >= 100) {
    finalStatus = 'Completed'
  } else if (checkRiskStatus(valPackage.start, valPackage.due, valPackage.progress || 0)) {
    finalStatus = 'Issued'
  } else if (valPackage.progress > 0) {
    finalStatus = 'In Progress'
  }

  await pool.query(
    `UPDATE val_packages 
     SET name = ?, owner = ?, members = ?, status = ?, progress = ?, start = ?, due = ?, description = ?, srb_ver = ?
     WHERE id = ?`,
    [
      valPackage.name,
      valPackage.owner,
      valPackage.members,
      finalStatus,
      valPackage.progress,
      valPackage.start || null,
      valPackage.due,
      valPackage.description || null,
      (valPackage as any).srb_ver || null,
      valPackage.id,
    ]
  )
}

// VAL Pkg 삭제
export async function deleteValPackage(valPackageId: string): Promise<void> {
  const pool = getPool()
  await pool.query('DELETE FROM val_packages WHERE id = ?', [valPackageId])
}

// 다음 VAL Pkg ID 생성 (5자리 숫자)
export async function getNextValPackageId(): Promise<string> {
  const pool = getPool()
  const [rows] = await pool.query<any[]>(
    `SELECT id FROM val_packages WHERE id LIKE 'Val-%' ORDER BY id DESC LIMIT 1`
  )

  if (rows.length === 0) {
    return 'Val-00001'
  }

  const lastId = rows[0].id
  const match = lastId.match(/Val-(\d+)/)
  if (match) {
    const nextNum = parseInt(match[1], 10) + 1
    return `Val-${String(nextNum).padStart(5, '0')}`
  }

  return 'Val-00001'
}

// VAL Pkg와 일감 링크 관련 함수들

// VAL Pkg에 링크된 일감 조회
export async function getValPackageTasks(valPackageId: string): Promise<ProjectChild[]> {
  const pool = getPool()
  const [tasks] = await pool.query<any[]>(
    `SELECT pc.* 
     FROM project_children pc
     INNER JOIN val_package_task_links vptl ON pc.id = vptl.task_id
     WHERE vptl.val_package_id = ?
     ORDER BY pc.created_at ASC`,
    [valPackageId]
  )

  const today = new Date().toISOString().slice(0, 10)
  return tasks.map((task) => {
    let phases = null
    if (task.phases) {
      try {
        phases = typeof task.phases === 'string' ? JSON.parse(task.phases) : task.phases
      } catch (e) {
        phases = null
      }
    }
    return {
      id: task.id,
      title: task.title,
      owner: task.owner,
      status: task.status,
      progress: task.progress || 0,
      start: task.start ? (typeof task.start === 'string' ? task.start : new Date(task.start).toISOString().slice(0, 10)) : today,
      due: task.due ? (typeof task.due === 'string' ? task.due : new Date(task.due).toISOString().slice(0, 10)) : '',
      description: task.description || '',
      phases: phases,
      linked_gmp_record_id: task.linked_gmp_record_id || null,
    }
  })
}

// 일감에 링크된 VAL Pkg 조회
export async function getValPackagesForTask(taskId: string): Promise<Project[]> {
  const pool = getPool()
  const [valPackages] = await pool.query<any[]>(
    `SELECT vp.* 
     FROM val_packages vp
     INNER JOIN val_package_task_links vptl ON vp.id = vptl.val_package_id
     WHERE vptl.task_id = ?
     ORDER BY vp.created_at ASC`,
    [taskId]
  )

  const today = new Date().toISOString().slice(0, 10)
  return valPackages.map((vp) => ({
    id: vp.id,
    name: vp.name,
    owner: vp.owner,
    members: vp.members,
    status: vp.status,
    progress: vp.progress,
    start: vp.start ? (typeof vp.start === 'string' ? vp.start : new Date(vp.start).toISOString().slice(0, 10)) : today,
    due: vp.due ? (typeof vp.due === 'string' ? vp.due : new Date(vp.due).toISOString().slice(0, 10)) : '',
    description: vp.description || '',
    srb_ver: vp.srb_ver || '',
    children: [],
  }))
}

// 링크 가능한 일감 조회 (Completed, Dropped 제외)
export async function getAvailableTasksForValPackage(): Promise<ProjectChild[]> {
  const pool = getPool()
  const [tasks] = await pool.query<any[]>(
    `SELECT * FROM project_children 
     WHERE status NOT IN ('Completed', 'Dropped')
     ORDER BY created_at ASC`
  )

  const today = new Date().toISOString().slice(0, 10)
  return tasks.map((task) => {
    let phases = null
    if (task.phases) {
      try {
        phases = typeof task.phases === 'string' ? JSON.parse(task.phases) : task.phases
      } catch (e) {
        phases = null
      }
    }
    return {
      id: task.id,
      title: task.title,
      owner: task.owner,
      status: task.status,
      progress: task.progress || 0,
      start: task.start ? (typeof task.start === 'string' ? task.start : new Date(task.start).toISOString().slice(0, 10)) : today,
      due: task.due ? (typeof task.due === 'string' ? task.due : new Date(task.due).toISOString().slice(0, 10)) : '',
      description: task.description || '',
      phases: phases,
      linked_gmp_record_id: task.linked_gmp_record_id || null,
    }
  })
}

// 일감들을 VAL Pkg에 링크
export async function linkTasksToValPackage(valPackageId: string, taskIds: string[]): Promise<void> {
  const pool = getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    for (const taskId of taskIds) {
      // 중복 체크 후 삽입
      await connection.query(
        `INSERT IGNORE INTO val_package_task_links (val_package_id, task_id)
         VALUES (?, ?)`,
        [valPackageId, taskId]
      )
    }

    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

// 일감 링크 해제
export async function unlinkTaskFromValPackage(valPackageId: string, taskId: string): Promise<void> {
  const pool = getPool()
  await pool.query(
    'DELETE FROM val_package_task_links WHERE val_package_id = ? AND task_id = ?',
    [valPackageId, taskId]
  )
}

// VAL Pkg의 모든 링크 삭제
export async function unlinkAllTasksFromValPackage(valPackageId: string): Promise<void> {
  const pool = getPool()
  await pool.query(
    'DELETE FROM val_package_task_links WHERE val_package_id = ?',
    [valPackageId]
  )
}

// ==================== 회의록 관련 함수 ====================

// 모든 회의록 조회
function normalizeMeetingDate(value: unknown): string | null {
  if (value == null) return null

  if (value instanceof Date) {
    const y = value.getFullYear()
    const m = String(value.getMonth() + 1).padStart(2, '0')
    const d = String(value.getDate()).toString().padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  if (typeof value === 'string') {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (match) {
      const [, y, m, d] = match
      return `${y}-${m}-${d}`
    }
  }

  return null
}

export async function getAllMeetingNotes(): Promise<MeetingNote[]> {
  const pool = getPool()
  const [rows] = await pool.query<any[]>(
    `SELECT * FROM meeting_notes ORDER BY meeting_date DESC, created_at DESC`
  )

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    meeting_date: normalizeMeetingDate(row.meeting_date) ?? '',
    attendees: row.attendees ? (typeof row.attendees === 'string' ? JSON.parse(row.attendees) : row.attendees) : [],
    agenda: row.agenda ? (typeof row.agenda === 'string' ? JSON.parse(row.agenda) : row.agenda) : [],
    discussion: row.discussion || '',
    decisions: row.decisions || '',
    action_items: row.action_items ? (typeof row.action_items === 'string' ? JSON.parse(row.action_items) : row.action_items) : [],
    next_meeting_date: normalizeMeetingDate(row.next_meeting_date),
    created_by: row.created_by,
    created_at: row.created_at ? new Date(row.created_at).toISOString() : undefined,
    updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
    status: (row.status as 'draft' | 'final') ?? 'final',
  }))
}

// 회의록 ID로 조회
export async function getMeetingNoteById(id: string): Promise<MeetingNote | null> {
  const pool = getPool()
  const [rows] = await pool.query<any[]>(
    'SELECT * FROM meeting_notes WHERE id = ?',
    [id]
  )

  if (rows.length === 0) {
    return null
  }

  const row = rows[0]
  return {
    id: row.id,
    title: row.title,
    meeting_date: normalizeMeetingDate(row.meeting_date) ?? '',
    attendees: row.attendees ? (typeof row.attendees === 'string' ? JSON.parse(row.attendees) : row.attendees) : [],
    agenda: row.agenda ? (typeof row.agenda === 'string' ? JSON.parse(row.agenda) : row.agenda) : [],
    discussion: row.discussion || '',
    decisions: row.decisions || '',
    action_items: row.action_items ? (typeof row.action_items === 'string' ? JSON.parse(row.action_items) : row.action_items) : [],
    next_meeting_date: normalizeMeetingDate(row.next_meeting_date),
    created_by: row.created_by,
    created_at: row.created_at ? new Date(row.created_at).toISOString() : undefined,
    updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
    status: (row.status as 'draft' | 'final') ?? 'final',
  }
}

// 회의록 추가
export async function addMeetingNote(meetingNote: MeetingNote): Promise<void> {
  const pool = getPool()
  await pool.query(
    `INSERT INTO meeting_notes 
     (id, title, meeting_date, attendees, agenda, discussion, decisions, status, action_items, next_meeting_date, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      meetingNote.id,
      meetingNote.title,
      meetingNote.meeting_date,
      JSON.stringify(meetingNote.attendees || []),
      JSON.stringify(meetingNote.agenda || []),
      meetingNote.discussion || null,
      meetingNote.decisions || null,
      meetingNote.status ?? 'final',
      JSON.stringify(meetingNote.action_items || []),
      meetingNote.next_meeting_date || null,
      meetingNote.created_by,
    ]
  )
}

// 회의록 수정
export async function updateMeetingNote(meetingNote: MeetingNote): Promise<void> {
  const pool = getPool()
  await pool.query(
    `UPDATE meeting_notes 
     SET title = ?, meeting_date = ?, attendees = ?, agenda = ?, discussion = ?, 
         decisions = ?, status = ?, action_items = ?, next_meeting_date = ?
     WHERE id = ?`,
    [
      meetingNote.title,
      meetingNote.meeting_date,
      JSON.stringify(meetingNote.attendees || []),
      JSON.stringify(meetingNote.agenda || []),
      meetingNote.discussion || null,
      meetingNote.decisions || null,
      meetingNote.status ?? 'final',
      JSON.stringify(meetingNote.action_items || []),
      meetingNote.next_meeting_date || null,
      meetingNote.id,
    ]
  )
}

// 회의록 삭제
export async function deleteMeetingNote(id: string): Promise<void> {
  const pool = getPool()
  await pool.query('DELETE FROM meeting_notes WHERE id = ?', [id])
}

// 회의록 검색
export async function searchMeetingNotes(keyword: string): Promise<MeetingNote[]> {
  const pool = getPool()
  const searchKeyword = `%${keyword}%`
  const [rows] = await pool.query<any[]>(
    `SELECT * FROM meeting_notes 
     WHERE title LIKE ? OR discussion LIKE ? OR decisions LIKE ?
     ORDER BY meeting_date DESC, created_at DESC`,
    [searchKeyword, searchKeyword, searchKeyword]
  )

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    meeting_date: normalizeMeetingDate(row.meeting_date) ?? '',
    attendees: row.attendees ? (typeof row.attendees === 'string' ? JSON.parse(row.attendees) : row.attendees) : [],
    agenda: row.agenda ? (typeof row.agenda === 'string' ? JSON.parse(row.agenda) : row.agenda) : [],
    discussion: row.discussion || '',
    decisions: row.decisions || '',
    action_items: row.action_items ? (typeof row.action_items === 'string' ? JSON.parse(row.action_items) : row.action_items) : [],
    next_meeting_date: normalizeMeetingDate(row.next_meeting_date),
    created_by: row.created_by,
    created_at: row.created_at ? new Date(row.created_at).toISOString() : undefined,
    updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
    status: (row.status as 'draft' | 'final') ?? 'final',
  }))
}

// 다음 회의록 ID 생성
export async function getNextMeetingNoteId(): Promise<string> {
  const pool = getPool()
  const [rows] = await pool.query<any[]>(
    `SELECT id FROM meeting_notes WHERE id LIKE 'MTG-%' ORDER BY id DESC LIMIT 1`
  )

  if (rows.length === 0) {
    return 'MTG-00001'
  }

  const lastId = rows[0].id
  const match = lastId.match(/MTG-(\d+)/)
  if (match) {
    const nextNum = parseInt(match[1], 10) + 1
    return `MTG-${String(nextNum).padStart(5, '0')}`
  }

  return 'MTG-00001'
}

// ==================== 액션 아이템 관련 함수 ====================

// 모든 액션 아이템 조회 (회의록 정보 포함)
export async function getAllActionItems(): Promise<Array<{
  id: string
  description: string
  assignee: string
  due_date: string | null
  status: 'pending' | 'in_progress' | 'completed'
  meeting_note_id: string
  meeting_title: string
  meeting_date: string
  created_at: string
}>> {
  const pool = getPool()
  const [rows] = await pool.query<any[]>(
    `SELECT 
      mn.id as meeting_note_id,
      mn.title as meeting_title,
      mn.meeting_date,
      mn.created_at,
      JSON_EXTRACT(mn.action_items, '$[*]') as action_items_json
     FROM meeting_notes mn
     WHERE mn.action_items IS NOT NULL 
       AND mn.action_items != '[]'
       AND JSON_LENGTH(mn.action_items) > 0
     ORDER BY mn.meeting_date DESC, mn.created_at DESC`
  )

  const allActionItems: Array<{
    id: string
    description: string
    assignee: string
    due_date: string | null
    status: 'pending' | 'in_progress' | 'completed'
    meeting_note_id: string
    meeting_title: string
    meeting_date: string
    created_at: string
  }> = []

  rows.forEach((row) => {
    let actionItems: ActionItem[] = []
    try {
      const itemsJson = typeof row.action_items_json === 'string' 
        ? JSON.parse(row.action_items_json) 
        : row.action_items_json
      
      if (Array.isArray(itemsJson)) {
        actionItems = itemsJson
      } else if (typeof itemsJson === 'object' && itemsJson !== null) {
        // 단일 객체인 경우 배열로 변환
        actionItems = [itemsJson]
      }
    } catch (e) {
      // JSON 파싱 실패 시 빈 배열
      actionItems = []
    }

    actionItems.forEach((item: ActionItem) => {
      allActionItems.push({
        id: item.id,
        description: item.description,
        assignee: item.assignee,
        due_date: item.due_date || null,
        status: item.status || 'pending',
        meeting_note_id: row.meeting_note_id,
        meeting_title: row.meeting_title,
        meeting_date: normalizeMeetingDate(row.meeting_date) ?? '',
        created_at: row.created_at ? new Date(row.created_at).toISOString() : '',
      })
    })
  })

  return allActionItems
}

// 특정 담당자의 액션 아이템 조회
export async function getActionItemsByAssignee(assignee: string): Promise<Array<{
  id: string
  description: string
  assignee: string
  due_date: string | null
  status: 'pending' | 'in_progress' | 'completed'
  meeting_note_id: string
  meeting_title: string
  meeting_date: string
  created_at: string
}>> {
  const allItems = await getAllActionItems()
  // 담당자 이름 정확히 일치하는 항목만 반환 (대소문자 구분)
  return allItems.filter(item => item.assignee === assignee)
}

// 액션 아이템 상태 업데이트
export async function updateActionItemStatus(
  meetingNoteId: string,
  actionItemId: string,
  status: 'pending' | 'in_progress' | 'completed'
): Promise<void> {
  const pool = getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    // 회의록 조회
    const [rows] = await connection.query<any[]>(
      'SELECT action_items FROM meeting_notes WHERE id = ?',
      [meetingNoteId]
    )

    if (rows.length === 0) {
      throw new Error('Meeting note not found')
    }

    let actionItems: ActionItem[] = []
    try {
      actionItems = typeof rows[0].action_items === 'string'
        ? JSON.parse(rows[0].action_items)
        : rows[0].action_items || []
    } catch (e) {
      actionItems = []
    }

    // 액션 아이템 상태 업데이트
    const updatedActionItems = actionItems.map((item: ActionItem) =>
      item.id === actionItemId ? { ...item, status } : item
    )

    // 회의록 업데이트
    await connection.query(
      'UPDATE meeting_notes SET action_items = ? WHERE id = ?',
      [JSON.stringify(updatedActionItems), meetingNoteId]
    )

    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

