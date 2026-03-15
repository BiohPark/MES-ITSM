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

    // 4. issues 테이블 인덱스
    console.log('📊 issues 테이블 인덱스 추가...')
    const issuesIndexes = [
      { name: 'idx_owner', sql: 'CREATE INDEX IF NOT EXISTS idx_owner ON issues(owner)' },
      { name: 'idx_status', sql: 'CREATE INDEX IF NOT EXISTS idx_status ON issues(status)' },
      { name: 'idx_occurred_date', sql: 'CREATE INDEX IF NOT EXISTS idx_occurred_date ON issues(occurred_date)' },
      { name: 'idx_related_issue_id', sql: 'CREATE INDEX IF NOT EXISTS idx_related_issue_id ON issues(related_issue_id)' },
      { name: 'idx_linked_task_id', sql: 'CREATE INDEX IF NOT EXISTS idx_linked_task_id ON issues(linked_task_id)' },
    ]

    for (const idx of issuesIndexes) {
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

    // 5. comments 테이블 인덱스
    console.log('📊 comments 테이블 인덱스 추가...')
    const commentsIndexes = [
      { name: 'idx_entity_lookup', sql: 'CREATE INDEX IF NOT EXISTS idx_entity_lookup ON comments(entity_type, entity_id, created_at)' },
      { name: 'idx_author', sql: 'CREATE INDEX IF NOT EXISTS idx_author ON comments(author)' },
    ]

    for (const idx of commentsIndexes) {
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

    // 6. ITSM ticket 테이블 인덱스
    console.log('📊 service_tickets 관련 인덱스 추가...')
    const ticketIndexes = [
      { name: 'idx_ticket_type_status', sql: 'CREATE INDEX IF NOT EXISTS idx_ticket_type_status ON service_tickets(ticket_type, status)' },
      { name: 'idx_ticket_assignee_status', sql: 'CREATE INDEX IF NOT EXISTS idx_ticket_assignee_status ON service_tickets(assignee_name, status)' },
      { name: 'idx_ticket_requester', sql: 'CREATE INDEX IF NOT EXISTS idx_ticket_requester ON service_tickets(requester_name)' },
      { name: 'idx_ticket_created_at', sql: 'CREATE INDEX IF NOT EXISTS idx_ticket_created_at ON service_tickets(created_at)' },
      { name: 'idx_ticket_sla_due_at', sql: 'CREATE INDEX IF NOT EXISTS idx_ticket_sla_due_at ON service_tickets(sla_due_at)' },
      { name: 'idx_ticket_approval_status', sql: 'CREATE INDEX IF NOT EXISTS idx_ticket_approval_status ON service_tickets(approval_status)' },
      { name: 'idx_ticket_links_ticket_id', sql: 'CREATE INDEX IF NOT EXISTS idx_ticket_links_ticket_id ON service_ticket_links(ticket_id, created_at)' },
      { name: 'idx_ticket_activity_ticket_id', sql: 'CREATE INDEX IF NOT EXISTS idx_ticket_activity_ticket_id ON service_ticket_activity_logs(ticket_id, created_at)' },
      { name: 'idx_ticket_notifications_recipient_status', sql: 'CREATE INDEX IF NOT EXISTS idx_ticket_notifications_recipient_status ON ticket_notifications(recipient_name, status, created_at)' },
      { name: 'idx_ticket_approvals_ticket_status', sql: 'CREATE INDEX IF NOT EXISTS idx_ticket_approvals_ticket_status ON ticket_approvals(ticket_id, status)' },
    ]

    for (const idx of ticketIndexes) {
      try {
        await connection.query(idx.sql)
        console.log(`   ✅ ${idx.name} 인덱스 추가 완료`)
      } catch (error: any) {
        if (error.code === 'ER_DUP_KEYNAME') {
          console.log(`   ℹ️  ${idx.name} 인덱스가 이미 존재합니다.`)
        } else if (error.code === 'ER_NO_SUCH_TABLE') {
          console.log(`   ℹ️  대상 테이블이 없어 ${idx.name} 인덱스를 건너뜁니다.`)
        } else {
          console.error(`   ❌ ${idx.name} 인덱스 추가 실패:`, error.message)
        }
      }
    }
    console.log()

    // 7. gantt 테이블 인덱스
    console.log('📊 gantt 테이블 인덱스 추가...')
    const ganttIndexes = [
      { name: 'idx_gantt_projects_created_at', sql: 'CREATE INDEX IF NOT EXISTS idx_gantt_projects_created_at ON gantt_projects(created_at)' },
      { name: 'idx_gantt_tasks_project_sort', sql: 'CREATE INDEX IF NOT EXISTS idx_gantt_tasks_project_sort ON gantt_tasks(project_id, sort_order, id)' },
      { name: 'idx_gantt_tasks_project_assignee', sql: 'CREATE INDEX IF NOT EXISTS idx_gantt_tasks_project_assignee ON gantt_tasks(project_id, assignee)' },
      { name: 'idx_gantt_events_project_date', sql: 'CREATE INDEX IF NOT EXISTS idx_gantt_events_project_date ON gantt_events(project_id, event_date, id)' },
      { name: 'idx_gantt_history_project_created', sql: 'CREATE INDEX IF NOT EXISTS idx_gantt_history_project_created ON gantt_wbs_history(project_id, created_at)' },
    ]

    for (const idx of ganttIndexes) {
      try {
        await connection.query(idx.sql)
        console.log(`   ✅ ${idx.name} 인덱스 추가 완료`)
      } catch (error: any) {
        if (error.code === 'ER_DUP_KEYNAME') {
          console.log(`   ℹ️  ${idx.name} 인덱스가 이미 존재합니다.`)
        } else if (error.code === 'ER_NO_SUCH_TABLE') {
          console.log(`   ℹ️  대상 테이블이 없어 ${idx.name} 인덱스를 건너뜁니다.`)
        } else {
          console.error(`   ❌ ${idx.name} 인덱스 추가 실패:`, error.message)
        }
      }
    }
    console.log()

    // 8. 복합 인덱스 (자주 함께 조회되는 컬럼들)
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
      {
        name: 'idx_project_children_project_owner_status',
        sql: 'CREATE INDEX IF NOT EXISTS idx_project_children_project_owner_status ON project_children(project_id, owner, status)'
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
