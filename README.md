# Software Projects 관리 시스템

소프트웨어 개발 조직의 리더를 위한 프로젝트 관리 웹 애플리케이션입니다. Next.js와 TypeScript로 개발되었으며, MySQL 데이터베이스를 통해 프로젝트 데이터를 관리합니다.

## 주요 기능

- 📋 **프로젝트 리스트**: 등록된 프로젝트를 한눈에 확인
- 📊 **대시보드**: 프로젝트 상태별 요약 정보 제공
- 🗄️ **MariaDB 데이터베이스**: 고성능 데이터베이스로 프로젝트 데이터 관리
- 🆕 **프로젝트 생성/수정**: UI에서 바로 프로젝트를 추가하거나 수정
- 🌿 **하위 아이템 관리**: 프로젝트별 세부 작업을 컨텍스트 메뉴로 추가
- 🔄 **실시간 업데이트**: API를 통한 데이터 동기화

## 시작하기

### 1. MariaDB 설치 및 설정

MariaDB가 설치되어 있어야 합니다. 설치되어 있지 않다면 [MariaDB 공식 사이트](https://mariadb.org/download/)에서 다운로드하세요.

**중요**: MariaDB 서버가 실행 중이어야 합니다. Windows에서는 서비스 관리자에서 "MariaDB" 서비스를 시작하세요.

### 2. 환경 변수 설정

프로젝트 루트에 `.env.local` 파일을 생성하고 다음 내용을 추가하세요:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=project_management
```

### 3. 의존성 설치

```bash
npm install
```

### 4. 데이터베이스 초기화

데이터베이스와 테이블을 생성합니다:

```bash
npm run init-db
```

### 5. CSV 데이터 마이그레이션 (선택사항)

기존 CSV 데이터가 있다면 데이터베이스로 마이그레이션할 수 있습니다:

```bash
npm run migrate
```

### 6. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어 결과를 확인하세요.

## 프로젝트 구조

- `app/` - Next.js App Router 디렉토리
  - `page.tsx` - 메인 페이지 컴포넌트
  - `api/projects/route.ts` - 프로젝트 API 엔드포인트
- `lib/` - 유틸리티 함수 및 헬퍼
  - `db.ts` - MariaDB 데이터베이스 연결 및 쿼리 유틸리티
- `scripts/` - 유틸리티 스크립트
  - `init-db.ts` - 데이터베이스 초기화 스크립트
  - `migrate-csv-to-db.ts` - CSV 데이터 마이그레이션 스크립트
- `types/` - TypeScript 타입 정의
  - `project.ts` - 프로젝트 타입 정의

## 데이터베이스 스키마

### projects 테이블

프로젝트 정보를 저장하는 메인 테이블입니다.

| 컬럼명 | 타입 | 설명 |
|--------|------|------|
| id | VARCHAR(50) | 프로젝트 고유 ID (Primary Key) |
| name | VARCHAR(255) | 프로젝트 이름 |
| owner | VARCHAR(100) | 담당 리더 이름 |
| members | INT | 팀원 수 |
| status | VARCHAR(50) | 프로젝트 상태 |
| progress | INT | 진행률 (0-100) |
| due | DATE | 마감일 |
| created_at | TIMESTAMP | 생성일시 |
| updated_at | TIMESTAMP | 수정일시 |

### project_children 테이블

프로젝트의 하위 아이템을 저장하는 테이블입니다.

| 컬럼명 | 타입 | 설명 |
|--------|------|------|
| id | VARCHAR(50) | 하위 아이템 고유 ID (Primary Key) |
| project_id | VARCHAR(50) | 프로젝트 ID (Foreign Key) |
| title | VARCHAR(255) | 하위 아이템 제목 |
| owner | VARCHAR(100) | 담당자 이름 |
| status | VARCHAR(50) | 상태 |
| due | DATE | 마감일 |
| created_at | TIMESTAMP | 생성일시 |
| updated_at | TIMESTAMP | 수정일시 |

## API 엔드포인트

### GET /api/projects
프로젝트 목록을 조회합니다.

### POST /api/projects
프로젝트를 추가, 수정, 삭제합니다.

**요청 본문 예시:**
```json
{
  "action": "add",
  "id": "PJT-2501",
  "name": "새 프로젝트",
  "owner": "홍길동",
  "members": 5,
  "status": "Planning",
  "progress": 0,
  "due": "2025-12-31"
}
```

**액션 타입:**
- `add`: 새 프로젝트 추가
- `update`: 기존 프로젝트 수정
- `delete`: 프로젝트 삭제
- `addChild`: 특정 프로젝트에 하위 아이템 추가

## 오프라인 배포 (npm 접속 불가 환경)

회사 보안 정책 등으로 npm 접속이 불가능한 환경에서 실행할 수 있습니다.

### 개발자 (집에서 수행)

1. `npm run build:offline` 실행
2. 생성된 `release` 폴더를 Git에 커밋하거나 압축하여 전달

### 배포 환경 (회사에서 수행)

1. `release` 폴더로 이동
2. `.env` 파일 생성 (DB 연결 정보 등 - 프로젝트 루트의 `.env.example` 참고)
3. `node server.js` 실행

```bash
cd release
node server.js
```

기본 포트: 3000 (PORT 환경변수로 변경 가능)
**필요사항**: Node.js만 설치되어 있으면 됩니다. npm 설치 불필요.

---

## 스크립트

- `npm run dev` - 개발 서버 실행
- `npm run build` - 프로덕션 빌드
- `npm run build:offline` - 오프라인 배포용 빌드 (release 폴더 생성)
- `npm run start` - 프로덕션 서버 실행
- `npm run lint` - ESLint 실행
- `npm run init-db` - 데이터베이스 및 테이블 초기화
- `npm run migrate` - CSV 데이터를 데이터베이스로 마이그레이션

