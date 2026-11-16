import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useProjectManager } from './hooks/useProjectManager';
import { useEditorState } from './hooks/useEditorState';
import { useCompiler } from './hooks/useCompiler';
import { useSpatialDebugger } from './hooks/useSpatialDebugger';
import { TopBar } from './components/TopBar';
import { ProjectExplorer } from './components/ProjectExplorer';
import { CodeEditor } from './components/CodeEditor';
import { findDeclaredWall } from './components/viewport/helpers/architecturalSelection';
import { ConsolePanel } from './components/ConsolePanel';
import { SplashScreen } from './components/SplashScreen';
import { InteractiveInputDialog } from './components/console/InteractiveInputDialog';
import { DocumentationModal } from './components/DocumentationModal';
import { NewProjectModal } from './components/modals/NewProjectModal';
import { OpenProjectModal } from './components/modals/OpenProjectModal';
import { NewFileModal } from './components/modals/NewFileModal';
import { RenameFileModal } from './components/modals/RenameFileModal';
import { RenameProjectModal } from './components/modals/RenameProjectModal';
import { ConfirmDeleteModal } from './components/modals/ConfirmDeleteModal';
import { UnsavedChangesModal } from './components/modals/UnsavedChangesModal';
import { InsertRoomModal } from './components/modals/InsertRoomModal';
import { SettingsModal } from './components/modals/SettingsModal';
import { SpatialObject, LumiFile, DiagnosticItem, SourceReference, DebugStep } from './types';
import { ideLogger } from './services/logger/IdeLogService';
import { lumiAssistant } from './services/assistant/LumiAssistantService';
import { LumicFileService } from './services/storage/LumicFileService';
import { findSourceFile } from './services/editor/sourceNavigation';
import { resolveDebugStep } from './services/editor/debugStepNavigation';
import { relativePath } from './services/integration/projectInput';
import type { ViewportWindowState } from './viewportBridge';
import type { StartupBridge } from './startupBridge';
import { ChevronUp, X } from 'lucide-react';

