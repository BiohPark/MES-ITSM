export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startBackupScheduler } = await import('./lib/backup-scheduler')
    await startBackupScheduler()
    console.log('[Instrumentation] 자동 백업 스케줄러가 시작되었습니다.')
  }
}


