import { getPool } from '../lib/db'
import { getProjects, getAllGmpRecords, getAllIssues } from '../lib/db'

async function memoryLeakCheck() {
  const pool = getPool()
  
  try {
    console.log('='.repeat(80))
    console.log('메모리 릭 체크 시작')
    console.log('='.repeat(80))
    console.log()

    const iterations = 10
    const memoryUsage: number[] = []
    
    console.log(`🔄 ${iterations}회 반복 실행하여 메모리 사용량 추적...`)
    console.log()

    for (let i = 0; i < iterations; i++) {
      // 메모리 사용량 측정 전
      const memBefore = process.memoryUsage()
      
      // 데이터 조회 실행
      await getProjects()
      await getAllGmpRecords()
      await getAllIssues()
      
      // 가비지 컬렉션 강제 실행 (가능한 경우)
      if (global.gc) {
        global.gc()
      }
      
      // 메모리 사용량 측정 후
      const memAfter = process.memoryUsage()
      
      const heapUsed = memAfter.heapUsed / 1024 / 1024 // MB
      memoryUsage.push(heapUsed)
      
      console.log(`  반복 ${i + 1}/${iterations}: 힙 사용량 ${heapUsed.toFixed(2)}MB`)
      
      // 짧은 대기 시간 (가비지 컬렉션 시간 확보)
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    console.log()
    console.log('📊 메모리 사용량 분석:')
    console.log('-'.repeat(80))
    const initialMemory = memoryUsage[0]
    const finalMemory = memoryUsage[memoryUsage.length - 1]
    const memoryIncrease = finalMemory - initialMemory
    const memoryIncreasePercent = ((memoryIncrease / initialMemory) * 100).toFixed(2)
    
    console.log(`  초기 메모리: ${initialMemory.toFixed(2)}MB`)
    console.log(`  최종 메모리: ${finalMemory.toFixed(2)}MB`)
    console.log(`  메모리 증가: ${memoryIncrease > 0 ? '+' : ''}${memoryIncrease.toFixed(2)}MB (${memoryIncreasePercent}%)`)
    console.log()
    
    // 메모리 증가율이 10% 이상이면 경고
    if (parseFloat(memoryIncreasePercent) > 10) {
      console.log('  ⚠️  경고: 메모리 사용량이 크게 증가했습니다. 메모리 릭 가능성이 있습니다.')
    } else if (parseFloat(memoryIncreasePercent) > 5) {
      console.log('  ⚠️  주의: 메모리 사용량이 다소 증가했습니다. 모니터링이 필요합니다.')
    } else {
      console.log('  ✅ 메모리 사용량이 안정적입니다.')
    }
    console.log()

    // 연결 풀 상태 확인
    console.log('📊 데이터베이스 연결 풀 상태:')
    console.log('-'.repeat(80))
    const poolInfo = pool as any
    console.log(`  활성 연결 수: ${poolInfo._allConnections?.length || 0}`)
    console.log(`  사용 중인 연결 수: ${poolInfo._acquiredConnections?.length || 0}`)
    console.log(`  대기 중인 요청 수: ${poolInfo._connectionQueue?.length || 0}`)
    console.log()

    // 연결이 제대로 해제되는지 확인
    console.log('📊 연결 해제 테스트...')
    const connection = await pool.getConnection()
    const connectionsBefore = (poolInfo._acquiredConnections?.length || 0)
    connection.release()
    const connectionsAfter = (poolInfo._acquiredConnections?.length || 0)
    
    if (connectionsAfter < connectionsBefore) {
      console.log('  ✅ 연결이 정상적으로 해제되었습니다.')
    } else {
      console.log('  ⚠️  연결 해제에 문제가 있을 수 있습니다.')
    }
    console.log()

    console.log('='.repeat(80))
    console.log('✅ 메모리 릭 체크 완료!')
    console.log('='.repeat(80))

  } catch (error) {
    console.error('❌ 메모리 릭 체크 실패:', error)
    throw error
  } finally {
    await pool.end()
  }
}

async function main() {
  try {
    await memoryLeakCheck()
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

main()

