@echo off
echo gantt_projects.owner_id 마이그레이션 실행
echo.
call npm run fix-gantt-owner-id
if %ERRORLEVEL% NEQ 0 (
  echo.
  echo MariaDB가 실행 중인지 확인하세요.
  echo 또는 다음 SQL을 직접 실행하세요:
  echo   ALTER TABLE gantt_projects MODIFY COLUMN owner_id VARCHAR(50) NULL;
  echo.
  pause
)
