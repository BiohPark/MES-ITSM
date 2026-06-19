# MES ITSM 프로젝트 분석 보고서

본 프로젝트는 소프트웨어 개발 조직의 리더와 팀을 위한 프로젝트 관리 및 IT 서비스 관리(ITSM) 웹 애플리케이션인 **MES ITSM (Software Projects 관리 시스템)**입니다. Next.js 기반으로 구축되었으며, 오프라인(망분리 사내망) 배포와 ServiceNow 스타일의 UI/UX를 지원합니다.

---

## 1. 기술 스택 (Technology Stack)

### 프론트엔드 (Frontend)
- **프레임워크**: Next.js 14 (App Router)
- **라이브러리**: React 18, TypeScript, Tiptap 에디터 (Rich Text Editor)
- **스타일링**: Vanilla CSS (ServiceNow 스타일의 UI를 구현하기 위한 `globals-servicenow.css` 및 `globals.css` 포함)

### 백엔드 & 데이터베이스 (Backend & Database)
- **런타임**: Next.js API Routes (Node.js)
- **데이터베이스**: MariaDB / MySQL (`mysql2/promise` 사용, 연결 풀링 및 재연결 자동화)
- **인증**: JWT (`jose` 라이브러리), 비밀번호 암호화 (`bcryptjs`)
- **기타 엔진**: `workflow_engine` 폴더 내에 Python/Django ORM 기반의 워크플로우 정의 파일도 포함되어 있어, Next.js 백엔드와 상호 보완적으로 작동하도록 설계됨

---

## 2. 프로젝트 아키텍처 및 디렉토리 구조

프로젝트는 역할과 비즈니스 로직에 따라 깔끔하게 분리되어 있습니다.

### 디렉토리 구조 상세
- `app/`: Next.js App Router 기반의 페이지 및 API 엔드포인트 정의
  - `/api`: 각 도메인별(27개 하위 폴더) REST API 엔드포인트 제공
  - `page.tsx`: 주요 비즈니스 기능을 탭 형태로 제공하는 메인 홈 컴포넌트
  - `middleware.ts`: JWT 세션 검증, Viewonly 쓰기 권한 차단, Admin API 차단 등 수행
- `components/`: UI 컴포넌트들을 도메인 영역별로 구분하여 모듈화
- `lib/`: DB 처리(`db.ts`), 비즈니스 계산(`schedule-calculator.ts`), 백업 스케줄러, 권한 검사 등의 핵심 비즈니스 로직
- `scripts/`: 데이터베이스 스키마 생성 및 초기화 스크립트 (약 50개 이상의 마이그레이션 스크립트 보유)
- `locales/`: 영어(`en.json`) 및 한국어(`ko.json`) 다국어 번역 지원

---

## 3. 핵심 비즈니스 도메인 및 기능

### 3.1. 프로젝트 및 WBS (Work Breakdown Structure) 관리
- **프로젝트 상세 트리**: 하위 작업(WBS)을 관리하고 진척도와 일정을 트래킹합니다.
- **자동 일정 전파**: 하위 작업의 마감일 중 가장 늦은 날짜가 상위 프로젝트의 마감일로 자동 반영됩니다.
- **자동 상태 제어**:
  - 실적 진척도가 `100%`에 도달하면 상태가 `Completed`로 자동 전환됩니다.
  - 시작일, 마감일 기준의 **계획 진척도**를 계산하여, 실적 진척도가 계획보다 **10% 이상 지연**되면 자동으로 상태가 `Issued` (위험)로 표시됩니다.

### 3.2. GMP & Validation Package 관리
- 제약/제조 등 규제 산업(GMP 환경)에 특화된 데이터 모델이 반영되어 있습니다.
- **GMP Records**: 일반 Task와 연계 가능한 GMP 변경 통제(CC) 등의 규격화된 기록 관리
- **VAL Packages (Validation Packages)**: 테스트 및 적격성 평가 패키지를 관리하고, WBS 작업과 다대다(M:N)로 연결 가능

