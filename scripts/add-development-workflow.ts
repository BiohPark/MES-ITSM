import { getPool } from '../lib/db'

async function addDevelopmentWorkflow() {
  const pool = getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    console.log('개발 단계 전용 워크플로우 생성 중...\n')

    // 1. Development Phase Workflow 생성
    console.log('📊 Development Phase Workflow 생성...')
    const [workflowResult] = await connection.query<any[]>(
      `INSERT INTO workflows (name, description, is_active) 
       VALUES ('Development Phase Workflow', '개발 단계 전용 워크플로우', TRUE)
       ON DUPLICATE KEY UPDATE description = '개발 단계 전용 워크플로우'`
    )
    
    const [workflows] = await connection.query<any[]>(
      "SELECT id FROM workflows WHERE name = 'Development Phase Workflow'"
    )
    
    if (workflows.length === 0) {
      throw new Error('워크플로우 생성 실패')
    }
    
    const workflowId = workflows[0].id
    console.log(`   ✅ Development Phase Workflow 생성 완료 (ID: ${workflowId})`)

    // 2. 상태 생성 (순서대로)
    console.log('\n📊 개발 단계 상태 생성...')
    const statuses = [
      { name: 'Planning', category: 'todo', is_initial: true, display_order: 1 },
      { name: 'Val 및 CC확정', category: 'in_progress', display_order: 2 },
      { name: '설계', category: 'in_progress', display_order: 3 },
      { name: '설계 리뷰', category: 'in_progress', display_order: 4 },
      { name: '개발', category: 'in_progress', display_order: 5 },
      { name: '유닛 테스트', category: 'in_progress', display_order: 6 },
      { name: '통합테스트', category: 'in_progress', display_order: 7 },
      { name: '테스트 산출물 리뷰', category: 'done', is_final: true, display_order: 8 },
    ]
    
    const statusIds: { [key: string]: number } = {}
    
    for (const status of statuses) {
      const [statusResult] = await connection.query<any[]>(
        `INSERT INTO workflow_statuses 
         (name, category, workflow_id, is_initial, is_final, display_order) 
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 
           category = VALUES(category),
           is_initial = VALUES(is_initial),
           is_final = VALUES(is_final),
           display_order = VALUES(display_order)`,
        [status.name, status.category, workflowId, status.is_initial || false, status.is_final || false, status.display_order]
      )
      
      const [insertedStatus] = await connection.query<any[]>(
        'SELECT id FROM workflow_statuses WHERE workflow_id = ? AND name = ?',
        [workflowId, status.name]
      )
      
      if (insertedStatus.length > 0) {
        statusIds[status.name] = insertedStatus[0].id
        console.log(`   ✅ 상태 "${status.name}" 생성 완료 (ID: ${insertedStatus[0].id})`)
      }
    }
    
    // 3. 전환 생성 (다음 상태로 이동, 이전 상태로 이동)
    console.log('\n📊 개발 단계 전환 생성...')
    
    // 다음 상태로 이동하는 전환들
    const forwardTransitions = [
      { name: 'Val 및 CC확정으로 이동', from: 'Planning', to: 'Val 및 CC확정', order: 1 },
      { name: '설계로 이동', from: 'Val 및 CC확정', to: '설계', order: 2 },
      { name: '설계 리뷰로 이동', from: '설계', to: '설계 리뷰', order: 3 },
      { name: '개발로 이동', from: '설계 리뷰', to: '개발', order: 4 },
      { name: '유닛 테스트로 이동', from: '개발', to: '유닛 테스트', order: 5 },
      { name: '통합테스트로 이동', from: '유닛 테스트', to: '통합테스트', order: 6 },
      { name: '테스트 산출물 리뷰로 이동', from: '통합테스트', to: '테스트 산출물 리뷰', order: 7 },
    ]
    
    // 이전 상태로 이동하는 전환들
    const backwardTransitions = [
      { name: 'Planning으로 돌아가기', from: 'Val 및 CC확정', to: 'Planning', order: 8 },
      { name: 'Val 및 CC확정으로 돌아가기', from: '설계', to: 'Val 및 CC확정', order: 9 },
      { name: '설계로 돌아가기', from: '설계 리뷰', to: '설계', order: 10 },
      { name: '설계 리뷰로 돌아가기', from: '개발', to: '설계 리뷰', order: 11 },
      { name: '개발로 돌아가기', from: '유닛 테스트', to: '개발', order: 12 },
      { name: '유닛 테스트로 돌아가기', from: '통합테스트', to: '유닛 테스트', order: 13 },
      { name: '통합테스트로 돌아가기', from: '테스트 산출물 리뷰', to: '통합테스트', order: 14 },
    ]
    
    const allTransitions = [...forwardTransitions, ...backwardTransitions]
    
    for (const trans of allTransitions) {
      const fromId = statusIds[trans.from]
      const toId = statusIds[trans.to]
      
      if (fromId && toId) {
        await connection.query(
          `INSERT INTO workflow_transitions 
           (name, workflow_id, from_status_id, to_status_id, display_order, is_active) 
           VALUES (?, ?, ?, ?, ?, TRUE)
           ON DUPLICATE KEY UPDATE 
             name = VALUES(name),
             display_order = VALUES(display_order),
             is_active = TRUE`,
          [trans.name, workflowId, fromId, toId, trans.order]
        )
        console.log(`   ✅ 전환 "${trans.name}" 생성 완료`)
      } else {
        console.warn(`   ⚠️  전환 "${trans.name}" 생성 실패: 상태 ID를 찾을 수 없음`)
      }
    }
    
    // 4. Development Phase Scheme 생성
    console.log('\n📊 Development Phase Scheme 생성...')
    await connection.query(
      `INSERT INTO workflow_schemes (name, workflow_id, is_default) 
       VALUES ('Development Phase Scheme', ?, FALSE)
       ON DUPLICATE KEY UPDATE workflow_id = VALUES(workflow_id)`,
      [workflowId]
    )
    console.log('   ✅ Development Phase Scheme 생성 완료')

    await connection.commit()
    console.log('\n🎉 개발 단계 전용 워크플로우 생성 완료!')
    console.log('\n📋 생성된 상태:')
    statuses.forEach((s, idx) => {
      console.log(`   ${idx + 1}. ${s.name}`)
    })
    console.log('\n📋 생성된 전환:')
    console.log('   - 다음 상태로 이동: 7개')
    console.log('   - 이전 상태로 이동: 7개')
  } catch (error) {
    await connection.rollback()
    console.error('❌ 개발 단계 워크플로우 생성 실패:', error)
    throw error
  } finally {
    connection.release()
  }
}

async function main() {
  try {
    await addDevelopmentWorkflow()
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

main()

