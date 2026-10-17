import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { LumiFile } from '../types';
import type { ProjectStorage } from '../services/storage/ProjectStorage';
import { defaultProjectStorage } from '../services/storage/LocalProjectStorage';
import { DesktopProjectStorage, desktopProjectStorage } from '../services/storage/DesktopProjectStorage';
import { ProjectSession } from '../services/project/ProjectSession';

export function useProjectManager(storage: ProjectStorage = desktopProjectStorage ?? defaultProjectStorage) {
  const session = useMemo(() => new ProjectSession(storage), [storage]);
  const state = useSyncExternalStore(session.subscribe, session.snapshot);
  useEffect(() => { void session.initialize(); }, [session]);
  const currentProject = state.projects.find(p => p.id === state.currentProjectId) ?? null;
  const dirtyFiles = state.drafts[state.currentProjectId ?? ''] ?? {};
  const activeFileId = currentProject?.activeFileId || null;
  const hasUnsavedChanges = Object.values(state.drafts).some(drafts => Object.keys(drafts).length > 0);
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const prevent = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', prevent);
    return () => window.removeEventListener('beforeunload', prevent);
  }, [hasUnsavedChanges]);
  const desktop = storage instanceof DesktopProjectStorage ? storage : null;
  const legacyProjects = useMemo(() => {
    if (!desktop) return [];
    try {
      const raw: unknown = JSON.parse(localStorage.getItem('lumi_ide_projects_v1') ?? '[]');
      return Array.isArray(raw) ? raw.filter(p => p && typeof p.id === 'string' && typeof p.name === 'string') as typeof state.projects : [];
    } catch { return []; }
  }, [desktop]);
  return {
    projects: state.projects, currentProject, currentProjectId: state.currentProjectId,
    activeFile: currentProject?.files.find(f => f.id === activeFileId) ?? null,
    activeFileId, entryFile: currentProject?.files.find(f => f.id === currentProject.entryFileId)
      ?? currentProject?.files.find(f => f.isEntry) ?? null,
    openTabIds: currentProject?.openTabIds ?? [], isLoaded: state.loaded,
    isDirty: (fileId: string) => Object.hasOwn(dirtyFiles, fileId),
    dirtyCount: Object.keys(dirtyFiles).length, projectRevision: state.revision,
    getFileContent: (file: LumiFile) => dirtyFiles[file.id] ?? file.content,
    storageError: state.error, clearStorageError: session.clearError,
    isDiskStorage: !!desktop,
    chooseProjectLocation: desktop ? () => desktop.chooseLocation() : undefined,
    legacyProjects,
    handleImportLocalProject: desktop ? (id: string) => session.run(async () => {
      const project = legacyProjects.find(p => p.id === id);
      if (!project) throw new Error('Proyecto local no encontrado.');
      const location = await desktop.chooseLocation();
      if (location) await session.adopt(await desktop.importProject(project, location));
    }) : undefined,
    handleOpenProject: desktop ? () => session.run(async () => {
      const project = await desktop.openProject();
      if (project) await session.adopt(project);
    }) : undefined,
    handleRenameProject: desktop ? (name: string) => session.run(async () => {
      if (!session.current) return;
      await session.adopt(await desktop.renameProject(session.current.id, name));
    }) : undefined,
    handleSaveAs: desktop ? () => session.run(async () => {
      const project = session.current;
      const file = project?.files.find(f => f.id === project.activeFileId);
      if (!project || !file) return;
      const copy = await desktop.saveAs(project.id, file.id, session.state.drafts[project.id]?.[file.id] ?? file.content);
      if (copy) await session.adopt(copy);
    }) : undefined,
    handleCreateProject: desktop ? (data: { name: string; location: string; description?: string }) => session.run(async () => {
      await session.adopt(await desktop.createProject(data));
    }) : session.createProject,
    handleSelectProject: session.selectProject, handleDeleteProject: session.deleteProject,
    handleSelectFile: session.selectFile, handleCreateFile: session.createFile,
    handleRenameFile: session.renameFile, handleDeleteFile: session.deleteFile,
    handleSetEntryFile: session.setEntry, handleCodeChange: session.edit,
    handleSaveCurrentFile: session.save, handleSaveAllFiles: () => session.save('*'),
    handleDiscardFileChanges: (fileId: string) => { if (state.currentProjectId) session.discard(state.currentProjectId, fileId); },
    handleForceCloseTab: session.closeTab,
    handleDiscardAndCloseTab: (fileId: string) => session.closeTab(fileId, true),
  };
}
