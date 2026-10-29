import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  IdeLogEvent, 
  IdeEventType, 
  CompileResult, 
  ScenePlan, 
  RoomModel 
} from '../../types';
import { Clock, Filter, Trash2 } from 'lucide-react';
import { getLogEventStyle, filterLogEvents, getCompileResultSummary, countPlacedObjects } from './outputLogUtils';

export interface OutputLogViewProps {
  /**
   * Centralized IDE log events stream.
   */
  events: IdeLogEvent[];
  /**
   * Internal compiler stdout lines.
   */
  logs?: string[];
  /**
   * Metadata of the latest compilation run.
   */
  lastCompileResult?: CompileResult | null;
  /**
   * Active scene plan.
   */
  scenePlan?: ScenePlan | null;
  legacyPlacement?: boolean;
  /**
   * Primary room plan override.
   */
  primaryRoom?: RoomModel | null;
  /**
   * Count of errors in current diagnostics.
   */
  errorCount?: number;
  /**
   * Count of warnings in current diagnostics.
   */
  warningCount?: number;
  /**
   * Callback invoked when user requests clearing logs.
   */
  onClear?: () => void;
  /**
   * Whether to show toolbar controls (filter and clear button). Defaults to true.
   */
  showControls?: boolean;
  /**
   * Controlled filter type.
   */
  filterType?: 'all' | IdeEventType;
  /**
   * Callback when filter type changes in controlled mode.
   */
  onFilterTypeChange?: (type: 'all' | IdeEventType) => void;
}