### 3.3. ITSM 티켓 시스템
- ServiceNow의 IT 서비스 관리 기능과 유사하게 구축된 완성도 높은 티켓 관리 기능입니다.
- **티켓 유형**: Request(요청), Incident(장애), Problem(문제), Change(변경)
- **부가 기능**: 티켓 승인 인박스(`approval-inbox`), 감사 로그(`audit-log`), 우선순위 정책(`priority-policy`), SLA(Service Level Agreement) 정책 및 알림 송출

### 3.4. 협업 도구 (회의록 및 액션 아이템)
- **회의록 (Meeting Notes)**: Tiptap 에디터를 활용한 Rich Text 회의록 생성 및 템플릿 지원
- **액션 아이템 (Action Items)**: 회의와 연계된 실행 과제 생성 및 담당자 지정, 진행 상태 모니터링

---

## 4. 데이터베이스 스키마 분석 (Database Schema)

`lib/db.ts` 및 마이그레이션 스크립트를 분석한 결과, 아래와 같은 구조화된 테이블 설계를 가지고 있습니다.

| 테이블명 | 주요 역할 | 관계 및 특징 |
| :--- | :--- | :--- |
| `projects` | 프로젝트 메인 정보 저장 | `id`(PK), 이름, 담당자, 진척도, 계획 대비 실적 위험 상태 관리 |
| `project_children` | 프로젝트 하위 Task (WBS) | `project_id` (FK), 담당자, 진척도, 일정, GMP/이슈 링크 |
| `users` | 사용자 정보 및 권한 | ID, 이름, 이메일, 역할(admin, user, Viewonly 등) |
| `gmp_records` | GMP 변경 통제(CC) 등 규격 기록 | `project_id` (FK), Task 및 Issue 링크 가능 |
| `val_packages` | 벨리데이션 패키지 정보 | SRB 버전, 상태 및 일정 관리 |
| `val_package_task_links` | VAL Pkg - Task 간 매핑 테이블 | 다대다 관계 해소를 위한 조인 테이블 |
| `workflows` 계열 | 워크플로우 정의 및 상태 전이 제어 | `workflows`, `workflow_statuses`, `workflow_transitions` 등 |
| `tickets` 계열 | ITSM 티켓 정보 | SLA, 결재(Approval), 댓글 등 관련 테이블 유기적 연결 |

---

## 5. 프로젝트의 독특한 기술적 특징

1. **오프라인 배포 지원 (`build:offline`)**
   - 개발 환경에서 `npm run build:offline`을 실행하면 최적화된 빌드 파일과 Node.js Standalone 웹 서버 파일이 포함된 `release` 폴더가 생성됩니다.
   - 이를 통해 인터넷과 `npm` 접속이 차단된 사내 폐쇄망(Air-gapped network) 서버에서도 Node.js 런타임만 있으면 바로 서비스를 구동할 수 있습니다.
2. **다중 환경 실행 모드**
   - 개발 모드(`npm run dev`), 사내망 공개 모드(`npm run dev:lan`), SSL 보안 접속용 HTTPS 프록시 실행 모드(`npm run start:https`) 등을 패키지 스크립트로 훌륭하게 지원합니다.
3. **N+1 쿼리 최적화**
   - 프로젝트 리스트 조회 시, 프로젝트별 하위 Task 및 GMP 레코드를 각각 개별 조회하지 않고, **IN 절을 활용한 배치 쿼리**로 가져온 뒤 메모리에서 맵(`Map`)을 사용해 그룹화하여 DB I/O 성능을 크게 향상시켰습니다.
4. **엄격한 권한 필터링**
   - `middleware.ts` 단에서 `Viewonly` 역할 계정에 대해 GET을 제외한 모든 쓰기 요청(POST/PUT/PATCH/DELETE)을 전역 차단하며, 특정 API의 경우 `admin` 권한 검증을 세션 토큰 레벨에서 강제합니다.
