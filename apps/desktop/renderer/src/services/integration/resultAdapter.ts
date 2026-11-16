import type { CompileResult, DiagnosticCategory, DiagnosticItem, LumiProject } from '../../types';
import type { ResultResponse, CoreDiagnostic } from './protocol/types';
import { relativePath } from './projectInput';

const categories: Record<CoreDiagnostic['category'], DiagnosticCategory> = {
  LEXICAL: 'lexico', SYNTACTIC: 'sintactico', SEMANTIC: 'semantico',
  IMPORT: 'importacion', RUNTIME: 'ejecucion', SPATIAL: 'espacial',
};

export function adaptBackendResult(response: ResultResponse, project: LumiProject, durationMs: number): CompileResult {
  const payload = response.result;
  const entry = project.files.find((file) => relativePath(file.path, project.name) === payload.entryFile);
  // The worker provides no severity. Classify a failed operation's diagnostics for the IDE.
  const blocking = response.status === 'failed' || response.status === 'blocked';
  const importSolutions: Record<string, string> = {
    IMPORT_FILE_NOT_FOUND: 'Revisá la ruta en importar y confirmá que el archivo exista en el proyecto.',
    IMPORT_SYMBOL_NOT_FOUND: 'Abrí el archivo importado y usá el nombre exacto de la función después de usar.',
    IMPORT_CIRCULAR_DEPENDENCY: 'Quita una importación del ciclo. Si ambos archivos necesitan la misma función, muévela a un tercer archivo.',
  };
  const diagnostics: DiagnosticItem[] = payload.diagnostics.map((diagnostic, index) => ({
    id: `${response.requestId}:${index}`, code: diagnostic.code,
    category: categories[diagnostic.category], severity: blocking ? 'error' : 'unspecified',
    blocking,
    file: diagnostic.file, line: diagnostic.line, column: diagnostic.column,
    description: diagnostic.description.replace('No se encontro el archivo importado', 'No se encontró el archivo importado'),
    ...(diagnostic.suggestion !== undefined ? { solution: importSolutions[diagnostic.code] ?? diagnostic.suggestion } : {}),
  }));
  const logs = [`[Python · ${response.operation === 'analyze' ? 'Análisis' : 'Ejecución'}] ${response.status}`, ...payload.output];
  if (response.operation === 'execute') logs.push(`[Python · Análisis] ${payload.analysisStatus}`);
  if (payload.lexicalError !== undefined) logs.push(`[Error léxico sin ubicación estructurada] ${payload.lexicalError}`);
  if (payload.limitations.length) logs.push('Capacidad pendiente: análisis semántico espacial.');
  for (const limitation of payload.limitations) logs.push(`Limitación del backend: ${limitation}`);
  return {
    compilationId: response.requestId, status: response.status, success: response.status === 'completed',
    diagnostics, scenePlan: payload.scenePlan ?? null,
    ...(payload.preferredRoomId !== undefined
      ? { preferredRoomId: payload.preferredRoomId }
      : {}),
    debugSteps: response.operation === 'execute' && payload.capabilities.debugTrace
      ? payload.debugSteps ?? [] : [],
    ...(payload.debugTraceUnavailableReason !== undefined
      ? { debugTraceUnavailableReason: payload.debugTraceUnavailableReason }
      : {}),
    durationMs, logs,
    entryFileInfo: {
      id: entry?.id ?? '',
      name: payload.entryFile.split('/').at(-1) ?? payload.entryFile, path: payload.entryFile,
    },
    timestamp: new Date().toISOString(), origin: 'python', operation: response.operation,
  };
}
