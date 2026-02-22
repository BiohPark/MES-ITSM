# Git 연동 및 지속적 커밋 환경

이 프로젝트는 **https://github.com/sanjaydosa/itsm_trial.git** 과 연동되어 있습니다.

## 1. 첫 설정 (한 번만)

### Git 사용자 정보 설정

커밋 시 필요한 이름과 이메일을 이 저장소에만 적용하려면:

```powershell
cd c:\Users\seung\YSJ_Projects\ITSM
git config user.name "본인이름"
git config user.email "본인@이메일.com"
```

전역으로 설정하려면 `--global`을 붙입니다.

```powershell
git config --global user.name "본인이름"
git config --global user.email "본인@이메일.com"
```

### Push 권한이 없는 경우 (Fork 사용)

원본 저장소(sanjaydosa/itsm_trial)에 직접 push 권한이 없다면:

1. GitHub에서 **Fork** 생성 (상단 Fork 버튼)
2. 본인 Fork 주소를 추가 원격으로 등록:

```powershell
git remote add myfork https://github.com/본인아이디/itsm_trial.git
```

3. 커밋 후 push는 `myfork`로:

```powershell
git push myfork main
```

원본 최신 반영:

```powershell
git fetch origin
git merge origin/main
```

## 2. 일상적인 작업 흐름

```powershell
# 1) 최신 소스 받기
git pull origin main

# 2) 작업 후 변경 사항 확인
git status
git diff

# 3) 스테이징 및 커밋
git add .
# 또는 특정 파일만: git add app/page.tsx lib/db.ts
git commit -m "작업 내용 요약"

# 4) 원격에 반영 (권한이 있으면 origin, 없으면 myfork)
git push origin main
# 또는: git push myfork main
```

## 3. 현재 연동 상태

- **원격(origin)**: `https://github.com/sanjaydosa/itsm_trial.git` (fetch/push)
- **브랜치**: `main`
- **상태**: 클론 직후와 동기화된 상태입니다.

이 문서대로 설정하면 이 디렉터리에서 지속적으로 commit/push 할 수 있습니다.
