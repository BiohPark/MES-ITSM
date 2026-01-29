# MariaDB 데이터베이스 파일 위치

## 일반적인 위치

MariaDB 데이터베이스 파일은 MariaDB 설치 방법에 따라 다른 위치에 저장됩니다:

### 1. MariaDB 공식 설치 프로그램 사용 시
```
C:\Program Files\MariaDB XX.X\data\project_management\
```

여기서 `XX.X`는 MariaDB 버전 번호입니다 (예: 10.11, 11.0 등)

### 2. XAMPP 사용 시
```
C:\xampp\mysql\data\project_management\
```

### 3. 사용자 정의 설치 경로
설치 시 지정한 경로의 `data` 폴더 내에 있습니다.

## 데이터베이스 파일 확인

데이터베이스 `project_management`는 다음 폴더에 저장됩니다:
- `project_management/` - 데이터베이스 폴더
  - `projects.frm` - projects 테이블 구조 파일
  - `projects.ibd` - projects 테이블 데이터 파일 (InnoDB)
  - `project_children.frm` - project_children 테이블 구조 파일
  - `project_children.ibd` - project_children 테이블 데이터 파일 (InnoDB)

## 정확한 위치 확인 방법

### 방법 1: MySQL 명령어 사용
MySQL에 접속하여 다음 명령어를 실행하세요:
```sql
SHOW VARIABLES LIKE 'datadir';
```

### 방법 2: MariaDB 설정 파일 확인
MariaDB 설정 파일(`my.ini` 또는 `my.cnf`)에서 `datadir` 항목을 확인하세요.

일반적인 설정 파일 위치:
- Windows: `C:\Program Files\MariaDB XX.X\data\my.ini` 또는 `C:\ProgramData\MariaDB XX.X\my.ini`
- XAMPP: `C:\xampp\mysql\bin\my.ini`

### 방법 3: Windows 서비스 확인
1. `Win + R` 키를 누르고 `services.msc` 입력
2. "MariaDB" 서비스 찾기
3. 속성 → 실행 파일 경로 확인

## 현재 프로젝트 설정

현재 프로젝트는 `.env.local` 파일의 설정을 사용합니다:
- 데이터베이스 이름: `project_management`
- 호스트: `localhost` (또는 `.env.local`에 설정된 값)
- 포트: `3306` (또는 `.env.local`에 설정된 값)

데이터베이스 파일은 MariaDB 서버의 데이터 디렉토리 내에 저장되며, 프로젝트 폴더 내에는 저장되지 않습니다.

