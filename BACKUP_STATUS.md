# 자동 백업 상태 확인 및 설정 가이드

## 현재 상태

### 구현 완료 사항
1. ✅ 자동 백업 스케줄러 구현 (`lib/backup-scheduler.ts`)
   - 서버 시작 시 자동으로 백업 스케줄러 시작
   - 1시간마다 자동 백업 실행
   - 서버 시작 시 즉시 한 번 실행

2. ✅ Next.js Instrumentation Hook 설정
   - `instrumentation.ts` 파일 생성
   - `next.config.js`에 `instrumentationHook: true` 설정
   - 서버 시작 시 자동 백업 스케줄러 자동 시작

3. ✅ 백업 테이블 목록 업데이트
   - `attachments` 테이블 추가
   - `backup_metadata` 테이블 추가

## 작동 방식

### 자동 백업 스케줄러
- **시작 시점**: Next.js 서버가 시작될 때 자동으로 시작
- **실행 주기**: 1시간마다 자동 실행
- **즉시 실행**: 서버 시작 시 즉시 한 번 실행
- **백업 타입**: `auto`로 자동 백업 생성
- **자동 정리**: 30일 이상 된 백업 자동 삭제

### 백업 파일 위치
- 디렉토리: `backups/`
- 파일명 형식: `backup-{timestamp}.json`
- 예시: `backup-2025-12-14T02-15-13-406Z.json`

### 백업 메타데이터
- 데이터베이스 테이블: `backup_metadata`
- 저장 정보:
  - `filename`: 백업 파일명
  - `file_path`: 백업 파일 경로
  - `file_size`: 파일 크기
  - `backup_type`: 'auto' 또는 'manual'
  - `created_by`: 생성자 (수동 백업인 경우)
  - `created_at`: 생성 시간

## 확인 방법

### 1. 서버 로그 확인
서버를 시작하면 다음 로그가 표시됩니다:
```
[Instrumentation] 자동 백업 스케줄러가 시작되었습니다.
[Backup Scheduler] 자동 백업 스케줄러를 시작합니다. (1시간마다 실행)
[Backup Scheduler] [timestamp] 자동 백업 시작...
[Backup Scheduler] [timestamp] 자동 백업 완료: backup-{timestamp}.json
```

### 2. 백업 목록 확인
- Admin 권한으로 로그인
- "백업" 탭 클릭
- 백업 목록에서 `backup_type`이 "자동"인 항목 확인

### 3. 백업 파일 확인
```powershell
Get-ChildItem backups -Filter "backup-*.json" | Sort-Object LastWriteTime -Descending
```

## 문제 해결

### 자동 백업이 실행되지 않는 경우

1. **서버 재시작 확인**
   - 서버를 재시작하면 자동 백업 스케줄러가 시작됩니다.
   - `npm run dev` 또는 `npm run start` 실행

2. **로그 확인**
   - 서버 콘솔에서 `[Backup Scheduler]` 로그 확인
   - 에러 메시지가 있는지 확인

3. **수동 테스트**
   - Admin 권한으로 로그인
   - 백업 탭에서 "수동 백업 생성" 버튼 클릭
   - 백업이 정상적으로 생성되는지 확인

4. **데이터베이스 확인**
   ```sql
   SELECT * FROM backup_metadata ORDER BY created_at DESC LIMIT 10;
   ```

## 수동 백업 vs 자동 백업

- **수동 백업**: Admin 사용자가 UI에서 직접 생성
  - `backup_type`: 'manual'
  - `created_by`: 생성한 사용자 ID

- **자동 백업**: 스케줄러에 의해 자동 생성
  - `backup_type`: 'auto'
  - `created_by`: null

## 참고사항

- 자동 백업은 서버가 실행 중일 때만 작동합니다.
- 서버가 중지되면 자동 백업도 중지됩니다.
- 서버를 재시작하면 자동 백업 스케줄러가 다시 시작됩니다.
- 프로덕션 환경에서는 서버가 항상 실행 중이어야 자동 백업이 정상 작동합니다.


