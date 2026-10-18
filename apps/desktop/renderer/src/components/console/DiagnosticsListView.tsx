import React, { useState, useMemo } from 'react';
import {
  DiagnosticItem,
  DiagnosticSeverity,
  DiagnosticCategory,
} from '../../types';
import {
  AlertCircle,
  AlertTriangle,
  Info,
  Filter,
  CheckCircle2,
  Sparkles,
  ExternalLink,
  Compass,
} from 'lucide-react';
import { filterDiagnostics, getDiagnosticObjectId } from './diagnosticUtils';

export interface DiagnosticsListViewProps {
  diagnostics: DiagnosticItem[];
  onNavigateToDiagnostic: (diag: DiagnosticItem) => void;
  onFocusObject?: (objectId: string) => void;
  initialSeverityFilter?: 'all' | DiagnosticSeverity;
  initialCategoryFilter?: 'all' | DiagnosticCategory;
}

export const DiagnosticsListView: React.FC<DiagnosticsListViewProps> = ({
  diagnostics,
  onNavigateToDiagnostic,
  onFocusObject,
  initialSeverityFilter = 'all',
  initialCategoryFilter = 'all',
}) => {
  const [severityFilter, setSeverityFilter] = useState<'all' | DiagnosticSeverity>(initialSeverityFilter);
  const [categoryFilter, setCategoryFilter] = useState<'all' | DiagnosticCategory>(initialCategoryFilter);

  const errorCount = useMemo(
    () => diagnostics.filter((d) => d.severity === 'error').length,
    [diagnostics]
  );
  const warningCount = useMemo(
    () => diagnostics.filter((d) => d.severity === 'warning').length,
    [diagnostics]
  );
  const infoCount = useMemo(
    () => diagnostics.filter((d) => d.severity === 'info').length,
    [diagnostics]
  );

  const filteredDiagnostics = useMemo(() => {
    return filterDiagnostics(diagnostics, {
      severity: severityFilter,
      category: categoryFilter,
    });
  }, [diagnostics, severityFilter, categoryFilter]);

  return (
    <div className="space-y-3 font-sans">
      <div className="flex flex-wrap items-center justify-between gap-2 p-2 glass-panel-header rounded-2xl text-xs select-none">
        <div className="flex items-center gap-1.5">
          <button
            id="filter-all-btn"
            onClick={() => setSeverityFilter('all')}
            className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all ${
              severityFilter === 'all'
                ? 'glass-btn bg-[var(--ide-accent)] text-[var(--ide-accent-text)] font-bold'
                : 'glass-tab-inactive'
            }`}
          >
            Todos ({diagnostics.length})
          </button>

          <button
            id="filter-error-btn"
            onClick={() => setSeverityFilter('error')}
            className={`px-3 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              severityFilter === 'error'
                ? 'glass-btn bg-rose-500/20 text-rose-500 dark:text-rose-200 border-rose-500/40 shadow-sm'
                : 'text-rose-500 dark:text-rose-400 hover:bg-rose-500/10'
            }`}
          >
            <AlertCircle className="w-3 h-3 text-rose-500" />
            <span>Errores ({errorCount})</span>
          </button>

          <button
            id="filter-warning-btn"
            onClick={() => setSeverityFilter('warning')}
            className={`px-3 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              severityFilter === 'warning'
                ? 'glass-btn bg-amber-500/20 text-amber-600 dark:text-amber-200 border-amber-500/40 shadow-sm'
                : 'text-amber-600 dark:text-amber-400 hover:bg-amber-500/10'
            }`}
          >
            <AlertTriangle className="w-3 h-3 text-amber-500" />
            <span>Advertencias ({warningCount})</span>
          </button>

          <button
            id="filter-info-btn"
            onClick={() => setSeverityFilter('info')}
            className={`px-3 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              severityFilter === 'info'
                ? 'glass-btn bg-[var(--ide-btn-bg)] text-[var(--ide-text)] border-[var(--ide-btn-border)] shadow-sm'
                : 'text-[var(--ide-text-muted)] hover:bg-[var(--ide-btn-bg)]'
            }`}
          >
            <Info className="w-3 h-3 text-[var(--ide-accent)]" />
            <span>Información ({infoCount})</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-[var(--ide-text-muted)]">
          <Filter className="w-3 h-3 text-[var(--ide-accent)]" />
          <span>Categoría:</span>
          <select
            id="filter-category-select"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as 'all' | DiagnosticCategory)}
            className="glass-btn text-[var(--ide-text)] bg-[var(--ide-dropdown-bg)] text-xs rounded-xl px-2.5 py-1 outline-none border border-[var(--ide-panel-border)] focus:border-[var(--ide-accent)] cursor-pointer"
          >
            <option value="all" className="bg-[var(--ide-dropdown-bg)] text-[var(--ide-text)]">Todas las categorías</option>
            <option value="lexico" className="bg-[var(--ide-dropdown-bg)] text-[var(--ide-text)]">Léxico</option>
            <option value="sintactico" className="bg-[var(--ide-dropdown-bg)] text-[var(--ide-text)]">Sintáctico</option>
            <option value="semantico" className="bg-[var(--ide-dropdown-bg)] text-[var(--ide-text)]">Semántico</option>
            <option value="importacion" className="bg-[var(--ide-dropdown-bg)] text-[var(--ide-text)]">Importación</option>
            <option value="espacial" className="bg-[var(--ide-dropdown-bg)] text-[var(--ide-text)]">Espacial</option>
            <option value="ejecucion" className="bg-[var(--ide-dropdown-bg)] text-[var(--ide-text)]">Ejecución</option>
          </select>
        </div>
      </div>

      {filteredDiagnostics.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 text-center text-[var(--ide-text-muted)] space-y-2">
          <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          <div className="text-sm font-semibold text-[var(--ide-text)]">
            No se encontraron diagnósticos para el filtro actual
          </div>
          <p className="text-xs text-[var(--ide-text-muted)] max-w-sm">
            {diagnostics.length === 0
              ? 'No hay diagnósticos estructurados para mostrar. Consulta la salida para conocer el resultado de la última operación.'
              : 'Prueba cambiando los filtros de severidad o categoría.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredDiagnostics.map((diag) => {
            const isError = diag.severity === 'error';
            const isWarning = diag.severity === 'warning';
            const objectId = getDiagnosticObjectId(diag);

            return (
              <div
                key={diag.id}
                onDoubleClick={() => onNavigateToDiagnostic(diag)}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer group shadow-lg ${
                  isError
                    ? 'glass-card bg-rose-950/20 border-rose-500/40 hover:border-rose-400/80 !w-auto !h-auto'
                    : isWarning
                    ? 'glass-card bg-amber-950/20 border-amber-500/40 hover:border-amber-400/80 !w-auto !h-auto'
                    : 'glass-card bg-[var(--ide-control-bg)] border-[var(--ide-panel-border)] hover:border-[var(--ide-accent)] !w-auto !h-auto'
                }`}
                title="Haz doble clic para abrir el archivo y resaltar la línea"
              >
                <div className="flex items-center justify-between text-xs pb-2 border-b border-[var(--ide-panel-border)]">
                  <div className="flex items-center gap-2">
                    {isError ? (
                      <span className="flex items-center gap-1 text-rose-300 font-bold drop-shadow-[0_0_6px_rgba(244,63,94,0.6)]">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                        <span>ERROR</span>
                      </span>
                    ) : isWarning ? (
                      <span className="flex items-center gap-1 text-amber-300 font-bold drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        <span>ADVERTENCIA</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[var(--ide-accent)] font-bold">
                        <Info className="w-3.5 h-3.5 text-[var(--ide-accent)]" />
                        <span>{diag.severity === 'unspecified' ? 'SIN SEVERIDAD PROPORCIONADA' : 'INFO'}</span>
                      </span>
                    )}

                    <span className="font-mono glass-btn text-[var(--ide-text)] px-2 py-0.5 rounded-lg text-[11px] font-bold border border-[var(--ide-panel-border)]">
                      {diag.code}
                    </span>

                    <span className="text-[10px] uppercase font-semibold text-[var(--ide-text-muted)] glass-btn px-2 py-0.5 rounded-full border border-[var(--ide-panel-border)]">
                      {diag.category}
                    </span>

                    {diag.blocking ? (
                      <span className="text-[9px] uppercase font-bold text-rose-200 bg-rose-500/30 border border-rose-400/50 px-2 py-0.5 rounded-full shadow-[0_0_8px_rgba(244,63,94,0.4)]">
                        Bloqueante
                      </span>
                    ) : diag.category === 'espacial' ? (
                      <span className="text-[9px] uppercase font-bold text-[var(--ide-accent)] bg-[var(--ide-accent-bg)] border border-[var(--ide-accent)]/40 px-2 py-0.5 rounded-full">
                        Diagnóstico espacial
                      </span>
                    ) : null}
                  </div>

                  <span className="font-mono text-[11px] text-[var(--ide-text)] glass-btn px-2 py-0.5 rounded-lg border border-[var(--ide-panel-border)]">
                    {diag.file}:{diag.line}:{diag.column}
                  </span>
                </div>

                <p className="text-[var(--ide-text)] text-xs pt-2.5 leading-relaxed">
                  {diag.description}
                </p>
                {diag.category === 'espacial' && (diag.targetRoomId || diag.roomId || objectId) && (
                  <p className="text-xs text-[var(--ide-text-muted)]">
                    {(diag.targetRoomId || diag.roomId) && `Habitación: ${diag.targetRoomId || diag.roomId}`}
                    {(diag.targetRoomId || diag.roomId) && objectId && ' · '}
                    {objectId && `Objeto: ${objectId}`}
                  </p>
                )}

                {diag.solution && (
                  <div className="mt-2.5 glass-card bg-[var(--ide-control-bg)] border border-[var(--ide-panel-border)] p-2.5 text-[11px] text-[var(--ide-text)] flex items-start gap-2 !w-auto !h-auto">
                    <Sparkles className="w-3.5 h-3.5 text-[var(--ide-accent)] flex-shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-[var(--ide-accent)] font-bold">Solución:</strong> {diag.solution}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2.5 text-xs">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigateToDiagnostic(diag);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-btn text-[var(--ide-text)] hover:text-white text-[11px] font-semibold border border-[var(--ide-panel-border)] hover:border-[var(--ide-accent)] transition-all shadow-sm"
                  >
                    <ExternalLink className="w-3 h-3 text-[var(--ide-accent)]" />
                    <span>Ir al código ({diag.file}:{diag.line})</span>
                  </button>

                  {objectId && onFocusObject && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onFocusObject(objectId);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-btn bg-[var(--ide-btn-bg)] text-[var(--ide-text)] hover:text-white text-[11px] font-semibold border border-[var(--ide-panel-border)] hover:border-[var(--ide-accent)] transition-all shadow-sm"
                    >
                      <Compass className="w-3 h-3 text-[var(--ide-accent)]" />
                      <span>Enfocar en 3D</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
