import { DebuggerStatus } from '../../types';

export interface DebuggerStatusInfo {
  label: string;
  badgeClass: string;
}

/**
 * Returns label and badge styling according to the current debugger status.
 */
export function getDebuggerStatusInfo(status?: DebuggerStatus): DebuggerStatusInfo {
  switch (status) {
    case 'running':
      return {
        label: 'Ejecutando',
        badgeClass:
          'bg-purple-500/20 text-purple-300 border border-purple-400/40 animate-pulse shadow-[0_0_8px_rgba(168,85,247,0.4)]',
      };
    case 'paused':
      return {
        label: 'Pausado',
        badgeClass: 'bg-amber-500/20 text-amber-300 border border-amber-400/40',
      };
    case 'finished':
      return {
        label: 'Completado',
        badgeClass: 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40',
      };
    case 'ready':
      return {
        label: 'Listo',
        badgeClass: 'glass-btn text-slate-400',
      };
    case 'idle':
    default:
      return {
        label: 'Inactivo',
        badgeClass: 'glass-btn text-slate-400',
      };
  }
}
