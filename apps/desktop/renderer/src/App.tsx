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
import { RenameProjectModal } from './components/modals/RenameProjectModal';
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
import { findSourceFile } from './services/editor/sourceNavigation';

export default function App() {
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
    handleForceCloseTab,
    handleDiscardAndCloseTab,
    storageError, clearStorageError, chooseProjectLocation,
    handleOpenProject, handleRenameProject, handleSaveAs,
    legacyProjects, handleImportLocalProject,
    isDiskStorage,
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
  const [isViewportMaximized, setIsViewportMaximized] = useState(false);


  const activeFileName = useMemo(() => {
    return currentProject?.files.find((f) => f.id === activeFileId)?.name || '';
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
  } = useEditorState(activeFileName, currentProjectId ?? '');

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
    (step: DebugStep) => {
      setHighlightedLine(step.sourceRef?.line || step.lineNumber);
      setScenePlan(step.sceneSnapshot);
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

  return (
    <div className="flex flex-col h-screen w-screen bg-[var(--ide-bg,#02110c)] text-[var(--ide-text,#f5ede0)] overflow-hidden font-sans select-none transition-colors duration-250">
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
        onSaveAs={handleSaveAs}
        onRenameProject={handleRenameProject && currentProject ? () => setShowRenameProjectModal(true) : undefined}
        onInsertRoomModal={() => setShowInsertRoomModal(true)}
        dirtyCount={dirtyCount}
        onExportLumic={handleExportLumic}
        onImportLumicFile={handleImportLumicFile}
      />
      <BackendModeNotice real={isRealBackend} refresh={isCompiling} />
      {storageError && <div role="alert" className="bg-rose-950 text-rose-100 px-4 py-2 text-sm z-[60]">
        {storageError} <button onClick={clearStorageError} className="underline ml-3">Cerrar aviso</button>
      </div>}
      {currentProject && !entryFile && <div role="status" className="px-4 py-2 text-xs text-amber-200">
        Selecciona el archivo principal desde el explorador antes de compilar. Esta selección se guarda en esta computadora.
      </div>}

      <div className={`relative flex-1 grid ${isViewportMaximized ? 'grid-rows-[1fr]' : 'grid-rows-[1fr_235px] xl:grid-rows-[1fr_210px]'} gap-3 p-3 min-h-0 overflow-hidden bg-[var(--ide-bg,#02110c)] transition-colors duration-250`}>
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

        <div className="grid grid-cols-12 gap-3 min-h-0 h-full">
          {!isViewportMaximized && (
            <>
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
                  highlightedLine={sourceNavigation && sourceNavigation.fileId !== activeFileId ? null : highlightedLine}
                  sourceNavigation={sourceNavigation}
                  errorLines={errorLines}
                  warningLines={warningLines}
                  breakpoints={breakpoints}
                  onToggleBreakpoint={toggleBreakpoint}
                />
              </div>
            </>
          )}

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

