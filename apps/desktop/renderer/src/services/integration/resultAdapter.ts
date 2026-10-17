import type { CompileResult, DiagnosticCategory, DiagnosticItem, LumiProject } from '../../types';
import type { ResultResponse, CoreDiagnostic } from './protocol/types';

const categories: Record<CoreDiagnostic['category'], DiagnosticCategory> = {
  LEXICAL: 'lexico', SYNTACTIC: 'sintactico', SEMANTIC: 'semantico',
  IMPORT: 'importacion', RUNTIME: 'ejecucion', SPATIAL: 'espacial',
};

export function adaptBackendResult(response: ResultResponse, project: LumiProject, durationMs: number): CompileResult {
  const payload = response.result;
  const diagnostics: DiagnosticItem[] = payload.diagnostics.map((diagnostic, index) => ({
    id: `${response.requestId}:${index}`, code: diagnostic.code,
    category: categories[diagnostic.category], severity: 'unspecified',
    // This UI flag reflects the failed operation, not an invented language severity.
    blocking: response.status === 'failed' || response.status === 'blocked',
    file: diagnostic.file, line: diagnostic.line, column: diagnostic.column,
    description: diagnostic.description,
    ...(diagnostic.suggestion !== undefined ? { solution: diagnostic.suggestion } : {}),
  }));
  const logs = [`[Python · ${response.operation === 'analyze' ? 'Análisis' : 'Ejecución'}] ${response.status}`, ...payload.output];
  if (payload.lexicalError !== undefined) logs.push(`[Error léxico sin ubicación estructurada] ${payload.lexicalError}`);
  if (payload.limitations.length) logs.push('Capacidad pendiente: análisis semántico espacial. No se generó ScenePlan ni trazas.');
  return {
    compilationId: response.requestId, status: response.status, success: response.status === 'completed',
    diagnostics, scenePlan: payload.scenePlan ?? null, debugSteps: [], durationMs, logs,
    entryFileInfo: {
      id: project.entryFileId ?? project.files.find((file) => file.isEntry)?.id ?? '',
      name: payload.entryFile.split('/').at(-1) ?? payload.entryFile, path: payload.entryFile,
    },
    timestamp: new Date().toISOString(), origin: 'python', operation: response.operation,
  };
}