const EXPLORER_MIN_WIDTH = 220;
const EXPLORER_MAX_WIDTH = 480;
const CONSOLE_MIN_HEIGHT = 140;
const CONSOLE_MAX_HEIGHT = 420;
export const MIN_SPLASH_DURATION_MS = 2500;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export default function App() {
  const {
    projects,
    currentProject,
    currentProjectId,
    activeFile,
    activeFileId,
    entryFile,
    openTabIds,
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
    handleForceCloseTab,
    handleDiscardAndCloseTab,
    storageError, clearStorageError, chooseProjectLocation,
    handleOpenProject, handleRenameProject, handleSaveAs,
    legacyProjects, handleImportLocalProject,
    isDiskStorage, isLoaded,
  } = useProjectManager();

  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [showRenameProjectModal, setShowRenameProjectModal] = useState(false);
  const [showOpenProjectModal, setShowOpenProjectModal] = useState(false);
  const [showNewFileModal, setShowNewFileModal] = useState(false);
  const [showInsertRoomModal, setShowInsertRoomModal] = useState(false);
  const [renameTargetFile, setRenameTargetFile] = useState<LumiFile | null>(null);
  const [deleteTargetFile, setDeleteTargetFile] = useState<LumiFile | null>(null);
  const [unsavedTargetFile, setUnsavedTargetFile] = useState<LumiFile | null>(null);
  const [showDocsModal, setShowDocsModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [hasExecutedScene, setHasExecutedScene] = useState(false);
  const [startupReady, setStartupReady] = useState(() => !window.lumiStartup);
  const [splashPresented, setSplashPresented] = useState(() => !window.lumiStartup);
  const [minimumSplashElapsed, setMinimumSplashElapsed] = useState(() => !window.lumiStartup);
  const [explorerWidth, setExplorerWidth] = useState(280);
  const [consoleHeight, setConsoleHeight] = useState(210);
  const [isConsoleVisible, setIsConsoleVisible] = useState(true);
  const [activeResize, setActiveResize] = useState<'explorer' | 'console' | null>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const viewportSessionRef = useRef<string | null>(null);
  const viewportSessionSequenceRef = useRef(0);
  useEffect(() => {
    if (!window.lumiStartup) return;
    let active = true;
    let firstFrame = 0;
    let secondFrame = 0;
    let minimumDurationTimer: ReturnType<typeof setTimeout> | undefined;
    window.lumiStartup.presentSplash()
      .then(() => {
        // Electron has shown the window: the minimum visible duration starts now.
        minimumDurationTimer = setTimeout(() => {
          if (active) setMinimumSplashElapsed(true);
        }, MIN_SPLASH_DURATION_MS);
        // Keep the committed splash through a real compositor frame before allowing the IDE swap.
        firstFrame = requestAnimationFrame(() => {
          secondFrame = requestAnimationFrame(() => { if (active) setSplashPresented(true); });
        });
      })
      .catch(error => console.error('No se pudo presentar la pantalla de inicio:', error));
    window.lumiStartup.whenReady()
      .catch(error => console.error('No se pudo confirmar la inicialización de Electron:', error))
      .finally(() => { if (active) setStartupReady(true); });
    return () => {
      active = false;
      if (minimumDurationTimer !== undefined) clearTimeout(minimumDurationTimer);
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };
  }, []);
  const activeFileIdentity = useMemo(() => {
    const file = currentProject?.files.find((f) => f.id === activeFileId);
    if (!file || !currentProject) return '';
    try { return relativePath(file.path, currentProject.name); }
    catch { return file.id; }
  }, [currentProject, activeFileId]);

  const {
    highlightedLine,
    setHighlightedLine,
    sourceNavigation,
    navigateToLocation,
    breakpoints,
    allBreakpoints,
    toggleBreakpoint,
    activeObjectId,
    setActiveObjectId,
  } = useEditorState(activeFileIdentity, currentProjectId ?? '');

  const {
    lumiState,
    isCompiling,
    lastCompileResult,
    scenePlan,
    sceneSource,
    legacyPlacement,
    setScenePlan,
    diagnostics,
    logs,
    debugSteps,
    lastCompiledRevision,
    runCompile,
    runExecute,
    isRealBackend,
    loadCompiledArtifact,
  } = useCompiler({ contextKey: `${currentProjectId}:${projectRevision}`, scopeKey: currentProjectId ?? '' });

  // Stale compilation detection
  const isStale = useMemo(() => {
    return lastCompileResult !== null && lastCompiledRevision !== null && lastCompiledRevision !== projectRevision;
  }, [lastCompileResult, lastCompiledRevision, projectRevision]);

  const hasBlockingErrors = useMemo(() => {
    return diagnostics.some((d) => d.blocking === true);
  }, [diagnostics]);

  const canRun = useMemo(() => {
    if (isRealBackend) return currentProject !== null && !isCompiling;
    return lastCompileResult !== null && lastCompileResult.success && !hasBlockingErrors && !isStale;
  }, [lastCompileResult, hasBlockingErrors, isStale, isRealBackend, currentProject, isCompiling]);

  const handleCompileCurrent = useCallback(async () => {
    if (!currentProject) {
      ideLogger.log('warning', 'No hay ningún proyecto abierto para compilar.', undefined, 'Compilador');
      lumiAssistant.setMessage('No hay un proyecto abierto. Abre o crea un proyecto antes de compilar.', 'ready');
      return null;
    }

    // Compilar actualiza el IDE, pero nunca abre ni reemplaza la escena ejecutada.
    setHasExecutedScene(false);
    // Usar contenido actualizado con cambios en memoria (drafts)
    const virtualProject = {
      ...currentProject,
      files: currentProject.files.map((f) => ({
        ...f,
        content: getFileContent(f),
      })),
    };

    return await runCompile(virtualProject, activeFileId || undefined, projectRevision);
  }, [currentProject, activeFileId, getFileContent, runCompile, projectRevision]);

  const handleRunExecution = useCallback(async () => {
    if (isCompiling) {
      ideLogger.logExecutionAborted('Ya hay una compilación o ejecución en curso.');
      lumiAssistant.onExecutionBlocked('Espera a que termine la operación actual antes de ejecutar Lumi.');
      return;
    }
    if (!currentProject) {
      ideLogger.logExecutionAborted('No hay un proyecto abierto.');
      lumiAssistant.onExecutionBlocked('Abre o crea un proyecto antes de ejecutar Lumi.');
      return;
    }

    if (isRealBackend) {
      // Una ejecución nueva nunca debe mostrar ni conservar la escena o selección anterior.
      viewportSessionRef.current = null;
      setActiveObjectId(null);
      setHasExecutedScene(false);
      window.lumiViewport?.clear();
      const targetFile = currentProject.files.find(file => file.id === currentProject.entryFileId)
        ?? currentProject.files.find(file => file.isEntry);
      if (targetFile) ideLogger.log('info', `Ejecutando archivo principal: ${targetFile.name}`, undefined, 'Ejecutor');
      const result = await runExecute({
        ...currentProject,
        files: currentProject.files.map((file) => ({ ...file, content: getFileContent(file) })),
      }, projectRevision);
      if (result?.success && result.scenePlan) {
        const sessionId = `viewport-${Date.now()}-${++viewportSessionSequenceRef.current}`;
        viewportSessionRef.current = sessionId;
        setActiveObjectId(null);
        setHasExecutedScene(true);
        await window.lumiViewport?.show({
          sessionId,
          scenePlan: result.scenePlan, sceneSource: 'python', legacyPlacement: false,
          activeObjectId: null, debugActiveObjectId: null, debugRoomId: null,
        });
      } else {
        window.lumiViewport?.clear();
      }
      return;
    }

    // El visor del navegador usa el último resultado del compilador simulado.
    // Si el código cambió, hay que volver a compilar antes de mostrarlo.
    if (isStale) {
      ideLogger.log(
        'warning',
        'El proyecto cambió desde la última compilación. Compile nuevamente antes de ejecutar.',
        undefined,
        'Ejecutor'
      );
      lumiAssistant.onExecutionBlocked('El proyecto cambió. Compílalo nuevamente antes de ejecutar Lumi.');
      return;
    }

    if (!lastCompileResult) {
      ideLogger.log(
        'warning',
        'No hay un resultado de compilación previo. Compile el proyecto primero.',
        undefined,
        'Ejecutor'
      );
      lumiAssistant.onExecutionBlocked('Compila el proyecto antes de ejecutar Lumi.');
      return;
    }

    if (hasBlockingErrors || !lastCompileResult.success) {
      ideLogger.logExecutionAborted('Existen errores bloqueantes en los diagnósticos. Corríjalos antes de ejecutar.');
      lumiAssistant.onExecutionBlocked('Corrige los errores bloqueantes antes de ejecutar Lumi.');
      return;
    }

    if (lastCompileResult.scenePlan) {
      const sessionId = `viewport-${Date.now()}-${++viewportSessionSequenceRef.current}`;
      viewportSessionRef.current = sessionId;
      setActiveObjectId(null);
      setScenePlan(lastCompileResult.scenePlan);
      setHasExecutedScene(true);
      await window.lumiViewport?.show({
        sessionId,
        scenePlan: lastCompileResult.scenePlan, sceneSource: sceneSource ?? 'simulation', legacyPlacement,
        activeObjectId: null, debugActiveObjectId: null, debugRoomId: null,
      });
      const totalObjs = lastCompileResult.scenePlan.rooms.reduce((acc, r) => acc + r.objects.length, 0);
      ideLogger.logExecutionStarted(currentProject.name, lastCompileResult.scenePlan.rooms.length, totalObjs);
    }
  }, [currentProject, isStale, lastCompileResult, hasBlockingErrors, setScenePlan,
    isRealBackend, runExecute, getFileContent, projectRevision, sceneSource, legacyPlacement, setActiveObjectId,
    activeFileId, entryFile, isCompiling]);

  const handleExportLumic = useCallback(() => {
    return LumicFileService.exportLumic(lastCompileResult, currentProject);
  }, [lastCompileResult, currentProject]);

  const handleImportLumicFile = useCallback(
    async (file: File) => {
      const res = await LumicFileService.readAndValidateFile(file);
      if (res.success && res.artifact) {
        loadCompiledArtifact(res.artifact);
        return { success: true };
      }
      return { success: false, error: res.error || 'Error al validar el archivo .lumic' };
    },
    [loadCompiledArtifact]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        setShowSettingsModal((prev) => !prev);
      }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'e' || e.key === 'E')) {
        e.preventDefault();
        handleExportLumic();
      }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'o' || e.key === 'O')) {
        e.preventDefault();
        setShowOpenProjectModal(true);
      }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        setShowNewFileModal(true);
      }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        handleSaveCurrentFile();
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        handleSaveAllFiles();
      }
      if (e.key === 'F5') {
        e.preventDefault();
        handleCompileCurrent();
      }
      if (e.key === 'F6') {
        e.preventDefault();
        handleRunExecution();
      }
      if (e.key === 'F1') {
        e.preventDefault();
        setShowDocsModal(true);
      }
      if (e.altKey && (e.key === 'h' || e.key === 'H')) {
        e.preventDefault();
        setShowInsertRoomModal(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handleExportLumic,
    handleCompileCurrent,
    handleRunExecution,
    handleSaveCurrentFile,
    handleSaveAllFiles,
  ]);

  // Track processed compilationId so auto-focus only runs ONCE per new compilation
  const lastProcessedCompilationIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (lastCompileResult) {
      if (lastProcessedCompilationIdRef.current === lastCompileResult.compilationId) {
        return;
      }
      lastProcessedCompilationIdRef.current = lastCompileResult.compilationId;

      if (diagnostics.length > 0) {
        const firstError = diagnostics.find((d) => d.blocking) || diagnostics.find((d) => d.severity === 'error') || diagnostics[0];
        const targetFile = currentProject && findSourceFile(currentProject, firstError.file, isRealBackend);
        if (targetFile) {
          handleSelectFile(targetFile.id);
          navigateToLocation(targetFile.id, firstError.line, firstError.column);
        } else {
          setHighlightedLine(null);
        }
        const targetObj = firstError.targetObjectId || firstError.objectId;
        if (targetObj) {
          setActiveObjectId(targetObj);
        }
      }
    }
  }, [lastCompileResult, diagnostics, setHighlightedLine, setActiveObjectId, currentProject,
    isRealBackend, handleSelectFile, navigateToLocation]);

  const handleDebugStepChange = useCallback(
    (step: DebugStep | null) => {
      const state = resolveDebugStep(currentProject, step, legacyPlacement);
      if (state.navigation) {
        handleSelectFile(state.navigation.fileId);
        navigateToLocation(state.navigation.fileId, state.navigation.line, state.navigation.column);
      } else {
        setHighlightedLine(null);
      }
      if (step) setScenePlan(state.scenePlan);
      setActiveObjectId(state.activeObjectId);
    },
    [currentProject, handleSelectFile, navigateToLocation, setHighlightedLine, setScenePlan, setActiveObjectId, legacyPlacement]
  );

  const {
    status: debuggerStatus,
    currentStepIndex,
    currentStep,
    playbackSpeed,
    isPlaying: isDebuggerPlaying,
    startDebugging,
    play: playDebugger,
    pause: pauseDebugger,
    togglePlay: togglePlayDebugger,
    nextStep: nextDebugStep,
    prevStep: prevDebugStep,
    jumpToStart: jumpDebugToStart,
    jumpToEnd: jumpDebugToEnd,
    resetDebugger,
    jumpToStep,
    changeSpeed: changeDebugSpeed,
  } = useSpatialDebugger({
    debugSteps,
    breakpoints: allBreakpoints,
    onStepChange: handleDebugStepChange,
  });

  const debugSelection = useMemo(() => resolveDebugStep(null, currentStep, legacyPlacement), [currentStep, legacyPlacement]);

  useEffect(() => {
    const sessionId = viewportSessionRef.current;
    if (!scenePlan || !hasExecutedScene || !sessionId) return;
    const state: ViewportWindowState = {
      sessionId, scenePlan, sceneSource, legacyPlacement, activeObjectId,
      debugActiveObjectId: debugSelection.activeObjectId,
      debugRoomId: currentStep?.roomId ?? null,
    };
    window.lumiViewport?.update(state);
  }, [scenePlan, sceneSource, legacyPlacement, activeObjectId, debugSelection.activeObjectId, currentStep?.roomId, hasExecutedScene]);

  useEffect(() => {
    viewportSessionRef.current = null;
    setHasExecutedScene(false);
  }, [currentProjectId]);

  const handleNavigateToSource = useCallback(
    (sourceRef: SourceReference) => {
      if (!currentProject) return;

      const targetFile = findSourceFile(currentProject, sourceRef.file, isRealBackend);
      if (!targetFile) {
        ideLogger.log('warning', `No se pudo identificar el archivo de origen: ${sourceRef.file}.`, undefined, 'Editor');
        return;
      }
      handleSelectFile(targetFile.id);
      navigateToLocation(targetFile.id, sourceRef.line, sourceRef.column);
    },
    [currentProject, handleSelectFile, navigateToLocation, isRealBackend]
  );

  const handleFocusObject = useCallback(
    (objectId: string | null) => {
      setActiveObjectId(objectId);
      if (!objectId) {
        lumiAssistant.onEntityDeselected();
        return;
      }
      if (!scenePlan) return;

      for (const room of scenePlan.rooms) {
        const obj = room.objects.find((o) => o.id === objectId);
        if (obj) {
          lumiAssistant.onEntitySelected(obj.name, 'Objeto');
          if (obj.sourceRef) handleNavigateToSource(obj.sourceRef);
          return;
        }

        const door = room.doors.find((d) => d.id === objectId);
        if (door) {
          lumiAssistant.onEntitySelected(door.wall, 'Puerta');
          if (door.sourceRef?.line) {
            setHighlightedLine(door.sourceRef.line);
          }
          return;
        }

        const win = room.windows.find((w) => w.id === objectId);
        if (win) {
          lumiAssistant.onEntitySelected(win.wall, 'Ventana');
          if (win.sourceRef?.line) {
            setHighlightedLine(win.sourceRef.line);
          }
          return;
        }
        const wall = findDeclaredWall(room, objectId);
        if (wall) {
          lumiAssistant.onEntitySelected(wall.data.name || wall.wall, 'Pared');
          if (wall.data.sourceRef?.line) setHighlightedLine(wall.data.sourceRef.line);
          return;
        }
      }
    },
    [scenePlan, setActiveObjectId, setHighlightedLine, handleNavigateToSource]
  );

  useEffect(() => window.lumiViewport?.onObjectSelected(selection => {
    if (selection.sessionId === viewportSessionRef.current) handleFocusObject(selection.objectId);
  }), [handleFocusObject]);

  const handleNavigateToDiagnostic = useCallback(
    (diag: DiagnosticItem) => {
      if (!currentProject) return;

      lumiAssistant.onDiagnosticFocused(diag);

      const targetFile = findSourceFile(currentProject, diag.file, isRealBackend);
      if (!targetFile) {
        ideLogger.log('warning', `No se pudo identificar el archivo del diagnóstico: ${diag.file}.`, undefined, 'Editor');
        return;
      }
      handleSelectFile(targetFile.id);
      navigateToLocation(targetFile.id, diag.line, diag.column);

      if (diag.targetObjectId) {
        setActiveObjectId(diag.targetObjectId);
      }
    },
    [currentProject, handleSelectFile, navigateToLocation, setActiveObjectId, isRealBackend]
  );

  const handleInsertRoomCode = useCallback(
    (code: string) => {
      if (!currentProject) return;

      const target = activeFile || entryFile || currentProject.files[0];
      if (!target) return;

      const currentText = getFileContent(target);
      const newText = currentText.trim().length > 0 
        ? `${currentText.trimEnd()}\n\n${code}\n`
        : `${code}\n`;

      handleCodeChange(target.id, newText);
      handleSelectFile(target.id);
      ideLogger.log('success', `Estructura de habitación insertada en "${target.name}".`, undefined, 'Editor');
      lumiAssistant.onRoomInserted('habitación');
    },
    [currentProject, activeFile, entryFile, getFileContent, handleCodeChange, handleSelectFile]
  );

  const handleTabCloseRequest = useCallback(
    (fileId: string) => {
      if (isDirty(fileId)) {
        const target = currentProject?.files.find((f) => f.id === fileId) || null;
        setUnsavedTargetFile(target);
      } else {
        handleForceCloseTab(fileId);
      }
    },
    [isDirty, currentProject, handleForceCloseTab]
  );

  const existingProjectNames = useMemo(
    () => projects.map((p) => p.name),
    [projects]
  );

  const existingFileNamesInCurrentProject = useMemo(
    () => (currentProject ? currentProject.files.map((f) => f.name) : []),
    [currentProject]
  );

  const errorLines = useMemo(
    () => diagnostics.filter((d) => d.severity === 'error' && currentProject
      && findSourceFile(currentProject, d.file, isRealBackend)?.id === activeFileId).map((d) => d.line),
    [diagnostics, currentProject, isRealBackend, activeFileId]
  );

  const warningLines = useMemo(
    () => diagnostics.filter((d) => d.severity === 'warning' && currentProject
      && findSourceFile(currentProject, d.file, isRealBackend)?.id === activeFileId).map((d) => d.line),
    [diagnostics, currentProject, isRealBackend, activeFileId]
  );

  useEffect(() => {
    if (!activeResize) return;

    const handlePointerMove = (event: PointerEvent) => {
      const bounds = workspaceRef.current?.getBoundingClientRect();
      if (!bounds) return;

      if (activeResize === 'explorer') {
        const availableWidth = Math.max(EXPLORER_MIN_WIDTH, bounds.width - 320);
        setExplorerWidth(clamp(event.clientX - bounds.left, EXPLORER_MIN_WIDTH, Math.min(EXPLORER_MAX_WIDTH, availableWidth)));
      } else {
        const availableHeight = Math.max(CONSOLE_MIN_HEIGHT, bounds.height - 180);
        setConsoleHeight(clamp(bounds.bottom - event.clientY, CONSOLE_MIN_HEIGHT, Math.min(CONSOLE_MAX_HEIGHT, availableHeight)));
      }
    };
    const stopResize = () => setActiveResize(null);

    document.body.classList.add('ide-is-resizing');
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopResize, { once: true });
    return () => {
      document.body.classList.remove('ide-is-resizing');
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopResize);
    };
  }, [activeResize]);

  const resizeExplorerWithKeyboard = useCallback((event: React.KeyboardEvent) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const delta = event.key === 'ArrowRight' ? 16 : -16;
    setExplorerWidth((width) => clamp(width + delta, EXPLORER_MIN_WIDTH, EXPLORER_MAX_WIDTH));
  }, []);

  const resizeConsoleWithKeyboard = useCallback((event: React.KeyboardEvent) => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    const delta = event.key === 'ArrowUp' ? 16 : -16;
    setConsoleHeight((height) => clamp(height + delta, CONSOLE_MIN_HEIGHT, CONSOLE_MAX_HEIGHT));
  }, []);

  if (!isLoaded || !startupReady || !splashPresented || !minimumSplashElapsed) return <SplashScreen />;

  return (
    <div className="flex flex-col h-screen w-screen bg-[var(--ide-bg,#02110c)] text-[var(--ide-text,#f5ede0)] overflow-hidden font-sans select-none transition-colors duration-250">
      <TopBar
        isRealBackend={isRealBackend}
        lumiState={lumiState}
        onCompile={handleCompileCurrent}
        onRun={handleRunExecution}
        isStale={isStale}
        hasBlockingErrors={isRealBackend ? false : hasBlockingErrors}
        canRun={canRun}
        projects={projects}
        currentProject={currentProject}
        onSelectProject={handleSelectProject}
        onNewProject={() => setShowNewProjectModal(true)}
        onOpenProjectModal={() => setShowOpenProjectModal(true)}
        onOpenDocs={() => setShowDocsModal(true)}
        onOpenSettings={() => setShowSettingsModal(true)}
        onNewFile={() => setShowNewFileModal(true)}
        onSaveFile={() => handleSaveCurrentFile()}
        onSaveAll={() => handleSaveAllFiles()}
        onSaveAs={handleSaveAs}
        onRenameProject={handleRenameProject && currentProject ? () => setShowRenameProjectModal(true) : undefined}
        onInsertRoomModal={() => setShowInsertRoomModal(true)}
        dirtyCount={dirtyCount}
        onExportLumic={handleExportLumic}
        onImportLumicFile={handleImportLumicFile}
      />
      {isRealBackend && <InteractiveInputDialog />}
      {storageError && <div role="alert" className="bg-rose-950 text-rose-100 px-4 py-2 text-sm z-[60]">
        {storageError} <button onClick={clearStorageError} className="underline ml-3 inline-flex items-center gap-1"><X className="w-3.5 h-3.5" aria-hidden="true" /><span>Cerrar aviso</span></button>
      </div>}
      <div
        ref={workspaceRef}
        className="relative flex-1 flex flex-col gap-0 p-3 min-h-0 overflow-hidden bg-[var(--ide-bg,#02110c)] transition-colors duration-250"
      >
        <div 
          className="absolute top-10 left-1/4 w-96 h-96 rounded-full blur-3xl pointer-events-none -z-10 opacity-30 transition-all duration-300"
          style={{ backgroundColor: 'var(--ide-accent-bg, rgba(26,66,47,0.4))' }}
        />
        <div 
          className="absolute bottom-10 right-1/4 w-96 h-96 rounded-full blur-3xl pointer-events-none -z-10 opacity-20 transition-all duration-300"
          style={{ backgroundColor: 'var(--ide-accent, rgba(243,235,214,0.2))' }}
        />
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full blur-[110px] pointer-events-none -z-10 opacity-25 transition-all duration-300"
          style={{ backgroundColor: 'var(--ide-btn-bg, rgba(26,66,47,0.3))' }}
        />

        <div className="flex flex-1 min-h-0 min-w-0">
          <aside className="h-full min-h-0 flex-none" style={{ width: explorerWidth }}>
                <ProjectExplorer
                  currentProject={currentProject}
                  projects={projects}
                  onSelectProject={handleSelectProject}
                  activeFileId={activeFileId}
                  onSelectFile={handleSelectFile}
                  onNewFile={() => setShowNewFileModal(true)}
                  onNewProject={() => setShowNewProjectModal(true)}
                  onOpenProjectModal={() => setShowOpenProjectModal(true)}
                  onRenameFile={(file) => setRenameTargetFile(file)}
                  onDeleteFile={(file) => setDeleteTargetFile(file)}
                  onSetEntryFile={handleSetEntryFile}
                  onOpenDocs={() => setShowDocsModal(true)}
                  isDirty={isDirty}
                />
          </aside>

          <div
            className="ide-resize-handle ide-resize-handle-x"
            role="separator"
            aria-label="Redimensionar explorador"
            aria-orientation="vertical"
            aria-valuemin={EXPLORER_MIN_WIDTH}
            aria-valuemax={EXPLORER_MAX_WIDTH}
            aria-valuenow={Math.round(explorerWidth)}
            tabIndex={0}
            onPointerDown={(event) => { event.preventDefault(); setActiveResize('explorer'); }}
            onKeyDown={resizeExplorerWithKeyboard}
          />

          <main className="flex-1 h-full min-h-0 min-w-0">
                <CodeEditor
                  files={currentProject ? currentProject.files : []}
                  activeFileId={activeFileId}
                  openTabIds={openTabIds}
                  onSelectFile={handleSelectFile}
                  onCloseTab={handleTabCloseRequest}
                  onNewFile={() => setShowNewFileModal(true)}
                  onCodeChange={handleCodeChange}
                  onSaveFile={handleSaveCurrentFile}
                  onSaveAll={handleSaveAllFiles}
                  isDirty={isDirty}
                  getFileContent={getFileContent}
                  highlightedLine={sourceNavigation && sourceNavigation.fileId !== activeFileId ? null : highlightedLine}
                  sourceNavigation={sourceNavigation}
                  errorLines={errorLines}
                  warningLines={warningLines}
                  breakpoints={breakpoints}
                  onToggleBreakpoint={toggleBreakpoint}
                />
          </main>
        </div>

        <>
          {isConsoleVisible && (
          <div
            className="ide-resize-handle ide-resize-handle-y"
            role="separator"
            aria-label="Redimensionar panel inferior"
            aria-orientation="horizontal"
            aria-valuemin={CONSOLE_MIN_HEIGHT}
            aria-valuemax={CONSOLE_MAX_HEIGHT}
            aria-valuenow={Math.round(consoleHeight)}
            tabIndex={0}
            onPointerDown={(event) => { event.preventDefault(); setActiveResize('console'); }}
            onKeyDown={resizeConsoleWithKeyboard}
          />
          )}
          <div
            className={`min-h-0 flex-none ${isConsoleVisible ? '' : 'hidden'}`}
            style={{ height: isConsoleVisible ? consoleHeight : 0 }}
            aria-hidden={!isConsoleVisible}
          >
            <ConsolePanel
              lumiState={lumiState}
              logs={logs}
              diagnostics={diagnostics}
              debugSteps={debugSteps}
              currentStepIndex={currentStepIndex}
              debuggerStatus={debuggerStatus}
              playbackSpeed={playbackSpeed}
              isPlaying={isDebuggerPlaying}
              onStepChange={jumpToStep}
              onStartDebugging={startDebugging}
              onTogglePlay={togglePlayDebugger}
              onPrevStep={prevDebugStep}
              onNextStep={nextDebugStep}
              onJumpToStart={jumpDebugToStart}
              onJumpToEnd={jumpDebugToEnd}
              onResetDebugger={resetDebugger}
              onChangeSpeed={changeDebugSpeed}
              onNavigateToDiagnostic={handleNavigateToDiagnostic}
              onFocusObject={handleFocusObject}
              scenePlan={scenePlan}
              legacyPlacement={legacyPlacement}
              onLumiClick={() => setShowDocsModal(true)}
              isStale={isStale}
              lastCompileResult={lastCompileResult}
              onCollapse={() => setIsConsoleVisible(false)}
            />
          </div>
          {!isConsoleVisible && (
          <button
            type="button"
            className="console-restore-button"
            onClick={() => setIsConsoleVisible(true)}
            title="Mostrar panel inferior"
            aria-label="Mostrar panel inferior"
          >
            <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Mostrar panel</span>
          </button>
          )}
        </>
      </div>

      <NewProjectModal
        isOpen={showNewProjectModal}
        onClose={() => setShowNewProjectModal(false)}
        onCreateProject={handleCreateProject}
        onChooseLocation={chooseProjectLocation}
        existingProjectNames={existingProjectNames}
      />

      <OpenProjectModal
        isOpen={showOpenProjectModal}
        onClose={() => setShowOpenProjectModal(false)}
        projects={projects}
        currentProjectId={currentProjectId || ''}
        onSelectProject={handleSelectProject}
        onDeleteProject={handleDeleteProject}
        onNewProjectClick={() => setShowNewProjectModal(true)}
        onOpenFromDisk={handleOpenProject}
        legacyProjects={legacyProjects} onImportLocalProject={handleImportLocalProject}
        confirmProjectDeletion={!isDiskStorage}
      />

      <NewFileModal
        isOpen={showNewFileModal}
        onClose={() => setShowNewFileModal(false)}
        onCreateFile={handleCreateFile}
        existingFileNames={existingFileNamesInCurrentProject}
      />

      <RenameFileModal
        isOpen={renameTargetFile !== null}
        onClose={() => setRenameTargetFile(null)}
        file={renameTargetFile}
        onRename={handleRenameFile}
        existingFileNames={existingFileNamesInCurrentProject}
      />

      <ConfirmDeleteModal
        isOpen={deleteTargetFile !== null}
        onClose={() => setDeleteTargetFile(null)}
        file={deleteTargetFile}
        hasUnsavedChanges={deleteTargetFile ? isDirty(deleteTargetFile.id) : false}
        isEntryFile={
          deleteTargetFile
            ? deleteTargetFile.isEntry ||
              deleteTargetFile.id === currentProject?.entryFileId
            : false
        }
        totalFilesInProject={currentProject ? currentProject.files.length : 0}
        onConfirmDelete={handleDeleteFile}
        recoverable={isDiskStorage}
      />

      <UnsavedChangesModal
        isOpen={unsavedTargetFile !== null}
        onClose={() => setUnsavedTargetFile(null)}
        file={unsavedTargetFile}
        onSaveAndClose={async (fileId) => {
          if (!await handleSaveCurrentFile(fileId)) return false;
          return handleForceCloseTab(fileId);
        }}
        onDiscardAndClose={(fileId) => {
          return handleDiscardAndCloseTab(fileId);
        }}
      />

      {handleRenameProject && <RenameProjectModal
        name={showRenameProjectModal ? currentProject?.name ?? null : null}
        onClose={() => setShowRenameProjectModal(false)} onRename={handleRenameProject}
      />}
      <InsertRoomModal
        isOpen={showInsertRoomModal}
        onClose={() => setShowInsertRoomModal(false)}
        onInsertRoom={handleInsertRoomCode}
      />

      <DocumentationModal
        isOpen={showDocsModal}
        onClose={() => setShowDocsModal(false)}
      />

      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />
    </div>
  );
}

