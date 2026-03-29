/**
 * One-off splice: replace app/page.tsx main tab JSX (lines 1690–2241) with <HomeTabContent ... />.
 * Run from repo root: node scripts/splice-home-tab-content.js
 */
const fs = require('fs')
const path = require('path')

const pagePath = path.join(__dirname, '..', 'app', 'page.tsx')
const lines = fs.readFileSync(pagePath, 'utf8').split(/\r?\n/)

// 1-based line numbers from editor
const START_LINE = 1690
const END_LINE = 2241
const startIdx = START_LINE - 1
const endIdx = END_LINE // slice end exclusive → include line END_LINE → use endIdx = END_LINE

const insert = [
  '        <HomeTabContent',
  '          activeTab={activeTab}',
  '          setActiveTab={setActiveTab}',
  '          user={user}',
  '          projects={projects}',
  '          loading={loading}',
  '          error={error}',
  '          fetchProjects={fetchProjects}',
  '          issues={issues}',
  '          issuesLoading={issuesLoading}',
  '          issuesError={issuesError}',
  '          fetchIssues={fetchIssues}',
  '          orphanTasks={orphanTasks}',
  '          fetchOrphanTasks={fetchOrphanTasks}',
  '          fetchGanttMyTasks={async () => { await fetchGanttMyTasks() }}',
  '          gmpRecords={gmpRecords}',
  '          gmpRecordsLoading={gmpRecordsLoading}',
  '          gmpRecordsError={gmpRecordsError}',
  '          fetchGmpRecords={fetchGmpRecords}',
  '          valPackages={valPackages}',
  '          valPackagesLoading={valPackagesLoading}',
  '          valPackagesError={valPackagesError}',
  '          fetchValPackages={fetchValPackages}',
  '          ticketsByType={ticketsByType}',
  '          ticketsLoading={ticketsLoading}',
  '          ticketsError={ticketsError}',
  '          fetchTickets={fetchTickets}',
  '          handleCreateTicket={handleCreateTicket}',
  '          handleOpenTicketDetail={handleOpenTicketDetail}',
  '          ganttMyTasks={ganttMyTasks}',
  '          searchOwner={searchOwner}',
  '          setSearchOwner={setSearchOwner}',
  '          pendingGanttProjectId={pendingGanttProjectId}',
  '          setPendingGanttProjectId={setPendingGanttProjectId}',
  '          isDeleteMode={isDeleteMode}',
  '          setIsDeleteMode={setIsDeleteMode}',
  '          selectedProjectIds={selectedProjectIds}',
  '          setSelectedProjectIds={setSelectedProjectIds}',
  '          selectedChildIds={selectedChildIds}',
  '          setSelectedChildIds={setSelectedChildIds}',
  '          selectedTaskIds={selectedTaskIds}',
  '          setSelectedTaskIds={setSelectedTaskIds}',
  '          selectedValPackageIds={selectedValPackageIds}',
  '          setSelectedValPackageIds={setSelectedValPackageIds}',
  '          selectedIssueIds={selectedIssueIds}',
  '          setSelectedIssueIds={setSelectedIssueIds}',
  '          isEditing={isEditing}',
  '          setIsEditing={setIsEditing}',
  '          selectedProject={selectedProject}',
  '          setSelectedProject={setSelectedProject}',
  '          editMode={editMode}',
  '          setEditMode={setEditMode}',
  '          isTaskEditing={isTaskEditing}',
  '          setIsTaskEditing={setIsTaskEditing}',
  '          selectedTask={selectedTask}',
  '          setSelectedTask={setSelectedTask}',
  '          taskEditMode={taskEditMode}',
  '          setTaskEditMode={setTaskEditMode}',
  '          isValPackageEditing={isValPackageEditing}',
  '          setIsValPackageEditing={setIsValPackageEditing}',
  '          selectedValPackage={selectedValPackage}',
  '          setSelectedValPackage={setSelectedValPackage}',
  '          valPackageEditMode={valPackageEditMode}',
  '          setValPackageEditMode={setValPackageEditMode}',
  '          setIsIssueEditing={setIsIssueEditing}',
  '          setSelectedIssue={setSelectedIssue}',
  '          setIssueEditMode={setIssueEditMode}',
  '          isChildModalOpen={isChildModalOpen}',
  '          setIsChildModalOpen={setIsChildModalOpen}',
  '          childTarget={childTarget}',
  '          setChildTarget={setChildTarget}',
  '          contextMenu={contextMenu}',
  '          setContextMenu={setContextMenu}',
  '          handleNewProject={handleNewProject}',
  '          handleProjectContextMenu={handleProjectContextMenu}',
  '          handleBatchDeleteProjects={handleBatchDeleteProjects}',
  '          handleBatchDeleteChildren={handleBatchDeleteChildren}',
  '          handleAddChild={handleAddChild}',
  '          handleProjectSave={handleProjectSave}',
  '          handleBatchDeleteGmpRecords={handleBatchDeleteGmpRecords}',
  '          handleBatchDeleteTasks={handleBatchDeleteTasks}',
  '          handleValPackageSave={handleValPackageSave}',
  '          handleNewValPackage={handleNewValPackage}',
  '          handleBatchDeleteValPackages={handleBatchDeleteValPackages}',
  '          handleBatchDeleteIssues={handleBatchDeleteIssues}',
  '        />',
]

const out = [...lines.slice(0, startIdx), ...insert, ...lines.slice(endIdx)].join('\n')
fs.writeFileSync(pagePath, out, 'utf8')
console.log('Spliced', pagePath, 'removed lines', START_LINE, '-', END_LINE)
