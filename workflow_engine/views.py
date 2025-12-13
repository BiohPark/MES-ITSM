"""
워크플로우 관리 시스템 - API 엔드포인트 및 비즈니스 로직
Python/Django 기반
"""

from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.views import View
import json

from .models import WorkflowModel, StatusModel, TransitionModel, TaskModel, WorkflowSchemeModel


class TransitionChecker:
    """
    상태 전환 유효성 검사 클래스
    """
    
    @staticmethod
    def get_available_transitions(task: TaskModel, user_role: str = None, user_id: str = None) -> list:
        """
        주어진 Task에 대해 사용 가능한 전환 목록을 반환
        
        Args:
            task: TaskModel 인스턴스
            user_role: 사용자 역할 (권한 체크용)
            user_id: 사용자 ID (권한 체크용)
        
        Returns:
            사용 가능한 TransitionModel 인스턴스 리스트
        """
        if not task.current_status:
            # 초기 상태가 없으면 워크플로우의 초기 상태로 설정
            workflow = task.get_workflow()
            if workflow:
                initial_status = workflow.statuses.filter(is_initial=True).first()
                if initial_status:
                    task.current_status = initial_status
                    task.save()
                else:
                    return []
            else:
                return []
        
        workflow = task.get_workflow()
        if not workflow:
            return []
        
        # 현재 상태에서 나가는 모든 전환 조회
        transitions = TransitionModel.objects.filter(
            workflow=workflow,
            from_status=task.current_status,
            is_active=True
        ).select_related('to_status').order_by('display_order', 'name')
        
        # 조건 검사하여 필터링
        available_transitions = []
        for transition in transitions:
            if TransitionChecker._check_transition_conditions(transition, task, user_role, user_id):
                available_transitions.append(transition)
        
        return available_transitions
    
    @staticmethod
    def _check_transition_conditions(
        transition: TransitionModel,
        task: TaskModel,
        user_role: str = None,
        user_id: str = None
    ) -> bool:
        """
        전환 조건을 검사
        
        Args:
            transition: TransitionModel 인스턴스
            task: TaskModel 인스턴스
            user_role: 사용자 역할
            user_id: 사용자 ID
        
        Returns:
            조건을 만족하면 True, 아니면 False
        """
        condition = transition.condition or {}
        
        # 역할 기반 권한 체크
        if 'required_roles' in condition:
            required_roles = condition['required_roles']
            if user_role and user_role not in required_roles:
                return False
        
        # 사용자 기반 권한 체크
        if 'required_users' in condition:
            required_users = condition['required_users']
            if user_id and user_id not in required_users:
                return False
        
        # Task 소유자 체크
        if 'owner_only' in condition and condition['owner_only']:
            if user_id and task.owner != user_id:
                return False
        
        # 필수 필드 체크
        if 'required_fields' in condition:
            required_fields = condition['required_fields']
            for field in required_fields:
                if not hasattr(task, field) or not getattr(task, field, None):
                    return False
        
        return True
    
    @staticmethod
    def can_transition(
        task: TaskModel,
        transition_id: int,
        user_role: str = None,
        user_id: str = None
    ) -> tuple[bool, str]:
        """
        특정 전환이 가능한지 확인
        
        Args:
            task: TaskModel 인스턴스
            transition_id: TransitionModel ID
            user_role: 사용자 역할
            user_id: 사용자 ID
        
        Returns:
            (가능 여부, 에러 메시지) 튜플
        """
        try:
            transition = TransitionModel.objects.get(id=transition_id)
        except TransitionModel.DoesNotExist:
            return False, "전환을 찾을 수 없습니다."
        
        # 워크플로우 일치 확인
        workflow = task.get_workflow()
        if not workflow or transition.workflow != workflow:
            return False, "워크플로우가 일치하지 않습니다."
        
        # 현재 상태 확인
        if task.current_status != transition.from_status:
            return False, f"현재 상태({task.current_status.name})에서 이 전환을 수행할 수 없습니다."
        
        # 조건 검사
        if not TransitionChecker._check_transition_conditions(transition, task, user_role, user_id):
            return False, "전환 조건을 만족하지 않습니다."
        
        return True, ""


