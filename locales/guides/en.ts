import type { TabKey } from '@/utils/constants'
import type { TabGuide } from '@/lib/i18n/types'

export const guidesEn: { default: TabGuide; tabs: Partial<Record<TabKey, TabGuide>> } = {
  default: {
    title: 'Feature guide',
    summary: 'Explains the purpose of the current screen and the basic workflow.',
    purpose: 'Helps you use the screen in line with your work goals.',
    sections: [
      {
        title: 'Basic workflow',
        bullets: [
          'Select an item in the list to open details and update status, owner, and due date.',
          'Leave attachments and comments together as a record of the work.',
        ],
      },
    ],
  },
  tabs: {
    dashboard: {
      title: 'Dashboard',
      summary: 'See overall projects and operations at a glance.',
      purpose: 'Quickly spot what needs attention first and where bottlenecks are.',
      sections: [
        {
          title: 'Tips',
          bullets: [
            'Check items with unusual status or progress first.',
            'Jump to the detail view for follow-up when something looks wrong.',
          ],
        },
      ],
    },
    request: {
      title: 'Service Request',
      summary: 'Handle standard services such as user requests, account creation, and access.',
      purpose: 'Process recurring requests through a consistent procedure.',
      sections: [
        {
          title: 'Tips',
          bullets: ['Record the requested service and reason in the detail fields.', 'Assign an approver and send an approval request when needed.'],
        },
      ],
    },
    incident: {
      title: 'Incident',
      summary: 'Manage service outages and user-impacting issues with fast recovery in mind.',
      purpose: 'Minimize impact and shorten time to restore service.',
      sections: [
        {
          title: 'Tips',
          bullets: ['Clearly record affected services and symptoms.', 'For incidents, immediate response and recovery take priority over approval steps.'],
        },
      ],
    },
    problem: {
      title: 'Problem',
      summary: 'Analyze root causes of recurring incidents and track preventive actions.',
      purpose: 'Prevent recurrence and drive structural improvements.',
      sections: [
        {
          title: 'Difference from Incident',
          bullets: ['Incidents focus on fast recovery.', 'Problems focus on root cause and prevention.'],
        },
      ],
    },
    change: {
      title: 'Change',
      summary: 'Track system changes from planning, approval, execution, to verification.',
      purpose: 'Control risk and ensure change quality.',
      sections: [
        {
          title: 'Tips',
          bullets: ['Document scope and rollback plans in the detail fields.', 'Changes usually require an approver and approval before execution.'],
        },
      ],
    },
    'approval-inbox': {
      title: 'Approval inbox',
      summary: 'See approval requests that you need to handle.',
      purpose: 'Reduce approval delays and clarify who acts on what.',
      sections: [
        {
          title: 'Tips',
          bullets: ['Open the ticket first by clicking the ticket number.', 'When rejecting, leave a reason so the requester knows what to fix.'],
        },
      ],
    },
    notifications: {
      title: 'Notifications',
      summary: 'Review assignments, approvals, and SLA warnings.',
      purpose: 'Catch operational events you might otherwise miss.',
      sections: [
        {
          title: 'Tips',
          bullets: ['Mark as read to keep your personal inbox tidy.', 'Escalations can be reclassified as higher-priority work items.'],
        },
      ],
    },
    'priority-policy': {
      title: 'Priority policy',
      summary: 'Automatically derive priority from impact and urgency.',
      purpose: 'Reduce inconsistent judgment and improve consistency.',
      sections: [
        {
          title: 'Tips',
          bullets: ['Agree on severity and urgency criteria as a team first.', 'When the policy changes, review impact on existing ticket classifications.'],
        },
      ],
    },
    'sla-policy': {
      title: 'SLA policy',
      summary: 'Define target times by ticket type and priority.',
      purpose: 'Standardize response and resolution expectations.',
      sections: [
        {
          title: 'Tips',
          bullets: ['Use different target times for incidents vs. changes.', 'If breaches are frequent, the targets may need to be adjusted.'],
        },
      ],
    },
    'project-defects': {
      title: 'Project defects',
      summary: 'Record defects found during in-project testing and QA, and track fix and verification history.',
      purpose: 'Separate from post-go-live operational issues so you can drive zero-defect goals before release and support audits.',
      sections: [
        {
          title: 'Vs. operational issues',
          bullets: [
            'This screen is for project and test defects. After go-live, use Issues and Tickets for operations.',
            'Pick a project and record test phase, severity, and status consistently.',
          ],
        },
        {
          title: 'Audit evidence',
          bullets: [
            'The detail panel shows an audit trail of create, update, and admin delete events.',
            'Use Export CSV to archive the current filtered list for evidence.',
          ],
        },
      ],
    },
  },
}
