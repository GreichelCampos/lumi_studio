import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { LumiProject, ScenePlan, DiagnosticItem, DebugStep, LumiState, CompileResult, LumiCompiledArtifact } from '../types';
import { CompilerService } from '../services/compiler/CompilerService';
import { defaultCompiler } from '../services/integration/compilerSelection';
import { notifyCompileResult } from '../services/compiler/resultNotifications';
import {
  validateCompileResult,
  createSafeFallbackCompileResult,
} from '../services/compiler/contracts/contractValidator';
import { ideLogger } from '../services/logger/IdeLogService';
import { lumiAssistant } from '../services/assistant/LumiAssistantService';

export interface UseCompilerOptions {
  customCompilerService?: CompilerService;
  contextKey?: string;
  scopeKey?: string;
}

export function useCompiler(options?: UseCompilerOptions) {
  const compilerService = useMemo(
    () => options?.customCompilerService || defaultCompiler(),
    [options?.customCompilerService]
  );

  const [lumiState, setLumiState] = useState<LumiState>('ready');
  const [isCompiling, setIsCompiling] = useState(false);
  const [lastCompileResult, setLastCompileResult] = useState<CompileResult | null>(null);
  const [scenePlan, setScenePlan] = useState<ScenePlan | null>(null);
  const [sceneSource, setSceneSource] = useState<'simulation' | 'artifact' | 'python' | null>(null);
  const [diagnostics, setDiagnostics] = useState<DiagnosticItem[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [debugSteps, setDebugSteps] = useState<DebugStep[]>([]);
  const [lastCompiledRevision, setLastCompiledRevision] = useState<number | null>(null);

  // Evitar condiciones de carrera en compilaciones asíncronas consecutivas
  const latestCompilationRequestIdRef = useRef<number>(0);

  const contextRef = useRef(options?.contextKey);
  contextRef.current = options?.contextKey;
  useEffect(() => {
    latestCompilationRequestIdRef.current++;
    setIsCompiling(false);
  }, [options?.contextKey]);
  useEffect(() => {
    setLastCompileResult(null); setScenePlan(null); setDiagnostics([]);
    setSceneSource(null);
    setLogs([]); setDebugSteps([]); setLastCompiledRevision(null);
  }, [options?.scopeKey]);

  const runOperation = useCallback(
    async (project: LumiProject, activeFileId?: string, projectRevision?: number, operation: 'analyze' | 'execute' = 'analyze'): Promise<CompileResult | null> => {
      const requestId = ++latestCompilationRequestIdRef.current;
      const context = contextRef.current;
      setIsCompiling(true);
      setLumiState('compiling');
      lumiAssistant.onCompiling();
      setDiagnostics([]);

      const targetEntry =
        project.files.find((f) => f.id === activeFileId)?.name ||
        project.files.find((f) => f.isEntry)?.name ||
        project.files[0]?.name ||
        'desconocido';

      try {
        const rawResult = operation === 'analyze'
          ? await compilerService.compile(project, { activeFileId })
          : await compilerService.execute?.(project);
        if (!rawResult) throw new Error('El servicio no admite ejecución real.');

        // Si se inició una compilación más reciente o se cargó un artefacto, descartar este resultado
        if (requestId !== latestCompilationRequestIdRef.current || context !== contextRef.current) {
          return null;
        }

        // Capa de validación de contrato para resiliencia ante datos externos
        const validation = validateCompileResult(rawResult);
        if (compilerService.mode === 'python' && !validation.isValid) {
          throw new Error('El resultado Python no cumple el contrato de presentación.');
        }
        const result: CompileResult = validation.isValid
          ? (validation.data || rawResult)
          : createSafeFallbackCompileResult(rawResult, validation.errors, rawResult?.compilationId);

        if (!validation.isValid) {
          ideLogger.log(
            'error',
            `Se detectaron ${validation.errors.length} violaciones de contrato en la respuesta del compilador.`,
            undefined,
            'Contratos'
          );
        }

        ideLogger.logCompilationStarted(result.compilationId, result.entryFileInfo?.name || targetEntry);

        setLastCompileResult(result);
        setScenePlan(result.scenePlan);
        setSceneSource(result.scenePlan ? compilerService.mode === 'python' ? 'python' : 'simulation' : null);
        setDiagnostics(result.diagnostics);
        setLogs(result.logs);
        setDebugSteps(result.debugSteps);
        if (projectRevision !== undefined) {
          setLastCompiledRevision(projectRevision);
        }

        notifyCompileResult(result, setLumiState);

        return result;
      } catch (err) {
        if (requestId !== latestCompilationRequestIdRef.current || context !== contextRef.current) return null;
        setLumiState('error');
        setLastCompileResult(null);
        setScenePlan(null);
        setSceneSource(null);
        setDebugSteps([]);
        setDiagnostics([]);
        const message = `[Infraestructura] ${err instanceof Error ? err.message : String(err)}`;
        setLogs([message]);
        lumiAssistant.setMessage('El backend no pudo completar la operación. Revisa la consola.', 'error');
        ideLogger.log('error', message, undefined, 'Backend');
        return null;
      } finally {
        if (requestId === latestCompilationRequestIdRef.current) {
          setIsCompiling(false);
        }
      }
    },
    [compilerService]
  );

  const runCompile = useCallback(
    (project: LumiProject, activeFileId?: string, revision?: number) => runOperation(project, activeFileId, revision),
    [runOperation]
  );
  const runExecute = useCallback(
    (project: LumiProject, revision?: number) => runOperation(project, undefined, revision, 'execute'),
    [runOperation]
  );

  const clearDiagnostics = useCallback(() => {
    setDiagnostics([]);
  }, []);

  const loadCompiledArtifact = useCallback((artifact: LumiCompiledArtifact) => {
    setSceneSource('artifact');
    // Invalidar cualquier compilación en vuelo previa
    latestCompilationRequestIdRef.current++;
    setIsCompiling(false);

    setScenePlan(artifact.scenePlan);
    if (artifact.debugSteps && artifact.debugSteps.length > 0) {
      setDebugSteps(artifact.debugSteps);
    } else {
      setDebugSteps([]);
    }

    const hasErrors = artifact.diagnosticsSummary?.hasBlockingErrors || false;
    const totalObjs = artifact.scenePlan.rooms.reduce((acc, r) => acc + r.objects.length, 0);

    const syntheticResult: CompileResult = {
      compilationId: `artifact-${artifact.project?.id || 'imported'}-${Date.now().toString(36)}`,
      status: hasErrors ? 'blocked' : 'completed',
      success: !hasErrors,
      diagnostics: [],
      scenePlan: artifact.scenePlan,
      entryFileInfo: {
        id: 'artifact-entry',
        name: artifact.project?.entryFile || 'artefacto.lumic',
        path: artifact.project?.entryFile || 'artefacto.lumic',
      },
      durationMs: 0,
      logs: [
        `[Artefacto .lumic] Cargado: "${artifact.project?.name || 'Escena'}" (esquema v${artifact.schemaVersion})`,
        `Compilador: ${artifact.compiler?.name} v${artifact.compiler?.version} (Target: ${artifact.compiler?.target})`,
        `Fecha de compilación: ${artifact.compiledAt}`,
        `Estructura: ${artifact.scenePlan.rooms.length} habitación(es), ${totalObjs} objeto(s) 3D`,
        artifact.debugSteps && artifact.debugSteps.length > 0
          ? `Depurador espacial: ${artifact.debugSteps.length} pasos secuenciales restaurados.`
          : 'Depurador espacial: sin pasos secuenciales embebidos.',
      ],
      debugSteps: artifact.debugSteps || [],
      timestamp: artifact.compiledAt || new Date().toISOString(),
    };

    setLastCompileResult(syntheticResult);
    setLogs(syntheticResult.logs);
    setDiagnostics([]);
    setLumiState(hasErrors ? 'error' : 'success');

    ideLogger.log(
      'info',
      `Artefacto .lumic "${artifact.project?.name || 'importado'}" cargado en el visor 3D (${artifact.scenePlan.rooms.length} hab., ${totalObjs} obj.).`,
      undefined,
      'Artefacto .lumic'
    );
  }, []);

  return {
    lumiState,
    setLumiState,
    isCompiling,
    lastCompileResult,
    scenePlan,
    sceneSource,
    setScenePlan,
    diagnostics,
    logs,
    debugSteps,
    lastCompiledRevision,
    runCompile,
    runExecute,
    isRealBackend: compilerService.mode === 'python',
    clearDiagnostics,
    loadCompiledArtifact,
  };
}