@method_decorator(csrf_exempt, name='dispatch')
class TaskTransitionsView(View):
    """
    Task의 사용 가능한 전환 목록 조회 API
    GET /api/tasks/{task_id}/transitions
    """
    
    def get(self, request, task_id):
        try:
            task = TaskModel.objects.get(id=task_id)
        except TaskModel.DoesNotExist:
            return JsonResponse(
                {'error': 'Task를 찾을 수 없습니다.'},
                status=404
            )
        
        # 사용자 정보 추출 (세션/토큰에서)
        user_role = request.GET.get('user_role') or request.headers.get('X-User-Role')
        user_id = request.GET.get('user_id') or request.headers.get('X-User-Id')
        
        # 사용 가능한 전환 조회
        transitions = TransitionChecker.get_available_transitions(task, user_role, user_id)
        
        # 응답 형식 변환
        transitions_data = [
            {
                'id': t.id,
                'name': t.name,
                'to_status_id': t.to_status.id,
                'to_status_name': t.to_status.name,
                'description': t.description,
            }
            for t in transitions
        ]
        
        return JsonResponse({
            'task_id': task.id,
            'current_status': task.current_status.name if task.current_status else None,
            'available_transitions': transitions_data
        })


@method_decorator(csrf_exempt, name='dispatch')
class TaskTransitionExecuteView(View):
    """
    Task 상태 전환 실행 API
    POST /api/tasks/{task_id}/transition
    """
    
    def post(self, request, task_id):
        try:
            task = TaskModel.objects.get(id=task_id)
        except TaskModel.DoesNotExist:
            return JsonResponse(
                {'error': 'Task를 찾을 수 없습니다.'},
                status=404
            )
        
        try:
            body = json.loads(request.body)
            transition_id = body.get('transition_id')
            
            if not transition_id:
                return JsonResponse(
                    {'error': 'transition_id가 필요합니다.'},
                    status=400
                )
        except json.JSONDecodeError:
            return JsonResponse(
                {'error': '잘못된 JSON 형식입니다.'},
                status=400
            )
        
        # 사용자 정보 추출
        user_role = body.get('user_role') or request.headers.get('X-User-Role')
        user_id = body.get('user_id') or request.headers.get('X-User-Id')
        
        # 전환 가능 여부 확인
        can_transition, error_message = TransitionChecker.can_transition(
            task, transition_id, user_role, user_id
        )
        
        if not can_transition:
            return JsonResponse(
                {'error': error_message},
                status=400
            )
        
        # 전환 실행
        try:
            transition = TransitionModel.objects.get(id=transition_id)
            old_status = task.current_status.name if task.current_status else None
            task.current_status = transition.to_status
            task.save()
            
            return JsonResponse({
                'success': True,
                'message': f'상태가 {old_status}에서 {transition.to_status.name}로 변경되었습니다.',
                'task_id': task.id,
                'old_status': old_status,
                'new_status': transition.to_status.name,
                'transition_name': transition.name
            })
        except TransitionModel.DoesNotExist:
            return JsonResponse(
                {'error': '전환을 찾을 수 없습니다.'},
                status=404
            )
        except Exception as e:
            return JsonResponse(
                {'error': f'상태 전환 중 오류가 발생했습니다: {str(e)}'},
                status=500
            )


# Django URL 패턴 예시 (urls.py에 추가)
"""
from django.urls import path
from . import views

urlpatterns = [
    path('api/tasks/<str:task_id>/transitions', views.TaskTransitionsView.as_view(), name='task-transitions'),
    path('api/tasks/<str:task_id>/transition', views.TaskTransitionExecuteView.as_view(), name='task-transition-execute'),
]
"""

