export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // 서버 사이드에서만 실행
    const { startBackupScheduler } = await import('./lib/backup-scheduler')
    startBackupScheduler()
    console.log('[Instrumentation] 자동 백업 스케줄러가 시작되었습니다.')
  }
}


