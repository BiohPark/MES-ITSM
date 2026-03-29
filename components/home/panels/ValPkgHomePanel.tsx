'use client'

import type { Project } from '@/types/project'
import { ValPackagesTable } from '@/components/val-packages/ValPackagesTable'
import { ValPackageEditModal } from '@/components/val-packages/ValPackageEditModal'
import type { HomeTabContentProps } from '../home-tab-content.types'

export function ValPkgHomePanel({ p }: { p: HomeTabContentProps }) {
  const {
    user,
    isDeleteMode,
    setIsDeleteMode,
    valPackages,
    valPackagesLoading,
    valPackagesError,
    fetchValPackages,
    selectedValPackageIds,
    setSelectedValPackageIds,
    setIsEditing,
    setSelectedProject,
    setIsTaskEditing,
    setSelectedTask,
    setIsIssueEditing,
    setSelectedIssue,
    setIsChildModalOpen,
    setChildTarget,
    setSelectedValPackage,
    setValPackageEditMode,
    setIsValPackageEditing,
    isValPackageEditing,
    selectedValPackage,
    valPackageEditMode,
    handleNewValPackage,
    handleBatchDeleteValPackages,
    handleValPackageSave,
  } = p

  return (
    <>
      <ValPackagesTable
        valPackages={valPackages}
        loading={valPackagesLoading}
        error={valPackagesError}
        onRefresh={fetchValPackages}
        onValPackageClick={(valPackage: Project) => {
          if (!isDeleteMode) {
            setIsEditing(false)
            setSelectedProject(null)
            setIsTaskEditing(false)
            setSelectedTask(null)
            setIsIssueEditing(false)
            setSelectedIssue(null)
            setIsChildModalOpen(false)
            setChildTarget(null)

            setSelectedValPackage(valPackage)
            setValPackageEditMode('edit')
            setIsValPackageEditing(true)
          }
        }}
        onNewValPackage={handleNewValPackage}
        isDeleteMode={isDeleteMode}
        selectedValPackageIds={selectedValPackageIds}
        onToggleValPackageSelection={(valPackageId: string) => {
          const newSet = new Set(selectedValPackageIds)
          if (newSet.has(valPackageId)) newSet.delete(valPackageId)
          else newSet.add(valPackageId)
          setSelectedValPackageIds(newSet)
        }}
        onDeleteModeChange={(enabled: boolean) => {
          setIsDeleteMode(enabled)
          if (!enabled) {
            setSelectedValPackageIds(new Set())
          }
        }}
        onBatchDelete={handleBatchDeleteValPackages}
      />
      {isValPackageEditing && selectedValPackage && (
        <ValPackageEditModal
          valPackage={selectedValPackage}
          mode={valPackageEditMode}
          onClose={() => {
            setIsValPackageEditing(false)
            setSelectedValPackage(null)
            setValPackageEditMode('edit')
          }}
          onSave={(updatedValPackage: Project) => handleValPackageSave(updatedValPackage, valPackageEditMode)}
          currentUser={user ? { name: user.name, username: user.username } : undefined}
        />
      )}
    </>
  )
}