export const OutputLogView: React.FC<OutputLogViewProps> = ({
  events,
  logs = [],
  lastCompileResult = null,
  scenePlan = null,
  legacyPlacement = false,
  primaryRoom = null,
  errorCount = 0,
  warningCount = 0,
  onClear,
  showControls = true,
  filterType: controlledFilterType,
  onFilterTypeChange,
}) => {
  const [internalFilterType, setInternalFilterType] = useState<'all' | IdeEventType>('all');
  const autoScrollEndRef = useRef<HTMLDivElement>(null);
  const prevEventsLength = useRef(events.length);

  const activeFilterType = controlledFilterType ?? internalFilterType;

  const handleFilterChange = (newType: 'all' | IdeEventType) => {
    if (onFilterTypeChange) {
      onFilterTypeChange(newType);
    } else {
      setInternalFilterType(newType);
    }
  };

  const filteredEvents = useMemo(() => {
    return filterLogEvents(events, { type: activeFilterType });
  }, [events, activeFilterType]);

  const resolvedPrimaryRoom = primaryRoom || scenePlan?.rooms[0] || null;
  const placedCount = countPlacedObjects(resolvedPrimaryRoom?.objects ?? [], legacyPlacement);
  const resultSummary = lastCompileResult ? getCompileResultSummary(lastCompileResult) : null;

  useEffect(() => {
    if (events.length > prevEventsLength.current) {
      if (typeof autoScrollEndRef.current?.scrollIntoView === 'function') {
        autoScrollEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }
    prevEventsLength.current = events.length;
  }, [events.length]);

  return (
    <div className="space-y-2" data-testid="output-log-view">
      {showControls && (
        <div className="flex items-center justify-between text-xs pb-1 select-none border-b border-[var(--ide-panel-border)]/50">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[var(--ide-text-muted)] uppercase tracking-wider font-semibold">
              Eventos ({filteredEvents.length}):
            </span>
            <div className="flex items-center gap-1">
              <Filter className="w-3 h-3 text-[var(--ide-accent)]" />
              <select
                id="filter-output-level"
                aria-label="Filtrar eventos por nivel"
                value={activeFilterType}
                onChange={(e) => handleFilterChange(e.target.value as 'all' | IdeEventType)}
                className="glass-btn text-[var(--ide-text)] bg-[var(--ide-dropdown-bg)] text-[11px] rounded-lg px-2 py-0.5 outline-none border border-[var(--ide-panel-border)] focus:border-[var(--ide-accent)] cursor-pointer"
              >
                <option value="all" className="bg-[var(--ide-dropdown-bg)] text-[var(--ide-text)]">Todos</option>
                <option value="info" className="bg-[var(--ide-dropdown-bg)] text-[var(--ide-text)]">Info</option>
                <option value="compile" className="bg-[var(--ide-dropdown-bg)] text-[var(--ide-text)]">Compilar</option>
                <option value="run" className="bg-[var(--ide-dropdown-bg)] text-[var(--ide-text)]">Ejecutar</option>
                <option value="success" className="bg-[var(--ide-dropdown-bg)] text-[var(--ide-text)]">Éxito</option>
                <option value="warning" className="bg-[var(--ide-dropdown-bg)] text-[var(--ide-text)]">Advertencias</option>
                <option value="error" className="bg-[var(--ide-dropdown-bg)] text-[var(--ide-text)]">Errores</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {onClear && (
              <button
                id="btn-clear-output"
                onClick={onClear}
                className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] glass-btn text-[var(--ide-text-muted)] hover:text-rose-400 hover:border-rose-400/40 transition-colors"
                title="Limpiar registros de salida"
                aria-label="Limpiar registros"
              >
                <Trash2 className="w-3 h-3" />
                <span>Limpiar</span>
              </button>
            )}
          </div>
        </div>
      )}

      {lastCompileResult && (
        <div className="glass-card p-3 space-y-1.5 font-sans text-xs border border-[var(--ide-panel-border)] !w-auto !h-auto">
          <div className="flex items-center justify-between text-[11px] text-[var(--ide-text-muted)]">
            <span className="font-mono text-[var(--ide-accent)] font-semibold">
              ID: #{lastCompileResult.compilationId}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-[var(--ide-text-muted)]" />
              {lastCompileResult.durationMs}ms
            </span>
          </div>
          <div className="flex items-center gap-4 pt-1 text-[var(--ide-text-muted)]">
            <div>
              Estado:{' '}
              <strong
                className={
                  resultSummary?.tone === 'error'
                    ? 'text-rose-400 font-bold'
                    : resultSummary?.tone === 'warning'
                    ? 'text-amber-400 font-bold'
                    : 'text-emerald-400 font-bold'
                }
              >
                {resultSummary?.label}
              </strong>
            </div>
            {lastCompileResult.origin === 'python' ? (
              <div>
                Diagnósticos: <span className="text-[var(--ide-text)] font-bold">{lastCompileResult.diagnostics.length}</span>
              </div>
            ) : (
              <>
                <div>
                  Errores: <span className="text-rose-400 font-bold">{errorCount}</span>
                </div>
                <div>
                  Advertencias: <span className="text-amber-400 font-bold">{warningCount}</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="space-y-1 pt-1" data-testid="event-logs-stream">
        {filteredEvents.length === 0 ? (
          <div className="text-[11px] text-[var(--ide-text-muted)] italic py-2 px-1">
            No hay registros de eventos para mostrar.
          </div>
        ) : (
          filteredEvents.map((evt) => (
            <div
              key={evt.id}
              className={`flex items-start gap-2 px-2.5 py-1 rounded text-[11px] font-mono leading-relaxed transition-colors ${getLogEventStyle(
                evt.type
              )}`}
              data-testid={`log-event-${evt.type}`}
            >
              <span className="text-[var(--ide-text-muted)] text-[10px] select-none flex-shrink-0">
                [{evt.timestamp}]
              </span>
              {evt.source && (
                <span className="text-[var(--ide-accent)] font-bold text-[10px] flex-shrink-0">
                  [{evt.source}]
                </span>
              )}
              <span className="flex-1 break-words">{evt.message}</span>
            </div>
          ))
        )}
      </div>

      {logs.length > 0 && (
        <div className="pt-2 border-t border-[var(--ide-panel-border)] space-y-1" data-testid="stdout-logs-stream">
          <div className="text-[10px] text-[var(--ide-text-muted)] uppercase tracking-wider font-semibold">
            Salida estándar de ejecución Lumi (stdout):
          </div>
          {logs.map((log, idx) => (
            <div
              key={idx}
              className="text-[var(--ide-text)] bg-[var(--ide-control-bg)] px-2.5 py-1 rounded border-l-2 border-[var(--ide-accent)]"
            >
              {log}
            </div>
          ))}
        </div>
      )}

      {resolvedPrimaryRoom && (
        <div className="mt-2 pt-2 border-t border-[var(--ide-panel-border)] text-[var(--ide-text-muted)] space-y-1 font-sans text-xs">
          <div>
            Habitación principal:{' '}
            <strong className="text-[var(--ide-accent)]">
              {resolvedPrimaryRoom.name} ({resolvedPrimaryRoom.dimensions[0]}m × {resolvedPrimaryRoom.dimensions[1]}m × {resolvedPrimaryRoom.dimensions[2]}m)
            </strong>
          </div>
          <div>
            Muros: <span className="text-[var(--ide-text-muted)]">Norte ({resolvedPrimaryRoom.walls.north.color}), Sur ({resolvedPrimaryRoom.walls.south.color})</span> | Piso: <span className="text-[var(--ide-text-muted)]">{resolvedPrimaryRoom.floor.material}</span>
          </div>
          <div>
            Entidades colocadas:{' '}
            <span className="text-[var(--ide-text)] font-semibold font-mono">
              {placedCount} {placedCount === 1 ? 'objeto' : 'objetos'}
            </span>
          </div>
        </div>
      )}

      <div ref={autoScrollEndRef} />
    </div>
  );
};
