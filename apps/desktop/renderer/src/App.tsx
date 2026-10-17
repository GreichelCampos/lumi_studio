import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useProjectManager } from './hooks/useProjectManager';
import { useEditorState } from './hooks/useEditorState';
import { useCompiler } from './hooks/useCompiler';
import { useSpatialDebugger } from './hooks/useSpatialDebugger';
import { TopBar } from './components/TopBar';
import { ProjectExplorer } from './components/ProjectExplorer';
import { CodeEditor } from './components/CodeEditor';
import { Viewport3D } from './components/Viewport3D';
import { ConsolePanel } from './components/ConsolePanel';
import { DocumentationModal } from './components/DocumentationModal';
import { NewProjectModal } from './components/modals/NewProjectModal';
import { OpenProjectModal } from './components/modals/OpenProjectModal';
import { NewFileModal } from './components/modals/NewFileModal';
import { RenameFileModal } from './components/modals/RenameFileModal';
import { ConfirmDeleteModal } from './components/modals/ConfirmDeleteModal';
import { UnsavedChangesModal } from './components/modals/UnsavedChangesModal';
import { InsertRoomModal } from './components/modals/InsertRoomModal';
import { SettingsModal } from './components/modals/SettingsModal';
import { SpatialObject, LumiFile, DiagnosticItem, SourceReference, DebugStep } from './types';
import { ideLogger } from './services/logger/IdeLogService';
import { lumiAssistant } from './services/assistant/LumiAssistantService';
import { LumicFileService } from './services/storage/LumicFileService';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { BackendModeNotice } from './components/BackendModeNotice';
import { relativePath } from './services/integration/projectInput';

