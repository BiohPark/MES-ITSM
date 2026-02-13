-- gantt_projects.owner_id 컬럼 타입 수정 (INT → VARCHAR(50))
-- users.id 형식('USER-00001')과 일치시킵니다.
-- 실행: mysql -u root -p project_management < scripts/fix-gantt-owner-id.sql

ALTER TABLE gantt_projects MODIFY COLUMN owner_id VARCHAR(50) NULL;
