"""
워크플로우 관리 시스템 - 데이터 모델 정의
Python/Django ORM 기반 모델
"""

from django.db import models
from django.contrib.postgres.fields import JSONField
from django.core.validators import MinValueValidator, MaxValueValidator


class WorkflowModel(models.Model):
    """
    워크플로우 정의 모델
    예: "Task Workflow", "Bug Workflow" 등
    """
    name = models.CharField(max_length=100, unique=True, help_text="워크플로우 이름")
    description = models.TextField(blank=True, null=True, help_text="워크플로우 설명")
    is_active = models.BooleanField(default=True, help_text="활성화 여부")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'workflows'
        verbose_name = 'Workflow'
        verbose_name_plural = 'Workflows'
        ordering = ['name']

    def __str__(self):
        return self.name


class StatusModel(models.Model):
    """
    상태 정의 모델
    각 워크플로우에 속한 상태들
    """
    STATUS_CATEGORY_CHOICES = [
        ('todo', 'To Do'),
        ('in_progress', 'In Progress'),
        ('done', 'Done'),
    ]

    name = models.CharField(max_length=50, help_text="상태 이름 (예: 'Open', 'In Progress', 'Resolved')")
    category = models.CharField(
        max_length=20,
        choices=STATUS_CATEGORY_CHOICES,
        default='todo',
        help_text="상태 카테고리"
    )
    workflow = models.ForeignKey(
        WorkflowModel,
        on_delete=models.CASCADE,
        related_name='statuses',
        help_text="속한 워크플로우"
    )
    description = models.TextField(blank=True, null=True, help_text="상태 설명")
    is_initial = models.BooleanField(default=False, help_text="초기 상태 여부")
    is_final = models.BooleanField(default=False, help_text="최종 상태 여부")
    display_order = models.IntegerField(default=0, help_text="표시 순서")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'workflow_statuses'
        verbose_name = 'Status'
        verbose_name_plural = 'Statuses'
        unique_together = [['workflow', 'name']]
        ordering = ['workflow', 'display_order', 'name']

    def __str__(self):
        return f"{self.workflow.name} - {self.name}"


class TransitionModel(models.Model):
    """
    상태 전환 정의 모델
    어떤 상태에서 어떤 상태로 전환할 수 있는지 정의
    """
    name = models.CharField(max_length=100, help_text="전환 이름 (예: 'Start Work', 'Resolve Issue')")
    workflow = models.ForeignKey(
        WorkflowModel,
        on_delete=models.CASCADE,
        related_name='transitions',
        help_text="속한 워크플로우"
    )
    from_status = models.ForeignKey(
        StatusModel,
        on_delete=models.CASCADE,
        related_name='outgoing_transitions',
        help_text="출발 상태"
    )
    to_status = models.ForeignKey(
        StatusModel,
        on_delete=models.CASCADE,
        related_name='incoming_transitions',
        help_text="도착 상태"
    )
    condition = models.JSONField(
        default=dict,
        blank=True,
        help_text="전환 조건/권한 (JSON 형식). 예: {'required_roles': ['admin'], 'required_fields': ['resolution']}"
    )
    description = models.TextField(blank=True, null=True, help_text="전환 설명")
    display_order = models.IntegerField(default=0, help_text="표시 순서")
    is_active = models.BooleanField(default=True, help_text="활성화 여부")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'workflow_transitions'
        verbose_name = 'Transition'
        verbose_name_plural = 'Transitions'
        unique_together = [['workflow', 'from_status', 'to_status', 'name']]
        ordering = ['workflow', 'display_order', 'name']

    def __str__(self):
        return f"{self.workflow.name}: {self.from_status.name} → {self.to_status.name} ({self.name})"


class WorkflowSchemeModel(models.Model):
    """
    워크플로우 스킴 모델
    Task가 어떤 워크플로우를 사용할지 정의
    """
    name = models.CharField(max_length=100, unique=True, help_text="스킴 이름")
    workflow = models.ForeignKey(
        WorkflowModel,
        on_delete=models.CASCADE,
        related_name='schemes',
        help_text="연결된 워크플로우"
    )
    is_default = models.BooleanField(default=False, help_text="기본 스킴 여부")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'workflow_schemes'
        verbose_name = 'Workflow Scheme'
        verbose_name_plural = 'Workflow Schemes'
        ordering = ['-is_default', 'name']

    def __str__(self):
        return f"{self.name} ({self.workflow.name})"


class TaskModel(models.Model):
    """
    Task 이슈 모델
    현재 상태와 워크플로우 스킴을 추적
    """
    # 기존 Task 필드들 (예시)
    id = models.CharField(max_length=50, primary_key=True, help_text="Task ID (예: TASK-00001)")
    title = models.CharField(max_length=255, help_text="Task 제목")
    description = models.TextField(blank=True, null=True, help_text="Task 설명")
    owner = models.CharField(max_length=100, help_text="담당자")
    
    # 워크플로우 관련 필드
    current_status = models.ForeignKey(
        StatusModel,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='tasks',
        help_text="현재 상태"
    )
    workflow_scheme = models.ForeignKey(
        WorkflowSchemeModel,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='tasks',
        help_text="사용 중인 워크플로우 스킴"
    )
    
    # 기타 필드
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tasks'
        verbose_name = 'Task'
        verbose_name_plural = 'Tasks'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.id}: {self.title}"

    def get_workflow(self):
        """Task가 사용하는 워크플로우 반환"""
        if self.workflow_scheme:
            return self.workflow_scheme.workflow
        return None

