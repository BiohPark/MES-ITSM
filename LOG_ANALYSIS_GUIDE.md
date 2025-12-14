# 로그 분석 가이드

PIM 매니저 권한 관련 문제를 분석하기 위한 로그 수집 및 분석 가이드입니다.

## 로그 수집 방법

### 1. 개발 서버 콘솔에서 로그 확인

PIM 매니저 권한으로 로그인 후 새로고침하면 서버 콘솔에 다음 로그가 출력됩니다:

#### 필수 확인 로그:

1. **세션 검증 로그**
   ```
   Middleware - Session verified: { userId: '...', role: 'PIM 매니저', username: '...' }
   ```

2. **API 요청 헤더 로그**
   ```
   Projects API - Request headers: { userRole: 'PIM 매니저', userId: '...' }
   ```

3. **에러 로그**
   ```
   Error in getProjects (attempt 1/3): ...
   Error code: ...
   Error message: ...
   Error stack: ...
   ```

4. **데이터베이스 연결 테스트 로그**
   ```
   Database connection test failed (attempt 1/2): ...
   ```

### 2. 브라우저 개발자 도구에서 확인

1. **Network 탭** 열기
2. 실패한 요청 (`/api/projects`, `/api/issues` 등) 클릭
3. **Response 탭**에서 에러 상세 정보 확인
   - `error`: 에러 메시지
   - `code`: 에러 코드
   - `details`: 상세 정보 (개발 모드에서만)
   - `stack`: 스택 트레이스 (개발 모드에서만)

## 로그 분석

### 자동 분석

로그를 `logs.txt` 파일로 저장한 후:

```bash
npm run analyze-logs logs.txt
```

### 수동 분석 체크리스트

#### 1. 세션 검증 확인
- [ ] `Middleware - Session verified` 로그에서 `role` 값이 `'PIM 매니저'`인지 확인
- [ ] `JWT 검증 성공` 로그에서 권한 정보가 올바른지 확인

#### 2. API 요청 확인
- [ ] `Projects API - Request headers` 로그에서 `userRole`이 `'PIM 매니저'`인지 확인
- [ ] 헤더에 `x-user-role`과 `x-user-id`가 제대로 전달되는지 확인

#### 3. 데이터베이스 연결 확인
- [ ] `Database connection test` 로그에서 연결 성공 여부 확인
- [ ] 연결 실패 시 에러 코드 및 메시지 확인

#### 4. 쿼리 에러 확인
- [ ] `Error in getProjects` 로그에서 에러 코드 확인
- [ ] 에러 메시지에서 구체적인 원인 파악
- [ ] 스택 트레이스에서 실패 지점 확인

## 일반적인 문제점 및 해결 방법

### 문제 1: 세션 검증 실패

**증상**: `JWT 검증 실패` 로그 출력

**가능한 원인**:
- JWT 토큰 만료
- JWT 시크릿 키 불일치
- 세션 토큰에 권한 정보 누락

**해결 방법**:
1. 로그아웃 후 다시 로그인
2. `.env.local`에서 `JWT_SECRET` 확인
3. 세션 토큰 생성 시 role 값 확인

### 문제 2: 데이터베이스 연결 실패

**증상**: `Database connection test failed` 로그 출력

**가능한 원인**:
- MySQL 서버가 실행되지 않음
- 연결 풀 리소스 부족
- 타임아웃 발생

**해결 방법**:
1. MySQL 서버 상태 확인
2. `.env.local`에서 데이터베이스 연결 설정 확인
3. 연결 풀 재생성 로그 확인

### 문제 3: 쿼리 실행 실패

**증상**: `Error in getProjects` 로그 출력

**가능한 원인**:
- 테이블이 존재하지 않음
- 권한 부족
- 쿼리 문법 오류

**해결 방법**:
1. 에러 코드 확인 (`ER_NO_SUCH_TABLE`, `ER_ACCESS_DENIED_ERROR` 등)
2. 데이터베이스 테이블 존재 여부 확인
3. 데이터베이스 사용자 권한 확인

## 로그 파일 예시

```
Middleware - Session verified: { userId: 'USER-00001', role: 'PIM 매니저', username: 'pim_mgr' }
Projects API - Request headers: { userRole: 'PIM 매니저', userId: 'USER-00001' }
Error in getProjects (attempt 1/3): Error: ...
Error code: ER_ACCESS_DENIED_ERROR
Error message: Access denied for user 'root'@'localhost'
```

## 다음 단계

로그를 수집한 후 다음 정보를 확인하세요:

1. **에러 코드**: MySQL 에러 코드 (예: `ER_ACCESS_DENIED_ERROR`)
2. **에러 메시지**: 구체적인 에러 내용
3. **스택 트레이스**: 에러가 발생한 정확한 위치

이 정보를 바탕으로 문제를 해결할 수 있습니다.

