import { createBackup, cleanupOldBackups } from '../lib/backup'

async function runAutoBackup() {
  try {
    console.log(`[${new Date().toISOString()}] 자동 백업 시작...`)
    const filename = await createBackup('auto')
    console.log(`[${new Date().toISOString()}] 자동 백업 완료: ${filename}`)

    // 30일 이상 된 백업 정리
    const deletedCount = await cleanupOldBackups(30)
    if (deletedCount > 0) {
      console.log(`[${new Date().toISOString()}] 오래된 백업 ${deletedCount}개 삭제 완료`)
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] 자동 백업 실패:`, error)
  }
}

// 즉시 실행
runAutoBackup().then(() => {
  process.exit(0)
}).catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})

