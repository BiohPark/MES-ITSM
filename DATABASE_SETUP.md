# 데이터베이스 설정 가이드

## MariaDB 설치

이 프로젝트는 MariaDB를 사용합니다. MariaDB는 MySQL과 호환되며, mysql2 드라이버를 통해 연결됩니다.

### Windows

1. [MariaDB 공식 사이트](https://mariadb.org/download/)에서 MariaDB 설치 프로그램을 다운로드
2. 설치 프로그램 실행 후 기본 설정으로 설치
3. 설치 완료 후 MariaDB 서버 시작
   - Windows 서비스에서 "MariaDB" 서비스가 실행 중인지 확인
   - 또는 명령 프롬프트에서: `net start MariaDB`

### macOS

```bash
# Homebrew를 사용한 설치
brew install mariadb
brew services start mariadb
```

### Linux (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install mariadb-server
sudo systemctl start mariadb
sudo systemctl enable mariadb
```

## 데이터베이스 초기화

프로젝트 루트에서 다음 명령어를 실행하세요:

```bash
npm run init-db
```

이 명령어는:
- `project_management` 데이터베이스를 생성합니다
- `projects` 테이블을 생성합니다
- `project_children` 테이블을 생성합니다

## 환경 변수 설정

`.env.local` 파일을 생성하고 다음 내용을 추가하세요:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=project_management
```

## CSV 데이터 마이그레이션

기존 CSV 파일의 데이터를 데이터베이스로 마이그레이션하려면:

```bash
npm run migrate
```

이 명령어는 `data/projects.csv` 파일을 읽어서 데이터베이스에 저장합니다.

## 데이터베이스 연결 확인

MariaDB에 접속하여 데이터베이스가 정상적으로 생성되었는지 확인할 수 있습니다:

```bash
# Windows (MariaDB 설치 경로에 따라 다를 수 있음)
"C:\Program Files\MariaDB XX.X\bin\mysql.exe" -u root -p

# macOS/Linux
mysql -u root -p
```

```sql
USE project_management;
SHOW TABLES;
SELECT * FROM projects;
SELECT * FROM project_children;
```

## MariaDB 연결 테스트

프로젝트에서 MariaDB 연결을 테스트하려면:

```bash
npx tsx scripts/test-mariadb-connection.ts
```

이 스크립트는:
- MariaDB 서버 연결 상태 확인
- 데이터베이스 버전 확인
- 데이터베이스 및 테이블 목록 확인

