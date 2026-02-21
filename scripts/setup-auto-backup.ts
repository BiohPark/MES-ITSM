/** DB 설정(.env.local) 적용 - getPool() 호출 전에 로드 */
import './load-dotenv'
/**
 * 자동 백업 스케줄러 설정 스크립트
 * 
 * 이 스크립트는 cron job이나 작업 스케줄러를 통해 1시간마다 실행되어야 합니다.
 * 
 * Windows Task Scheduler 사용 예시:
 * 1. 작업 스케줄러 열기
 * 2. 기본 작업 만들기
 * 3. 트리거: 매시간
 * 4. 동작: 프로그램 시작
 * 5. 프로그램: node
 * 6. 인수: scripts/auto-backup.ts
 * 
 * Linux/Mac cron 사용 예시:
 * crontab -e
 * 0 * * * * cd /path/to/project && npm run auto-backup
 */

import { createBackup, cleanupOldBackups } from '../lib/backup'

async function main() {
  try {
    console.log(`[${new Date().toISOString()}] 자동 백업 시작...`)
    const filename = await createBackup('auto')
    console.log(`[${new Date().toISOString()}] 자동 백업 완료: ${filename}`)

    // system_settings.backup_retention_days 기준 오래된 백업 정리
    const deletedCount = await cleanupOldBackups()
    if (deletedCount > 0) {
      console.log(`[${new Date().toISOString()}] 오래된 백업 ${deletedCount}개 삭제 완료`)
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] 자동 백업 실패:`, error)
    process.exit(1)
  }
}

main()

