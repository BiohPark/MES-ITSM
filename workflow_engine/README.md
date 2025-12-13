# 워크플로우 관리 시스템

Task 이슈 유형에 대한 동적 워크플로우 관리 시스템입니다.

## 구조

### 백엔드 (Python/Django ORM)
- `models.py`: 데이터 모델 정의
- `views.py`: API 엔드포인트 및 비즈니스 로직

### 프론트엔드 (Next.js)
- `components/tasks/TaskStatusActions.tsx`: Task 상태 전환 UI 컴포넌트
- `app/api/tasks/[taskId]/transitions/route.ts`: 전환 목록 조회 API
- `app/api/tasks/[taskId]/transition/route.ts`: 전환 실행 API

### 데이터베이스
- `scripts/add-workflow-tables.ts`: 워크플로우 테이블 생성 스크립트

## 설치 및 설정

### 1. 데이터베이스 테이블 생성

```bash
npm run add-workflow-tables
```

이 스크립트는 다음 테이블을 생성합니다:
- `workflows`: 워크플로우 정의
- `workflow_statuses`: 상태 정의
- `workflow_transitions`: 상태 전환 정의
- `workflow_schemes`: 워크플로우 스킴

### 2. 기본 워크플로우 데이터

스크립트 실행 시 다음 기본 워크플로우가 자동 생성됩니다:

**Task Workflow**
- 상태: Planning (초기) → In Progress → Review → Completed (최종) / Cancelled (최종)
- 전환:
  - Planning → In Progress: "Start Work"
  - In Progress → Review: "Submit for Review"
  - Review → In Progress: "Back to Work"
  - Review → Completed: "Complete"
  - Planning/In Progress → Cancelled: "Cancel"

## 사용 방법

### 프론트엔드에서 컴포넌트 사용

```tsx
import { TaskStatusActions } from '@/components/tasks/TaskStatusActions'

function TaskDetailPage({ taskId }: { taskId: string }) {
  const [taskStatus, setTaskStatus] = useState<string>('')

  return (
    <div>
      <h2>Task 상세</h2>
      <TaskStatusActions
        taskId={taskId}
        currentStatus={taskStatus}
        onStatusChange={(newStatus) => {
          setTaskStatus(newStatus)
          // Task 데이터 새로고침 등 추가 작업
        }}
        userRole="admin" // 선택사항: 세션에서 가져올 수 있음
        userId="user123" // 선택사항: 세션에서 가져올 수 있음
      />
    </div>
  )
}
```

### API 직접 호출

#### 전환 목록 조회

```typescript
const response = await fetch(`/api/tasks/${taskId}/transitions`, {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
  },
  credentials: 'include',
})

const data = await response.json()
// {
//   task_id: "TASK-00001",
//   current_status: "Planning",
//   available_transitions: [
//     {
//       id: 1,
//       name: "Start Work",
//       to_status_id: 2,
//       to_status_name: "In Progress",
//       description: null
//     }
//   ]
// }
```

#### 전환 실행

```typescript
const response = await fetch(`/api/tasks/${taskId}/transition`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  credentials: 'include',
  body: JSON.stringify({
    transition_id: 1,
    user_role: "admin", // 선택사항
    user_id: "user123"  // 선택사항
  }),
})

const data = await response.json()
// {
//   success: true,
//   message: "상태가 Planning에서 In Progress로 변경되었습니다.",
//   task_id: "TASK-00001",
//   old_status: "Planning",
//   new_status: "In Progress",
//   transition_name: "Start Work"
// }
```

## 전환 조건 설정

전환의 `condition` 필드에 JSON 형식으로 조건을 설정할 수 있습니다:

```json
{
  "required_roles": ["admin", "개발 매니저"],
  "required_users": ["user123", "user456"],
  "owner_only": true,
  "required_fields": ["resolution", "assignee"]
}
```

- `required_roles`: 특정 역할만 전환 가능
- `required_users`: 특정 사용자만 전환 가능
- `owner_only`: Task 소유자만 전환 가능
- `required_fields`: 필수 필드가 채워져 있어야 전환 가능

## Python 백엔드 사용 (Django)

Python 백엔드를 사용하는 경우:

1. `workflow_engine/models.py`를 Django 앱에 추가
2. `workflow_engine/views.py`의 뷰를 URL에 연결:

```python
# urls.py
from django.urls import path
from workflow_engine import views

urlpatterns = [
    path('api/tasks/<str:task_id>/transitions', views.TaskTransitionsView.as_view()),
    path('api/tasks/<str:task_id>/transition', views.TaskTransitionExecuteView.as_view()),
]
```

3. 마이그레이션 실행:

```bash
python manage.py makemigrations workflow_engine
python manage.py migrate
```

## 데이터베이스 스키마

### workflows
- `id`: INT (PK)
- `name`: VARCHAR(100) (UNIQUE)
- `description`: TEXT
- `is_active`: BOOLEAN

### workflow_statuses
- `id`: INT (PK)
- `name`: VARCHAR(50)
- `category`: VARCHAR(20) (todo, in_progress, done)
- `workflow_id`: INT (FK → workflows)
- `is_initial`: BOOLEAN
- `is_final`: BOOLEAN
- `display_order`: INT

### workflow_transitions
- `id`: INT (PK)
- `name`: VARCHAR(100)
- `workflow_id`: INT (FK → workflows)
- `from_status_id`: INT (FK → workflow_statuses)
- `to_status_id`: INT (FK → workflow_statuses)
- `condition`: JSON
- `is_active`: BOOLEAN
- `display_order`: INT

### workflow_schemes
- `id`: INT (PK)
- `name`: VARCHAR(100) (UNIQUE)
- `workflow_id`: INT (FK → workflows)
- `is_default`: BOOLEAN

