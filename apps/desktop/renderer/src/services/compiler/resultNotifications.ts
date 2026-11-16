import type { CompileResult, LumiState } from '../../types';
import { lumiAssistant } from '../assistant/LumiAssistantService';
import { ideLogger } from '../logger/IdeLogService';
import { triggerSparkles } from '../../utils/sparkles';

export function notifyCompileResult(result: CompileResult, setLumiState: (state: LumiState) => void): void {
  if (result.origin === 'python') {
    const state = result.status === 'completed' ? 'success' : result.status === 'incomplete' ? 'warning' : 'error';
    setLumiState(state);
    const message = result.status === 'completed'
      ? result.operation === 'analyze'
        ? 'Análisis sin errores. Usá Ejecutar Lumi (F6) para ejecutar el programa y ver la escena.'
        : result.scenePlan
          ? 'Ejecución completada. La escena está lista para el visor 3D.'
          : 'Ejecución completada. Este programa no generó una escena 3D.'
      : result.status === 'incomplete'
        ? 'Análisis sin errores detectados. Usá Ejecutar Lumi (F6) para comprobar el espacio y dibujar la escena.'
        : result.operation === 'analyze'
          ? 'El análisis encontró un problema. Revisá la consola y los diagnósticos.'
          : 'La ejecución de Lumi se detuvo. Revisá los diagnósticos o la salida para conocer el motivo.';
    const importError = result.diagnostics.find(diagnostic => diagnostic.blocking && diagnostic.category === 'importacion');
    if (importError) lumiAssistant.onDiagnosticFocused(importError);
    else lumiAssistant.setMessage(message, state);
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
