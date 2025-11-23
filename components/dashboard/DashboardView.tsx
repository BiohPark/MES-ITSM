'use client'

import { useMemo } from 'react'
import type { Project } from '@/types/project'
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
  AlertTriangleIcon 
} from '@/components/common/Icons'

export function DashboardView({
  projects,
  loading,
  error,
  onRefresh,
}: {
  projects: Project[]
  loading: boolean
  error: string | null
  onRefresh: () => void | Promise<void>
}) {
  const stats = useMemo(() => {
    const allTasks = projects.flatMap((p) => p.children || [])
    
    return {
      totalProjects: projects.length,
      totalTasks: allTasks.length,
      activeProjects: projects.filter((p) => p.status?.toLowerCase() === 'in progress' || p.status === 'In Progress').length,
      activeTasks: allTasks.filter((t) => t.status?.toLowerCase() === 'in progress' || t.status === 'In Progress').length,
      completedProjects: projects.filter((p) => p.status === 'Completed').length,
      completedTasks: allTasks.filter((t) => t.status === 'Completed').length,
      issuedProjects: projects.filter((p) => p.status === 'Issued').length,
      issuedTasks: allTasks.filter((t) => t.status === 'Issued').length,
      planningProjects: projects.filter((p) => p.status === 'Planning').length,
      planningTasks: allTasks.filter((t) => t.status === 'Planning').length,
      avgProgress: projects.length > 0 
        ? Math.round(projects.reduce((sum, p) => sum + p.progress, 0) / projects.length)
        : 0,
      avgTaskProgress: allTasks.length > 0
        ? Math.round(allTasks.reduce((sum, t) => sum + ((t as any).progress || 0), 0) / allTasks.length)
        : 0,
    }
  }, [projects])

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
  }, [projects])

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
    
    return items.sort((a, b) => a.due.getTime() - b.due.getTime())
  }, [projects])

  const statusDistribution = useMemo(() => {
    const allTasks = projects.flatMap((p) => p.children || [])
    
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
  }, [projects])

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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <KPICard
          title="전체 프로젝트"
          value={stats.totalProjects}
          subtitle={`진행 중: ${stats.activeProjects}`}
          icon={<FolderIcon size={32} color="#3b82f6" />}
          color="#3b82f6"
        />
        <KPICard
          title="전체 일감"
          value={stats.totalTasks}
          subtitle={`진행 중: ${stats.activeTasks}`}
          icon={<ClipboardIcon size={32} color="#10b981" />}
          color="#10b981"
        />
        <KPICard
          title="완료된 프로젝트"
          value={stats.completedProjects}
          subtitle={`${stats.totalProjects > 0 ? Math.round((stats.completedProjects / stats.totalProjects) * 100) : 0}%`}
          icon={<CheckCircleIcon size={32} color="#22c55e" />}
          color="#22c55e"
        />
        <KPICard
          title="완료된 일감"
          value={stats.completedTasks}
          subtitle={`${stats.totalTasks > 0 ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0}%`}
          icon={<CheckCircleIcon size={32} color="#22c55e" />}
          color="#22c55e"
        />
        <KPICard
          title="평균 진행률 (프로젝트)"
          value={`${stats.avgProgress}%`}
          subtitle={`${stats.activeProjects}개 진행 중`}
          icon={<BarChartIcon size={32} color="#8b5cf6" />}
          color="#8b5cf6"
        />
        <KPICard
          title="평균 진행률 (일감)"
          value={`${stats.avgTaskProgress}%`}
          subtitle={`${stats.activeTasks}개 진행 중`}
          icon={<BarChartIcon size={32} color="#8b5cf6" />}
          color="#8b5cf6"
        />
        <KPICard
          title="이슈 프로젝트"
          value={stats.issuedProjects}
          subtitle="주의 필요"
          icon={<AlertTriangleIcon size={32} color="#ef4444" />}
          color="#ef4444"
        />
        <KPICard
          title="이슈 일감"
          value={stats.issuedTasks}
          subtitle="주의 필요"
          icon={<AlertTriangleIcon size={32} color="#ef4444" />}
          color="#ef4444"
        />
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

