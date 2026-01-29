# MySQL → MariaDB 전환 완료 요약

## 완료된 작업

### 1. 코드 수정
- ✅ `lib/db.ts`: MariaDB 호환 설정으로 수정
  - mysql2 호환되지 않는 옵션 제거 (acquireTimeout, timeout, reconnect)
  - 주석을 MariaDB로 업데이트

### 2. 문서 업데이트
- ✅ `README.md`: MySQL → MariaDB로 변경
- ✅ `DATABASE_SETUP.md`: MariaDB 설치 가이드로 업데이트
- ✅ `DB_LOCATION.md`: MariaDB 파일 위치로 업데이트
- ✅ `MARIADB_SETUP.md`: 새로운 MariaDB 설정 가이드 생성

### 3. 스크립트 개선
- ✅ `package.json`: setup-db 스크립트에 누락된 테이블 추가
  - `add-predecessors-table` 추가
  - `add-gantt-tables` 추가
- ✅ `scripts/test-mariadb-connection.ts`: MariaDB 연결 테스트 스크립트 생성

## MariaDB 서버 시작 방법

### Windows에서 MariaDB 서비스 시작

1. **서비스 관리자 사용**
   - `Win + R` → `services.msc` 입력
   - "MariaDB" 서비스 찾기
   - 우클릭 → 시작

2. **명령 프롬프트 사용**
   ```cmd
   net start MariaDB
   ```

3. **PowerShell 사용**
   ```powershell
   Start-Service -Name MariaDB
   ```

### MariaDB 설치 확인

MariaDB가 설치되어 있지 않은 경우:
1. [MariaDB 다운로드 페이지](https://mariadb.org/download/)에서 설치 프로그램 다운로드
2. 설치 후 서비스 시작

## 테스트 방법

### 1. MariaDB 서버 시작 확인

```powershell
# 서비스 상태 확인
Get-Service -Name "*mariadb*"

# 포트 확인
netstat -an | findstr ":3306"
```

### 2. 연결 테스트

MariaDB 서버가 시작된 후:

```bash
npx tsx scripts/test-mariadb-connection.ts
```

### 3. 데이터베이스 초기화

```bash
npm run setup-db
```

이 명령어는 다음을 실행합니다:
- 데이터베이스 생성
- 모든 테이블 생성 (projects, users, gantt_projects, workflows, issues, comments 등)
- 관리자 계정 생성

### 4. 애플리케이션 실행

```bash
npm run dev
```

## 환경 변수 설정

`.env.local` 파일을 생성하고 다음 내용을 추가:

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mariadb_password
DB_NAME=project_management
```

## 변경 사항 상세

### lib/db.ts
- MariaDB 호환을 위해 일부 옵션 제거
- 주석 업데이트

### package.json
- setup-db 스크립트에 누락된 테이블 추가

### 문서
- 모든 MySQL 언급을 MariaDB로 변경
- MariaDB 설치 및 설정 가이드 추가

## 테스트 결과

### ✅ 연결 테스트 성공
- MariaDB 버전: 12.1.2-MariaDB
- 포트: 3307 (기본 포트 3306이 아닌 경우)
- 연결 상태: 정상

### ✅ 데이터베이스 초기화 성공
- 데이터베이스: `project_management` 생성 완료
- 총 18개 테이블 생성 완료:
  - attachments
  - backup_metadata
  - comments
  - gantt_projects
  - gantt_tasks
  - gmp_records
  - issues
  - predecessors
  - project_children
  - projects
  - users (관리자 계정 1개 생성됨)
  - val_package_task_links
  - val_packages
  - voc_feedbacks
  - workflow_schemes (2개 레코드)
  - workflow_statuses (13개 레코드)
  - workflow_transitions (20개 레코드)
  - workflows (2개 레코드)

### ✅ 애플리케이션 실행
- 개발 서버가 정상적으로 시작되었습니다
- MariaDB와 정상적으로 통신 중

## 완료된 단계

1. ✅ MariaDB 서버 시작 확인
2. ✅ `.env.local` 파일 생성 및 설정 (포트 3307)
3. ✅ 연결 테스트 실행 및 성공
4. ✅ 데이터베이스 초기화 실행 및 성공
5. ✅ 모든 테이블 생성 확인
6. ✅ 애플리케이션 실행 및 테스트

## 중요 사항

**포트 설정**: 현재 MariaDB가 포트 **3307**에서 실행 중입니다.
`.env.local` 파일에 `DB_PORT=3307`이 설정되어 있습니다.

다른 환경에서 사용할 때는 MariaDB 포트를 확인하고 `.env.local` 파일을 수정하세요.

