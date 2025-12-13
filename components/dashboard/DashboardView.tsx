'use client'

import { useMemo } from 'react'
import type { Project, ProjectChild } from '@/types/project'
import type { Issue } from '@/types/issue'
import { KPICard } from './KPICard'
import { ChartCard } from './ChartCard'
import { StatusChart } from './StatusChart'
import { OwnerStatsTable } from './OwnerStatsTable'
import { UpcomingDeadlinesList } from './UpcomingDeadlinesList'
import { 
  FolderIcon, 
  ClipboardIcon, 
  CheckCircleIcon, 
  BarChartIcon, 
  AlertTriangleIcon,
  XCircleIcon
} from '@/components/common/Icons'

export function DashboardView({
  projects,
  issues = [],
  orphanTasks = [],
  loading,
  error,
  onRefresh,
}: {
  projects: Project[]
  issues?: Issue[]
  orphanTasks?: ProjectChild[]
  loading: boolean
  error: string | null
  onRefresh: () => void | Promise<void>
}) {
  const stats = useMemo(() => {
    // 프로젝트에 속한 일감과 orphan tasks 모두 포함
    const projectTasks = projects.flatMap((p) => p.children || [])
    const allTasks = [...projectTasks, ...(orphanTasks || [])]
    
    // 디버깅: "생산 요구사항 1" 일감 확인
    if (process.env.NODE_ENV === 'development') {
      const targetTask = allTasks.find((t) => t.title?.includes('생산 요구사항'))
      if (targetTask) {
        console.log('Dashboard - 생산 요구사항 일감 발견:', {
          id: targetTask.id,
          title: targetTask.title,
          status: targetTask.status,
          isOrphan: orphanTasks?.some(ot => ot.id === targetTask.id),
          allTasksCount: allTasks.length,
          projectTasksCount: projectTasks.length,
          orphanTasksCount: orphanTasks?.length || 0,
        })
      }
    }
    
    // KPI 관련 통계
    const issuedTasks = allTasks.filter((t) => t.status === 'Issued').length
    const completedTasksList = allTasks.filter((t) => {
      const isCompleted = t.status === 'Completed'
      // 디버깅: Completed 필터링 확인
      if (process.env.NODE_ENV === 'development' && t.title?.includes('생산 요구사항')) {
        console.log('Completed 필터링:', {
          title: t.title,
          status: t.status,
          isCompleted,
          statusType: typeof t.status,
        })
      }
      return isCompleted
    })
    const completedTasks = completedTasksList.length
    
    // 디버깅: 모든 Completed 일감 목록 출력
    if (process.env.NODE_ENV === 'development') {
      console.log('Dashboard - Completed 일감 목록:', completedTasksList.map(t => ({
        id: t.id,
        title: t.title,
        status: t.status,
        isOrphan: orphanTasks?.some(ot => ot.id === t.id),
      })))
      console.log('Dashboard - 전체 일감 상태 분포:', {
        total: allTasks.length,
        issued: issuedTasks,
        completed: completedTasks,
        byStatus: allTasks.reduce((acc, t) => {
          acc[t.status] = (acc[t.status] || 0) + 1
          return acc
        }, {} as Record<string, number>),
      })
    }
    
    const totalTasks = allTasks.length
    
    // 이슈 통계
    const totalIssues = issues.length
    const openIssues = issues.filter((i) => i.status === 'Open' || i.status === 'In Progress').length
    const resolvedIssues = issues.filter((i) => i.status === 'Resolved' || i.status === 'Closed').length
    
    // 이슈 해결 시간 계산 (해결된 이슈들)
    const resolvedIssuesWithTime = issues.filter((i) => i.resolved_date && i.occurred_date)
    const avgResolutionDays = resolvedIssuesWithTime.length > 0
      ? Math.round(
          resolvedIssuesWithTime.reduce((sum, issue) => {
            const occurred = new Date(issue.occurred_date)
            const resolved = new Date(issue.resolved_date!)
            const days = Math.ceil((resolved.getTime() - occurred.getTime()) / (1000 * 60 * 60 * 24))
            return sum + days
          }, 0) / resolvedIssuesWithTime.length
        )
      : 0
    
    // Deviation 통계
    const deviationIssues = issues.filter((i) => i.is_deviation).length
    
    return {
      // KPI 1: Issued 상태 일감 제로화
      issuedTasks,
      issuedTasksGoal: 0, // 목표는 0개
      
      // KPI 2: 완료 일감 수 지속 증대
      completedTasks,
      completedTasksRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      
      // KPI 3: 이슈 최소화 및 빠른 해결
      totalIssues,
      openIssues,
      resolvedIssues,
      avgResolutionDays,
      
      // KPI 4: Deviation 수 최소화
      deviationIssues,
      deviationIssuesGoal: 0, // 목표는 0개
      
      // 기존 통계 (참고용)
      totalProjects: projects.length,
      totalTasks,
      activeProjects: projects.filter((p) => p.status?.toLowerCase() === 'in progress' || p.status === 'In Progress').length,
      activeTasks: allTasks.filter((t) => t.status?.toLowerCase() === 'in progress' || t.status === 'In Progress').length,
      completedProjects: projects.filter((p) => p.status === 'Completed').length,
      issuedProjects: projects.filter((p) => p.status === 'Issued').length,
      planningProjects: projects.filter((p) => p.status === 'Planning').length,
      planningTasks: allTasks.filter((t) => t.status === 'Planning').length,
      avgProgress: projects.length > 0 
        ? Math.round(projects.reduce((sum, p) => sum + p.progress, 0) / projects.length)
        : 0,
      avgTaskProgress: allTasks.length > 0
        ? Math.round(allTasks.reduce((sum, t) => sum + ((t as any).progress || 0), 0) / allTasks.length)
        : 0,
    }
  }, [projects, issues, orphanTasks])

  const ownerStats = useMemo(() => {
    const ownerMap = new Map<string, { projects: number; tasks: number; progress: number }>()
    
    projects.forEach((project) => {
      if (!ownerMap.has(project.owner)) {
        ownerMap.set(project.owner, { projects: 0, tasks: 0, progress: 0 })
      }
      const owner = ownerMap.get(project.owner)!
      owner.projects++
      owner.progress += project.progress
      
      project.children?.forEach((child) => {
        if (!ownerMap.has(child.owner)) {
          ownerMap.set(child.owner, { projects: 0, tasks: 0, progress: 0 })
        }
        const taskOwner = ownerMap.get(child.owner)!
        taskOwner.tasks++
        taskOwner.progress += (child as any).progress || 0
      })
    })
    
    // orphan tasks도 담당자별 통계에 포함
    orphanTasks?.forEach((task) => {
      if (!ownerMap.has(task.owner)) {
        ownerMap.set(task.owner, { projects: 0, tasks: 0, progress: 0 })
      }
      const taskOwner = ownerMap.get(task.owner)!
      taskOwner.tasks++
      taskOwner.progress += (task as any).progress || 0
    })
    
    return Array.from(ownerMap.entries())
      .map(([owner, data]) => ({
        owner,
        ...data,
        avgProgress: data.projects + data.tasks > 0
          ? Math.round(data.progress / (data.projects + data.tasks))
          : 0,
      }))
      .sort((a, b) => (b.projects + b.tasks) - (a.projects + a.tasks))
      .slice(0, 10)
  }, [projects, orphanTasks])

  const upcomingDeadlines = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const nextWeek = new Date(today)
    nextWeek.setDate(nextWeek.getDate() + 7)
    
    const items: Array<{ id: string; name: string; due: Date; type: 'project' | 'task'; owner: string }> = []
    
    projects.forEach((project) => {
      if (project.due) {
        const dueDate = new Date(project.due)
        dueDate.setHours(0, 0, 0, 0)
        if (dueDate >= today && dueDate <= nextWeek) {
          items.push({
            id: project.id,
            name: project.name,
            due: dueDate,
            type: 'project',
            owner: project.owner,
          })
        }
      }
      
      project.children?.forEach((child) => {
        if (child.due) {
          const dueDate = new Date(child.due)
          dueDate.setHours(0, 0, 0, 0)
          if (dueDate >= today && dueDate <= nextWeek) {
            items.push({
              id: child.id,
              name: child.title,
              due: dueDate,
              type: 'task',
              owner: child.owner,
            })
          }
        }
      })
    })
    
    // orphan tasks도 마감일 목록에 포함
    orphanTasks?.forEach((task) => {
      if (task.due) {
        const dueDate = new Date(task.due)
        dueDate.setHours(0, 0, 0, 0)
        if (dueDate >= today && dueDate <= nextWeek) {
          items.push({
            id: task.id,
            name: task.title,
            due: dueDate,
            type: 'task',
            owner: task.owner,
          })
        }
      }
    })
    
    return items.sort((a, b) => a.due.getTime() - b.due.getTime())
  }, [projects, orphanTasks])

  const statusDistribution = useMemo(() => {
    // 프로젝트에 속한 일감과 orphan tasks 모두 포함
    const projectTasks = projects.flatMap((p) => p.children || [])
    const allTasks = [...projectTasks, ...(orphanTasks || [])]
    
    return {
      projects: {
        Planning: projects.filter((p) => p.status === 'Planning').length,
        'In Progress': projects.filter((p) => p.status?.toLowerCase() === 'in progress' || p.status === 'In Progress').length,
        Issued: projects.filter((p) => p.status === 'Issued').length,
        Completed: projects.filter((p) => p.status === 'Completed').length,
      },
      tasks: {
        Planning: allTasks.filter((t) => t.status === 'Planning').length,
        'In Progress': allTasks.filter((t) => t.status?.toLowerCase() === 'in progress' || t.status === 'In Progress').length,
        Issued: allTasks.filter((t) => t.status === 'Issued').length,
        Completed: allTasks.filter((t) => t.status === 'Completed').length,
      },
    }
  }, [projects, orphanTasks])

  if (loading) {
    return (
      <div className="table-wrapper">
        <div className="placeholder">
          <p>데이터를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="table-wrapper">
        <div className="placeholder">
          <p>에러 발생: {error}</p>
          <button onClick={onRefresh} className="refresh-button">
            새로고침
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#111827' }}>Dashboard</h1>
        <button onClick={onRefresh} className="refresh-button">
          새로고침
        </button>
      </div>

      {/* KPI 카드 그리드 */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#111827', marginBottom: '1rem' }}>핵심 KPI</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          {/* KPI 1: Issued 상태 일감 제로화 */}
          <KPICard
            title="KPI 1: Issued 일감 제로화"
            value={stats.issuedTasks}
            subtitle={stats.issuedTasks === 0 ? '✅ 목표 달성!' : `목표: ${stats.issuedTasksGoal}개 (${stats.issuedTasks}개 남음)`}
            icon={<AlertTriangleIcon size={32} color={stats.issuedTasks === 0 ? "#22c55e" : "#ef4444"} />}
            color={stats.issuedTasks === 0 ? "#22c55e" : "#ef4444"}
          />
          
          {/* KPI 2: 완료 일감 수 지속 증대 */}
          <KPICard
            title="KPI 2: 완료 일감 수"
            value={stats.completedTasks}
            subtitle={`전체 대비 ${stats.completedTasksRate}% | 총 ${stats.totalTasks}개 중`}
            icon={<CheckCircleIcon size={32} color="#22c55e" />}
            color="#22c55e"
          />
          
          {/* KPI 3: 이슈 최소화 및 빠른 해결 */}
          <KPICard
            title="KPI 3: 시스템 이슈 관리"
            value={stats.totalIssues}
            subtitle={stats.openIssues > 0 ? `미해결: ${stats.openIssues}개 | 평균 해결: ${stats.avgResolutionDays}일` : `모두 해결됨 | 평균 해결: ${stats.avgResolutionDays}일`}
            icon={<AlertTriangleIcon size={32} color={stats.openIssues === 0 ? "#22c55e" : "#f59e0b"} />}
            color={stats.openIssues === 0 ? "#22c55e" : "#f59e0b"}
          />
          
          {/* KPI 4: Deviation 수 최소화 */}
          <KPICard
            title="KPI 4: Deviation 최소화"
            value={stats.deviationIssues}
            subtitle={stats.deviationIssues === 0 ? '✅ 목표 달성!' : `목표: ${stats.deviationIssuesGoal}개 (${stats.deviationIssues}개 남음)`}
            icon={<XCircleIcon size={32} color={stats.deviationIssues === 0 ? "#22c55e" : "#ef4444"} />}
            color={stats.deviationIssues === 0 ? "#22c55e" : "#ef4444"}
          />
        </div>
      </div>

      {/* 참고 통계 카드 */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#111827', marginBottom: '1rem' }}>참고 통계</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
          <KPICard
            title="전체 프로젝트"
            value={stats.totalProjects}
            subtitle={`진행 중: ${stats.activeProjects}`}
            icon={<FolderIcon size={24} color="#3b82f6" />}
            color="#3b82f6"
          />
          <KPICard
            title="전체 일감"
            value={stats.totalTasks}
            subtitle={`진행 중: ${stats.activeTasks}`}
            icon={<ClipboardIcon size={24} color="#10b981" />}
            color="#10b981"
          />
          <KPICard
            title="해결된 이슈"
            value={stats.resolvedIssues}
            subtitle={`전체 ${stats.totalIssues}개 중`}
            icon={<CheckCircleIcon size={24} color="#22c55e" />}
            color="#22c55e"
          />
          <KPICard
            title="평균 진행률"
            value={`${stats.avgTaskProgress}%`}
            subtitle="일감 평균"
            icon={<BarChartIcon size={24} color="#8b5cf6" />}
            color="#8b5cf6"
          />
        </div>
      </div>

      {/* KPI 상세 정보 섹션 */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#111827', marginBottom: '1rem' }}>KPI 상세 정보</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
          {/* KPI 1: Issued 일감 목록 */}
          <ChartCard title={`Issued 일감 목록 (${stats.issuedTasks}개)`}>
            {stats.issuedTasks === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#22c55e' }}>
                <p style={{ fontSize: '1.125rem', fontWeight: 600 }}>✅ 목표 달성!</p>
                <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem' }}>Issued 상태 일감이 없습니다.</p>
              </div>
            ) : (
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {/* 프로젝트에 속한 Issued 일감 */}
                {projects.flatMap((p) => 
                  (p.children || []).filter((t) => t.status === 'Issued').map((task) => (
                    <div
                      key={`${p.id}-${task.id}`}
                      style={{
                        padding: '0.75rem',
                        borderBottom: '1px solid #e5e7eb',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{task.title}</div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                          {task.id} | {p.name} | {task.owner}
                        </div>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 600 }}>
                        Issued
                      </div>
                    </div>
                  ))
                )}
                {/* Orphan Issued 일감 */}
                {orphanTasks?.filter((t) => t.status === 'Issued').map((task) => (
                  <div
                    key={`orphan-${task.id}`}
                    style={{
                      padding: '0.75rem',
                      borderBottom: '1px solid #e5e7eb',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{task.title}</div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                        {task.id} | N/A | {task.owner}
                      </div>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 600 }}>
                      Issued
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ChartCard>

          {/* KPI 3: 미해결 이슈 목록 */}
          <ChartCard title={`미해결 이슈 (${stats.openIssues}개)`}>
            {stats.openIssues === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#22c55e' }}>
                <p style={{ fontSize: '1.125rem', fontWeight: 600 }}>✅ 모든 이슈 해결됨</p>
                <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem' }}>현재 미해결 이슈가 없습니다.</p>
              </div>
            ) : (
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {issues
                  .filter((i) => i.status === 'Open' || i.status === 'In Progress')
                  .map((issue) => {
                    const occurredDate = new Date(issue.occurred_date)
                    const today = new Date()
                    const daysSinceOccurred = Math.ceil((today.getTime() - occurredDate.getTime()) / (1000 * 60 * 60 * 24))
                    return (
                      <div
                        key={issue.id}
                        style={{
                          padding: '0.75rem',
                          borderBottom: '1px solid #e5e7eb',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{issue.title}</div>
                          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                            {issue.id} | {issue.owner} | 발생: {daysSinceOccurred}일 전
                          </div>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: 600 }}>
                          {issue.status}
                        </div>
                      </div>
                    )
                  })}
              </div>
            )}
          </ChartCard>

          {/* KPI 4: Deviation 목록 */}
          <ChartCard title={`Deviation 이슈 (${stats.deviationIssues}개)`}>
            {stats.deviationIssues === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#22c55e' }}>
                <p style={{ fontSize: '1.125rem', fontWeight: 600 }}>✅ 목표 달성!</p>
                <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem' }}>Deviation 이슈가 없습니다.</p>
              </div>
            ) : (
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {issues
                  .filter((i) => i.is_deviation)
                  .map((issue) => (
                    <div
                      key={issue.id}
                      style={{
                        padding: '0.75rem',
                        borderBottom: '1px solid #e5e7eb',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{issue.title}</div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                          {issue.id} | {issue.owner} | {issue.status}
                        </div>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 600 }}>
                        Deviation
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </ChartCard>
        </div>
      </div>

      {/* 차트 및 통계 섹션 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* 상태별 분포 차트 */}
        <ChartCard title="프로젝트 상태 분포">
          <StatusChart data={statusDistribution.projects} />
        </ChartCard>
        
        <ChartCard title="일감 상태 분포">
          <StatusChart data={statusDistribution.tasks} />
        </ChartCard>
      </div>

      {/* 담당자별 통계 및 마감일 임박 항목 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
        {/* 담당자별 작업량 */}
        <ChartCard title="담당자별 작업량 (Top 10)">
          <OwnerStatsTable data={ownerStats} />
        </ChartCard>

        {/* 마감일 임박 항목 */}
        <ChartCard title="다가오는 마감일 (7일 이내)">
          <UpcomingDeadlinesList items={upcomingDeadlines} />
        </ChartCard>
      </div>
    </div>
  )
}

