import { createBackup, cleanupOldBackups } from './backup'

let backupInterval: NodeJS.Timeout | null = null
let isRunning = false

/**
 * 자동 백업 스케줄러 시작
 * 1시간마다 자동으로 백업을 생성합니다.
 */
export function startBackupScheduler() {
  // 이미 실행 중이면 중복 실행 방지
  if (backupInterval) {
    console.log('[Backup Scheduler] 이미 실행 중입니다.')
    return
  }

  console.log('[Backup Scheduler] 자동 백업 스케줄러를 시작합니다. (1시간마다 실행)')

  // 즉시 한 번 실행 (서버 시작 시)
  runBackup()

  // 1시간마다 실행 (3600000ms = 1시간)
  backupInterval = setInterval(() => {
    runBackup()
  }, 60 * 60 * 1000) // 1시간
}

/**
 * 자동 백업 스케줄러 중지
 */
export function stopBackupScheduler() {
  if (backupInterval) {
    clearInterval(backupInterval)
    backupInterval = null
    console.log('[Backup Scheduler] 자동 백업 스케줄러를 중지했습니다.')
  }
}

/**
 * 백업 실행
 */
async function runBackup() {
  // 중복 실행 방지
  if (isRunning) {
    console.log('[Backup Scheduler] 백업이 이미 실행 중입니다. 건너뜁니다.')
    return
  }

  try {
    isRunning = true
    const timestamp = new Date().toISOString()
    console.log(`[Backup Scheduler] [${timestamp}] 자동 백업 시작...`)
    
    const filename = await createBackup('auto')
    
    console.log(`[Backup Scheduler] [${timestamp}] 자동 백업 완료: ${filename}`)

    // 30일 이상 된 백업 정리
    const deletedCount = await cleanupOldBackups(30)
    if (deletedCount > 0) {
      console.log(`[Backup Scheduler] [${timestamp}] 오래된 백업 ${deletedCount}개 삭제 완료`)
    }
  } catch (error) {
    const timestamp = new Date().toISOString()
    console.error(`[Backup Scheduler] [${timestamp}] 자동 백업 실패:`, error)
  } finally {
    isRunning = false
  }
}


