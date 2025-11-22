# 데이터베이스 설정 가이드

## MySQL 설치

### Windows

1. [MySQL 공식 사이트](https://dev.mysql.com/downloads/mysql/)에서 MySQL Installer를 다운로드
2. 설치 프로그램 실행 후 "Developer Default" 옵션 선택
3. 설치 완료 후 MySQL 서버 시작

### macOS

```bash
# Homebrew를 사용한 설치
brew install mysql
brew services start mysql
```

### Linux (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install mysql-server
sudo systemctl start mysql
sudo systemctl enable mysql
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

MySQL에 접속하여 데이터베이스가 정상적으로 생성되었는지 확인할 수 있습니다:

```bash
mysql -u root -p
```

```sql
USE project_management;
SHOW TABLES;
SELECT * FROM projects;
SELECT * FROM project_children;
```

