import { describe, it, expect } from 'vitest';
import { getDebuggerStatusInfo } from '../../../components/console/debuggerUtils';
import { DebuggerStatus } from '../../../types';

describe('debuggerUtils', () => {
  describe('getDebuggerStatusInfo', () => {
    it('retorna la información correcta para el estado "running"', () => {
      const info = getDebuggerStatusInfo('running');
      expect(info.label).toBe('Reproduciendo');
      expect(info.badgeClass).toContain('bg-purple-500/20');
      expect(info.badgeClass).toContain('animate-pulse');
    });

    it('retorna la información correcta para el estado "paused"', () => {
      const info = getDebuggerStatusInfo('paused');
      expect(info.label).toBe('Pausado');
      expect(info.badgeClass).toContain('bg-amber-500/20');
    });

    it('retorna la información correcta para el estado "finished"', () => {
      const info = getDebuggerStatusInfo('finished');
      expect(info.label).toBe('Completado');
      expect(info.badgeClass).toContain('bg-emerald-500/20');
    });

    it('retorna la información correcta para el estado "ready"', () => {
      const info = getDebuggerStatusInfo('ready');
      expect(info.label).toBe('Listo');
      expect(info.badgeClass).toContain('glass-btn');
    });

    it('retorna la información correcta para el estado "idle"', () => {
      const info = getDebuggerStatusInfo('idle');
      expect(info.label).toBe('Inactivo');
      expect(info.badgeClass).toContain('glass-btn');
    });

    it('retorna valor por defecto para cualquier otro valor no tipado', () => {
      const info = getDebuggerStatusInfo('desconocido' as unknown as DebuggerStatus);
      expect(info.label).toBe('Inactivo');
    });
  });
});
