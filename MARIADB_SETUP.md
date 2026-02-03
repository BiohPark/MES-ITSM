# MariaDB 설정 및 연결 가이드

## MariaDB 서버 확인

### Windows에서 MariaDB 서비스 확인

1. **서비스 관리자에서 확인**
   - `Win + R` 키를 누르고 `services.msc` 입력
   - "MariaDB" 서비스를 찾아 실행 중인지 확인
   - 실행 중이 아니면 서비스를 시작하세요

2. **명령 프롬프트에서 확인**
   ```cmd
   net start MariaDB
   ```

3. **포트 확인**
   - 기본 포트: 3306
   - 다른 포트를 사용하는 경우 `.env.local` 파일에 `DB_PORT` 설정

### MariaDB 연결 정보 확인

MariaDB에 접속하여 연결 정보를 확인할 수 있습니다:

```bash
# Windows (MariaDB 설치 경로에 따라 다를 수 있음)
"C:\Program Files\MariaDB XX.X\bin\mysql.exe" -u root -p

# 또는 환경 변수 PATH에 추가된 경우
mysql -u root -p
```

접속 후:
```sql
SELECT VERSION();
SHOW VARIABLES LIKE 'port';
```

## 환경 변수 설정

프로젝트 루트에 `.env.local` 파일을 생성하고 다음 내용을 추가하세요:

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mariadb_password
DB_NAME=project_management
```

**중요 사항:**
- `DB_HOST`: MariaDB 서버 주소 (기본값: 127.0.0.1)
- `DB_PORT`: MariaDB 포트 (기본값: 3306, 다른 포트 사용 시 변경)
- `DB_USER`: MariaDB 사용자명 (기본값: root)
- `DB_PASSWORD`: MariaDB 비밀번호
- `DB_NAME`: 데이터베이스 이름 (기본값: project_management)

## 연결 테스트

프로젝트에서 MariaDB 연결을 테스트하려면:

```bash
npx tsx scripts/test-mariadb-connection.ts
```

이 스크립트는:
- ✅ MariaDB 서버 연결 상태 확인
- ✅ 데이터베이스 버전 확인 (MariaDB인지 확인)
- ✅ 데이터베이스 목록 확인
- ✅ 테이블 목록 확인

## 데이터베이스 초기화

모든 테이블을 생성하려면:

```bash
npm run setup-db
```

이 명령어는 다음을 실행합니다:
1. 데이터베이스 생성 (`init-db`)
2. 모든 테이블 생성 (users, projects, gantt_projects, workflows, issues, comments 등)
3. 관리자 계정 생성

## 문제 해결

### 연결 실패 (ECONNREFUSED)

**원인**: MariaDB 서버가 실행되지 않음

**해결 방법**:
1. Windows 서비스 관리자에서 "MariaDB" 서비스 시작
2. 또는 명령 프롬프트에서: `net start MariaDB`

### 인증 실패 (ER_ACCESS_DENIED_ERROR)

**원인**: 잘못된 사용자명 또는 비밀번호

**해결 방법**:
1. `.env.local` 파일의 `DB_USER`와 `DB_PASSWORD` 확인
2. MariaDB에 직접 접속하여 사용자 정보 확인

### 포트 충돌

**원인**: 다른 포트에서 MariaDB가 실행 중

**해결 방법**:
1. MariaDB 설정 파일에서 포트 확인
2. `.env.local` 파일의 `DB_PORT`를 올바른 포트로 변경

## MariaDB와 MySQL의 차이점

이 프로젝트는 `mysql2` 드라이버를 사용하며, MariaDB와 완전히 호환됩니다. 
- MariaDB는 MySQL의 포크(fork)로, 대부분의 MySQL 기능을 지원합니다
- `mysql2` 드라이버는 MariaDB와 MySQL 모두를 지원합니다
- SQL 문법은 거의 동일합니다


