import type { CompileResult, LumiState } from '../../types';
import { lumiAssistant } from '../assistant/LumiAssistantService';
import { ideLogger } from '../logger/IdeLogService';
import { triggerSparkles } from '../../utils/sparkles';

export function notifyCompileResult(result: CompileResult, setLumiState: (state: LumiState) => void): void {
  if (result.origin === 'python') {
    const state = result.status === 'completed' ? 'success' : result.status === 'incomplete' ? 'warning' : 'error';
    setLumiState(state);
    lumiAssistant.setMessage(result.status === 'completed'
      ? result.scenePlan
        ? 'Python terminó correctamente. ScenePlan recibido; las trazas todavía no están disponibles.'
        : 'Python terminó correctamente. Esta respuesta no contiene ScenePlan ni trazas.'
      : result.status === 'incomplete' ? 'El análisis espacial todavía está incompleto.'
      : 'Python encontró un problema. Revisa la consola y los diagnósticos.', state);
    return;
  }
  const blockingErrors = result.diagnostics.filter((d) => d.blocking === true);
  const spatialErrors = result.diagnostics.filter((d) => d.category === 'espacial' && d.severity === 'error');
  const spatialWarnings = result.diagnostics.filter((d) => d.category === 'espacial' && d.severity === 'warning');
  const totalSpatialIssues = spatialErrors.length + spatialWarnings.length;
  const totalErrors = result.diagnostics.filter((d) => d.severity === 'error').length;
  const totalWarnings = result.diagnostics.filter((d) => d.severity === 'warning').length;

  ideLogger.logCompilationFinished(
    result.compilationId,
    result.durationMs,
    totalErrors,
    totalWarnings,
    result.success,
    blockingErrors.length
  );

  if (!result.success || blockingErrors.length > 0) {
    setLumiState('error');
    const firstBlocking = blockingErrors[0] || result.diagnostics.find((d) => d.severity === 'error');
    lumiAssistant.onCompileBlockingError(firstBlocking);
  } else if (result.status === 'completed_with_spatial_issues' || totalSpatialIssues > 0) {
    setLumiState(spatialErrors.length > 0 ? 'error' : 'warning');
    lumiAssistant.onCompileCompletedWithSpatialIssues(spatialErrors.length, spatialWarnings.length, totalSpatialIssues);
  } else if (totalWarnings > 0) {
    setLumiState('warning');
    lumiAssistant.onCompileWarning(totalWarnings);
  } else {
    setLumiState('success');
    triggerSparkles();
    const totalObjs = result.scenePlan?.rooms.reduce((acc, r) => acc + r.objects.length, 0) || 0;
    lumiAssistant.onCompileSuccess(result.scenePlan?.rooms.length || 0, totalObjs);
  }
}