export default function App() {
  // 1. Project and File Management via Abstract Storage
  const {
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
  } = useProjectManager();

  // 2. Modals Management State
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [showOpenProjectModal, setShowOpenProjectModal] = useState(false);
  const [showNewFileModal, setShowNewFileModal] = useState(false);
  const [showInsertRoomModal, setShowInsertRoomModal] = useState(false);
  const [renameTargetFile, setRenameTargetFile] = useState<LumiFile | null>(null);
  const [deleteTargetFile, setDeleteTargetFile] = useState<LumiFile | null>(null);
  const [unsavedTargetFile, setUnsavedTargetFile] = useState<LumiFile | null>(null);
  const [showDocsModal, setShowDocsModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isViewportMaximized, setIsViewportMaximized] = useState(false);

  // 3. Editor Interaction State

  const activeFileName = useMemo(() => {
    return currentProject?.files.find((f) => f.id === activeFileId)?.name || '';
  }, [currentProject, activeFileId]);

  const {
    highlightedLine,
    setHighlightedLine,
    breakpoints,
    allBreakpoints,
    toggleBreakpoint,
    activeObjectId,
    setActiveObjectId,
  } = useEditorState(activeFileName);

  // 4. Compiler Service & ScenePlan State
  const {
    lumiState,
    isCompiling,
    lastCompileResult,
    scenePlan,
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

  // 5. Trigger compilation
  const handleCompileCurrent = useCallback(async () => {
    if (!currentProject) {
      ideLogger.log('warning', 'No hay ningún proyecto abierto para compilar.', undefined, 'Compilador');
      return null;
    }

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

  // 6. Trigger Run Execution
  const handleRunExecution = useCallback(async () => {
    if (!currentProject) {
      ideLogger.logExecutionAborted('No hay un proyecto abierto.');
      return;
    }

    if (isRealBackend) {
      await runExecute({
        ...currentProject,
        files: currentProject.files.map((file) => ({ ...file, content: getFileContent(file) })),
      }, projectRevision);
      return;
    }

    // COMPORTAMIENTO EXIGIDO:
    // Si el proyecto cambió después de la última compilación, el resultado queda en estado stale.
    // En ese estado, Ejecutar 3D NO debe recompilar automáticamente.
    // Debe bloquear la ejecución e indicar claramente el mensaje.
    if (isStale) {
      ideLogger.log(
        'warning',
        'El proyecto cambió desde la última compilación. Compile nuevamente antes de ejecutar.',
        undefined,
        'Ejecutor'
      );
      return;
    }

    if (!lastCompileResult) {
      ideLogger.log(
        'warning',
        'No hay un resultado de compilación previo. Compile el proyecto primero.',
        undefined,
        'Ejecutor'
      );
      return;
    }

    if (hasBlockingErrors || !lastCompileResult.success) {
      ideLogger.logExecutionAborted('Existen errores bloqueantes en los diagnósticos. Corríjalos antes de ejecutar.');
      return;
    }

    if (lastCompileResult.scenePlan) {
      setScenePlan(lastCompileResult.scenePlan);
      const totalObjs = lastCompileResult.scenePlan.rooms.reduce((acc, r) => acc + r.objects.length, 0);
      ideLogger.logExecutionStarted(currentProject.name, lastCompileResult.scenePlan.rooms.length, totalObjs);
    }
  }, [currentProject, isStale, lastCompileResult, hasBlockingErrors, setScenePlan,
    isRealBackend, runExecute, getFileContent, projectRevision]);

  // 6b. Exportar artefacto compilado .lumic
  const handleExportLumic = useCallback(() => {
    return LumicFileService.exportLumic(lastCompileResult, currentProject);
  }, [lastCompileResult, currentProject]);

  // 6c. Importar y cargar artefacto compilado .lumic
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

  // Atajos de teclado globales del IDE (sin colisiones con atajos del navegador)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isViewportMaximized) {
        setIsViewportMaximized(false);
      }
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
    isViewportMaximized,
    handleExportLumic,
    handleCompileCurrent,
    handleRunExecution,
    handleSaveCurrentFile,
    handleSaveAllFiles,
  ]);

  // Recompilación automática al cargar y al cambiar entre proyectos
  const lastLoadedProjectIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (isLoaded && currentProject) {
      if (lastLoadedProjectIdRef.current !== currentProject.id) {
        lastLoadedProjectIdRef.current = currentProject.id;
        handleCompileCurrent();
      }
    }
  }, [currentProject?.id, isLoaded, handleCompileCurrent]);

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
        setHighlightedLine(firstError.line);
        const targetObj = firstError.targetObjectId || firstError.objectId;
        if (targetObj) {
          setActiveObjectId(targetObj);
        }
      }
    }
  }, [lastCompileResult, diagnostics, setHighlightedLine, setActiveObjectId]);

  // 7. Spatial Debugger - Stable callback
  const handleDebugStepChange = useCallback(
    (step: DebugStep) => {
      // 1. Highlight source code line
      setHighlightedLine(step.sourceRef?.line || step.lineNumber);
      // 2. Synchronize 3D Scene Snapshot
      setScenePlan(step.sceneSnapshot);
      // 3. Highlight 3D active entity if present in step
      if (step.activeObjectId) {
        setActiveObjectId(step.activeObjectId);
      }
    },
    [setHighlightedLine, setScenePlan, setActiveObjectId]
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

  // Focus object handler
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
          if (obj.sourceRef?.line) {
            setHighlightedLine(obj.sourceRef.line);
          }
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
      }
    },
    [scenePlan, setActiveObjectId, setHighlightedLine]
  );

  // Navigate to Source Reference from Viewport 3D Object Card
  const handleNavigateToSource = useCallback(
    (sourceRef: SourceReference) => {
      if (!currentProject) return;

      const targetFile = currentProject.files.find(
        (f) => f.name === sourceRef.file || f.path.endsWith(sourceRef.file) || f.id === sourceRef.file
      );

      if (targetFile) {
        handleSelectFile(targetFile.id);
      }

      setHighlightedLine(sourceRef.line);
    },
    [currentProject, handleSelectFile, setHighlightedLine]
  );

  // 8. Navigate from Diagnostic to Code
  const handleNavigateToDiagnostic = useCallback(
    (diag: DiagnosticItem) => {
      if (!currentProject) return;

      lumiAssistant.onDiagnosticFocused(diag);

      // Find file by name or path
      const targetFile = currentProject.files.find(
        (f) => isRealBackend ? relativePath(f.path, currentProject.name) === diag.file
          : f.name === diag.file || f.path.endsWith(diag.file) || f.id === diag.file
      );

      if (targetFile) {
        handleSelectFile(targetFile.id);
      }

      setHighlightedLine(diag.line);

      if (diag.targetObjectId) {
        setActiveObjectId(diag.targetObjectId);
      }
    },
    [currentProject, handleSelectFile, setHighlightedLine, setActiveObjectId, isRealBackend]
  );

  // 9. Inserción de código generado por "Insertar -> Habitación"
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

  // Keyboard Shortcuts (F5 = Compile, F6 = Run)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F5') {
        e.preventDefault();
        handleCompileCurrent();
      } else if (e.key === 'F6') {
        e.preventDefault();
        handleRunExecution();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [handleCompileCurrent, handleRunExecution]);

  // Tab Close Handler with Unsaved Changes Guard
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

  // Existing names for validation
  const existingProjectNames = useMemo(
    () => projects.map((p) => p.name),
    [projects]
  );

  const existingFileNamesInCurrentProject = useMemo(
    () => (currentProject ? currentProject.files.map((f) => f.name) : []),
    [currentProject]
  );

  // Error and warning lines for code editor gutter
  const errorLines = useMemo(
    () => diagnostics.filter((d) => d.severity === 'error').map((d) => d.line),
    [diagnostics]
  );

  const warningLines = useMemo(
    () => diagnostics.filter((d) => d.severity === 'warning').map((d) => d.line),
    [diagnostics]
  );

  return (
    <div className="flex flex-col h-screen w-screen bg-[var(--ide-bg,#02110c)] text-[var(--ide-text,#f5ede0)] overflow-hidden font-sans select-none transition-colors duration-250">
      {/* Top Application Window Bar */}
      <TopBar
        isRealBackend={isRealBackend}
        lumiState={lumiState}
        onCompile={handleCompileCurrent}
        onRun={handleRunExecution}
        isCompiling={isCompiling}
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
        onInsertRoomModal={() => setShowInsertRoomModal(true)}
        dirtyCount={dirtyCount}
        onExportLumic={handleExportLumic}
        onImportLumicFile={handleImportLumicFile}
      />
      <BackendModeNotice real={isRealBackend} refresh={isCompiling} />

      {/* Main IDE Body with Floating Modular Panels Layout */}
      <div className={`relative flex-1 grid ${isViewportMaximized ? 'grid-rows-[1fr]' : 'grid-rows-[1fr_235px] xl:grid-rows-[1fr_210px]'} gap-3 p-3 min-h-0 overflow-hidden bg-[var(--ide-bg,#02110c)] transition-colors duration-250`}>
        {/* Ambient atmospheric glow effects behind the glass panels (theme reactive) */}
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

        {/* Top Split: Project Explorer (Left) | Code Editor (Center) | 3D Viewport (Right) */}
        <div className="grid grid-cols-12 gap-3 min-h-0 h-full">
          {!isViewportMaximized && (
            <>
              {/* Left Panel: Project Explorer */}
              <div className="col-span-12 md:col-span-3 lg:col-span-2 xl:col-span-2 h-full min-h-0">
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
              </div>

              {/* Center Panel: Code Editor */}
              <div className="col-span-12 md:col-span-5 lg:col-span-5 xl:col-span-4 h-full min-h-0">
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
                  highlightedLine={highlightedLine}
                  errorLines={errorLines}
                  warningLines={warningLines}
                  breakpoints={breakpoints}
                  onToggleBreakpoint={toggleBreakpoint}
                />
              </div>
            </>
          )}

          {/* Right Panel: 3D Viewport */}
          <div className={`${isViewportMaximized ? 'col-span-12' : 'col-span-12 md:col-span-4 lg:col-span-5 xl:col-span-6'} h-full min-h-0`}>
            <ErrorBoundary fallbackTitle="Error al renderizar el visualizador 3D">
              <Viewport3D
                sceneGenerationUnavailable={isRealBackend}
                scenePlan={scenePlan}
                activeObjectId={activeObjectId}
                debugActiveObjectId={currentStep?.activeObjectId || null}
                onSelectObject={handleFocusObject}
                onNavigateToSource={handleNavigateToSource}
                onCompile={handleCompileCurrent}
                onInsertRoom={() => setShowInsertRoomModal(true)}
                hasCompileErrors={hasBlockingErrors}
                isCompiled={lastCompileResult !== null}
                isMaximized={isViewportMaximized}
                onToggleMaximize={() => setIsViewportMaximized((prev) => !prev)}
              />
            </ErrorBoundary>
          </div>
        </div>

        {/* Bottom Floating Panel: Console & Spatial Debugger & Lumi Assistant */}
        {!isViewportMaximized && (
          <div className="h-full min-h-0">
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
              onLumiClick={() => setShowDocsModal(true)}
              isStale={isStale}
              lastCompileResult={lastCompileResult}
            />
          </div>
        )}
      </div>

      {/* 1. Modal: Crear Proyecto */}
      <NewProjectModal
        isOpen={showNewProjectModal}
        onClose={() => setShowNewProjectModal(false)}
        onCreateProject={handleCreateProject}
        existingProjectNames={existingProjectNames}
      />

      {/* 2. Modal: Abrir / Gestionar Proyectos */}
      <OpenProjectModal
        isOpen={showOpenProjectModal}
        onClose={() => setShowOpenProjectModal(false)}
        projects={projects}
        currentProjectId={currentProjectId || ''}
        onSelectProject={handleSelectProject}
        onDeleteProject={handleDeleteProject}
        onNewProjectClick={() => setShowNewProjectModal(true)}
      />

      {/* 3. Modal: Nuevo Archivo .lumi */}
      <NewFileModal
        isOpen={showNewFileModal}
        onClose={() => setShowNewFileModal(false)}
        onCreateFile={handleCreateFile}
        existingFileNames={existingFileNamesInCurrentProject}
      />

      {/* 4. Modal: Renombrar Archivo */}
      <RenameFileModal
        isOpen={renameTargetFile !== null}
        onClose={() => setRenameTargetFile(null)}
        file={renameTargetFile}
        onRename={handleRenameFile}
        existingFileNames={existingFileNamesInCurrentProject}
      />

      {/* 5. Modal: Confirmar Eliminación de Archivo */}
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
      />

      {/* 6. Modal: Cambios sin guardar al cerrar pestaña */}
      <UnsavedChangesModal
        isOpen={unsavedTargetFile !== null}
        onClose={() => setUnsavedTargetFile(null)}
        file={unsavedTargetFile}
        onSaveAndClose={async (fileId) => {
          await handleSaveCurrentFile(fileId);
          handleForceCloseTab(fileId);
        }}
        onDiscardAndClose={(fileId) => {
          handleDiscardFileChanges(fileId);
          handleForceCloseTab(fileId);
        }}
      />

      {/* 7. Modal: Insertar Habitación */}
      <InsertRoomModal
        isOpen={showInsertRoomModal}
        onClose={() => setShowInsertRoomModal(false)}
        onInsertRoom={handleInsertRoomCode}
      />

      {/* 8. Modal: Manual y Documentación de Sintaxis Lumi */}
      <DocumentationModal
        isOpen={showDocsModal}
        onClose={() => setShowDocsModal(false)}
      />

      {/* 9. Modal: Configuración del IDE (Temas de color, fuentes, visor 3D) */}
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />
    </div>
  );
}

