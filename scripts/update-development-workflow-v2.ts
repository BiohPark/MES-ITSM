import { getPool } from '../lib/db'

async function updateDevelopmentWorkflow() {
  const pool = getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    console.log('개발 단계 워크플로우 업데이트 중...\n')

    // 개발 단계 전용 워크플로우 조회
    const [workflows] = await connection.query<any[]>(
      "SELECT id FROM workflows WHERE name = 'Development Phase Workflow'"
    )

    if (workflows.length === 0) {
      throw new Error('Development Phase Workflow를 찾을 수 없습니다. 먼저 add-development-workflow를 실행하세요.')
    }

    const workflowId = workflows[0].id
    console.log(`📊 Development Phase Workflow ID: ${workflowId}`)

    // 기존 전환 삭제
    console.log('\n🗑️  기존 전환 삭제 중...')
    await connection.query(
      'DELETE FROM workflow_transitions WHERE workflow_id = ?',
      [workflowId]
    )
    console.log('   ✅ 기존 전환 삭제 완료')

    // 기존 상태 삭제 (Planning만 유지)
    console.log('\n🗑️  기존 상태 삭제 중...')
    await connection.query(
      `DELETE FROM workflow_statuses 
       WHERE workflow_id = ? 
       AND name NOT IN ('Planning')`,
      [workflowId]
    )
    console.log('   ✅ 기존 상태 삭제 완료')

    // 새로운 상태 생성
    console.log('\n📊 새로운 개발 단계 상태 생성...')
    const statuses = [
      { name: '설계 리뷰', category: 'in_progress', is_initial: true, display_order: 1 },
      { name: '개발', category: 'in_progress', display_order: 2 },
      { name: '유닛 테스트', category: 'in_progress', display_order: 3 },
      { name: '통합테스트', category: 'in_progress', display_order: 4 },
      { name: '테스트 산출물 리뷰', category: 'in_progress', display_order: 5 },
      { name: '코드리뷰', category: 'in_progress', display_order: 6 },
      { name: 'Val서버 이관', category: 'done', is_final: true, display_order: 7 },
    ]

    const statusIds: { [key: string]: number } = {}

    // Planning 상태 ID 가져오기
    const [existingStatuses] = await connection.query<any[]>(
      `SELECT id, name FROM workflow_statuses 
       WHERE workflow_id = ? AND name IN ('Planning')`,
      [workflowId]
    )

    for (const status of existingStatuses) {
      statusIds[status.name] = status.id
    }

    // 새로운 상태 생성
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

    // 전환 생성
    console.log('\n📊 개발 단계 전환 생성...')

    // 설계 리뷰부터 시작하는 전환
    const forwardTransitions = [
      { name: '개발로 이동', from: '설계 리뷰', to: '개발', order: 1 },
      { name: '유닛 테스트로 이동', from: '개발', to: '유닛 테스트', order: 2 },
      { name: '통합테스트로 이동', from: '유닛 테스트', to: '통합테스트', order: 3 },
      { name: '테스트 산출물 리뷰로 이동', from: '통합테스트', to: '테스트 산출물 리뷰', order: 4 },
      { name: '코드리뷰로 이동', from: '테스트 산출물 리뷰', to: '코드리뷰', order: 5 },
      { name: 'Val서버 이관으로 이동', from: '코드리뷰', to: 'Val서버 이관', order: 6 },
    ]

    // 이전 상태로 이동
    const backwardTransitions = [
      { name: '설계 리뷰로 돌아가기', from: '개발', to: '설계 리뷰', order: 7 },
      { name: '개발로 돌아가기', from: '유닛 테스트', to: '개발', order: 8 },
      { name: '유닛 테스트로 돌아가기', from: '통합테스트', to: '유닛 테스트', order: 9 },
      { name: '통합테스트로 돌아가기', from: '테스트 산출물 리뷰', to: '통합테스트', order: 10 },
      { name: '테스트 산출물 리뷰로 돌아가기', from: '코드리뷰', to: '테스트 산출물 리뷰', order: 11 },
      { name: '코드리뷰로 돌아가기', from: 'Val서버 이관', to: '코드리뷰', order: 12 },
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
        console.warn(`   ⚠️  전환 "${trans.name}" 생성 실패: 상태 ID를 찾을 수 없음 (from: ${trans.from}, to: ${trans.to})`)
      }
    }

    await connection.commit()
    console.log('\n🎉 개발 단계 워크플로우 업데이트 완료!')
    console.log('\n📋 새로운 상태 순서:')
    console.log('   1. 설계 리뷰 (시작)')
    console.log('   2. 개발')
    console.log('   3. 유닛 테스트')
    console.log('   4. 통합테스트')
    console.log('   5. 테스트 산출물 리뷰')
    console.log('   6. 코드리뷰')
    console.log('   7. Val서버 이관 (최종)')
  } catch (error) {
    await connection.rollback()
    console.error('❌ 개발 단계 워크플로우 업데이트 실패:', error)
    throw error
  } finally {
    connection.release()
  }
}

async function main() {
  try {
    await updateDevelopmentWorkflow()
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

main()

