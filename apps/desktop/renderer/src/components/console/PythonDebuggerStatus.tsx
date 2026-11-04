import type { CompileResult, DiagnosticItem } from '../../types';
import { getCompileResultSummary } from './outputLogUtils';

interface Props {
  result: CompileResult;
  onNavigateToDiagnostic?: (diagnostic: DiagnosticItem) => void;
}

export function PythonDebuggerStatus({ result, onNavigateToDiagnostic }: Props) {
  const runtimeDiagnostics = result.diagnostics.filter(diagnostic => diagnostic.category === 'ejecucion');
  return (
    <section className="glass-card p-3 space-y-2 text-xs" aria-label="Estado del depurador Python">
      <h3 className="font-semibold">{getCompileResultSummary(result).label}</h3>
      <p>Python todavía no publica pasos, variables ni pila de llamadas. Los puntos de interrupción del editor solo detienen la reproducción de pasos importados o de demostración.</p>
      <p>{result.scenePlan ? 'El visor muestra el ScenePlan final recibido de Python.' : 'Esta respuesta no contiene un ScenePlan.'}</p>
      {runtimeDiagnostics.map(diagnostic => (
        <div key={diagnostic.id} className="border-l-2 border-rose-400 pl-2">
          <p>{diagnostic.code}: {diagnostic.description}</p>
          {onNavigateToDiagnostic && (
            <button className="underline" onClick={() => onNavigateToDiagnostic(diagnostic)}>
              Ver diagnóstico en {diagnostic.file}:{diagnostic.line}
            </button>
          )}
        </div>
      ))}
    </section>
  );
}
