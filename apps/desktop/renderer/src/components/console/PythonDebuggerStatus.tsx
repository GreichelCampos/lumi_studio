import type { CompileResult, DiagnosticItem } from '../../types';
import { getCompileResultSummary } from './outputLogUtils';
import { ExternalLink } from 'lucide-react';

interface Props {
  result: CompileResult;
  onNavigateToDiagnostic?: (diagnostic: DiagnosticItem) => void;
}

export function PythonDebuggerStatus({ result, onNavigateToDiagnostic }: Props) {
  const runtimeDiagnostics = result.diagnostics.filter(diagnostic => diagnostic.category === 'ejecucion');
  const hasTrace = result.debugSteps.length > 0;
  const unavailableMessages: Record<string, string> = {
    execution_failed: 'La ejecución falló antes de producir una traza espacial completa.',
    execution_not_attempted: 'La ejecución no se inició, por lo que no hay una traza espacial.',
    step_limit_exceeded: 'La ejecución terminó, pero la traza superó el límite de pasos y no se publicó parcialmente.',
    response_size_exceeded: 'La ejecución terminó, pero la traza excedía el tamaño seguro de respuesta.',
  };
  const unavailableMessage = result.debugTraceUnavailableReason
    ? unavailableMessages[result.debugTraceUnavailableReason] ?? `La traza espacial no está disponible: ${result.debugTraceUnavailableReason}.`
    : null;
  return (
    <section className="glass-card p-3 space-y-2 text-xs" aria-label="Estado del depurador Python">
      <h3 className="font-semibold">{getCompileResultSummary(result).label}</h3>
      <p>{hasTrace
        ? `Python publicó ${result.debugSteps.length} pasos espaciales reales. Los controles reproducen sus snapshots en el visor.`
        : unavailableMessage ?? 'Esta ejecución no contiene pasos espaciales para reproducir.'}</p>
      <p>{result.scenePlan ? 'El visor muestra el ScenePlan final recibido de Python.' : 'Esta respuesta no contiene un ScenePlan.'}</p>
      {runtimeDiagnostics.map(diagnostic => (
        <div key={diagnostic.id} className="border-l-2 border-rose-400 pl-2">
          <p>{diagnostic.code}: {diagnostic.description}</p>
          {onNavigateToDiagnostic && (
            <button className="underline inline-flex items-center gap-1.5" onClick={() => onNavigateToDiagnostic(diagnostic)}>
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              Ver diagnóstico en {diagnostic.file}:{diagnostic.line}
            </button>
          )}
        </div>
      ))}
    </section>
  );
}
