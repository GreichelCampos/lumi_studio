import { useState, useCallback, useEffect, useMemo } from 'react';
import { LumiProject, LumiFile } from '../types';
import { ProjectStorage } from '../services/storage/ProjectStorage';
import { defaultProjectStorage } from '../services/storage/LocalProjectStorage';
import { ideLogger } from '../services/logger/IdeLogService';
import {
  createInitialProject,
  createLumiFile,
  renameLumiFile,
  deleteLumiFile,
  setProjectEntryFile,
  saveFileContentInProject,
  saveAllDirtyFilesInProject,
  resolveInitialProjectSelection,
} from '../services/project/projectOperations';

export function useProjectManager(storage: ProjectStorage = defaultProjectStorage) {
  const [projects, setProjects] = useState<LumiProject[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [openTabIds, setOpenTabIds] = useState<string[]>([]);
  const [dirtyFiles, setDirtyFiles] = useState<Record<string, string>>({});
  const [isLoaded, setIsLoaded] = useState(false);
  const [projectRevision, setProjectRevision] = useState<number>(1);

  useEffect(() => {
    let isMounted = true;

    async function initializeProjects() {
      try {
        const loadedProjects = await storage.getProjects();
        if (!isMounted) return;

        setProjects(loadedProjects);

        const lastActiveId = await storage.getLastActiveProjectId();
        const { selectedProject, initialTabs, initialActiveId } = resolveInitialProjectSelection(
          loadedProjects,
          lastActiveId
        );

        if (selectedProject) {
          setCurrentProjectId(selectedProject.id);
          ideLogger.logProjectOpened(selectedProject.name, selectedProject.files.length);
          setOpenTabIds(initialTabs);
          setActiveFileId(initialActiveId);
        }
      } catch (err) {
        console.error('Error inicializando proyectos en useProjectManager:', err);
      } finally {
        if (isMounted) setIsLoaded(true);
      }
    }

    initializeProjects();

    return () => {
      isMounted = false;
    };
  }, [storage]);

  const currentProject = useMemo(() => {
    if (!currentProjectId) return null;
    return projects.find((p) => p.id === currentProjectId) || null;
  }, [projects, currentProjectId]);

  const activeFile = useMemo(() => {
    if (!currentProject || !activeFileId) return null;
    return currentProject.files.find((f) => f.id === activeFileId) || null;
  }, [currentProject, activeFileId]);

  const entryFile = useMemo(() => {
    if (!currentProject) return null;
    return (
      currentProject.files.find((f) => f.id === currentProject.entryFileId) ||
      currentProject.files.find((f) => f.isEntry) ||
      currentProject.files[0] ||
      null
    );
  }, [currentProject]);

  const isDirty = useCallback(
    (fileId: string): boolean => {
      if (!(fileId in dirtyFiles)) return false;
      const file = currentProject?.files.find((f) => f.id === fileId);
      if (!file) return false;
      return dirtyFiles[fileId] !== file.content;
    },
    [dirtyFiles, currentProject]
  );

  const getFileContent = useCallback(
    (file: LumiFile): string => {
      if (file.id in dirtyFiles) {
        return dirtyFiles[file.id];
      }
      return file.content;
    },
    [dirtyFiles]
  );

  const dirtyCount = useMemo(() => {
    if (!currentProject) return 0;
    return currentProject.files.filter((f) => isDirty(f.id)).length;
  }, [currentProject, isDirty]);

  const handleSelectProject = useCallback(
    async (projectId: string) => {
      const selected = projects.find((p) => p.id === projectId);
      if (!selected) return;

      setCurrentProjectId(projectId);
      setDirtyFiles({});
      setProjectRevision((r) => r + 1);
      ideLogger.logProjectOpened(selected.name, selected.files.length);

      const targetEntry =
        selected.entryFileId ||
        selected.files.find((f) => f.isEntry)?.id ||
        selected.files[0]?.id ||
        null;

      const validTabs =
        selected.openTabIds && selected.openTabIds.length > 0
          ? selected.openTabIds.filter((tid) => selected.files.some((f) => f.id === tid))
          : targetEntry
          ? [targetEntry]
          : [];

      setOpenTabIds(validTabs);
      const targetActive =
        selected.activeFileId && selected.files.some((f) => f.id === selected.activeFileId)
          ? selected.activeFileId
          : targetEntry;

      setActiveFileId(targetActive);
      await storage.setLastActiveProjectId(projectId);
    },
    [projects, storage]
  );

  const handleCreateProject = useCallback(
    async (data: { name: string; location: string; description?: string }) => {
      const { project: newProject, principalFile } = createInitialProject(data);

      const updatedProjects = [...projects, newProject];
      setProjects(updatedProjects);
      setCurrentProjectId(newProject.id);
      setActiveFileId(principalFile.id);
      setOpenTabIds([principalFile.id]);
      setDirtyFiles({});

      await storage.saveProject(newProject);
      await storage.setLastActiveProjectId(newProject.id);
    },
    [projects, storage]
  );

  const handleDeleteProject = useCallback(
    async (projectId: string) => {
      const remainingProjects = projects.filter((p) => p.id !== projectId);
      setProjects(remainingProjects);
      await storage.deleteProject(projectId);

      if (currentProjectId === projectId) {
        const nextProj = remainingProjects[0] || null;
        if (nextProj) {
          await handleSelectProject(nextProj.id);
        } else {
          setCurrentProjectId(null);
          setActiveFileId(null);
          setOpenTabIds([]);
          setDirtyFiles({});
        }
      }
    },
    [projects, currentProjectId, storage, handleSelectProject]
  );

  const handleSelectFile = useCallback(
    (fileId: string) => {
      if (!currentProject) return;
      const fileExists = currentProject.files.some((f) => f.id === fileId);
      if (!fileExists) return;

      setActiveFileId(fileId);
      setOpenTabIds((prev) => (prev.includes(fileId) ? prev : [...prev, fileId]));

      setProjects((prev) =>
        prev.map((p) => {
          if (p.id !== currentProjectId) return p;
          const updatedOpenTabs = p.openTabIds?.includes(fileId)
            ? p.openTabIds
            : [...(p.openTabIds || []), fileId];
          const updated = { ...p, activeFileId: fileId, openTabIds: updatedOpenTabs };
          storage.saveProject(updated);
          return updated;
        })
      );
    },
    [currentProject, currentProjectId, storage]
  );

  const handleCreateFile = useCallback(
    async (cleanFileName: string) => {
      if (!currentProject) return;

      const newFile = createLumiFile(currentProject.name, cleanFileName);
      const updatedFiles = [...currentProject.files, newFile];
      const updatedOpenTabs = [...openTabIds, newFile.id];

      const updatedProject: LumiProject = {
        ...currentProject,
        files: updatedFiles,
        activeFileId: newFile.id,
        openTabIds: updatedOpenTabs,
      };

      setProjects((prev) => (prev.map((p) => (p.id === currentProjectId ? updatedProject : p))));
      setOpenTabIds(updatedOpenTabs);
      setActiveFileId(newFile.id);

      await storage.saveProject(updatedProject);
    },
    [currentProject, currentProjectId, openTabIds, storage]
  );

  const handleRenameFile = useCallback(
    async (fileId: string, newCleanName: string) => {
      if (!currentProject) return;

      const updatedProject = renameLumiFile(currentProject, fileId, newCleanName);

      setProjects((prev) => (prev.map((p) => (p.id === currentProjectId ? updatedProject : p))));
      await storage.saveProject(updatedProject);
    },
    [currentProject, currentProjectId, storage]
  );

  const handleDeleteFile = useCallback(
    async (fileId: string) => {
      if (!currentProject) return;

      const { updatedProject, remainingTabs, newActiveId } = deleteLumiFile(
        currentProject,
        fileId,
        openTabIds,
        activeFileId
      );

      setDirtyFiles((prev) => {
        const next = { ...prev };
        delete next[fileId];
        return next;
      });

      setProjects((prev) => (prev.map((p) => (p.id === currentProjectId ? updatedProject : p))));
      setOpenTabIds(remainingTabs);
      setActiveFileId(newActiveId);

      await storage.saveProject(updatedProject);
    },
    [currentProject, openTabIds, activeFileId, currentProjectId, storage]
  );

  const handleSetEntryFile = useCallback(
    async (fileId: string) => {
      if (!currentProject) return;
      const fileExists = currentProject.files.some((f) => f.id === fileId);
      if (!fileExists) return;

      const updatedProject = setProjectEntryFile(currentProject, fileId);

      setProjects((prev) => (prev.map((p) => (p.id === currentProjectId ? updatedProject : p))));
      await storage.saveProject(updatedProject);
    },
    [currentProject, currentProjectId, storage]
  );

  const handleCodeChange = useCallback(
    (fileId: string, newContent: string) => {
      if (!currentProject) return;
      const originalFile = currentProject.files.find((f) => f.id === fileId);
      if (!originalFile) return;

      setProjectRevision((r) => r + 1);

      if (newContent === originalFile.content) {
        setDirtyFiles((prev) => {
          const next = { ...prev };
          delete next[fileId];
          return next;
        });
      } else {
        setDirtyFiles((prev) => ({
          ...prev,
          [fileId]: newContent,
        }));
      }
    },
    [currentProject]
  );

  const handleSaveCurrentFile = useCallback(
    async (targetFileId?: string) => {
      const fileIdToSave = targetFileId || activeFileId;
      if (!currentProject || !fileIdToSave) return;

      const currentDirtyContent = dirtyFiles[fileIdToSave];
      if (currentDirtyContent === undefined) return;

      const targetFileObj = currentProject.files.find((f) => f.id === fileIdToSave);
      const updatedProject = saveFileContentInProject(currentProject, fileIdToSave, currentDirtyContent);

      setDirtyFiles((prev) => {
        const next = { ...prev };
        delete next[fileIdToSave];
        return next;
      });

      setProjects((prev) => (prev.map((p) => (p.id === currentProjectId ? updatedProject : p))));

      await storage.saveProject(updatedProject);
      if (targetFileObj) {
        ideLogger.logFileSaved(targetFileObj.name);
      }
    },
    [activeFileId, currentProject, dirtyFiles, currentProjectId, storage]
  );

  const handleSaveAllFiles = useCallback(async () => {
    if (!currentProject || Object.keys(dirtyFiles).length === 0) return;

    const modifiedCount = Object.keys(dirtyFiles).length;
    const updatedProject = saveAllDirtyFilesInProject(currentProject, dirtyFiles);

    setDirtyFiles({});
    setProjects((prev) => (prev.map((p) => (p.id === currentProjectId ? updatedProject : p))));

    await storage.saveProject(updatedProject);
    ideLogger.logAllFilesSaved(modifiedCount);
  }, [currentProject, dirtyFiles, currentProjectId, storage]);

  const handleDiscardFileChanges = useCallback((fileId: string) => {
    setDirtyFiles((prev) => {
      const next = { ...prev };
      delete next[fileId];
      return next;
    });
  }, []);

  const handleForceCloseTab = useCallback(
    (fileId: string) => {
      handleDiscardFileChanges(fileId);

      const nextTabs = openTabIds.filter((id) => id !== fileId);
      setOpenTabIds(nextTabs);

      if (activeFileId === fileId) {
        const nextActive = nextTabs[nextTabs.length - 1] || null;
        setActiveFileId(nextActive);
      }

      if (currentProject) {
        const updatedProject: LumiProject = {
          ...currentProject,
          openTabIds: nextTabs,
          activeFileId: activeFileId === fileId ? nextTabs[nextTabs.length - 1] || '' : currentProject.activeFileId,
        };
        storage.saveProject(updatedProject);
      }
    },
    [handleDiscardFileChanges, openTabIds, activeFileId, currentProject, storage]
  );

  return {
    projects,
    currentProject,
    currentProjectId,
    activeFile,
    activeFileId,
    entryFile,
    openTabIds,
    isLoaded,
    isDirty,
    dirtyCount,
    projectRevision,
    getFileContent,
    handleSelectProject,
    handleCreateProject,
    handleDeleteProject,
    handleSelectFile,
    handleCreateFile,
    handleRenameFile,
    handleDeleteFile,
    handleSetEntryFile,
    handleCodeChange,
    handleSaveCurrentFile,
    handleSaveAllFiles,
    handleDiscardFileChanges,
    handleForceCloseTab,
  };
}
