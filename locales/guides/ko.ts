import type { TabKey } from '@/utils/constants'
import type { TabGuide } from '@/lib/i18n/types'

export const guidesKo: { default: TabGuide; tabs: Partial<Record<TabKey, TabGuide>> } = {
  default: {
    title: '기능 가이드',
    summary: '현재 화면의 목적과 기본 사용 흐름을 안내합니다.',
    purpose: '업무 목적에 맞게 화면을 사용하도록 도와줍니다.',
    sections: [
      {
        title: '기본 사용 흐름',
        bullets: [
          '목록에서 항목을 선택해 상세를 열고 상태/담당/기한을 갱신합니다.',
          '관련 첨부와 코멘트를 함께 남겨 업무 근거를 기록합니다.',
        ],
      },
    ],
  },
  tabs: {
    dashboard: {
      title: '대시보드',
      summary: '전체 프로젝트와 운영 현황을 한눈에 확인합니다.',
      purpose: '우선 대응 대상과 병목을 빠르게 식별합니다.',
      sections: [
        {
          title: '활용 포인트',
          bullets: [
            '상태/진척률 이상 항목을 먼저 확인합니다.',
            '문제가 있는 항목은 해당 상세 화면으로 바로 이동해 후속 조치합니다.',
          ],
        },
      ],
    },
    request: {
      title: 'Service Request',
      summary: '사용자 요청, 계정 생성, 권한 부여 같은 표준 서비스를 접수하고 처리합니다.',
      purpose: '반복 요청을 정형화된 절차로 처리합니다.',
      sections: [
        {
          title: '운영 팁',
          bullets: ['요청 서비스와 요청 사유를 detail 항목에 남깁니다.', '필요 시 승인자를 지정하고 승인 요청을 보냅니다.'],
        },
      ],
    },
    incident: {
      title: 'Incident',
      summary: '서비스 장애나 사용자 영향 이슈를 신속 복구 중심으로 관리합니다.',
      purpose: '영향 최소화와 복구 시간 단축이 목표입니다.',
      sections: [
        {
          title: '운영 팁',
          bullets: ['영향 서비스와 증상을 명확히 기록합니다.', 'Incident는 승인 절차보다 즉시 대응과 복구가 우선입니다.'],
        },
      ],
    },
    problem: {
      title: 'Problem',
      summary: '재발성 장애의 근본 원인을 분석하고 예방 조치를 관리합니다.',
      purpose: '재발 방지와 구조적 개선이 목표입니다.',
      sections: [
        {
          title: 'Incident와 차이',
          bullets: ['Incident는 빠른 복구 중심입니다.', 'Problem은 원인 분석과 재발 방지 중심입니다.'],
        },
      ],
    },
    change: {
      title: 'Change',
      summary: '시스템 변경 작업을 계획, 승인, 시행, 검증까지 추적합니다.',
      purpose: '위험 통제와 변경 품질 확보가 목표입니다.',
      sections: [
        {
          title: '운영 팁',
          bullets: ['변경 범위와 롤백 계획을 detail 항목에 남깁니다.', 'Change는 승인자를 지정하고 승인 요청 후 진행하는 것이 기본입니다.'],
        },
      ],
    },
    'approval-inbox': {
      title: '승인 Inbox',
      summary: '내가 처리해야 할 승인 요청을 모아봅니다.',
      purpose: '승인 지연을 줄이고 처리 책임을 명확히 합니다.',
      sections: [
        {
          title: '운영 팁',
          bullets: ['티켓 번호를 눌러 상세를 먼저 확인합니다.', '반려 시에는 사유를 남겨 재작업 방향을 명확히 합니다.'],
        },
      ],
    },
    notifications: {
      title: '알림',
      summary: '할당, 승인, SLA 경고를 확인합니다.',
      purpose: '놓치기 쉬운 운영 이벤트를 빠르게 인지합니다.',
      sections: [
        {
          title: '운영 팁',
          bullets: ['읽음 처리로 개인 Inbox를 정리합니다.', '에스컬레이션은 우선 대응 항목으로 재분류합니다.'],
        },
      ],
    },
    'priority-policy': {
      title: '우선순위 정책',
      summary: 'Impact/Urgency 기준으로 Priority를 자동 결정합니다.',
      purpose: '사람마다 다른 판단을 줄이고 일관성을 높입니다.',
      sections: [
        {
          title: '운영 팁',
          bullets: ['장애 등급과 긴급도를 팀 기준으로 먼저 합의합니다.', '정책 변경 시 기존 티켓 분류 영향도 함께 점검합니다.'],
        },
      ],
    },
    'sla-policy': {
      title: 'SLA 정책',
      summary: '티켓 유형과 Priority에 따라 목표 시간을 정의합니다.',
      purpose: '응답/해결 수준을 표준화합니다.',
      sections: [
        {
          title: '운영 팁',
          bullets: ['Incident와 Change는 서로 다른 목표 시간을 둡니다.', '브리치가 잦은 정책은 현실적인 시간 재조정이 필요합니다.'],
        },
      ],
    },
  },
}
