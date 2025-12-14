# VOC 관리 및 백업/복구 시스템 가이드

## 개요

ITSM 시스템에 VOC(Voice of Customer) 관리 기능과 자동 백업/복구 시스템이 추가되었습니다.

## VOC 관리 기능

### 기능 설명
- 사용자 피드백 접수 및 관리
- 카테고리별 분류 (UI/UX 개선, 기능 요청, 버그 신고, 성능 문제, 사용성 개선, 기타)
- 우선순위 관리 (Low, Medium, High, Critical)
- 상태 관리 (Open, In Progress, Resolved, Closed)
- Admin 응답 기능

### 사용 방법

#### 일반 사용자
1. **VOC 관리** 탭으로 이동
2. **피드백 제출** 버튼 클릭
3. 카테고리, 우선순위, 제목, 내용 입력 후 제출
4. 자신이 제출한 피드백 조회 및 상태 확인

#### Admin
1. **VOC 관리** 탭에서 모든 피드백 조회
2. 상태별 필터링 가능
3. 피드백 상세 보기에서:
   - 상태 변경 (진행 중, 해결됨, 종료)
   - 관리자 응답 작성
   - 우선순위 조정

### 데이터베이스 설정

VOC 테이블을 생성하려면 다음 명령어를 실행하세요:

```bash
npm run add-voc-table
```

## 백업 및 복구 시스템

### 기능 설명
- **자동 백업**: 1시간마다 자동으로 데이터베이스 백업 생성
- **수동 백업**: Admin이 언제든지 수동 백업 생성 가능
- **복구 기능**: Admin이 백업 파일로부터 데이터베이스 복구 가능
- **백업 관리**: 백업 파일 목록 조회, 파일 크기 확인
- **자동 정리**: 30일 이상 된 백업 파일 자동 삭제

### 백업 파일 형식
- JSON 형식으로 저장 (작은 파일 크기)
- 위치: `backups/` 디렉토리
- 파일명 형식: `backup-YYYY-MM-DDTHH-mm-ss-sssZ.json`

### 사용 방법

#### Admin 사용자
1. **백업** 탭으로 이동 (Admin만 접근 가능)
2. **수동 백업 생성** 버튼으로 즉시 백업 생성
3. 백업 목록에서 원하는 백업 선택
4. **복구** 버튼 클릭하여 데이터베이스 복구
   - ⚠️ **주의**: 복구 시 현재 데이터는 모두 삭제되고 백업 데이터로 대체됩니다.

### 자동 백업 설정

#### Windows Task Scheduler
1. 작업 스케줄러 열기
2. 기본 작업 만들기
3. 트리거: 매시간
4. 동작: 프로그램 시작
5. 프로그램: `node`
6. 인수: `scripts/setup-auto-backup.ts` (또는 `npm run auto-backup`)
7. 시작 위치: 프로젝트 루트 디렉토리

#### Linux/Mac cron
```bash
# crontab 편집
crontab -e

# 다음 줄 추가 (매시간 실행)
0 * * * * cd /path/to/project && npm run auto-backup
```

#### Node.js 스케줄러 라이브러리 사용 (선택사항)
```bash
npm install node-cron
```

그리고 서버 시작 시 스케줄러를 등록:
```typescript
import cron from 'node-cron'
import { createBackup, cleanupOldBackups } from './lib/backup'

// 매시간 실행
cron.schedule('0 * * * *', async () => {
  await createBackup('auto')
  await cleanupOldBackups(30)
})
```

### 데이터베이스 설정

백업 메타데이터 테이블을 생성하려면 다음 명령어를 실행하세요:

```bash
npm run add-backup-table
```

### 백업 파일 구조

백업 파일은 다음과 같은 JSON 구조를 가집니다:

```json
{
  "version": "1.0",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "tables": {
    "projects": [...],
    "project_children": [...],
    "gmp_records": [...],
    "val_packages": [...],
    "issues": [...],
    "users": [...],
    "voc_feedbacks": [...],
    "comments": [...]
  }
}
```

## API 엔드포인트

### VOC API

#### GET /api/voc
피드백 목록 조회
- Query Parameters:
  - `status`: 상태 필터 (선택)
  - `userId`: 사용자 ID 필터 (선택, Admin만 사용 가능)

#### POST /api/voc
피드백 생성/수정/삭제
- Body:
  ```json
  {
    "action": "create" | "update" | "delete",
    "category": "카테고리",
    "title": "제목",
    "content": "내용",
    "priority": "Medium",
    "id": 1,  // update/delete 시 필요
    "status": "In Progress",  // update 시
    "admin_response": "응답 내용"  // update 시
  }
  ```

### 백업 API

#### GET /api/backup
백업 목록 조회 (Admin만)
- Query Parameters:
  - `limit`: 조회할 백업 개수 (기본값: 50)

#### POST /api/backup
백업 생성/복구 (Admin만)
- Body:
  ```json
  {
    "action": "create" | "restore" | "cleanup",
    "backupId": 1,  // restore 시 필요
    "daysToKeep": 30  // cleanup 시 (선택, 기본값: 30)
  }
  ```

## 보안 고려사항

1. **백업 파일 보안**: 백업 파일에는 민감한 정보가 포함될 수 있으므로 적절한 접근 제어가 필요합니다.
2. **복구 권한**: 복구 기능은 Admin만 사용할 수 있도록 제한되어 있습니다.
3. **자동 백업 인증**: 자동 백업 API는 환경 변수 `BACKUP_AUTH_TOKEN`으로 보호됩니다.

## 문제 해결

### 백업 디렉토리 생성 오류
백업 디렉토리가 자동으로 생성되지만, 권한 문제가 있을 수 있습니다. 수동으로 생성:
```bash
mkdir backups
chmod 755 backups
```

### 백업 파일이 너무 큰 경우
백업 파일은 JSON 형식으로 저장되며, 압축되지 않습니다. 필요시 백업 후 gzip 압축을 추가할 수 있습니다.

### 복구 실패
- 백업 파일이 손상되었는지 확인
- 데이터베이스 연결 상태 확인
- 외래 키 제약 조건 확인

## 향후 개선 사항

- [ ] 백업 파일 압축 기능
- [ ] 증분 백업 지원
- [ ] 백업 파일 다운로드 기능
- [ ] 백업 스케줄 커스터마이징
- [ ] 백업 알림 기능
- [ ] VOC 통계 및 대시보드

