import { getProjects, getAllGmpRecords, getOrphanTasks } from '../lib/db'

// 성능 측정 스크립트
async function measurePerformance() {
  console.log('⏱️  성능 측정 시작...\n')

  // 1. 프로젝트 조회 성능 측정
  console.log('📊 프로젝트 조회 성능 측정...')
  const startProjects = performance.now()
  const projects = await getProjects()
  const endProjects = performance.now()
  const projectsTime = endProjects - startProjects
  console.log(`   ✅ 프로젝트 조회 완료: ${projects.length}개 (${projectsTime.toFixed(2)}ms)`)
  console.log(`   📈 평균 조회 시간: ${(projectsTime / projects.length).toFixed(4)}ms/프로젝트\n`)

  // 2. GMP Record 조회 성능 측정
  console.log('📊 GMP Record 조회 성능 측정...')
  const startGmp = performance.now()
  const gmpRecords = await getAllGmpRecords()
  const endGmp = performance.now()
  const gmpTime = endGmp - startGmp
  console.log(`   ✅ GMP Record 조회 완료: ${gmpRecords.length}개 (${gmpTime.toFixed(2)}ms)`)
  console.log(`   📈 평균 조회 시간: ${(gmpTime / gmpRecords.length).toFixed(4)}ms/Record\n`)

  // 3. Orphan Tasks 조회 성능 측정
  console.log('📊 Orphan Tasks 조회 성능 측정...')
  const startOrphan = performance.now()
  const orphanTasks = await getOrphanTasks()
  const endOrphan = performance.now()
  const orphanTime = endOrphan - startOrphan
  console.log(`   ✅ Orphan Tasks 조회 완료: ${orphanTasks.length}개 (${orphanTime.toFixed(2)}ms)\n`)

  // 4. 전체 데이터 통계
  const totalProjects = projects.length
  const totalTasks = projects.reduce((sum, p) => sum + (p.children?.length || 0), 0) + orphanTasks.length
  const totalGmpRecords = gmpRecords.length
  const totalData = totalProjects + totalTasks + totalGmpRecords

  console.log('📊 전체 데이터 통계:')
  console.log(`   - 프로젝트: ${totalProjects}개`)
  console.log(`   - 일감: ${totalTasks}개`)
  console.log(`   - GMP Record: ${totalGmpRecords}개`)
  console.log(`   - 총 데이터: ${totalData}개\n`)

  // 5. 성능 요약
  console.log('⏱️  성능 요약:')
  console.log(`   - 프로젝트 조회: ${projectsTime.toFixed(2)}ms`)
  console.log(`   - GMP Record 조회: ${gmpTime.toFixed(2)}ms`)
  console.log(`   - Orphan Tasks 조회: ${orphanTime.toFixed(2)}ms`)
  console.log(`   - 총 조회 시간: ${(projectsTime + gmpTime + orphanTime).toFixed(2)}ms\n`)

  // 6. 병목 지점 식별
  console.log('🔍 병목 지점 분석:')
  const times = [
    { name: '프로젝트 조회', time: projectsTime },
    { name: 'GMP Record 조회', time: gmpTime },
    { name: 'Orphan Tasks 조회', time: orphanTime },
  ]
  times.sort((a, b) => b.time - a.time)
  
  times.forEach((item, index) => {
    const percentage = ((item.time / (projectsTime + gmpTime + orphanTime)) * 100).toFixed(1)
    console.log(`   ${index + 1}. ${item.name}: ${item.time.toFixed(2)}ms (${percentage}%)`)
  })

  // 7. 권장사항
  console.log('\n💡 최적화 권장사항:')
  if (projectsTime > 1000) {
    console.log('   ⚠️  프로젝트 조회가 느립니다. 인덱스 추가 또는 쿼리 최적화를 고려하세요.')
  }
  if (gmpTime > 1000) {
    console.log('   ⚠️  GMP Record 조회가 느립니다. 인덱스 추가 또는 쿼리 최적화를 고려하세요.')
  }
  if (totalData > 10000 && (projectsTime + gmpTime + orphanTime) > 5000) {
    console.log('   ⚠️  대량 데이터 처리 시 페이지네이션 또는 가상 스크롤을 고려하세요.')
  }
  if (projects.length > 0) {
    const avgChildren = totalTasks / totalProjects
    if (avgChildren > 50) {
      console.log('   ⚠️  프로젝트당 평균 일감 수가 많습니다. 지연 로딩을 고려하세요.')
    }
  }
}

async function main() {
  try {
    await measurePerformance()
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

main()

