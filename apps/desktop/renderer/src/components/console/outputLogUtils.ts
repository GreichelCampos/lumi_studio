import { CompileResult, IdeEventType, IdeLogEvent, SpatialObject } from '../../types';

export function countPlacedObjects(objects: SpatialObject[], legacyPlacement = false): number {
  return objects.filter(object => {
    const position = object.position;
    return Array.isArray(position) && position.length === 3 && position.every(Number.isFinite)
      && (legacyPlacement || object.placed === undefined || object.placed === true);
  }).length;
}

export function getCompileResultSummary(result: CompileResult): { label: string; tone: 'error' | 'warning' | 'success' } {
  const tone = result.status === 'failed' || result.status === 'blocked' ? 'error'
    : result.status === 'incomplete' || result.status === 'completed_with_spatial_issues' ? 'warning' : 'success';
  if (result.origin === 'python') {
    const execution = result.operation === 'execute';
    const labels = {
      completed: execution ? 'Ejecución terminada' : 'Análisis terminado',
      incomplete: execution ? 'Ejecución incompleta' : 'Análisis incompleto',
      failed: execution ? 'Ejecución fallida' : 'Análisis fallido',
      blocked: execution ? 'Ejecución bloqueada' : 'Análisis bloqueado',
      completed_with_spatial_issues: 'Resultado Python con incidencias',
    };
    return { label: labels[result.status], tone };
  }
  const labels = {
    blocked: 'Compilación bloqueada', failed: 'Compilación fallida', incomplete: 'Compilación incompleta',
    completed_with_spatial_issues: 'Válido para 3D (con problemas espaciales)', completed: 'Válido para 3D',
  };
  return { label: labels[result.status], tone };
}

export interface LogFilterOptions {
  type?: 'all' | IdeEventType;
  source?: string;
  search?: string;
}

/**
 * Returns Tailwind CSS classes for styling a log event entry based on its type.
 */
export function getLogEventStyle(type: IdeEventType): string {
  switch (type) {
    case 'error':
      return 'bg-rose-500/15 border-l-2 border-rose-500 text-rose-600 dark:text-rose-200';
    case 'warning':
      return 'bg-amber-500/15 border-l-2 border-amber-500 text-amber-600 dark:text-amber-200';
    case 'success':
      return 'bg-emerald-500/15 border-l-2 border-emerald-500 text-emerald-600 dark:text-emerald-200';
    case 'compile':
      return 'bg-[var(--ide-btn-bg)] border-l-2 border-[var(--ide-accent)] text-[var(--ide-text)]';
    case 'run':
      return 'bg-[var(--ide-accent-bg)] border-l-2 border-[var(--ide-accent)] text-[var(--ide-text)]';
    case 'info':
    default:
      return 'bg-[var(--ide-control-bg)] border-l-2 border-[var(--ide-panel-border)] text-[var(--ide-text-muted)]';
  }
}

/**
 * Formats a timestamp into a standardized string representation.
 */
export function formatLogTimestamp(timestamp: string | Date): string {
  if (timestamp instanceof Date) {
    return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
  return timestamp;
}

/**
 * Filters log events by type/level, source, and search query.
 */
export function filterLogEvents(
  events: IdeLogEvent[],
  options?: LogFilterOptions
): IdeLogEvent[] {
  if (!options) return events;
  const { type = 'all', source = 'all', search = '' } = options;
  const normalizedSearch = search.trim().toLowerCase();

  return events.filter((evt) => {
    if (type !== 'all' && evt.type !== type) return false;
    if (source !== 'all' && evt.source !== source) return false;
    if (normalizedSearch && !evt.message.toLowerCase().includes(normalizedSearch)) return false;
    return true;
  });
}
